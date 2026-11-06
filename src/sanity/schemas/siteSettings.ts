import { defineType, defineField } from "sanity";

export const siteSettings = defineType({
  name: "siteSettings",
  type: "document",
  title: "Paramètres du site",
  fields: [
    defineField({
      name: "siteName",
      type: "string",
      title: "Nom du site (en-tête, pied de page, copyright)",
      initialValue: "Hugues Absil",
    }),
    // Hero
    defineField({
      name: "heroImage",
      type: "image",
      title: "Image de fond (accueil)",
      description: "Utilisée si le diaporama ci-dessous est vide.",
      options: { hotspot: true },
    }),
    defineField({
      name: "heroImages",
      type: "array",
      title: "Images du diaporama (accueil)",
      description:
        "Liste des images qui défilent en fond à l'accueil (8 s par image, ordre conservé). Si cette liste n'est pas vide, elle remplace l'image unique ci-dessus. Glisser pour réordonner.",
      of: [
        {
          type: "object",
          fields: [
            { name: "image", type: "image", title: "Image", options: { hotspot: true } },
            { name: "alt", type: "string", title: "Texte alternatif" },
          ],
          preview: {
            select: { alt: "alt" },
            prepare: ({ alt }: { alt?: string }) => ({ title: alt ?? "Sans libellé" }),
          },
        },
      ],
    }),
    defineField({
      name: "heroImageAlt",
      type: "string",
      title: "Texte alternatif (image accueil)",
    }),
    defineField({
      name: "heroTitle",
      type: "string",
      title: "Titre principal (accueil)",
      initialValue: "Hugues Absil",
    }),
    defineField({
      name: "heroSubtitle",
      type: "string",
      title: "Sous-titre (accueil)",
      initialValue: "Artiste Contemporain",
    }),
    defineField({
      name: "heroCtaLabel",
      type: "string",
      title: "Texte du bouton (accueil)",
      initialValue: "Découvrir la Galerie",
    }),
    defineField({
      name: "galleryUseFeatured",
      type: "boolean",
      title: "Utiliser la sélection « À la une » pour la galerie",
      description:
        "Si activé, les œuvres marquées « À la une » sont affichées en premier (max. 20). Sinon, une sélection aléatoire de 20 œuvres est affichée.",
      initialValue: false,
    }),
    // Navigation
    defineField({
      name: "navItems",
      type: "array",
      title: "Liens du menu",
      of: [
        {
          type: "object",
          fields: [
            { name: "label", type: "string", title: "Libellé" },
            { name: "href", type: "string", title: "Ancre ou URL (ex. #gallery, #contact)" },
          ],
          preview: {
            select: { label: "label" },
            prepare: ({ label }: { label?: string }) => ({ title: label ?? "Sans libellé" }),
          },
        },
      ],
      initialValue: [
        { label: "Accueil", href: "#hero" },
        { label: "Galerie", href: "#gallery" },
        { label: "Expositions", href: "#exhibitions" },
        { label: "Biographie", href: "#biography" },
        { label: "Films", href: "#films" },
        { label: "Presse", href: "#press" },
        { label: "Performances", href: "#performances" },
        { label: "Écrits critiques", href: "#critiques" },
        { label: "Enseignement", href: "#enseignement" },
        { label: "Journal", href: "#journal" },
        { label: "Contact", href: "#contact" },
      ],
    }),
    // Footer
    defineField({
      name: "footerSubtitle",
      type: "string",
      title: "Sous-titre (pied de page)",
      initialValue: "Artiste contemporain.",
    }),
    defineField({
      name: "footerNavTitle",
      type: "string",
      title: "Titre bloc navigation (pied de page)",
      initialValue: "Navigation",
    }),
    defineField({
      name: "footerSocialTitle",
      type: "string",
      title: "Titre bloc réseaux (pied de page)",
      initialValue: "Réseaux Sociaux",
    }),
    defineField({
      name: "instagramUrl",
      type: "url",
      title: "Lien Instagram",
      description: "URL complète du profil (ex. https://www.instagram.com/votrenom). Ne pas mettre uniquement https://instagram.com.",
      placeholder: "https://www.instagram.com/votrenom",
    }),
    defineField({
      name: "linkedinUrl",
      type: "url",
      title: "Lien LinkedIn",
    }),
    defineField({
      name: "contactEmail",
      type: "string",
      title: "Email de contact",
      initialValue: "contact@huguesabsil.com",
    }),
    // Contact section
    defineField({
      name: "contactTitle",
      type: "string",
      title: "Titre section Contact",
      initialValue: "Contact",
    }),
    defineField({
      name: "contactIntro",
      type: "text",
      title: "Texte d'introduction (section Contact)",
      initialValue: "Pour toute question, demande d'information ou intérêt pour une œuvre",
    }),
    defineField({
      name: "contactInfoTitle",
      type: "string",
      title: "Titre bloc informations (Contact)",
      initialValue: "Informations",
    }),
    defineField({
      name: "contactInfoText",
      type: "text",
      title: "Texte bloc informations (Contact)",
      initialValue:
        "N'hésitez pas à me contacter pour toute demande concernant mes œuvres, les expositions à venir ou pour organiser une visite de l'atelier.",
    }),
    defineField({
      name: "contactSuccessMessage",
      type: "string",
      title: "Message après envoi réussi (formulaire)",
      initialValue: "Message envoyé avec succès ! Je vous répondrai dans les plus brefs délais.",
    }),
    defineField({
      name: "contactErrorMessage",
      type: "string",
      title: "Message en cas d'erreur (formulaire)",
      initialValue: "Une erreur est survenue. Veuillez réessayer.",
    }),
    defineField({
      name: "pressKit",
      type: "file",
      title: "Dossier de presse (PDF)",
      description:
        "Fichier PDF téléchargeable depuis la section Presse du site. Si vide, le lien de téléchargement est masqué.",
      options: {
        accept: "application/pdf",
      },
      validation: (Rule) =>
        Rule.custom((value) => {
          if (!value || typeof value !== "object") return true;
          const asset = (value as { asset?: { _ref?: string } }).asset;
          if (!asset?._ref) return true;
          // Les refs Sanity file sont du type file-<id>-pdf (ou autre extension)
          const ref = asset._ref;
          if (ref.includes("-pdf") || ref.endsWith("pdf")) return true;
          return "Veuillez uploader un fichier PDF.";
        }),
    }),
  ],
});
