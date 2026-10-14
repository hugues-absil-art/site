/**
 * Crée des Ressources / Expositions publiées à partir des fiches « À classer »,
 * selon un plan JSON (liste de { wp_id, slug, title, type, date, target, category }).
 * Les fiches « À classer » ne sont PAS supprimées.
 *
 * Usage :
 *   node scripts/promote-a-classer.js --plan=./plan.json [--dry-run]
 *
 * - Identifiants déterministes (wp-resource-<id>, wp-exhibition-<id>) : relancer met à jour.
 * - Le slug WordPress est conservé (utile pour faire correspondre les anciennes adresses).
 * - Profil d'édition déduit des ressources déjà présentes dans la même catégorie (ou ses parents).
 * - Expositions / ateliers : date et dateEnd = date de l'article WordPress (évite l'affichage « à venir »).
 *
 * .env : VITE_SANITY_PROJECT_ID, VITE_SANITY_DATASET, SANITY_API_TOKEN
 */
import fs from "node:fs";
import { client, hasToken } from "./lib/sanityClient.js";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const planArg = args.find((a) => a.startsWith("--plan="));
if (!planArg) {
  console.error("Usage: node scripts/promote-a-classer.js --plan=./plan.json [--dry-run]");
  process.exit(1);
}
if (!hasToken && !dryRun) {
  console.error("SANITY_API_TOKEN requis (sauf --dry-run).");
  process.exit(1);
}
const plan = JSON.parse(fs.readFileSync(planArg.slice(7), "utf-8"));

const ROOT_PROFILE = {
  "oeil-expo": "exposition",
  "critiques-livres-d-art": "article",
  "atelier-stages": "atelier",
  "histoire-art": "chapitre",
  "technique-picturale": "chapitre",
};

const slugOf = (url) =>
  String(url || "").split(/[?#]/)[0].replace(/\/+$/, "").split("/").pop();

function plainText(content) {
  if (!Array.isArray(content)) return "";
  return content
    .filter((b) => b?._type === "block")
    .map((b) => (b.children || []).map((c) => c.text || "").join(""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstImage(content) {
  const b = (content || []).find((x) => x?._type === "imageWithLayout" && x.image?.asset);
  return b ? { _type: "image", asset: b.image.asset } : undefined;
}

const [acDocs, cats, resources, existingSlugs] = await Promise.all([
  client.fetch(
    `*[_type=="contenuAClasser" && !(_id in path("drafts.**")) && sourceUrl match "*hugues-absil.com/wordpress/*"]{_id,title,sourceUrl,content,extractedContent}`
  ),
  client.fetch(`*[_type=="resourceCategory"]{_id,"slug":slug.current,"parent":parent->slug.current,editorProfile}`),
  client.fetch(`*[_type=="resource" && defined(categoryRef)]{"cat":categoryRef->slug.current,editorProfile}`),
  client.fetch(
    `*[_type in ["resource","exhibition"] && defined(slug.current)]{_id,_type,"slug":slug.current,"hasContent":count(coalesce(content,body,[]))>0,"hasExcerpt":defined(excerpt) || defined(description)}`
  ),
]);

const acBySlug = new Map();
for (const d of acDocs) acBySlug.set(slugOf(d.sourceUrl), d);
const catBySlug = new Map(cats.map((c) => [c.slug, c]));
const slugTaken = new Map(existingSlugs.map((s) => [`${s._type}:${s.slug}`, s._id]));
const existingDoc = new Map(existingSlugs.map((s) => [`${s._type}:${s.slug}`, s]));
const normTitle = (t) =>
  String(t || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
const acByTitle = new Map();
for (const d of acDocs) if (d.title) acByTitle.set(normTitle(d.title), d);

function profileFor(catSlug) {
  let cur = catSlug;
  const seen = new Set();
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const counts = {};
    for (const r of resources) {
      if (r.cat === cur && r.editorProfile) counts[r.editorProfile] = (counts[r.editorProfile] || 0) + 1;
    }
    const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (best) return best[0];
    const c = catBySlug.get(cur);
    if (c?.editorProfile) return c.editorProfile;
    if (ROOT_PROFILE[cur]) return ROOT_PROFILE[cur];
    cur = c?.parent;
  }
  return "chapitre";
}

const log = [];
let created = 0;
for (const item of plan) {
  const ac = acBySlug.get(item.slug) || acByTitle.get(normTitle(item.title));
  const row = { wp_id: item.wp_id, slug: item.slug, titre: item.title, cible: item.target, categorie: item.category || "" };
  if (!ac) {
    log.push({ ...row, statut: "IGNORÉ : fiche À classer introuvable" });
    continue;
  }
  const content = Array.isArray(ac.content) && ac.content.length ? ac.content : undefined;
  const excerpt = (plainText(ac.content) || ac.extractedContent || "").slice(0, 500);
  const cover = firstImage(ac.content);
  const validUrl = /^https?:\/\//.test(ac.sourceUrl || "") ? ac.sourceUrl : undefined;
  const title = (ac.title || item.title || "").trim() || item.slug;
  let doc;

  if (item.target === "exhibition") {
    const id = `wp-exhibition-${item.wp_id}`;
    const taken = slugTaken.get(`exhibition:${item.slug}`);
    if (taken && taken !== id) {
      const ex = existingDoc.get(`exhibition:${item.slug}`);
      if (ex && !ex.hasContent && content) {
        if (!dryRun) await client.patch(taken).set({ body: content, ...(ex.hasExcerpt ? {} : { description: excerpt }) }).commit();
        log.push({ ...row, statut: "existant : contenu complété", id: taken });
      } else log.push({ ...row, statut: `existant conservé (${taken})`, id: taken });
      continue;
    }
    doc = {
      _id: id,
      _type: "exhibition",
      title,
      slug: { _type: "slug", current: item.slug },
      description: excerpt || undefined,
      ...(content ? { body: content } : {}),
      dateStart: item.date,
      dateEnd: item.date,
      ...(validUrl ? { externalLink: validUrl } : {}),
      ...(cover ? { image: cover } : {}),
    };
  } else {
    const cat = catBySlug.get(item.category);
    if (!cat) {
      log.push({ ...row, statut: `IGNORÉ : catégorie inconnue « ${item.category} »` });
      continue;
    }
    const id = `wp-resource-${item.wp_id}`;
    const taken = slugTaken.get(`resource:${item.slug}`);
    if (taken && taken !== id) {
      const ex = existingDoc.get(`resource:${item.slug}`);
      if (ex && !ex.hasContent && content) {
        if (!dryRun) await client.patch(taken).set({ content, ...(ex.hasExcerpt ? {} : { excerpt }) }).commit();
        log.push({ ...row, statut: "existant : contenu complété", id: taken });
      } else log.push({ ...row, statut: `existant conservé (${taken})`, id: taken });
      continue;
    }
    const profile = profileFor(item.category);
    const dated = profile === "exposition" || profile === "atelier";
    doc = {
      _id: id,
      _type: "resource",
      title,
      slug: { _type: "slug", current: item.slug },
      categoryRef: { _type: "reference", _ref: cat._id },
      editorProfile: profile,
      excerpt: excerpt || undefined,
      ...(content ? { content } : {}),
      ...(item.type === "post" || dated ? { date: item.date } : {}),
      ...(dated ? { dateEnd: item.date } : {}),
      ...(dated && cover ? { coverImage: cover } : {}),
      ...(validUrl ? { sourceUrl: validUrl } : {}),
    };
    row.profil = profile;
  }

  if (!dryRun) await client.createOrReplace(doc);
  created++;
  log.push({ ...row, statut: dryRun ? "à créer (simulation)" : "créé", id: doc._id });
}

const out = planArg.slice(7).replace(/\.json$/, "") + (dryRun ? ".simulation.csv" : ".resultat.csv");
const cols = ["wp_id", "slug", "titre", "cible", "categorie", "profil", "statut", "id"];
const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
fs.writeFileSync(out, "﻿" + [cols.join(";"), ...log.map((r) => cols.map((c) => esc(r[c])).join(";"))].join("\n"));
console.log(`${dryRun ? "[simulation] " : ""}${created} document(s) ${dryRun ? "seraient créés" : "créés"} sur ${plan.length}. Journal : ${out}`);
const ignored = log.filter((r) => r.statut.startsWith("IGNORÉ"));
for (const r of ignored) console.log("  -", r.slug, "→", r.statut);
