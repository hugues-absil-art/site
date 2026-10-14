import { defineType, defineField } from "sanity";
import { blockContent } from "./blockContent";
import { standardOrderings } from "./commonOrderings";

export const pressArticle = defineType({
  name: "pressArticle",
  type: "document",
  title: "Article de presse",
  fields: [
    defineField({
      name: "title",
      type: "string",
      title: "Titre",
    }),
    defineField({
      name: "publication",
      type: "string",
      title: "Publication",
    }),
    defineField({
      name: "date",
      type: "date",
      title: "Date",
    }),
    defineField({
      name: "excerpt",
      type: "text",
      title: "Extrait",
    }),
    defineField({
      name: "url",
      type: "url",
      title: "URL",
    }),
    defineField({
      name: "videoUrl",
      type: "url",
      title: "URL de la vidéo (YouTube ou Vimeo)",
      description: "Optionnel. Affiche une miniature et un lecteur comme pour les films.",
    }),
    defineField({
      name: "image",
      type: "image",
      title: "Image",
      options: { hotspot: true },
    }),
    defineField({
      name: "slug",
      type: "slug",
      title: "Slug",
      options: { source: "title" },
    }),
    defineField({
      name: "content",
      type: blockContent.name,
      title: "Contenu",
    }),
  ],
  orderings: standardOrderings("date", "Date"),
});
