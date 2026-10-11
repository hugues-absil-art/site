/**
 * Recopie le contenu complet des fiches « À classer » vers les Ressources / Expositions
 * dont le texte est plus court (import tronqué). Ne modifie QUE content / body
 * (et l'extrait s'il est vide) : titre, catégorie, dates, slug restent intacts.
 *
 * Correspondance : slug du document = dernier segment de l'URL source de la fiche.
 * Un document n'est mis à jour que si sa version est nettement plus courte
 * (voir --ratio) que celle de la fiche.
 *
 * Usage :
 *   node scripts/refresh-content-from-a-classer.js [--ratio=0.85] [--dry-run]
 *
 * .env : VITE_SANITY_PROJECT_ID, VITE_SANITY_DATASET, SANITY_API_TOKEN
 * Traite les documents publiés et leurs brouillons (drafts.*).
 */
import fs from "node:fs";
import { client, hasToken } from "./lib/sanityClient.js";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const ratioArg = args.find((a) => a.startsWith("--ratio="));
const ratio = ratioArg ? parseFloat(ratioArg.slice(8)) : 0.85;

if (!hasToken && !dryRun) {
  console.error("SANITY_API_TOKEN requis (sauf --dry-run).");
  process.exit(1);
}

const slugOf = (url) =>
  String(url || "").split(/[?#]/)[0].replace(/\/+$/, "").split("/").pop();

function words(content) {
  if (!Array.isArray(content)) return 0;
  return content
    .filter((b) => b?._type === "block")
    .map((b) => (b.children || []).map((c) => c.text || "").join(" "))
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;
}

function plainText(content) {
  if (!Array.isArray(content)) return "";
  return content
    .filter((b) => b?._type === "block")
    .map((b) => (b.children || []).map((c) => c.text || "").join(""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

const [acDocs, targets] = await Promise.all([
  client.fetch(
    `*[_type=="contenuAClasser" && !(_id in path("drafts.**")) && sourceUrl match "*hugues-absil.com/wordpress/*"]{_id,sourceUrl,content}`
  ),
  client.fetch(
    `*[_type in ["resource","exhibition"] && defined(slug.current)]{_id,_type,"slug":slug.current,content,body,excerpt,description}`
  ),
]);

// meilleure fiche (la plus longue) par slug
const acBySlug = new Map();
for (const a of acDocs) {
  const s = slugOf(a.sourceUrl);
  const w = words(a.content);
  if (!acBySlug.has(s) || w > acBySlug.get(s).w) acBySlug.set(s, { w, content: a.content });
}

const rows = [];
let updated = 0;
for (const t of targets) {
  const ac = acBySlug.get(t.slug);
  if (!ac || !ac.content?.length) continue;
  const field = t._type === "exhibition" ? "body" : "content";
  const current = words(t[field]);
  if (current >= ac.w * ratio) continue;
  const set = { [field]: ac.content };
  const excerptField = t._type === "exhibition" ? "description" : "excerpt";
  if (!t[excerptField]) set[excerptField] = plainText(ac.content).slice(0, 500);
  rows.push({ id: t._id, type: t._type, slug: t.slug, avant: current, apres: ac.w });
  if (!dryRun) await client.patch(t._id).set(set).commit();
  updated++;
}

const out = "../../inventaire/refresh_contenus" + (dryRun ? ".simulation.csv" : ".resultat.csv");
fs.writeFileSync(
  new URL(out, import.meta.url),
  "﻿" +
    ["id;type;slug;mots_avant;mots_apres", ...rows.map((r) => `${r.id};${r.type};${r.slug};${r.avant};${r.apres}`)].join("\n")
);
console.log(
  `${dryRun ? "[simulation] " : ""}${updated} document(s) ${dryRun ? "seraient mis à jour" : "mis à jour"} ` +
    `(+${rows.reduce((s, r) => s + r.apres - r.avant, 0)} mots).`
);
