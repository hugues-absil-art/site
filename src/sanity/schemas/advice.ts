import { defineType, defineField } from "sanity";
import { blockContent } from "./blockContent";
import { standardOrderings } from "./commonOrderings";

export const advice = defineType({
  name: "advice",
  type: "document",
  title: "Journal",
  fields: [
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
      title: "Date",
    }),
    defineField({
      name: "category",
      type: "string",
      title: "Catégorie",
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
  ],
  orderings: standardOrderings("date", "Date"),
});
