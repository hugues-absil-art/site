import { defineType, defineField } from "sanity";
import { ImageWithLayoutPreview } from "../components/ImageWithLayoutPreview";

export const imageWithLayout = defineType({
  name: "imageWithLayout",
  type: "object",
  title: "Image",
  description:
    "Pour que le texte entoure l'image, gardez « Flottant gauche » ou « Flottant droite ». Au clic, l'image s'agrandit sur le site.",
  fields: [
    defineField({
      name: "image",
      type: "image",
      title: "Image",
      options: { hotspot: true },
    }),
    defineField({
      name: "caption",
      type: "string",
      title: "Légende",
    }),
    defineField({
      name: "layout",
      type: "string",
      title: "Mise en page",
      description:
        "Flottant = le texte entoure l'image. Centré / Entre le texte = image seule sur sa ligne. Pleine largeur = toute la colonne (la taille est alors ignorée).",
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
      title: "Taille",
      description:
        "Au clic, le visiteur voit toujours l'image en grand : une petite taille ne gêne pas la lecture. Ignorée si « Pleine largeur ».",
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
  components: {
    preview: ImageWithLayoutPreview,
  },
  preview: {
    select: { caption: "caption", media: "image", layout: "layout" },
    prepare({ caption, media, layout }) {
      const layoutLabels: Record<string, string> = {
        fullWidth: "Pleine largeur",
        centered: "Centré",
        betweenText: "Entre le texte",
        floatLeft: "Flottant gauche",
        floatRight: "Flottant droite",
      };
      return {
        title: caption || "Image",
        subtitle: layout ? layoutLabels[layout] || layout : "Mise en page à définir",
        media,
        layout: layout || undefined,
      };
    },
  },
});
