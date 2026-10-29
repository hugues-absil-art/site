import {
  RESOURCE_CATEGORY_INFO,
  RESOURCE_CATEGORY_LABELS,
  type ResourceCategorySection,
} from "../sanity/constants/resourceCategories";
import { CRITIQUES_LABEL, sectionUrlPrefix } from "./resourceSection";

export type SearchGroup =
  | "painting"
  | "exhibition"
  | "press"
  | "ecrits"
  | "enseignement"
  | "journal"
  | "film"
  | "performance"
  | "page";

export interface SearchIndexItem {
  id: string;
  group: SearchGroup;
  title: string;
  href: string;
  excerpt?: string;
  meta?: string;
  imageUrl?: string | null;
  titleText: string;
  metaText: string;
  excerptText: string;
  bodyText: string;
}

export const SEARCH_GROUP_LABELS: Record<SearchGroup, string> = {
  painting: "Œuvres",
  exhibition: "Expositions",
  press: "Presse",
  ecrits: CRITIQUES_LABEL,
  enseignement: "Enseignement",
  journal: "Journal",
  film: "Films",
  performance: "Performances",
  page: "Pages",
};

export const SEARCH_GROUP_ORDER: SearchGroup[] = [
  "painting",
  "exhibition",
  "press",
  "ecrits",
  "enseignement",
  "journal",
  "film",
  "performance",
  "page",
];

export const MIN_QUERY_LENGTH = 2;
export const MAX_RESULTS_PER_GROUP = 8;
export const MAX_RESULTS_TOTAL = 24;

export const SEARCH_TIER = {
  title: 0,
  meta: 1,
  excerpt: 2,
  body: 3,
  mixed: 4,
} as const;

export type SearchTier = (typeof SEARCH_TIER)[keyof typeof SEARCH_TIER];

const categoryInfo = RESOURCE_CATEGORY_INFO as Record<
  string,
  { title: string; description: string; section: ResourceCategorySection }
>;
const categoryLabels = RESOURCE_CATEGORY_LABELS as Record<string, string>;

export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenizeQuery(query: string): string[] {
  return normalizeSearchText(query)
    .split(" ")
    .filter((token) => token.length > 0);
}

function joinParts(parts: Array<string | number | null | undefined>): string {
  return parts
    .map((part) => (part == null ? "" : String(part).trim()))
    .filter(Boolean)
    .join(" ");
}

function makeItem(input: {
  id: string;
  group: SearchGroup;
  title: string;
  href: string;
  excerpt?: string;
  meta?: string;
  imageUrl?: string | null;
  extraMeta?: string;
  bodyText?: string;
}): SearchIndexItem {
  const title = input.title.trim() || "Sans titre";
  return {
    id: input.id,
    group: input.group,
    title,
    href: input.href,
    excerpt: input.excerpt?.trim() || undefined,
    meta: input.meta?.trim() || undefined,
    imageUrl: input.imageUrl ?? null,
    titleText: title,
    metaText: joinParts([input.meta, input.extraMeta]),
    excerptText: input.excerpt ?? "",
    bodyText: input.bodyText ?? "",
  };
}

export function resourceSectionAndLeaf(resource: {
  category?: string | null;
  categoryRef?: {
    slug?: string | null;
    section?: ResourceCategorySection | null;
    title?: string | null;
  } | null;
}): { section: ResourceCategorySection; leaf: string } {
  const leaf = resource.categoryRef?.slug ?? resource.category ?? "";
  const fromInfo = leaf ? categoryInfo[leaf]?.section : undefined;
  const section = resource.categoryRef?.section ?? fromInfo ?? "ecrits";
  return { section, leaf };
}

export function resourceHref(resource: {
  slug?: string | null;
  category?: string | null;
  categoryRef?: {
    slug?: string | null;
    section?: ResourceCategorySection | null;
  } | null;
}): string {
  const { section, leaf } = resourceSectionAndLeaf(resource);
  const prefix = sectionUrlPrefix(section);
  if (!resource.slug) return `/${prefix}`;
  if (!leaf) return `/${prefix}/${resource.slug}`;
  return `/${prefix}/${leaf}/${resource.slug}`;
}

export function exhibitionHref(slug?: string | null): string {
  return slug ? `/expositions/${slug}` : "/#exhibitions";
}

export function pressHref(slug?: string | null): string {
  return slug ? `/presse/${slug}` : "/#press";
}

export function journalHref(slug?: string | null): string {
  return slug ? `/journal/${slug}` : "/#journal";
}

export function categoryIndexHref(section: ResourceCategorySection | string | null | undefined, slug: string): string {
  return `/${sectionUrlPrefix(section)}/${slug}`;
}

export type SearchIndexPayload = {
  paintings?: Array<{
    _id?: string;
    title?: string | null;
    year?: number | null;
    reference?: string | null;
    techniqueTitle?: string | null;
    themeTitle?: string | null;
    seriesTitle?: string | null;
    description?: string | null;
    imageUrl?: string | null;
  }> | null;
  exhibitions?: Array<{
    _id?: string;
    title?: string | null;
    slug?: string | null;
    venue?: string | null;
    city?: string | null;
    country?: string | null;
    description?: string | null;
    bodyText?: string | null;
    imageUrl?: string | null;
  }> | null;
  pressArticles?: Array<{
    _id?: string;
    title?: string | null;
    publication?: string | null;
    excerpt?: string | null;
    slug?: string | null;
    bodyText?: string | null;
    imageUrl?: string | null;
  }> | null;
  advice?: Array<{
    _id?: string;
    title?: string | null;
    slug?: string | null;
    excerpt?: string | null;
    tags?: string[] | null;
    category?: string | null;
    bodyText?: string | null;
    imageUrl?: string | null;
  }> | null;
  resources?: Array<{
    _id?: string;
    title?: string | null;
    slug?: string | null;
    category?: string | null;
    categoryRef?: {
      slug?: string | null;
      section?: ResourceCategorySection | null;
      title?: string | null;
    } | null;
    excerpt?: string | null;
    tags?: string[] | null;
    workshopLocation?: string | null;
    bodyText?: string | null;
    imageUrl?: string | null;
  }> | null;
  films?: Array<{
    _id?: string;
    title?: string | null;
    director?: string | null;
    year?: string | null;
    description?: string | null;
    bodyText?: string | null;
    imageUrl?: string | null;
  }> | null;
  performances?: Array<{
    _id?: string;
    title?: string | null;
  }> | null;
  biography?: {
    _id?: string;
    bodyText?: string | null;
    education?: string[] | null;
    awards?: string[] | null;
    nationality?: string | null;
    birthYear?: number | null;
  } | null;
  resourceCategories?: Array<{
    _id?: string;
    title?: string | null;
    slug?: string | null;
    description?: string | null;
    section?: ResourceCategorySection | null;
  }> | null;
};

const DEFAULT_PAGE_ITEMS: Array<{ id: string; title: string; href: string; extra?: string }> = [
  { id: "page-hero", title: "Accueil", href: "/#hero", extra: "home accueil" },
  { id: "page-gallery", title: "Galerie", href: "/#gallery", extra: "oeuvres tableaux peinture" },
  { id: "page-exhibitions", title: "Expositions", href: "/#exhibitions" },
  { id: "page-biography", title: "Biographie", href: "/#biography", extra: "artiste peintre" },
  { id: "page-films", title: "Films", href: "/#films" },
  { id: "page-press", title: "Presse", href: "/#press" },
  { id: "page-performances", title: "Performances", href: "/#performances" },
  { id: "page-critiques", title: CRITIQUES_LABEL, href: "/#critiques", extra: "ecrits écrits" },
  { id: "page-enseignement", title: "Enseignement", href: "/#enseignement", extra: "cours atelier" },
  { id: "page-journal", title: "Journal", href: "/#journal" },
  { id: "page-contact", title: "Contact", href: "/#contact" },
];

function buildPageItems(biography?: SearchIndexPayload["biography"]): SearchIndexItem[] {
  return DEFAULT_PAGE_ITEMS.map((page) => {
    if (page.id === "page-biography" && biography) {
      const extra = joinParts([
        biography.nationality,
        biography.birthYear,
        ...(biography.education ?? []),
        ...(biography.awards ?? []),
      ]);
      return makeItem({
        id: biography._id ?? page.id,
        group: "page",
        title: page.title,
        href: page.href,
        excerpt: joinParts([biography.nationality, biography.birthYear]),
        extraMeta: joinParts([page.extra, extra]),
        bodyText: biography.bodyText ?? "",
      });
    }
    return makeItem({
      id: page.id,
      group: "page",
      title: page.title,
      href: page.href,
      extraMeta: page.extra,
    });
  });
}

export function buildSearchIndexFromPayload(payload: SearchIndexPayload): SearchIndexItem[] {
  const items: SearchIndexItem[] = [];

  for (const painting of payload.paintings ?? []) {
    if (!painting?._id) continue;
    const meta = joinParts([painting.year, painting.reference]);
    items.push(
      makeItem({
        id: painting._id,
        group: "painting",
        title: painting.title ?? "Sans titre",
        href: "/#gallery",
        excerpt: painting.description ?? undefined,
        meta,
        imageUrl: painting.imageUrl,
        extraMeta: joinParts([painting.techniqueTitle, painting.themeTitle, painting.seriesTitle, painting.reference]),
        bodyText: painting.description ?? "",
      })
    );
  }

  for (const exhibition of payload.exhibitions ?? []) {
    if (!exhibition?._id) continue;
    const meta = joinParts([exhibition.venue, exhibition.city, exhibition.country]);
    items.push(
      makeItem({
        id: exhibition._id,
        group: "exhibition",
        title: exhibition.title ?? "Sans titre",
        href: exhibitionHref(exhibition.slug),
        excerpt: exhibition.description ?? undefined,
        meta,
        imageUrl: exhibition.imageUrl,
        extraMeta: meta,
        bodyText: exhibition.bodyText ?? exhibition.description ?? "",
      })
    );
  }

  for (const article of payload.pressArticles ?? []) {
    if (!article?._id) continue;
    items.push(
      makeItem({
        id: article._id,
        group: "press",
        title: article.title ?? "Sans titre",
        href: pressHref(article.slug),
        excerpt: article.excerpt ?? undefined,
        meta: article.publication ?? undefined,
        imageUrl: article.imageUrl,
        extraMeta: article.publication ?? "",
        bodyText: article.bodyText ?? "",
      })
    );
  }

  for (const post of payload.advice ?? []) {
    if (!post?._id) continue;
    items.push(
      makeItem({
        id: post._id,
        group: "journal",
        title: post.title ?? "Sans titre",
        href: journalHref(post.slug),
        excerpt: post.excerpt ?? undefined,
        meta: post.category ?? undefined,
        imageUrl: post.imageUrl,
        extraMeta: joinParts([post.category, ...(post.tags ?? [])]),
        bodyText: post.bodyText ?? "",
      })
    );
  }

  for (const resource of payload.resources ?? []) {
    if (!resource?._id) continue;
    const { section, leaf } = resourceSectionAndLeaf(resource);
    const categoryTitle = resource.categoryRef?.title ?? categoryLabels[leaf] ?? leaf;
    items.push(
      makeItem({
        id: resource._id,
        group: section,
        title: resource.title ?? "Sans titre",
        href: resourceHref(resource),
        excerpt: resource.excerpt ?? undefined,
        meta: categoryTitle || undefined,
        imageUrl: resource.imageUrl,
        extraMeta: joinParts([categoryTitle, resource.workshopLocation, ...(resource.tags ?? [])]),
        bodyText: resource.bodyText ?? "",
      })
    );
  }

  for (const film of payload.films ?? []) {
    if (!film?._id) continue;
    items.push(
      makeItem({
        id: film._id,
        group: "film",
        title: film.title ?? "Sans titre",
        href: "/#films",
        excerpt: film.description ?? undefined,
        meta: joinParts([film.director, film.year]) || undefined,
        imageUrl: film.imageUrl,
        extraMeta: joinParts([film.director, film.year]),
        bodyText: film.bodyText ?? film.description ?? "",
      })
    );
  }

  for (const performance of payload.performances ?? []) {
    if (!performance?._id || !performance.title) continue;
    items.push(
      makeItem({
        id: performance._id,
        group: "performance",
        title: performance.title,
        href: "/#performances",
      })
    );
  }

  for (const category of payload.resourceCategories ?? []) {
    if (!category?._id || !category.slug) continue;
    const section = category.section === "enseignement" ? "enseignement" : "ecrits";
    items.push(
      makeItem({
        id: category._id,
        group: section,
        title: category.title ?? category.slug,
        href: categoryIndexHref(section, category.slug),
        excerpt: category.description ?? undefined,
        meta: section === "enseignement" ? "Enseignement" : CRITIQUES_LABEL,
        extraMeta: category.slug,
        bodyText: category.description ?? "",
      })
    );
  }

  items.push(...buildPageItems(payload.biography));
  return items;
}

export function scoreSearchItem(item: SearchIndexItem, tokens: string[]): SearchTier | null {
  if (tokens.length === 0) return null;
  const title = normalizeSearchText(item.titleText);
  const meta = normalizeSearchText(item.metaText);
  const excerpt = normalizeSearchText(item.excerptText);
  const body = normalizeSearchText(item.bodyText);
  const all = `${title} ${meta} ${excerpt} ${body}`;
  if (!tokens.every((token) => all.includes(token))) return null;
  if (tokens.every((token) => title.includes(token))) return SEARCH_TIER.title;
  if (tokens.every((token) => meta.includes(token))) return SEARCH_TIER.meta;
  if (tokens.every((token) => excerpt.includes(token))) return SEARCH_TIER.excerpt;
  if (tokens.every((token) => body.includes(token))) return SEARCH_TIER.body;
  return SEARCH_TIER.mixed;
}

export function searchIndex(items: SearchIndexItem[], query: string): SearchIndexItem[] {
  const trimmed = query.trim();
  if (normalizeSearchText(trimmed).length < MIN_QUERY_LENGTH) return [];
  const tokens = tokenizeQuery(trimmed);
  if (tokens.length === 0) return [];

  const ranked = items
    .map((item) => {
      const tier = scoreSearchItem(item, tokens);
      return tier == null ? null : { item, tier };
    })
    .filter((row): row is { item: SearchIndexItem; tier: SearchTier } => row != null)
    .sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      return (a.item.title ?? "").localeCompare(b.item.title ?? "", "fr");
    });

  const usedByGroup: Partial<Record<SearchGroup, number>> = {};
  const results: SearchIndexItem[] = [];
  for (const row of ranked) {
    const used = usedByGroup[row.item.group] ?? 0;
    if (used >= MAX_RESULTS_PER_GROUP) continue;
    results.push(row.item);
    usedByGroup[row.item.group] = used + 1;
    if (results.length >= MAX_RESULTS_TOTAL) break;
  }
  return results;
}

export function groupSearchResults(results: SearchIndexItem[]): Array<{ group: SearchGroup; label: string; items: SearchIndexItem[] }> {
  const buckets = new Map<SearchGroup, SearchIndexItem[]>();
  for (const item of results) {
    const list = buckets.get(item.group) ?? [];
    list.push(item);
    buckets.set(item.group, list);
  }
  return SEARCH_GROUP_ORDER.filter((group) => (buckets.get(group)?.length ?? 0) > 0).map((group) => ({
    group,
    label: SEARCH_GROUP_LABELS[group],
    items: buckets.get(group) ?? [],
  }));
}

export function isSearchQueryReady(query: string): boolean {
  return normalizeSearchText(query).length >= MIN_QUERY_LENGTH;
}
