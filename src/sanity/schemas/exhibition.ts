import { defineType, defineField } from "sanity";
import { blockContent } from "./blockContent";
import { standardOrderings } from "./commonOrderings";

export const exhibition = defineType({
  name: "exhibition",
  type: "document",
  title: "Exposition",
  orderings: standardOrderings("dateStart", "Date de début"),
  preview: {
    select: { title: "title", media: "image" },
    prepare({ title, media }) {
      return { title: title ?? "Sans titre", media };
    },
  },
  fields: [
    defineField({
      name: "title",
      type: "string",
      title: "Titre",
    }),
    defineField({
      name: "slug",
      type: "slug",
      title: "Slug (URL)",
      description:
        "Générez-le à partir du titre (bouton « Générer »). Nécessaire pour la page dédiée sur le site : /expositions/votre-slug. Sans slug, la carte reste cliquable uniquement vers un lien externe éventuel.",
      options: { source: "title", maxLength: 96 },
    }),
    defineField({
      name: "image",
      type: "image",
      title: "Image de couverture",
      description: "Affichée en liste sur le site et en tête de la fiche exposition. À défaut, la première image du « Contenu » peut servir de repli.",
      options: { hotspot: true },
    }),
    defineField({
      name: "description",
      type: "text",
      title: "Résumé court",
      description:
        "Texte d’accroche sur la liste d’expositions. Le détail du texte va sur la page dédiée si vous avez renseigné le slug et le bloc « Contenu ».",
    }),
    defineField({
      name: "body",
      type: blockContent.name,
      title: "Contenu",
      description: "Article de présentation sur la page dédiée (nécessite un slug). Images et mise en forme possibles.",
    }),
    defineField({
      name: "dateStart",
      type: "date",
      title: "Date de début",
    }),
    defineField({
      name: "dateEnd",
      type: "date",
      title: "Date de fin",
    }),
    defineField({
      name: "venue",
      type: "string",
      title: "Lieu",
    }),
    defineField({
      name: "city",
      type: "string",
      title: "Ville",
    }),
    defineField({
      name: "country",
      type: "string",
      title: "Pays",
    }),
    defineField({
      name: "externalLink",
      type: "url",
      title: "Lien externe",
    }),
    defineField({
      name: "type",
      type: "string",
      title: "Type (facultatif)",
      description:
        "Champ libre non utilisé par le site pour l’instant (ex. « personnelle », « collective », « foire »). Vous pouvez le laisser vide.",
    }),
  ],
});
