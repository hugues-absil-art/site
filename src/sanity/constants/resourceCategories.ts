/**
 * Catégories des documents Resource (Critiques / Enseignement).
 * Utilisées par le schéma Sanity (liste déroulante), les actions "Changer de section"
 * et les pages du site. Les sous-catégories imbriquées se gèrent dans Sanity (parent = toute catégorie
 * de la même section), pas dans cette liste. Pour une nouvelle racine, modifier ce fichier
 * et Critiques.tsx / Enseignement.tsx si besoin (liens et icônes).
 */
export const RESOURCE_CATEGORIES = [
  {
    value: "critiques-litteraires",
    label: "Critiques de livres d'art",
    description: "Articles et commentaires sur les livres d'art récents",
    section: "ecrits" as const,
  },
  {
    value: "oeil-expo",
    label: "Expositions à voir",
    description: "Articles sur les expositions récentes",
    section: "ecrits" as const,
  },
  {
    value: "atelier-stages",
    label: "Ateliers & Stages",
    description: "Stages de peinture, cours en atelier et formations pratiques",
    section: "enseignement" as const,
  },
  {
    value: "histoire-art",
    label: "Histoire de l'art",
    description: "Cours et contenus théoriques",
    section: "enseignement" as const,
  },
  {
    value: "technique-picturale",
    label: "Technique de création",
    description: "Cours sur les matériaux et techniques",
    section: "enseignement" as const,
  },
] as const;

export type ResourceCategoryValue = (typeof RESOURCE_CATEGORIES)[number]["value"];
export type ResourceCategorySection = (typeof RESOURCE_CATEGORIES)[number]["section"];

/** Pour le schéma Sanity : liste { title, value } pour la liste déroulante */
export const RESOURCE_CATEGORY_LIST_OPTIONS = RESOURCE_CATEGORIES.map((c) => ({
  title: c.label,
  value: c.value,
}));

/** Labels par valeur (pour ResourcePage, breadcrumbs, etc.) */
export const RESOURCE_CATEGORY_LABELS: Record<ResourceCategoryValue, string> = Object.fromEntries(
  RESOURCE_CATEGORIES.map((c) => [c.value, c.label])
) as Record<ResourceCategoryValue, string>;

/** Section (ecrits | enseignement) par valeur */
export const RESOURCE_CATEGORY_SECTION: Record<ResourceCategoryValue, ResourceCategorySection> =
  Object.fromEntries(RESOURCE_CATEGORIES.map((c) => [c.value, c.section])) as Record<
    ResourceCategoryValue,
    ResourceCategorySection
  >;

/** Infos complètes par valeur (pour ResourceCategoryPage : title, description, section) */
export const RESOURCE_CATEGORY_INFO: Record<
  ResourceCategoryValue,
  { title: string; description: string; section: ResourceCategorySection }
> = Object.fromEntries(
  RESOURCE_CATEGORIES.map((c) => [c.value, { title: c.label, description: c.description, section: c.section }])
) as Record<
  ResourceCategoryValue,
  { title: string; description: string; section: ResourceCategorySection }
>;
