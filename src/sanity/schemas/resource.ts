import { defineType, defineField } from "sanity";
import { blockContent } from "./blockContent";
import { RESOURCE_CATEGORY_LIST_OPTIONS } from "../constants/resourceCategories";
import { ResourceDocumentInput } from "../components/ResourceDocumentInput";
import {
  EDITOR_PROFILE_OPTIONS,
  isEditorProfile,
  shouldShowConditionalField,
  type EditorProfile,
} from "../lib/resourceEditorProfile";
import { standardOrderings } from "./commonOrderings";

function profileOf(document: Record<string, unknown> | undefined): EditorProfile | undefined {
  const p = document?.editorProfile;
  return isEditorProfile(p) ? p : undefined;
}

export const resource = defineType({
  name: "resource",
  type: "document",
  title: "Ressource",
  components: {
    input: ResourceDocumentInput,
  },
  fields: [
    defineField({
      name: "categoryRef",
      type: "reference",
      title: "Catégorie",
      to: [{ type: "resourceCategory" }],
      description:
        "Choisissez la catégorie en premier : le formulaire s’adapte ensuite (dates, atelier, etc.).",
    }),
    defineField({
      name: "editorProfile",
      type: "string",
      title: "Profil d’édition",
      description: "Synchronisé automatiquement depuis la catégorie.",
      options: {
        list: [...EDITOR_PROFILE_OPTIONS],
        layout: "radio",
      },
      hidden: true,
      readOnly: true,
    }),
    defineField({
      name: "title",
      type: "string",
      title: "Titre",
    }),
    defineField({
      name: "slug",
      type: "slug",
      title: "Slug",
      options: { source: "title" },
    }),
    defineField({
      name: "category",
      type: "string",
      title: "Catégorie (ancien)",
      description: "Champ conservé pour compatibilité. Préférer « Catégorie » (référence) ci-dessus.",
      options: {
        list: RESOURCE_CATEGORY_LIST_OPTIONS,
        layout: "dropdown",
      },
      hidden: ({ document }) => !!document?.categoryRef,
    }),
    defineField({
      name: "order",
      type: "number",
      title: "Ordre d'affichage",
      description:
        "Clé de tri uniquement (entiers ou décimales, ex. 1.5 entre 1 et 2). Le sommaire affiche 1, 2, 3… selon la position. Laisser vide pour tri par date.",
    }),
    defineField({
      name: "excerpt",
      type: "text",
      title: "Extrait",
    }),
    defineField({
      name: "content",
      type: blockContent.name,
      title: "Contenu",
    }),
    defineField({
      name: "date",
      type: "date",
      title: "Date / Date de début",
      description:
        "Pour les expositions à voir : date de début. Pour les articles : date de publication (optionnelle).",
      hidden: ({ document, value }) =>
        !shouldShowConditionalField("date", profileOf(document as Record<string, unknown>), value),
    }),
    defineField({
      name: "dateEnd",
      type: "date",
      title: "Date de fin",
      description: "Optionnel. Pour les expositions à voir, renseigner la date de fin.",
      hidden: ({ document, value }) =>
        !shouldShowConditionalField("dateEnd", profileOf(document as Record<string, unknown>), value),
    }),
    defineField({
      name: "coverImage",
      type: "image",
      title: "Image de couverture",
      options: { hotspot: true },
    }),
    defineField({
      name: "videoUrl",
      type: "url",
      title: "URL vidéo (bas de page)",
      description:
        "URL YouTube ou Vimeo affichée sous le contenu. Pour une vidéo au milieu du texte, utilisez plutôt le bloc « Vidéo » dans le Contenu.",
    }),
    defineField({
      name: "tags",
      type: "array",
      title: "Tags",
      of: [{ type: "string" }],
    }),
    defineField({
      name: "workshopDate",
      type: "string",
      title: "Date atelier",
      hidden: ({ document, value }) =>
        !shouldShowConditionalField("workshop", profileOf(document as Record<string, unknown>), value),
    }),
    defineField({
      name: "workshopDuration",
      type: "string",
      title: "Durée atelier",
      hidden: ({ document, value }) =>
        !shouldShowConditionalField("workshop", profileOf(document as Record<string, unknown>), value),
    }),
    defineField({
      name: "workshopPrice",
      type: "number",
      title: "Prix atelier",
      hidden: ({ document, value }) =>
        !shouldShowConditionalField("workshop", profileOf(document as Record<string, unknown>), value),
    }),
    defineField({
      name: "workshopLocation",
      type: "string",
      title: "Lieu atelier",
      hidden: ({ document, value }) =>
        !shouldShowConditionalField("workshop", profileOf(document as Record<string, unknown>), value),
    }),
    defineField({
      name: "workshopRegistrationLink",
      type: "url",
      title: "Lien inscription atelier",
      hidden: ({ document, value }) =>
        !shouldShowConditionalField("workshop", profileOf(document as Record<string, unknown>), value),
    }),
    defineField({
      name: "sourceUrl",
      type: "url",
      title: "URL source",
      description: "Page d’origine (ex. ancien site) après migration depuis « À classer ».",
      hidden: ({ document, value }) =>
        !shouldShowConditionalField("sourceUrl", profileOf(document as Record<string, unknown>), value),
    }),
  ],
  orderings: standardOrderings("date", "Date"),
  preview: {
    select: {
      title: "title",
      category: "category",
      categoryTitle: "categoryRef.title",
      parentTitle: "categoryRef.parent.title",
      order: "order",
      editorProfile: "editorProfile",
    },
    prepare({ title, category, categoryTitle, parentTitle, order, editorProfile }) {
      const parts: string[] = [];
      if (parentTitle) parts.push(parentTitle);
      if (categoryTitle) parts.push(categoryTitle);
      else if (category) parts.push(`${category} (ancien)`);
      if (editorProfile) parts.push(String(editorProfile));
      if (order != null) parts.push(`ordre ${order}`);
      return {
        title: title || "Sans titre",
        subtitle: parts.length > 0 ? parts.join(" · ") : "Sans catégorie",
      };
    },
  },
});
