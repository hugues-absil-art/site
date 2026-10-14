import { defineType, defineField } from "sanity";
import { blockContent } from "./blockContent";
import { standardOrderings } from "./commonOrderings";

export const contenuAClasser = defineType({
  name: "contenuAClasser",
  type: "document",
  title: "À classer",
  fields: [
    defineField({
      name: "sourceUrl",
      type: "url",
      title: "URL source",
      description: "URL de la page ou de la ressource d'origine",
    }),
    defineField({
      name: "title",
      type: "string",
      title: "Titre",
      description: "Titre extrait ou dérivé (ex. balise title, premier H1)",
    }),
    defineField({
      name: "content",
      type: blockContent.name,
      title: "Contenu",
      description: "Texte riche importé (crawl) : paragraphes, liens, images. À migrer vers la section définitive.",
    }),
    defineField({
      name: "extractedContent",
      type: "text",
      title: "Contenu extrait",
      description: "Texte brut extrait pour réutilisation ou copier-coller vers un type de document",
      rows: 10,
    }),
    defineField({
      name: "extractedAt",
      type: "datetime",
      title: "Date d'extraction",
    }),
    defineField({
      name: "contentType",
      type: "string",
      title: "Type de contenu",
      description: "Indication du type de page/section si détectable (ex. page_contact, bloc_footer)",
    }),
    defineField({
      name: "rawHtml",
      type: "text",
      title: "HTML brut",
      description: "HTML brut de la section, si utile pour reparser plus tard",
      rows: 6,
      hidden: ({ value }) => !value,
    }),
  ],
  orderings: standardOrderings("extractedAt", "Date d'extraction"),
  preview: {
    select: {
      title: "title",
      sourceUrl: "sourceUrl",
      extractedAt: "extractedAt",
    },
    prepare({ title, sourceUrl, extractedAt }) {
      const label = title || sourceUrl || "Sans titre";
      const date = extractedAt
        ? new Date(extractedAt).toLocaleDateString("fr-FR")
        : "";
      return {
        title: label,
        subtitle: date ? `Extrait le ${date}` : undefined,
      };
    },
  },
});
