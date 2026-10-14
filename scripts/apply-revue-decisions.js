/**
 * Applique les décisions exportées par l'interface « revue_decisions.html » (A7, A2, A4).
 *
 * A7 (brouillons) :
 *   supprimer : supprime le BROUILLON (jamais une version publiée : ignoré si une version publiée existe)
 *   remplir   : copie le contenu complet de la fiche « À classer » (même adresse WordPress) dans le brouillon ;
 *               le brouillon reste un brouillon
 *   publier   : publie le brouillon (copie vers l'identifiant publié, supprime le brouillon) ;
 *               si la ressource n'a pas de catégorie, reprend celle du plan de rangement si elle existe
 *   garder / main : rien
 * A2 : ignorer / main : rien ; publier : création d'une ressource depuis la fiche « À classer » (catégorie choisie).
 * A4 : ajouter : télécharge l'image, la téléverse et l'ajoute à la fin de la fiche « À classer » et des
 *      ressources/expositions de même adresse ; ignorer : rien.
 *
 * Sécurités : sauvegarde complète des documents touchés (JSON), simulation avec --dry-run.
 *
 * Usage :
 *   node scripts/apply-revue-decisions.js --file=chemin/decisions_revue.json [--plan=chemin/plan.json] [--dry-run]
 *
 * .env : VITE_SANITY_PROJECT_ID, VITE_SANITY_DATASET, SANITY_API_TOKEN
 */
import fs from "node:fs";
import crypto from "node:crypto";
import { client, hasToken } from "./lib/sanityClient.js";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const get = (n) => (args.find((a) => a.startsWith(`--${n}=`)) || "").slice(n.length + 3);
const file = get("file");
const planFile = get("plan");
if (!file) {
  console.error("Usage: node scripts/apply-revue-decisions.js --file=decisions_revue.json [--plan=plan.json] [--dry-run]");
  process.exit(1);
}
if (!hasToken && !dryRun) {
  console.error("SANITY_API_TOKEN requis (sauf --dry-run).");
  process.exit(1);
}
const dec = JSON.parse(fs.readFileSync(file, "utf-8"));
const plan = planFile ? JSON.parse(fs.readFileSync(planFile, "utf-8")) : [];
const planCatBySlug = new Map(plan.filter((p) => p.category).map((p) => [p.slug, p.category]));

const slugOfUrl = (u) => String(u || "").split(/[?#]/)[0].replace(/\/+$/, "").split("/").pop();
const key = () => crypto.randomBytes(6).toString("hex");
const words = (blocks) =>
  (blocks || []).filter((b) => b?._type === "block").map((b) => (b.children || []).map((c) => c.text || "").join(" ")).join(" ").split(/\s+/).filter(Boolean).length;
const plain = (blocks) =>
  (blocks || []).filter((b) => b?._type === "block").map((b) => (b.children || []).map((c) => c.text || "").join("")).join(" ").replace(/\s+/g, " ").trim();
const uniqueKeys = (blocks) => {
  const seen = new Set();
  return blocks.map((b) => {
    let k = b._key || key();
    while (seen.has(k)) k = key();
    seen.add(k);
    return { ...b, _key: k };
  });
};
const fieldOf = (doc) => (doc._type === "exhibition" ? "body" : "content");

const log = [];
const backup = [];
const add = (onglet, titre, decision, statut) => log.push({ onglet, titre, decision, statut });

// ---------- données ----------
const draftIds = dec.a7.map((x) => x.docId);
const baseIds = draftIds.map((i) => i.replace(/^drafts\./, ""));
const [drafts, published, acs, cats] = await Promise.all([
  client.fetch(`*[_id in $ids]`, { ids: draftIds }),
  client.fetch(`*[_id in $ids]{_id}`, { ids: baseIds }),
  client.fetch(`*[_type=="contenuAClasser" && !(_id in path("drafts.**")) && sourceUrl match "*hugues-absil.com/wordpress/*"]{_id,title,sourceUrl,content,extractedAt}`),
  client.fetch(`*[_type=="resourceCategory" && !(_id in path("drafts.**"))]{_id,"slug":slug.current}`),
]);
const draftById = new Map(drafts.map((d) => [d._id, d]));
const pubSet = new Set(published.map((p) => p._id));
const acBySlug = new Map(acs.map((a) => [slugOfUrl(a.sourceUrl), a]));
const catBySlug = new Map(cats.map((c) => [c.slug, c._id]));

// ---------- A7 ----------
for (const x of dec.a7) {
  const d = draftById.get(x.docId);
  const base = x.docId.replace(/^drafts\./, "");
  if (["garder", "main"].includes(x.decision)) { add("A7", x.titre, x.decision, "rien à faire"); continue; }
  if (!d) { add("A7", x.titre, x.decision, "IGNORÉ : brouillon introuvable (déjà traité ?)"); continue; }

  if (x.decision === "supprimer") {
    if (pubSet.has(base)) { add("A7", x.titre, x.decision, "IGNORÉ : une version publiée existe, seul un brouillon peut être supprimé ici"); continue; }
    backup.push(d);
    if (!dryRun) await client.delete(d._id);
    add("A7", x.titre, x.decision, (dryRun ? "à supprimer" : "supprimé") + ` (contenait ${words(d.content || d.body)} mots)`);
  } else if (x.decision === "remplir") {
    const ac = acBySlug.get(x.wpSlug);
    if (!ac || !ac.content?.length) { add("A7", x.titre, x.decision, `IGNORÉ : fiche « À classer » introuvable pour « ${x.wpSlug} »`); continue; }
    const field = fieldOf(d);
    const set = { [field]: uniqueKeys(ac.content) };
    const exF = d._type === "exhibition" ? "description" : "excerpt";
    if (!d[exF]) set[exF] = plain(ac.content).slice(0, 500);
    backup.push(d);
    if (!dryRun) await client.patch(d._id).ifRevisionId(d._rev).set(set).commit();
    add("A7", x.titre, x.decision, `${dryRun ? "à remplir" : "rempli"} : ${words(d[field])} → ${words(ac.content)} mots (reste un brouillon)`);
  } else if (x.decision === "publier") {
    if (pubSet.has(base)) { add("A7", x.titre, x.decision, "IGNORÉ : une version publiée existe déjà"); continue; }
    const doc = { ...d };
    for (const k of ["_createdAt", "_updatedAt", "_rev"]) delete doc[k];
    doc._id = base;
    let note = "";
    if (doc._type === "resource" && !doc.categoryRef) {
      const slug = doc.slug?.current;
      const c = planCatBySlug.get(slug);
      if (c && catBySlug.has(c)) {
        doc.categoryRef = { _type: "reference", _ref: catBySlug.get(c) };
        note = ` ; catégorie « ${c} » reprise du plan`;
      } else note = " ; ATTENTION : sans catégorie, la page n'apparaîtra pas sur le site";
    }
    backup.push(d);
    if (!dryRun) await client.transaction().createOrReplace(doc).delete(d._id).commit();
    add("A7", x.titre, x.decision, (dryRun ? "à publier" : "publié") + ` (${words(doc.content || doc.body)} mots)${note}`);
  }
}

// ---------- A2 ----------
for (const x of dec.a2) {
  if (x.decision !== "publier") { add("A2", x.titre, x.decision, "rien à faire"); continue; }
  const ac = acBySlug.get(x.slug);
  if (!ac || !x.categoryId) { add("A2", x.titre, x.decision, "IGNORÉ : fiche ou catégorie manquante"); continue; }
  const doc = { _id: `wp-resource-a2-${x.slug}`, _type: "resource", title: ac.title, slug: { _type: "slug", current: x.slug }, categoryRef: { _type: "reference", _ref: x.categoryId }, content: uniqueKeys(ac.content || []), excerpt: plain(ac.content).slice(0, 500), sourceUrl: ac.sourceUrl };
  if (!dryRun) await client.createOrReplace(doc);
  add("A2", x.titre, x.decision, dryRun ? "à créer" : "créé");
}

// ---------- A4 ----------
const wantImgs = dec.a4.filter((x) => x.decision === "ajouter");
for (const x of dec.a4.filter((y) => y.decision !== "ajouter")) add("A4", `${x.titre} — ${decodeURIComponent(x.url.split("/").pop())}`, x.decision, "rien à faire");
for (const x of wantImgs) {
  const label = `${x.titre} — ${decodeURIComponent(x.url.split("/").pop())}`;
  try {
    const res = await fetch(x.url);
    if (!res.ok) { add("A4", label, "ajouter", `ÉCHEC : téléchargement refusé (HTTP ${res.status})`); continue; }
    const buf = Buffer.from(await res.arrayBuffer());
    const slug = slugOfUrl(x.url) && acs.find((a) => a._id === x.ac) ? slugOfUrl(acs.find((a) => a._id === x.ac).sourceUrl) : x.slug;
    const targets = await client.fetch(`*[(_id==$ac) || (_type in ["resource","exhibition"] && slug.current==$slug)]`, { ac: x.ac, slug });
    if (!dryRun) {
      const asset = await client.assets.upload("image", buf, { filename: decodeURIComponent(x.url.split("/").pop().split("?")[0]) });
      for (const t of targets) {
        const f = t._type === "exhibition" ? "body" : "content";
        backup.push(t);
        const block = { _type: "imageWithLayout", _key: key(), image: { _type: "image", asset: { _type: "reference", _ref: asset._id } }, layout: "centered", size: "medium" };
        await client.patch(t._id).ifRevisionId(t._rev).set({ [f]: uniqueKeys([...(t[f] || []), block]) }).commit();
      }
    }
    add("A4", label, "ajouter", `${dryRun ? "téléchargeable (" + Math.round(buf.length / 1024) + " Ko), à ajouter" : "ajouté"} à ${targets.length} document(s)`);
  } catch (e) {
    add("A4", label, "ajouter", "ÉCHEC : " + String(e.message || e).slice(0, 80));
  }
}

// ---------- journaux ----------
const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
const dir = new URL("../../inventaire/", import.meta.url);
const csvName = `application_revue.${dryRun ? "simulation" : "resultat"}.csv`;
const cols = ["onglet", "titre", "decision", "statut"];
const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
fs.writeFileSync(new URL(csvName, dir), "﻿" + [cols.join(";"), ...log.map((r) => cols.map((c) => esc(r[c])).join(";"))].join("\n"));
if (!dryRun && backup.length) {
  const name = `backup_avant_revue_${stamp}.json`;
  fs.writeFileSync(new URL(name, dir), JSON.stringify(backup));
  console.log("Sauvegarde des documents touchés : inventaire/" + name);
}
const count = (re) => log.filter((r) => re.test(r.statut)).length;
console.log(
  `${dryRun ? "[simulation] " : ""}supprimés ${count(/^(à supprimer|supprimé)/)} | remplis ${count(/^(à remplir|rempli)/)} | publiés ${count(/^(à publier|publié)/)} | ` +
    `images ${count(/^(téléchargeable|ajouté)/)} | rien à faire ${count(/^rien/)} | problèmes ${count(/IGNORÉ|ÉCHEC|ATTENTION/)}`
);
for (const r of log.filter((x) => /IGNORÉ|ÉCHEC|ATTENTION/.test(x.statut))) console.log("  -", r.onglet, r.titre.slice(0, 50), "→", r.statut);
