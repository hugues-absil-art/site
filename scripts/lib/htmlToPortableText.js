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
  // Zone de commentaires WordPress (formulaire, liste, pingbacks) : ne doit pas être importée.
  $(".comment-respond, #respond, #comments, .comments-area, .commentlist, .comment-list, .pingback").remove();

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
          // Le champ Contenu n'accepte plus l'image native (voir blockContent.ts) : imageWithLayout.
          blocks.push({
            _type: "imageWithLayout",
            _key: blockKey(),
            image: { _type: "image", asset: { _type: "reference", _ref: ref } },
            layout: "centered",
            size: "medium",
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
      // Liste invalide (texte libre ou div/p hors <li>) : on parcourt tous les nœuds.
      const hasStray =
        $(el).children().toArray().some((c) => tagName(c) !== "li") ||
        $(el).contents().toArray().some((n) => n.type === "text" && (n.data ?? "").trim() !== "");
      if (hasStray) {
        await walkContainer(el);
        return;
      }
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

    await walkContainer(el);
  }

  const INLINE_TAGS = new Set([
    "a", "strong", "b", "em", "i", "u", "span", "font", "sup", "sub", "small", "abbr", "cite", "code", "mark",
  ]);

  /** Un nœud inline « pur » : pas d'image ni de bloc dedans (sinon il passe par walk). */
  function isPureInline(node) {
    if (node.type !== "tag") return false;
    if (!INLINE_TAGS.has(tagName(node))) return false;
    return $(node).find("img, p, div, ul, ol, li, h1, h2, h3, h4, h5, h6, figure, blockquote, table").length === 0;
  }

  /** Transforme une suite de nœuds inline (texte libre, <br>, liens, gras…) en paragraphes. */
  function flushInline(buffer) {
    // Coupe aux doubles <br> (= changement de paragraphe sur WordPress).
    const parts = [];
    let cur = [];
    let brRun = [];
    for (const node of buffer) {
      if (node.type === "tag" && tagName(node) === "br") {
        brRun.push(node);
        continue;
      }
      if (brRun.length >= 2) {
        parts.push(cur);
        cur = [];
      } else if (brRun.length === 1) {
        cur.push(brRun[0]);
      }
      brRun = [];
      cur.push(node);
    }
    parts.push(cur);
    for (const part of parts) {
      const wrapper = $("<p></p>");
      for (const n of part) wrapper.append($(n).clone());
      const markDefs = [];
      const spans = inlineSpans($, wrapper.get(0), pageUrl, markDefs);
      // Retire les retours à la ligne et espaces en bord de paragraphe.
      while (spans.length && /^\s*$/.test(spans[0].text)) spans.shift();
      while (spans.length && /^\s*$/.test(spans[spans.length - 1].text)) spans.pop();
      if (spans.length === 0) continue;
      spans[0].text = spans[0].text.replace(/^\s+/, "");
      spans[spans.length - 1].text = spans[spans.length - 1].text.replace(/\s+$/, "");
      blocks.push({ _type: "block", _key: blockKey(), style: "normal", markDefs, children: spans });
    }
  }

  /**
   * Parcourt TOUS les nœuds enfants (pas seulement les éléments) : le texte posé
   * directement dans un conteneur, entre des <br>, était ignoré (pages WordPress
   * sans <p>, souvent plusieurs milliers de mots perdus).
   */
  async function walkContainer(el) {
    let buffer = [];
    const flush = () => {
      if (buffer.length) flushInline(buffer);
      buffer = [];
    };
    for (const node of $(el).contents().toArray()) {
      if (node.type === "text") {
        if ((node.data ?? "").trim() !== "" || buffer.length) buffer.push(node);
      } else if (node.type === "tag" && tagName(node) === "br") {
        if (buffer.length) buffer.push(node);
      } else if (isPureInline(node)) {
        buffer.push(node);
      } else if (node.type === "tag") {
        flush();
        await walk(node);
      }
    }
    flush();
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
    await walkContainer($root.get(0));
  }

  return blocks;
}
