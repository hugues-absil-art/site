import { defineType, defineField } from "sanity";
import { blockContent } from "./blockContent";
import { series } from "./series";
import { technique } from "./technique";
import { theme } from "./theme";
import { paintingStatus } from "./paintingStatus";
import { ReferenceFieldInput } from "../components/ReferenceFieldInput";
import { standardOrderings } from "./commonOrderings";

export const painting = defineType({
  name: "painting",
  type: "document",
  title: "Tableau",
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
      name: "year",
      type: "number",
      title: "Année",
    }),
    defineField({
      name: "reference",
      type: "string",
      title: "Référence (catalogue)",
      description:
        "Cote interne : 2 chiffres d’année + code média + numéro. T toile · D dessin · A céramique utilitaire · CE carreaux céramique · C carnet · G gravure · L lithographie · M monotype · S sculpture. Ex. 24T05, 24CE03.",
      components: {
        input: ReferenceFieldInput,
      },
    }),
    defineField({
      name: "technique",
      type: "reference",
      title: "Technique",
      to: [{ type: technique.name }],
    }),
    defineField({
      name: "theme",
      type: "reference",
      title: "Thème",
      to: [{ type: theme.name }],
    }),
    defineField({
      name: "status",
      type: "reference",
      title: "Statut",
      to: [{ type: paintingStatus.name }],
    }),
    defineField({
      name: "dimensions",
      type: "string",
      title: "Dimensions",
    }),
    defineField({
      name: "description",
      type: "text",
      title: "Description",
    }),
    defineField({
      name: "price",
      type: "number",
      title: "Prix",
    }),
    defineField({
      name: "image",
      type: "image",
      title: "Image",
      options: { hotspot: true },
    }),
    defineField({
      name: "inSituImages",
      type: "array",
      title: "Images in situ",
      of: [{ type: "image", options: { hotspot: true } }],
    }),
    defineField({
      name: "series",
      type: "reference",
      title: "Série",
      to: [{ type: series.name }],
    }),
    defineField({
      name: "gallery",
      type: "boolean",
      title: "Afficher dans la galerie",
      initialValue: false,
    }),
    defineField({
      name: "featured",
      type: "boolean",
      title: "À la une",
      description:
        "Afficher cette œuvre en premier dans la galerie si l'option « Utiliser la sélection À la une » est activée dans les paramètres du site.",
      initialValue: false,
    }),
    defineField({
      name: "precisions",
      type: blockContent.name,
      title: "Précisions sur l'œuvre",
      description:
        "Texte, images ou vidéos en lien avec l'œuvre (explications, œuvres ayant inspiré, etc.). Même éditeur que le contenu des articles de presse.",
    }),
  ],
  orderings: standardOrderings("year", "Année"),
});
