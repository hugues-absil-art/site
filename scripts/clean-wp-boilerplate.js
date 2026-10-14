/**
 * Retire des contenus Sanity les restes de l'ancien WordPress :
 *  - la zone de commentaires : titre « Un commentaire » / « N commentaires », les commentaires, « Pingbacks »,
 *    jusqu'à « Laisser un commentaire Annuler la réponse. » inclus ;
 *  - « Continuer la lecture » (reste des pages de liste).
 * Les blocs placés APRÈS la zone de commentaires (ex. une image ajoutée ensuite) sont conservés.
 * Sauvegarde des documents modifiés, simulation avec --dry-run.
 *
 * Usage : node scripts/clean-wp-boilerplate.js [--dry-run]
 */
import fs from "node:fs";
import { client, hasToken } from "./lib/sanityClient.js";

const dryRun = process.argv.includes("--dry-run");
if (!hasToken && !dryRun) {
  console.error("SANITY_API_TOKEN requis (sauf --dry-run).");
  process.exit(1);
}

const TYPES = ["resource", "exhibition", "pressArticle", "advice", "contenuAClasser"];
const text = (b) => (b?._type === "block" ? (b.children || []).map((c) => c.text || "").join("").replace(/\s+/g, " ").trim() : "");
const HEADING = /^(Un commentaire|\d+ commentaires?|Pingbacks)$/;
const FORM = /^Laisser un commentaire\s*Annuler la réponse\.?$/;
const MORE = /^Continuer la lecture\s*»?$/;

function clean(blocks) {
  const out = [];
  let removed = 0;
  let inComments = false;
  for (const b of blocks) {
    const t = text(b);
    if (!inComments && HEADING.test(t)) { inComments = true; removed++; continue; }
    if (inComments) {
      removed++;
      if (FORM.test(t)) inComments = false; // fin de la zone : le bloc « Laisser un commentaire »
      continue;
    }
    if (FORM.test(t) || MORE.test(t)) { removed++; continue; }
    out.push(b);
  }
  // zone de commentaires sans fin trouvée : on ne touche pas au document (sécurité)
  return inComments ? null : { out, removed };
}

const docs = await client.fetch(`*[_type in $types]{_id,_rev,_type,title,content,body}`, { types: TYPES });
const log = [];
const backup = [];
let totalRemoved = 0;
const changes = [];
for (const d of docs) {
  const field = d._type === "exhibition" ? "body" : "content";
  const blocks = d[field];
  if (!Array.isArray(blocks) || blocks.length === 0) continue;
  const r = clean(blocks);
  if (r === null) { log.push(`IGNORÉ (zone de commentaires sans fin) : ${d._id} ${d.title}`); continue; }
  if (r.removed === 0) continue;
  totalRemoved += r.removed;
  backup.push({ _id: d._id, _rev: d._rev, field, [field]: blocks });
  changes.push({ id: d._id, rev: d._rev, field, out: r.out, removed: r.removed, title: d.title });
}
console.log(`${docs.length} documents analysés | ${changes.length} à nettoyer | ${totalRemoved} blocs retirés${log.length ? " | " + log.length + " ignorés" : ""}`);
if (!dryRun && changes.length) {
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  fs.writeFileSync(new URL(`../../inventaire/backup_avant_nettoyage_commentaires_${stamp}.json`, import.meta.url), JSON.stringify(backup));
  let n = 0;
  for (const c of changes) {
    await client.patch(c.id).ifRevisionId(c.rev).set({ [c.field]: c.out }).commit();
    if (++n % 100 === 0) console.log(`  ${n}/${changes.length}…`);
  }
  console.log(`Terminé : ${changes.length} documents nettoyés.`);
}
log.forEach((l) => console.log(" ", l));
