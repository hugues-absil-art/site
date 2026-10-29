import { defineType, defineField } from "sanity";

export const series = defineType({
  name: "series",
  type: "document",
  title: "Série",
  fields: [
    defineField({
      name: "title",
      type: "string",
      title: "Titre",
      validation: (Rule) => Rule.required().error("Le titre est obligatoire : sans titre, le site peut planter."),
    }),
    defineField({
      name: "slug",
      type: "slug",
      title: "Slug",
      options: { source: "title" },
      validation: (Rule) => Rule.required(),
    }),
  ],
});
