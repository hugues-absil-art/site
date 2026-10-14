/**
 * Convertit les blocs « image » natifs du champ Contenu en blocs « imageWithLayout »
 * (le schéma blockContent n'accepte plus l'image native : le Studio affiche
 * « Invalid Portable Text value »).
 *
 * Usage :
 *   node scripts/convert-images-to-image-with-layout.js [--type=contenuAClasser] [--dry-run]
 *
 * Options :
 *   --type=...  type de document à traiter (défaut : contenuAClasser)
 *   --dry-run   compte les blocs à convertir sans rien écrire
 *
 * .env : VITE_SANITY_PROJECT_ID, VITE_SANITY_DATASET, SANITY_API_TOKEN
 * Sont traités les documents publiés et leurs brouillons (drafts.*).
 */
import { client, hasToken } from "./lib/sanityClient.js";

const dryRun = process.argv.includes("--dry-run");
const typeArg = process.argv.find((a) => a.startsWith("--type="));
const docType = typeArg ? typeArg.slice(7).trim() : "contenuAClasser";

if (!hasToken && !dryRun) {
  console.error("SANITY_API_TOKEN requis (sauf --dry-run).");
  process.exit(1);
}

function convert(block) {
  if (!block || block._type !== "image") return block;
  const { asset, alt, _key, hotspot, crop } = block;
  return {
    _type: "imageWithLayout",
    _key,
    image: {
      _type: "image",
      asset,
      ...(hotspot ? { hotspot } : {}),
      ...(crop ? { crop } : {}),
    },
    ...(alt && !/^[\w\-]+$/.test(alt) ? { caption: alt } : {}),
    layout: "centered",
    size: "medium",
  };
}

const docs = await client.fetch(
  `*[_type == $type && count(content[_type == "image"]) > 0]{_id, title, content}`,
  { type: docType }
);
console.log(`${docs.length} document(s) « ${docType} » avec des images natives.`);

let blocks = 0;
let done = 0;
for (const doc of docs) {
  const n = doc.content.filter((b) => b._type === "image").length;
  blocks += n;
  if (dryRun) continue;
  await client.patch(doc._id).set({ content: doc.content.map(convert) }).commit();
  done++;
  if (done % 25 === 0) console.log(`  ${done}/${docs.length}…`);
}
console.log(
  dryRun
    ? `[dry-run] ${blocks} bloc(s) image seraient convertis dans ${docs.length} document(s).`
    : `Terminé : ${blocks} bloc(s) convertis dans ${done} document(s).`
);
