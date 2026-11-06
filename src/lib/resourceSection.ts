/**
 * Section « Critiques » (anciennement « Écrits »).
 * La valeur Sanity `ecrits` est conservée pour les documents déjà publiés.
 * Les URLs et libellés publics utilisent « critiques ».
 */

export type ResourceSection = "ecrits" | "enseignement";

export const CRITIQUES_SANITY_VALUE = "ecrits" as const;
export const CRITIQUES_LABEL = "Écrits critiques";
export const CRITIQUES_URL_PREFIX = "critiques";
export const CRITIQUES_HASH_ID = "critiques";
export const LEGACY_CRITIQUES_URL_PREFIX = "ecrits";
export const LEGACY_CRITIQUES_HASH_ID = "ecrits";

export function isCritiquesSection(section: string | undefined | null): boolean {
  return section === CRITIQUES_SANITY_VALUE || section === CRITIQUES_URL_PREFIX;
}

/** Préfixe d’URL public (`critiques` | `enseignement`). */
export function sectionUrlPrefix(section: string | undefined | null): string {
  return isCritiquesSection(section) ? CRITIQUES_URL_PREFIX : "enseignement";
}

/** Ancre d’accueil (`/#critiques` | `/#enseignement`). */
export function sectionHomePath(section: string | undefined | null): string {
  return isCritiquesSection(section) ? `/${hashHref(CRITIQUES_HASH_ID)}` : "/#enseignement";
}

export function sectionBackLabel(section: string | undefined | null): string {
  return isCritiquesSection(section) ? "Retour aux écrits critiques" : "Retour à l'enseignement";
}

/** `#critiques` depuis un id d’ancre. */
export function hashHref(id: string): `#${string}` {
  return `#${id}`;
}

/** `#ecrits` (favoris / Sanity) → `#critiques`. */
export function resolveHomeHashId(rawId: string): string {
  return rawId === LEGACY_CRITIQUES_HASH_ID ? CRITIQUES_HASH_ID : rawId;
}

export function normalizeNavItem<T extends { label: string; href: string }>(item: T): T {
  const href =
    item.href === hashHref(LEGACY_CRITIQUES_HASH_ID) || item.href === `/${hashHref(LEGACY_CRITIQUES_HASH_ID)}`
      ? hashHref(CRITIQUES_HASH_ID)
      : item.href;
  const label =
    item.label === "Écrits" || item.label === "Ecrits" || item.label === "Critiques" ? CRITIQUES_LABEL : item.label;
  return { ...item, label, href };
}

export function normalizeNavItems<T extends { label: string; href: string }>(items: T[]): T[] {
  return items.map(normalizeNavItem);
}
