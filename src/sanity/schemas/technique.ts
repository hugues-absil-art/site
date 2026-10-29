import { defineType, defineField } from "sanity";

export const technique = defineType({
  name: "technique",
  type: "document",
  title: "Technique",
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
