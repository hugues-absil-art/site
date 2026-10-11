/**
 * Conversion HTML (zone principale) → blocs Portable Text Sanity (texte, liens, images).
 * Utilisé par l’import « À classer » (crawl / migrate-from-website).
 */
import * as cheerio from "cheerio";
import crypto from "node:crypto";
import { resolveUrl } from "./websiteUtils.js";

function blockKey() {
  return crypto.randomBytes(8).toString("hex");
}

const SKIP_TAGS = new Set([
  "script",
  "style",
  "nav",
  "footer",
  "iframe",
  "noscript",
  "svg",
  "form",
  "button",
  "input",
]);

/**
 * @param {import("cheerio").CheerioAPI} $
 * @param {cheerio.Element} el
 * @param {string} pageUrl
 * @param {Array<{_type:string,_key:string,href?:string}>} markDefs
 * @returns {Array<{_type:'span',_key:string,text:string,marks:string[]}>}
 */
function inlineSpans($, el, pageUrl, markDefs) {
  const spans = [];

  function walkNode(node, marks) {
    if (!node) return;
    if (node.type === "text") {
      const text = node.data ?? "";
      if (text) {
        spans.push({ _type: "span", _key: blockKey(), text, marks: [...marks] });
      }
      return;
    }
    if (node.type !== "tag") return;
    const name = (node.name || "").toLowerCase();
    if (name === "br") {
      spans.push({ _type: "span", _key: blockKey(), text: "\n", marks: [...marks] });
      return;
    }
    if (name === "a") {
      const href = $(node).attr("href");
      const abs = resolveUrl(pageUrl, href || "");
      if (abs && /^https?:\/\//i.test(abs)) {
        const lk = `lk-${blockKey()}`;
        markDefs.push({ _type: "link", _key: lk, href: abs });
        $(node)
          .contents()
          .each((_, c) => walkNode(c, [...marks, lk]));
      } else {
        $(node)
          .contents()
          .each((_, c) => walkNode(c, marks));
      }
      return;
    }
    if (name === "strong" || name === "b") {
      $(node)
        .contents()
        .each((_, c) => walkNode(c, [...marks, "strong"]));
      return;
    }
    if (name === "em" || name === "i") {
      $(node)
        .contents()
        .each((_, c) => walkNode(c, [...marks, "em"]));
      return;
    }
    $(node)
      .contents()
      .each((_, c) => walkNode(c, marks));
  }

  $(el).contents().each((_, n) => walkNode(n, []));

  const merged = [];
  for (const s of spans) {
    const prev = merged[merged.length - 1];
    if (prev && JSON.stringify(prev.marks) === JSON.stringify(s.marks)) {
      prev.text += s.text;
    } else {
      merged.push({ ...s });
    }
  }
  return merged.filter((s) => s.text.length > 0);
}

function tagName(el) {
  if (!el || el.type !== "tag") return "";
  return (el.name || "").toLowerCase();
}

/**
 * @param {string} html page complète
 * @param {string} pageUrl URL canonique de la page
 * @param {null | ((url: string, alt: string) => Promise<string>)} uploadImage retourne _ref asset Sanity
 */
export async function buildPortableTextFromHtml(html, pageUrl, uploadImage) {
  const $ = cheerio.load(html);
  $("script, style, nav, footer, iframe").remove();

  let $root = $("main").first();
  if (!$root.length) $root = $("article").first();
  if (!$root.length) $root = $(".entry-content, .post-content, .article-content, #content, .content").first();
  if (!$root.length) $root = $("body");

  const blocks = [];

  async function emitImage(imgEl) {
    const $img = $(imgEl);
    const src = $img.attr("src");
    const full = resolveUrl(pageUrl, src || "");
    if (!full || !/\.(jpg|jpeg|png|webp|gif|avif)(\?|$)/i.test(full)) return;
    const alt = ($img.attr("alt") || "").trim();
    if (uploadImage) {
      try {
        const ref = await uploadImage(full, alt);
        if (ref) {
          blocks.push({
            _type: "image",
            _key: blockKey(),
            asset: { _type: "reference", _ref: ref },
            ...(alt ? { alt } : {}),
          });
        }
      } catch {
        /* image inaccessible */
      }
    }
  }

  /** Images dans un paragraphe ou un item de liste (souvent enveloppées dans un lien) : inlineSpans les ignore. */
  async function emitNestedImages(el) {
    for (const img of $(el).find("img").toArray()) {
      await emitImage(img);
    }
  }

  async function walk(el) {
    if (!el || el.type !== "tag") return;
    const tag = tagName(el);
    if (!tag || SKIP_TAGS.has(tag)) return;

    if (tag === "img") {
      await emitImage(el);
      return;
    }

    if (tag === "figure") {
      const img = $(el).find("img").first();
      if (img.length && img.get(0)) await emitImage(img.get(0));
      return;
    }

    if (tag === "p" || tag === "blockquote" || /^h[1-6]$/.test(tag)) {
      const markDefs = [];
      const children = inlineSpans($, el, pageUrl, markDefs);
      const plain = $(el).text().replace(/\s+/g, " ").trim();
      if (!plain && children.length === 0) {
        await emitNestedImages(el);
        return;
      }
      let style = "normal";
      if (tag === "blockquote") style = "blockquote";
      else if (tag === "h1") style = "h1";
      else if (tag === "h2") style = "h2";
      else if (/^h[3-6]$/.test(tag)) style = "h3";
      blocks.push({
        _type: "block",
        _key: blockKey(),
        style,
        markDefs,
        children:
          children.length > 0
            ? children
            : [{ _type: "span", _key: blockKey(), text: plain, marks: [] }],
      });
      await emitNestedImages(el);
      return;
    }

    if (tag === "ul" || tag === "ol") {
      for (const liNode of $(el).children().toArray()) {
          const li = liNode;
          if (!li || li.type !== "tag") continue;
          // HTML invalide fréquent sur WordPress : div/p directement dans une liste.
          if (tagName(li) !== "li") {
            await walk(li);
            continue;
          }
          const markDefs = [];
          const children = inlineSpans($, li, pageUrl, markDefs);
          const text = $(li).text().replace(/\s+/g, " ").trim();
          if (!text && children.length === 0) {
            await emitNestedImages(li);
            continue;
          }
          blocks.push({
            _type: "block",
            _key: blockKey(),
            style: "normal",
            listItem: tag === "ul" ? "bullet" : "number",
            level: 1,
            markDefs,
            children:
              children.length > 0
                ? children
                : [{ _type: "span", _key: blockKey(), text, marks: [] }],
          });
          await emitNestedImages(li);
      }
      return;
    }

    const childElements = $(el).children().toArray();
    if (childElements.length === 0) {
      const t = $(el).text().replace(/\s+/g, " ").trim();
      if (t) {
        const markDefs = [];
        const children = inlineSpans($, el, pageUrl, markDefs);
        blocks.push({
          _type: "block",
          _key: blockKey(),
          style: "normal",
          markDefs,
          children:
            children.length > 0
              ? children
              : [{ _type: "span", _key: blockKey(), text: t, marks: [] }],
        });
      }
      return;
    }

    for (const child of childElements) {
      await walk(child);
    }
  }

  const top = $root.children().toArray();
  if (top.length === 0) {
    const t = $root.text().replace(/\s+/g, " ").trim();
    if (t) {
      blocks.push({
        _type: "block",
        _key: blockKey(),
        style: "normal",
        markDefs: [],
        children: [{ _type: "span", _key: blockKey(), text: t, marks: [] }],
      });
    }
  } else {
    for (const child of top) {
      await walk(child);
    }
  }

  return blocks;
}
