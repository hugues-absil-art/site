import { defineType, defineField } from "sanity";
import { standardOrderings } from "./commonOrderings";

export const performance = defineType({
  name: "performance",
  type: "document",
  title: "Performance",
  fields: [
    defineField({
      name: "title",
      type: "string",
      title: "Titre",
      description: "Titre optionnel de la vidéo (ex. nom de l'événement, lieu)",
    }),
    defineField({
      name: "description",
      type: "text",
      title: "Description",
      description: "Texte optionnel accompagnant la vidéo (contexte, lieu, date…).",
      rows: 4,
    }),
    defineField({
      name: "url",
      type: "url",
      title: "URL YouTube",
      description: "URL de la vidéo YouTube (partagée ou embed)",
      validation: (Rule) =>
        Rule.uri({
          scheme: ["http", "https"],
          allowRelative: false,
        }),
    }),
    defineField({
      name: "order",
      type: "number",
      title: "Ordre d'affichage",
      description: "Plus le nombre est petit, plus la vidéo apparaît en premier",
      initialValue: 0,
    }),
  ],
  orderings: [
    {
      title: "Ordre d'affichage",
      name: "orderAsc",
      by: [{ field: "order", direction: "asc" }],
    },
    ...standardOrderings(),
  ],
  preview: {
    select: { title: "title", url: "url", description: "description" },
    prepare({
      title,
      url,
      description,
    }: {
      title?: string;
      url?: string;
      description?: string;
    }) {
      const label = title || "Sans titre";
      const id = url ? extractYoutubeId(url) : null;
      const subtitleParts = [
        id ? `YouTube: ${id}` : url || "—",
        description?.trim() ? description.trim().slice(0, 60) : null,
      ].filter(Boolean);
      return {
        title: label,
        subtitle: subtitleParts.join(" · "),
      };
    },
  },
});

function extractYoutubeId(url: string): string | null {
  const match =
    url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?/]+)/) ?? null;
  return match ? match[1] : null;
}
