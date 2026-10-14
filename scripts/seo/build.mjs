/**
 * Génération SEO après `vite build` : pré-rendu statique des pages + sitemap + robots.txt.
 *
 * Pourquoi : le site est une application côté navigateur. Sans ce script, toutes les adresses renvoient
 * le même HTML vide (même titre, statut HTTP 404 sur GitHub Pages) : Google ne pourrait ni les indexer
 * ni conserver le classement actuel. Ici, chaque page reçoit un vrai fichier HTML (statut 200) avec
 * son texte, son <title>, sa description, sa balise canonique, Open Graph et JSON-LD.
 *
 * Ce que le script écrit dans dist/ :
 *  - une page par document Sanity publié, À L'ADRESSE WORDPRESS D'ORIGINE (/wordpress/…) quand elle existe
 *    (aucune redirection : l'adresse indexée par Google est conservée), sinon à l'adresse du nouveau site ;
 *  - une copie à l'adresse « nouveau site » avec une balise canonique vers l'adresse d'origine ;
 *  - des pages de catégories (listes de liens crawlables) ;
 *  - des pages de redirection (meta refresh à 0 s, traitée par Google comme une redirection permanente)
 *    pour les anciennes adresses sans équivalent (pages de structure, doublons, catégories WordPress) ;
 *  - sitemap.xml (+ google_sitemap.xml.gz, ancien emplacement), robots.txt, 404.html (noindex).
 *
 * Variables : VITE_SANITY_PROJECT_ID, VITE_SANITY_DATASET, VITE_SITE_URL (défaut https://hugues-absil.com),
 *             GITHUB_PAGES / VITE_BASE_PATH (même logique que vite.config.ts).
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { createClient } from "@sanity/client";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DIST = path.join(ROOT, "dist");
const SITE_URL = (process.env.VITE_SITE_URL || "https://hugues-absil.com").replace(/\/$/, "");
const SITE_NAME = "Hugues Absil";
const DEFAULT_TITLE = "Hugues Absil - Artiste Contemporain";
const DEFAULT_DESC = "Site officiel de Hugues Absil, artiste contemporain. Découvrez ses œuvres, expositions et actualités.";
const BASE = process.env.VITE_BASE_PATH
  ? process.env.VITE_BASE_PATH.replace(/\/$/, "")
  : process.env.GITHUB_PAGES === "true"
    ? "/site"
    : "";
const projectId = process.env.SANITY_PROJECT_ID || process.env.VITE_SANITY_PROJECT_ID;
const dataset = process.env.SANITY_DATASET || process.env.VITE_SANITY_DATASET || "production";

if (!fs.existsSync(path.join(DIST, "index.html"))) {
  console.error("SEO : dist/index.html introuvable (lancer vite build d'abord).");
  process.exit(1);
}
if (!projectId) {
  console.warn("SEO : VITE_SANITY_PROJECT_ID absent, pré-rendu ignoré.");
  process.exit(0);
}

const template = fs.readFileSync(path.join(DIST, "index.html"), "utf-8");
if (template.includes('id="seo-static"')) {
  console.error("SEO : dist/ a déjà été pré-rendu. Relancer d'abord `vite build` (ou `npm run build`).");
  process.exit(1);
}
const legacy = JSON.parse(fs.readFileSync(path.join(ROOT, "seo/legacy-map.json"), "utf-8"));
const sanity = createClient({ projectId, dataset, apiVersion: "2024-01-01", useCdn: false }); // données à jour (pas le cache du CDN)

// ---------- utilitaires ----------
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const attr = esc;
const href = (p) => `${BASE}${p}`;
const abs = (p) => `${SITE_URL}${p}`;
const dateOnly = (d) => (d ? String(d).slice(0, 10) : "");
const stripHtml = (s) => String(s || "").replace(/\s+/g, " ").trim();
const cut = (text, max = 160) => {
  const t = stripHtml(text);
  if (t.length <= max) return t;
  const c = t.slice(0, max);
  return c.slice(0, Math.max(c.lastIndexOf(" "), 60)).trim() + "…";
};
function plain(blocks) {
  return (blocks || [])
    .filter((b) => b?._type === "block")
    .map((b) => (b.children || []).map((c) => c.text || "").join(""))
    .join(" ");
}
function imageUrl(ref, width = 1200) {
  const m = /^image-([a-f0-9]+)-(\d+)x(\d+)-(\w+)$/.exec(ref || "");
  if (!m) return null;
  const [, id, w, h, ext] = m;
  return { url: `https://cdn.sanity.io/images/${projectId}/${dataset}/${id}-${w}x${h}.${ext}?w=${width}&auto=format`, w: +w, h: +h };
}
function bestImageOf(cover, blocks) {
  const refs = [cover, ...(blocks || []).filter((x) => x?._type === "imageWithLayout").map((x) => x.image?.asset?._ref)].filter(Boolean);
  let best = null;
  for (const ref of refs) {
    const i = imageUrl(ref);
    if (i && i.w >= 600 && (!best || i.w > best.w)) best = i;
  }
  return best ? best.url : null;
}
function imagesOf(blocks, max = 40) {
  return (blocks || [])
    .filter((x) => x?._type === "imageWithLayout" && x.image?.asset?._ref)
    .map((x) => ({ url: imageUrl(x.image.asset._ref)?.url, caption: x.caption }))
    .filter((x) => x.url)
    .slice(0, max);
}

/** Portable Text -> HTML. h1/h2/h3 du contenu deviennent h2/h3/h4 (le titre de la page est le seul h1). */
function ptToHtml(blocks, altFallback = "") {
  const out = [];
  let list = null; // { tag, items: [] }
  const flush = () => {
    if (list) {
      out.push(`<${list.tag}>${list.items.join("")}</${list.tag}>`);
      list = null;
    }
  };
  for (const b of blocks || []) {
    if (b?._type === "block") {
      const defs = Object.fromEntries((b.markDefs || []).map((d) => [d._key, d]));
      const inner = (b.children || [])
        .map((c) => {
          let t = esc(c.text || "").replace(/\n/g, "<br>");
          for (const m of c.marks || []) {
            if (m === "strong") t = `<strong>${t}</strong>`;
            else if (m === "em") t = `<em>${t}</em>`;
            else if (defs[m]?.href) t = `<a href="${attr(defs[m].href)}">${t}</a>`;
          }
          return t;
        })
        .join("");
      if (!stripHtml(inner.replace(/<[^>]+>/g, ""))) continue;
      if (b.listItem) {
        const tag = b.listItem === "number" ? "ol" : "ul";
        if (!list || list.tag !== tag) {
          flush();
          list = { tag, items: [] };
        }
        list.items.push(`<li>${inner}</li>`);
        continue;
      }
      flush();
      const tag = { h1: "h2", h2: "h3", h3: "h4", blockquote: "blockquote" }[b.style] || "p";
      out.push(`<${tag}>${inner}</${tag}>`);
    } else if (b?._type === "imageWithLayout" && b.image?.asset?._ref) {
      flush();
      const img = imageUrl(b.image.asset._ref);
      if (!img) continue;
      const alt = b.caption || altFallback;
      const w = Math.min(img.w, 1200);
      const h = Math.round((img.h * w) / img.w);
      out.push(
        `<figure><img src="${attr(img.url)}" alt="${attr(alt)}" width="${w}" height="${h}" loading="lazy">${b.caption ? `<figcaption>${esc(b.caption)}</figcaption>` : ""}</figure>`
      );
    } else if (b?._type === "videoEmbed" && b.url) {
      flush();
      out.push(`<p><a href="${attr(b.url)}">Voir la vidéo</a></p>`);
    }
  }
  flush();
  return out.join("\n");
}

const NAV = [
  ["Accueil", "/"],
  ["Critiques", "/critiques/oeil-expo"],
  ["Enseignement", "/enseignement/histoire-art"],
];
const navHtml = () => `<nav aria-label="Navigation principale">${NAV.map(([l, p]) => `<a href="${attr(href(p))}">${esc(l)}</a>`).join(" · ")}</nav>`;

/** HTML complet d'une page : <head> SEO + contenu statique dans #root (remplacé au chargement de l'application). */
function renderPage({ title, description, canonicalPath, type = "website", image, jsonLd, body, robots }) {
  const fullTitle = title === DEFAULT_TITLE ? title : `${title} | ${SITE_NAME}`;
  const desc = description || DEFAULT_DESC;
  const url = abs(canonicalPath);
  const head = [
    `<title>${esc(fullTitle)}</title>`,
    `<meta name="description" content="${attr(desc)}" />`,
    `<link rel="canonical" href="${attr(url)}" />`,
    robots ? `<meta name="robots" content="${attr(robots)}" />` : "",
    `<meta property="og:title" content="${attr(fullTitle)}" />`,
    `<meta property="og:description" content="${attr(desc)}" />`,
    `<meta property="og:type" content="${type}" />`,
    `<meta property="og:url" content="${attr(url)}" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:locale" content="fr_FR" />`,
    image ? `<meta property="og:image" content="${attr(image)}" />` : "",
    `<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}" />`,
    jsonLd ? `<script id="seo-jsonld" type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>` : "",
  ]
    .filter(Boolean)
    .join("\n    ");
  let html = template
    .replace(/<title>[\s\S]*?<\/title>/, "")
    .replace(/<meta name="description"[^>]*>\s*/, "")
    .replace("</head>", `    ${head}\n  </head>`);
  html = html.replace('<div id="root"></div>', `<div id="root"><div id="seo-static" style="max-width:48rem;margin:0 auto;padding:2rem 1rem;font-family:system-ui,sans-serif;line-height:1.6">${navHtml()}\n${body}</div></div>`);
  return html;
}

function write(relPath, html) {
  const clean = relPath.replace(/^\//, "");
  const file = clean.endsWith(".html") || clean.endsWith(".xml") || clean.endsWith(".txt") ? clean : path.join(clean, "index.html");
  const full = path.join(DIST, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, html);
}

function redirectPage(targetPath, label = "la nouvelle page") {
  const url = abs(targetPath.split("#")[0] || "/");
  const to = href(targetPath);
  return `<!doctype html>
<html lang="fr"><head>
<meta charset="utf-8" />
<title>Redirection | ${SITE_NAME}</title>
<link rel="canonical" href="${attr(url)}" />
<meta http-equiv="refresh" content="0; url=${attr(to)}" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<script>location.replace(${JSON.stringify(to)});</script>
</head><body><p>Cette page a été déplacée. <a href="${attr(to)}">Aller vers ${esc(label)}</a>.</p></body></html>`;
}

// ---------- données Sanity ----------
const DOC_FIELDS = `_id,_type,title,"slug":slug.current,_updatedAt`;
const [cats, resources, exhibitions, press, advice] = await Promise.all([
  sanity.fetch(`*[_type=="resourceCategory" && !(_id in path("drafts.**")) && defined(slug.current)]{_id,title,"slug":slug.current,description,section,order,"parent":parent->slug.current}`),
  sanity.fetch(`*[_type=="resource" && !(_id in path("drafts.**")) && defined(slug.current)]{${DOC_FIELDS},excerpt,content,date,"cat":coalesce(categoryRef->slug.current, category),"section":categoryRef->section,"cover":coverImage.asset._ref}`),
  sanity.fetch(`*[_type=="exhibition" && !(_id in path("drafts.**")) && defined(slug.current)]{${DOC_FIELDS},description,body,dateStart,dateEnd,venue,city,country,"cover":image.asset._ref}`),
  sanity.fetch(`*[_type=="pressArticle" && !(_id in path("drafts.**")) && defined(slug.current)]{${DOC_FIELDS},publication,excerpt,content,date,"cover":image.asset._ref}`),
  sanity.fetch(`*[_type=="advice" && !(_id in path("drafts.**")) && defined(slug.current)]{${DOC_FIELDS},excerpt,content,date,"cover":image.asset._ref}`).catch(() => []),
]);
const catBySlug = new Map(cats.map((c) => [c.slug, c]));
const prefixOf = (section) => (section === "ecrits" ? "critiques" : "enseignement");

// chemin canonique hérité (WordPress) par identifiant de document
const legacyById = new Map();
for (const e of legacy.entries) if (e.target && !legacyById.has(e.target.id)) legacyById.set(e.target.id, e.path);

const docs = [];
for (const r of resources) {
  const c = catBySlug.get(r.cat);
  if (!r.cat || !c) continue; // sans catégorie : pas de page publique
  docs.push({ ...r, kind: "resource", body: r.content, newPath: `/${prefixOf(r.section || c.section)}/${r.cat}/${r.slug}` });
}
for (const e of exhibitions) docs.push({ ...e, kind: "exhibition", body: e.body, newPath: `/expositions/${e.slug}` });
for (const p of press) docs.push({ ...p, kind: "pressArticle", body: p.content, newPath: `/presse/${p.slug}` });
for (const a of advice) docs.push({ ...a, kind: "advice", body: a.content, newPath: `/journal/${a.slug}` });
for (const d of docs) {
  d.canonical = legacyById.get(d._id) || d.newPath;
  d.nWords = plain(d.body).split(/\s+/).filter(Boolean).length;
  d.nImgs = imagesOf(d.body, 999).length;
}

// Doublons : même titre et contenu équivalent (ou l'un quasi vide) -> une page principale ; les autres
// pointent vers elle par balise canonique et sortent du sitemap.
const normTitle = (t) => String(t || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
const groups = new Map();
for (const d of docs) {
  const k = d.kind + ":" + normTitle(d.title);
  (groups.get(k) || groups.set(k, []).get(k)).push(d);
}
let dupCount = 0;
for (const g of groups.values()) {
  if (g.length < 2) continue;
  g.sort((a, b) => (legacyById.has(b._id) - legacyById.has(a._id)) || b.nWords - a.nWords || String(a._id).localeCompare(String(b._id)));
  const main = g[0];
  for (const d of g.slice(1)) {
    const hi = Math.max(main.nWords, d.nWords) || 1;
    const similar = Math.abs(main.nWords - d.nWords) / hi <= 0.1 || Math.min(main.nWords, d.nWords) <= 0.2 * hi;
    if (!similar || legacyById.has(d._id)) continue;
    d.dupOf = main;
    d.canonical = main.canonical;
    dupCount++;
  }
}
// Pages quasi vides sans ancienne adresse (donc jamais indexées) : noindex.
for (const d of docs) if (!d.dupOf && !legacyById.has(d._id) && d.nWords <= 5 && d.nImgs === 0) d.noindex = true;

// ---------- pages de documents ----------
const sitemap = []; // { loc, lastmod, images }
const stats = { docs: 0, legacy: 0, alternates: 0, redirects: 0, categories: 0, duplicates: 0, noindex: 0 };

function docHtml(d) {
  const text = plain(d.body);
  const description = cut(d.excerpt || d.description || text);
  const image = bestImageOf(d.cover, d.body);
  const datePub = dateOnly(d.date || d.dateStart);
  let jsonLd;
  if (d.kind === "exhibition") {
    jsonLd = {
      "@context": "https://schema.org", "@type": "ExhibitionEvent", name: d.title, description,
      startDate: d.dateStart || undefined, endDate: d.dateEnd || undefined, image: image ? [image] : undefined,
      location: d.venue ? { "@type": "Place", name: d.venue, address: [d.city, d.country].filter(Boolean).join(", ") || undefined } : undefined,
      performer: { "@type": "Person", name: SITE_NAME },
    };
  } else {
    jsonLd = {
      "@context": "https://schema.org", "@type": d.kind === "advice" ? "BlogPosting" : "Article", headline: d.title, description,
      image: image ? [image] : undefined, datePublished: datePub || undefined, dateModified: dateOnly(d._updatedAt) || undefined,
      author: { "@type": "Person", name: SITE_NAME }, mainEntityOfPage: abs(d.canonical),
      publisher: d.publication ? { "@type": "Organization", name: d.publication } : undefined,
    };
  }
  const meta = [datePub ? `<time datetime="${datePub}">${datePub}</time>` : "", d.venue ? esc(d.venue) : "", d.publication ? esc(d.publication) : ""].filter(Boolean).join(" · ");
  const body = `<article>\n<h1>${esc(d.title)}</h1>\n${meta ? `<p>${meta}</p>` : ""}\n${ptToHtml(d.body, d.title)}\n</article>`;
  return renderPage({ title: d.title, description, canonicalPath: d.canonical, type: "article", image, jsonLd, body, robots: d.noindex ? "noindex, follow" : undefined });
}

for (const d of docs) {
  const html = docHtml(d);
  stats.docs++;
  if (d.dupOf) {
    write(d.newPath, html); // doublon : sa page existe, canonique vers la page principale, absent du sitemap
    stats.duplicates++;
    continue;
  }
  write(d.canonical, html);
  if (d.canonical !== d.newPath) {
    // même contenu à l'adresse du nouveau site, canonique vers l'adresse d'origine
    write(d.newPath, html);
    stats.alternates++;
    stats.legacy++;
  }
  if (!d.noindex) sitemap.push({ loc: d.canonical, lastmod: dateOnly(d._updatedAt), images: imagesOf(d.body) });
  else stats.noindex++;
}

// ---------- pages de catégories ----------
const docsByCat = new Map();
for (const d of docs) if (d.kind === "resource" && !d.dupOf && !d.noindex) (docsByCat.get(d.cat) || docsByCat.set(d.cat, []).get(d.cat)).push(d);
for (const c of cats) {
  const prefix = prefixOf(c.section);
  const p = `/${prefix}/${c.slug}`;
  const children = cats.filter((x) => x.parent === c.slug);
  const items = (docsByCat.get(c.slug) || []).sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  const body = `<h1>${esc(c.title)}</h1>\n${c.description ? `<p>${esc(c.description)}</p>` : ""}\n` +
    (children.length ? `<h2>Rubriques</h2><ul>${children.map((x) => `<li><a href="${attr(href(`/${prefixOf(x.section)}/${x.slug}`))}">${esc(x.title)}</a></li>`).join("")}</ul>` : "") +
    (items.length ? `<h2>Pages</h2><ul>${items.map((x) => `<li><a href="${attr(href(x.canonical))}">${esc(x.title)}</a></li>`).join("")}</ul>` : "");
  write(p, renderPage({ title: c.title, description: cut(c.description || `${c.title} : articles et ressources de Hugues Absil.`), canonicalPath: p, body }));
  stats.categories++;
  if (items.length || children.length) sitemap.push({ loc: p, lastmod: "", images: [] });
}

// ---------- accueil ----------
const homeLinks = cats.filter((c) => !c.parent).map((c) => `<li><a href="${attr(href(`/${prefixOf(c.section)}/${c.slug}`))}">${esc(c.title)}</a></li>`).join("");
const homeBody = `<h1>Hugues Absil, artiste contemporain</h1>\n<p>${esc(DEFAULT_DESC)}</p>\n<h2>Rubriques</h2><ul>${homeLinks}</ul>`;
fs.writeFileSync(
  path.join(DIST, "index.html"),
  renderPage({
    title: DEFAULT_TITLE, description: DEFAULT_DESC, canonicalPath: "/", body: homeBody,
    jsonLd: [
      { "@context": "https://schema.org", "@type": "WebSite", name: SITE_NAME, url: `${SITE_URL}/`, inLanguage: "fr" },
      { "@context": "https://schema.org", "@type": "Person", name: SITE_NAME, url: `${SITE_URL}/`, jobTitle: "Artiste peintre, graveur et dessinateur" },
    ],
  })
);
sitemap.unshift({ loc: "/", lastmod: "", images: [] });

// ---------- redirections des anciennes adresses ----------
const written = new Set(docs.map((d) => d.canonical).concat(docs.map((d) => d.newPath)));
for (const e of legacy.entries) {
  if (!e.redirect || written.has(e.path)) continue;
  write(e.path, redirectPage(e.redirect));
  stats.redirects++;
}
for (const a of legacy.archives || []) {
  if (!a.redirect) continue; // étiquettes : volontairement laissées en 404 (pas de redirection massive vers l'accueil)
  write(a.path, redirectPage(a.redirect));
  stats.redirects++;
  for (let n = 2; n <= a.pages; n++) write(`${a.path}page/${n}/`, redirectPage(a.redirect));
}
write("/wordpress/", redirectPage("/", "l'accueil"));
stats.redirects++;

// ---------- version du contenu (le workflow ne reconstruit que si elle change) ----------
const contentVersion = await sanity.fetch(
  `string(count(*[_type in $t])) + "|" + (*[_type in $t] | order(_updatedAt desc)[0]._updatedAt)`,
  { t: ["resource", "exhibition", "pressArticle", "advice", "resourceCategory"] }
);
fs.writeFileSync(path.join(DIST, "build-info.json"), JSON.stringify({ contentVersion, builtAt: new Date().toISOString() }));

// ---------- sitemap, robots.txt, 404 ----------
const sm = ["<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
  "<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\" xmlns:image=\"http://www.google.com/schemas/sitemap-image/1.1\">"];
for (const u of sitemap) {
  sm.push("  <url>", `    <loc>${esc(abs(u.loc))}</loc>`);
  if (u.lastmod) sm.push(`    <lastmod>${u.lastmod}</lastmod>`);
  for (const im of u.images) sm.push(`    <image:image><image:loc>${esc(im.url)}</image:loc>${im.caption ? `<image:caption>${esc(im.caption)}</image:caption>` : ""}</image:image>`);
  sm.push("  </url>");
}
sm.push("</urlset>");
const sitemapXml = sm.join("\n") + "\n";
fs.writeFileSync(path.join(DIST, "sitemap.xml"), sitemapXml);
fs.writeFileSync(path.join(DIST, "google_sitemap.xml.gz"), zlib.gzipSync(sitemapXml)); // ancien emplacement, mis à jour
fs.writeFileSync(path.join(DIST, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: ${BASE}/studio\n\nSitemap: ${abs("/sitemap.xml")}\n`);
fs.writeFileSync(
  path.join(DIST, "404.html"),
  template.replace(/<title>[\s\S]*?<\/title>/, `<title>Page introuvable | ${SITE_NAME}</title>`).replace("</head>", '    <meta name="robots" content="noindex" />\n  </head>')
);

console.log(
  `SEO : ${stats.docs} pages, dont ${stats.legacy} à l'adresse WordPress d'origine (+${stats.alternates} copies canoniques), ` +
    `${stats.categories} catégories, ${stats.redirects} redirections, ${stats.duplicates} doublons (canonique vers la page principale), ` +
    `${stats.noindex} pages vides en noindex, ${sitemap.length} URL dans le sitemap.`
);
