import { defineType, defineField } from "sanity";

export const videoEmbed = defineType({
  name: "videoEmbed",
  type: "object",
  title: "Vidéo",
  description:
    "Collez une URL YouTube ou Vimeo : une vignette cliquable apparaît dans le texte (cours, expos, écrits…) (cours, expos, écrits…). Pour une vidéo en bas de fiche ressource, utilisez plutôt le champ « URL vidéo » du document.",
  fields: [
    defineField({
      name: "url",
      type: "url",
      title: "URL YouTube ou Vimeo",
      description: "Collez le lien de la vidéo (page ou embed). Ex. https://www.youtube.com/watch?v=…",
      validation: (Rule) =>
        Rule.required().uri({
          scheme: ["http", "https"],
          allowRelative: false,
        }),
    }),
    defineField({
      name: "title",
      type: "string",
      title: "Titre / Légende",
    }),
    defineField({
      name: "layout",
      type: "string",
      title: "Mise en page",
      description: "Flottant = le texte entoure la vignette. Pleine largeur = toute la colonne (la taille est alors ignorée).",
      options: {
        list: [
          { value: "floatLeft", title: "Flottant gauche (texte à droite)" },
          { value: "floatRight", title: "Flottant droite (texte à gauche)" },
          { value: "centered", title: "Centré" },
          { value: "betweenText", title: "Entre le texte" },
          { value: "fullWidth", title: "Pleine largeur" },
        ],
        layout: "radio",
      },
      initialValue: "floatLeft",
    }),
    defineField({
      name: "size",
      type: "string",
      title: "Taille de la vignette",
      description: "Sur le site, la vidéo n'est qu'une vignette : elle se lit en grand au clic. Ignorée si « Pleine largeur ».",
      options: {
        list: [
          { value: "small", title: "Petit (≈ 180 px)" },
          { value: "medium", title: "Moyen (≈ 290 px)" },
          { value: "large", title: "Grand (≈ 450 px)" },
        ],
        layout: "radio",
      },
      initialValue: "small",
    }),
  ],
  preview: {
    select: { title: "title", url: "url" },
    prepare({ title, url }) {
      return {
        title: title || "Vidéo",
        subtitle: url || "Sans URL",
      };
    },
  },
});
