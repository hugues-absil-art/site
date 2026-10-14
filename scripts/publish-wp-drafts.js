/**
 * Publie les brouillons remplis depuis WordPress (décision « remplir » de la revue) en préparant le référencement :
 *  - une seule page par groupe de doublons (même titre) : celle qui a le plus de texte ; les autres restent en brouillon ;
 *  - l'adresse (slug) est alignée sur celle de WordPress quand elle est libre, pour que la page soit servie
 *    à son adresse d'origine ;
 *  - les ressources « Critique d'expositions » sans date reçoivent la date de l'article WordPress (date et date de fin) :
 *    le site les range alors automatiquement dans « Archives » ;
 *  - sans catégorie : reprise de celle du plan de rangement si elle existe.
 * Sauvegarde des brouillons avant publication. Simulation avec --dry-run.
 *
 * Usage : node scripts/publish-wp-drafts.js --file=../inventaire/decisions_revue.json [--plan=…plan.json] [--dry-run]
 */
import fs from "node:fs";
import { client, hasToken } from "./lib/sanityClient.js";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const get = (n) => (args.find((a) => a.startsWith(`--${n}=`)) || "").slice(n.length + 3);
if (!get("file")) {
  console.error("Usage: node scripts/publish-wp-drafts.js --file=decisions_revue.json [--plan=plan.json] [--dry-run]");
  process.exit(1);
}
if (!hasToken && !dryRun) {
  console.error("SANITY_API_TOKEN requis (sauf --dry-run).");
  process.exit(1);
}
const dec = JSON.parse(fs.readFileSync(get("file"), "utf-8"));
const plan = get("plan") ? JSON.parse(fs.readFileSync(get("plan"), "utf-8")) : [];
const legacy = JSON.parse(fs.readFileSync(new URL("../seo/legacy-map.json", import.meta.url), "utf-8"));
const wpBySlug = new Map(legacy.entries.map((e) => [e.wpSlug, e]));
const planCat = new Map(plan.filter((p) => p.category).map((p) => [p.slug, p.category]));

const norm = (t) => String(t || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
const words = (d) =>
  (d.content || d.body || []).filter((b) => b?._type === "block").map((b) => (b.children || []).map((c) => c.text || "").join(" ")).join(" ").split(/\s+/).filter(Boolean).length;

const todo = dec.a7.filter((x) => x.decision === "remplir");
const [drafts, cats, taken] = await Promise.all([
  client.fetch(`*[_id in $ids]`, { ids: todo.map((x) => x.docId) }),
  client.fetch(`*[_type=="resourceCategory" && !(_id in path("drafts.**"))]{_id,"slug":slug.current}`),
  client.fetch(`*[_type in ["resource","exhibition"] && !(_id in path("drafts.**")) && defined(slug.current)]{_id,_type,"slug":slug.current}`),
]);
const byId = new Map(drafts.map((d) => [d._id, d]));
const catId = new Map(cats.map((c) => [c.slug, c._id]));
const slugOwner = new Map(taken.map((t) => [`${t._type}:${t.slug}`, t._id]));

// groupes de doublons (titre identique) : on publie celui qui a le plus de texte
const groups = new Map();
for (const x of todo) {
  const d = byId.get(x.docId);
  if (!d) continue;
  const k = d._type + ":" + norm(d.title);
  (groups.get(k) || groups.set(k, []).get(k)).push({ x, d });
}
const keep = new Set();
for (const g of groups.values()) {
  g.sort((a, b) => words(b.d) - words(a.d));
  keep.add(g[0].d._id);
}

const log = [];
const backup = [];
for (const x of todo) {
  const d = byId.get(x.docId);
  if (!d) { log.push({ titre: x.titre, statut: "IGNORÉ : brouillon introuvable (déjà publié ?)" }); continue; }
  if (!keep.has(d._id)) { log.push({ titre: d.title, statut: "laissé en brouillon : doublon d'un autre brouillon de la liste" }); continue; }
  const base = d._id.replace(/^drafts\./, "");
  const doc = { ...d };
  for (const k of ["_createdAt", "_updatedAt", "_rev"]) delete doc[k];
  doc._id = base;
  const notes = [];

  // adresse alignée sur WordPress
  const wpSlug = x.wpSlug;
  if (wpSlug && doc.slug?.current !== wpSlug) {
    const owner = slugOwner.get(`${doc._type}:${wpSlug}`);
    if (!owner || owner === base) {
      notes.push(`adresse « ${doc.slug?.current} » → « ${wpSlug} »`);
      doc.slug = { _type: "slug", current: wpSlug };
    } else {
      // la page publiée qui porte déjà cette adresse WordPress existe : ce brouillon en est un doublon
      log.push({ titre: d.title, statut: `laissé en brouillon : la page publiée ${owner} porte déjà l'adresse WordPress « ${wpSlug} » (doublon)` });
      continue;
    }
  }
  // catégorie
  if (doc._type === "resource" && !doc.categoryRef) {
    const c = planCat.get(wpSlug) || planCat.get(doc.slug?.current);
    if (c && catId.has(c)) { doc.categoryRef = { _type: "reference", _ref: catId.get(c) }; notes.push(`catégorie « ${c} » (plan de rangement)`); }
    else notes.push("ATTENTION : sans catégorie, pas de page publique");
  }
  // archives : expositions sans date -> date de l'article WordPress
  const wp = wpBySlug.get(wpSlug);
  const catSlug = [...catId.entries()].find(([, id]) => id === doc.categoryRef?._ref)?.[0];
  if (doc._type === "resource" && catSlug === "oeil-expo" && wp?.date) {
    if (!doc.date) { doc.date = wp.date; notes.push(`date ${wp.date}`); }
    if (!doc.dateEnd) { doc.dateEnd = doc.date; notes.push("date de fin (→ Archives)"); }
  }
  backup.push(d);
  if (!dryRun) await client.transaction().createOrReplace(doc).delete(d._id).commit();
  log.push({ titre: d.title, statut: (dryRun ? "à publier" : "publié") + (notes.length ? " — " + notes.join(" ; ") : "") });
}

const dir = new URL("../../inventaire/", import.meta.url);
const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
fs.writeFileSync(new URL(`publication_brouillons_wp.${dryRun ? "simulation" : "resultat"}.csv`, dir), "﻿" + ["titre;statut", ...log.map((r) => `${esc(r.titre)};${esc(r.statut)}`)].join("\n"));
if (!dryRun && backup.length) fs.writeFileSync(new URL(`backup_avant_publication_wp_${stamp}.json`, dir), JSON.stringify(backup));
const n = (re) => log.filter((r) => re.test(r.statut)).length;
console.log(`${dryRun ? "[simulation] " : ""}${n(/^(à publier|publié)/)} page(s) à publier | ${n(/^laissé/)} doublon(s) laissé(s) en brouillon | ${n(/IGNORÉ|ATTENTION/)} problème(s)`);
for (const r of log) console.log("  -", String(r.titre).slice(0, 44).padEnd(44), "|", r.statut);
