/**
 * Applique les décisions exportées par l'interface de revue (decisions_pages_tronquees.json).
 *
 * - rafraichir : le contenu de la page est remplacé par celui de la fiche « À classer » (version complète).
 * - fusion     : le contenu est reconstruit selon la « recette » (passages WordPress + passages conservés).
 * - autres décisions (garder, main, dupliquer) : ignorées ici.
 *
 * Sécurités :
 * - sauvegarde de l'état actuel de chaque document modifié (fichier JSON, pour pouvoir revenir en arrière) ;
 * - ifRevisionID : si une page a été modifiée depuis la lecture, elle est ignorée et signalée ;
 * - seuls content / body (et l'extrait s'il est vide) sont écrits.
 *
 * Usage :
 *   node scripts/apply-review-decisions.js --file=chemin/decisions.json [--dry-run]
 *
 * .env : VITE_SANITY_PROJECT_ID, VITE_SANITY_DATASET, SANITY_API_TOKEN
 */
import fs from "node:fs";
import crypto from "node:crypto";
import { client, hasToken } from "./lib/sanityClient.js";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const fileArg = args.find((a) => a.startsWith("--file="));
if (!fileArg) {
  console.error("Usage: node scripts/apply-review-decisions.js --file=decisions.json [--dry-run]");
  process.exit(1);
}
if (!hasToken && !dryRun) {
  console.error("SANITY_API_TOKEN requis (sauf --dry-run).");
  process.exit(1);
}
const decisions = JSON.parse(fs.readFileSync(fileArg.slice(7), "utf-8"));
const todo = decisions.filter((d) => d.decision === "rafraichir" || d.decision === "fusion");
const ignored = decisions.filter((d) => !todo.includes(d));

const words = (blocks) =>
  (blocks || [])
    .filter((b) => b?._type === "block")
    .map((b) => (b.children || []).map((c) => c.text || "").join(" "))
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;
const images = (blocks) => (blocks || []).filter((b) => b?._type === "imageWithLayout" || b?._type === "image").length;
const plain = (blocks) =>
  (blocks || [])
    .filter((b) => b?._type === "block")
    .map((b) => (b.children || []).map((c) => c.text || "").join(""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

const ids = [...new Set(todo.map((d) => d.docId))];
const acIds = [...new Set(todo.map((d) => d.acId))];
const [docs, acs] = await Promise.all([
  client.fetch(`*[_id in $ids]{_id,_type,_rev,content,body,excerpt,description}`, { ids }),
  client.fetch(`*[_id in $acIds]{_id,content}`, { acIds }),
]);
const docById = new Map(docs.map((d) => [d._id, d]));
const acById = new Map(acs.map((a) => [a._id, a]));

function uniqueKeys(blocks) {
  const seen = new Set();
  return blocks.map((b) => {
    let key = b._key || crypto.randomBytes(6).toString("hex");
    while (seen.has(key)) key = crypto.randomBytes(6).toString("hex");
    seen.add(key);
    return { ...b, _key: key };
  });
}

const report = [];
const backup = [];
let applied = 0;
let problems = 0;

for (const d of todo) {
  const doc = docById.get(d.docId);
  const ac = acById.get(d.acId);
  const row = { id: d.docId, titre: d.titre, decision: d.decision };
  if (!doc || !ac) {
    report.push({ ...row, statut: "IGNORÉ : document ou fiche introuvable" });
    problems++;
    continue;
  }
  const field = doc._type === "exhibition" ? "body" : "content";
  const current = doc[field] || [];
  const full = ac.content || [];
  let next;

  if (d.decision === "rafraichir") {
    next = full;
  } else {
    const parts = [];
    let bad = false;
    for (const it of d.recipe || []) {
      const src = it.s === "f" ? full : current;
      const b = src[it.b];
      if (!b) {
        bad = true;
        break;
      }
      parts.push(b);
    }
    if (bad || parts.length === 0) {
      report.push({ ...row, statut: "IGNORÉ : recette de fusion incohérente (page modifiée depuis l'export ?)" });
      problems++;
      continue;
    }
    next = parts;
  }
  next = uniqueKeys(next);

  const before = { mots: words(current), images: images(current) };
  const after = { mots: words(next), images: images(next) };
  if (d.decision === "fusion" && after.mots < before.mots) {
    report.push({ ...row, ...flat(before, after), statut: "IGNORÉ : le résultat aurait MOINS de texte que l'actuel" });
    problems++;
    continue;
  }
  backup.push({ _id: doc._id, _rev: doc._rev, field, [field]: current, excerpt: doc.excerpt, description: doc.description });
  const set = { [field]: next };
  const excerptField = doc._type === "exhibition" ? "description" : "excerpt";
  if (!doc[excerptField]) set[excerptField] = plain(next).slice(0, 500);
  if (!dryRun) {
    try {
      await client.patch(doc._id).ifRevisionId(doc._rev).set(set).commit();
    } catch (e) {
      report.push({ ...row, ...flat(before, after), statut: "ÉCHEC : " + (e.message || e).toString().slice(0, 90) });
      problems++;
      continue;
    }
  }
  applied++;
  report.push({ ...row, ...flat(before, after), statut: dryRun ? "à appliquer (simulation)" : "appliqué" });
}

function flat(b, a) {
  return { mots_avant: b.mots, mots_apres: a.mots, images_avant: b.images, images_apres: a.images };
}

const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
const dir = new URL("../../inventaire/", import.meta.url);
const csvName = `application_decisions.${dryRun ? "simulation" : "resultat"}.csv`;
const cols = ["id", "titre", "decision", "mots_avant", "mots_apres", "images_avant", "images_apres", "statut"];
const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
fs.writeFileSync(new URL(csvName, dir), "﻿" + [cols.join(";"), ...report.map((r) => cols.map((c) => esc(r[c])).join(";"))].join("\n"));
if (!dryRun && backup.length) {
  const bname = `backup_avant_application_${stamp}.json`;
  fs.writeFileSync(new URL(bname, dir), JSON.stringify(backup));
  console.log("Sauvegarde de l'état précédent :", "inventaire/" + bname);
}
const sum = (k) => report.filter((r) => typeof r[k] === "number").reduce((s, r) => s + r[k], 0);
console.log(
  `${dryRun ? "[simulation] " : ""}${applied} page(s) ${dryRun ? "seraient mises à jour" : "mises à jour"} sur ${todo.length} ` +
    `| mots ${sum("mots_avant")} -> ${sum("mots_apres")} | images ${sum("images_avant")} -> ${sum("images_apres")} | ` +
    `${problems} problème(s) | ${ignored.length} décision(s) non traitée(s) ici`
);
for (const r of report.filter((x) => /IGNORÉ|ÉCHEC/.test(x.statut))) console.log("  -", r.titre, "→", r.statut);
