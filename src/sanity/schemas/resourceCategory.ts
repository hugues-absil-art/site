import { defineType, defineField } from "sanity";
import type { Reference } from "@sanity/types";
import { EDITOR_PROFILE_OPTIONS } from "../lib/resourceEditorProfile";

function canonicalId(id: string): string {
  return id.replace(/^drafts\./, "");
}

function idPair(id: string): string[] {
  const c = canonicalId(id.trim());
  if (!c) return [];
  return [c, `drafts.${c}`];
}

const SECTION_LABEL: Record<string, string> = {
  ecrits: "Critiques",
  critiques: "Critiques",
  enseignement: "Enseignement",
};

function buildBreadcrumbSubtitle(args: {
  section?: string;
  title?: string;
  p1?: string;
  p2?: string;
  p3?: string;
  p4?: string;
  p5?: string;
  p6?: string;
  p7?: string;
}): string {
  const sectionLabel = args.section ? SECTION_LABEL[args.section] ?? args.section : null;
  const chain = [args.p7, args.p6, args.p5, args.p4, args.p3, args.p2, args.p1, args.title].filter(
    (x): x is string => typeof x === "string" && x.trim() !== ""
  );
  const parts = [sectionLabel, ...chain].filter(Boolean) as string[];
  return parts.join(" › ");
}

export const resourceCategory = defineType({
  name: "resourceCategory",
  type: "document",
  title: "Catégorie (Critiques / Enseignement)",
  fields: [
    defineField({
      name: "title",
      type: "string",
      title: "Titre",
      description: "Affiché sur le site (ex. Histoire de l'art, Technique picturale)",
 
      validation: (Rule) => Rule.required().error("Le titre est obligatoire : sans titre, le site peut planter."),
    }),
    defineField({
      name: "slug",
      type: "slug",
      title: "Slug",
      description: "Utilisé dans l'URL (ex. histoire-art). Doit être unique parmi toutes les catégories.",
      options: { source: "title" },
      validation: (Rule) =>
        Rule.required().custom(async (value, context) => {
          const slug =
            value && typeof value === "object" && "current" in value
              ? String((value as { current?: string }).current ?? "").trim()
              : "";
          if (!slug) return true;
          const docId = context.document?._id;
          if (!docId) return true;
          const client = context.getClient({ apiVersion: "2024-01-01" });
          const exclude = idPair(docId);
          if (exclude.length === 0) return true;
          const n = await client.fetch<number>(
            `count(*[_type == "resourceCategory" && slug.current == $slug && !(_id in $exclude)])`,
            { slug, exclude }
          );
          return n > 0 ? "Ce slug est déjà utilisé par une autre catégorie." : true;
        }),
    }),
    defineField({
      name: "description",
      type: "text",
      title: "Description",
      description: "Courte description affichée sous le titre sur la page de la catégorie",
    }),
    defineField({
      name: "section",
      type: "string",
      title: "Section",
      options: {
        list: [
          { title: "Critiques", value: "ecrits" },
          { title: "Enseignement", value: "enseignement" },
        ],
        layout: "radio",
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "editorProfile",
      type: "string",
      title: "Profil d’édition",
      description:
        "Détermine les champs affichés sur les ressources de cette branche. Les sous-catégories héritent du parent si laissé vide. Recommandé sur les catégories racines (article, exposition, atelier, chapitre).",
      options: {
        list: [...EDITOR_PROFILE_OPTIONS],
        layout: "radio",
      },
    }),
    defineField({
      name: "parent",
      type: "reference",
      title: "Catégorie parente",
      // weak: évite le blocage publish si l’ancien parent a été supprimé (réf. fantôme).
      weak: true,
      to: [{ type: "resourceCategory" }],
      description:
        "Laissez vide pour une catégorie racine (carte sur l’accueil). Sinon choisissez n’importe quelle catégorie de la même section : vous pouvez imbriquer plusieurs niveaux (ex. Histoire de l’art → Dessin → Aquarelle). Si un point rouge apparaît, effacez la référence cassée puis publiez.",
      options: {
        filter: ({ document }) => {
          const sec = document?.section as string | undefined;
          const raw = String(document?._id ?? "");
          const exclude = idPair(raw);
          if (exclude.length === 0) {
            return { filter: "section == $sec", params: { sec: sec ?? "" } };
          }
          return {
            filter: "section == $sec && !(_id in $exclude)",
            params: { sec: sec ?? "", exclude },
          };
        },
      },
      validation: (Rule) =>
        Rule.custom(async (parentRef, context) => {
          if (!parentRef || typeof parentRef !== "object" || !("_ref" in parentRef)) return true;
          const ref = (parentRef as Reference)._ref;
          if (!ref) return true;
          const selfId = context.document?._id;
          if (!selfId) return true;
          const selfCanon = canonicalId(selfId);
          const client = context.getClient({ apiVersion: "2024-01-01" });
          const mySection = context.document?.section as string | undefined;

          let id: string | undefined = ref;
          const visited = new Set<string>();
          for (let depth = 0; depth < 52; depth++) {
            if (!id) return true;
            const canon = canonicalId(id);
            if (canon === selfCanon) {
              return "Une catégorie ne peut pas être son propre ancêtre (référence circulaire).";
            }
            if (visited.has(canon)) {
              return "Boucle détectée dans la hiérarchie des parents.";
            }
            visited.add(canon);

            // Le brouillon prime sur la version publiée : c'est lui que l'éditeur vient de modifier.
            const [pub, draft] = idPair(id);
            const row: { p?: string; s?: string } | null = await client.fetch<{
              p?: string;
              s?: string;
            } | null>(
              `(coalesce(*[_id == $draft][0], *[_id == $pub][0])){ "p": parent._ref, "s": section }`,
              { pub, draft }
            );
            if (!row) {
              // Réf. fantôme : ne pas bloquer (parent est weak). L’éditeur peut effacer le champ.
              return true;
            }
            if (mySection != null && row.s != null && row.s !== mySection) {
              return "Le parent doit appartenir à la même section (Critiques ou Enseignement).";
            }
            id = row.p ?? undefined;
          }
          return "Hiérarchie trop profonde (plus de 50 niveaux).";
        }),
    }),
    defineField({
      name: "order",
      type: "number",
      title: "Ordre d'affichage",
      description:
        "Tri des cartes (page d'accueil) ou des sous-catégories. Entiers ou décimales pour insérer sans tout renommer.",
    }),
    defineField({
      name: "showTableOfContents",
      type: "boolean",
      title: "Afficher un sommaire des chapitres",
      description:
        "Si activé, la page de cette catégorie pourra afficher une liste numérotée des articles rattachés directement à cette catégorie (navigation chapitre précédent / suivant).",
      initialValue: false,
    }),
  ],
  orderings: [
    { title: "Ordre d'affichage", name: "orderAsc", by: [{ field: "order", direction: "asc" }] },
    { title: "Titre", name: "titleAsc", by: [{ field: "title", direction: "asc" }] },
  ],
  preview: {
    select: {
      title: "title",
      section: "section",
      p1: "parent.title",
      p2: "parent.parent.title",
      p3: "parent.parent.parent.title",
      p4: "parent.parent.parent.parent.title",
      p5: "parent.parent.parent.parent.parent.title",
      p6: "parent.parent.parent.parent.parent.parent.title",
      p7: "parent.parent.parent.parent.parent.parent.parent.title",
    },
    prepare({ title, section, p1, p2, p3, p4, p5, p6, p7 }) {
      const crumb = buildBreadcrumbSubtitle({
        section,
        title,
        p1,
        p2,
        p3,
        p4,
        p5,
        p6,
        p7,
      });
      return {
        title: title || "Sans titre",
        subtitle: crumb || undefined,
      };
    },
  },
});
