import { defineType, defineField } from "sanity";
import { blockContent } from "./blockContent";
import { standardOrderings } from "./commonOrderings";

export const film = defineType({
  name: "film",
  type: "document",
  title: "Films",
  fields: [
    defineField({
      name: "title",
      type: "string",
      title: "Titre du film",
    }),
    defineField({
      name: "slug",
      type: "slug",
      title: "Slug",
      options: { source: "title" },
      description: "Optionnel, utile pour une page dédiée par film plus tard.",
    }),
    defineField({
      name: "director",
      type: "string",
      title: "Réalisateur",
      description: "Ex. nom du réalisateur (César du court métrage)",
    }),
    defineField({
      name: "directorUrl",
      type: "url",
      title: "Lien réalisateur",
      description: "Optionnel : site, IMDb, etc.",
    }),
    defineField({
      name: "year",
      type: "string",
      title: "Année",
      description: "Ex. 2025 ou « En cours »",
    }),
    defineField({
      name: "description",
      type: "text",
      title: "Résumé / intention",
    }),
    defineField({
      name: "videoUrl",
      type: "url",
      title: "URL de la vidéo",
      description: "Lien Vimeo, YouTube ou URL de diffusion",
    }),
    defineField({
      name: "posterImage",
      type: "image",
      title: "Affiche / image de couverture",
      options: { hotspot: true },
    }),
    defineField({
      name: "duration",
      type: "string",
      title: "Durée",
      description: "Ex. 52 min, Court métrage",
    }),
    defineField({
      name: "status",
      type: "string",
      title: "Statut",
      options: {
        list: [
          { value: "inProgress", title: "En cours" },
          { value: "postProduction", title: "En post-production" },
          { value: "released", title: "Sorti" },
        ],
      },
    }),
    defineField({
      name: "order",
      type: "number",
      title: "Ordre d'affichage",
      description: "Plus le nombre est petit, plus le film apparaît en premier.",
    }),
    defineField({
      name: "article",
      type: blockContent.name,
      title: "Article / note explicative",
      description:
        "Texte enrichi (paragraphes, images, vidéos, mise en page) comme pour un article de presse. Affiché dans un bloc « En savoir plus » sous la carte du film.",
    }),
  ],
  orderings: [
    { title: "Ordre (numéro)", name: "orderAsc", by: [{ field: "order", direction: "asc" }] },
    { title: "Année (récente)", name: "yearDesc", by: [{ field: "year", direction: "desc" }] },
    ...standardOrderings(),
  ],
  preview: {
    select: { title: "title", director: "director", year: "year" },
    prepare({ title, director, year }) {
      return {
        title: title || "Sans titre",
        subtitle: [director, year].filter(Boolean).join(" · ") || undefined,
      };
    },
  },
});
