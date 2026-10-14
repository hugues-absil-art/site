import type { SanityImageSource } from "@sanity/image-url";
import { getSanityClient, urlFor } from "./client";
import {
  paintingsQuery,
  exhibitionsQuery,
  exhibitionBySlugQuery,
  biographyQuery,
  siteSettingsQuery,
  pressArticlesQuery,
  pressArticleBySlugQuery,
  pressQuotesQuery,
  advicePostsQuery,
  adviceBySlugQuery,
  performancesQuery,
  filmsQuery,
  resourcesQuery,
  resourcesByCategoryQuery,
  resourceBySlugQuery,
  resourceCategoriesQuery,
  searchIndexQuery,
} from "./queries";
import {
  buildSearchIndexFromPayload,
  type SearchIndexItem,
  type SearchIndexPayload,
} from "@/lib/search";
import { slugsFromCategoryRef, type CategoryRefNode } from "./categoryRefUtils";
import { normalizeNavItem } from "@/lib/resourceSection";

const isClientAvailable = () => getSanityClient() !== null;

function resolveExhibitionImageUrl(row: {
  imageUrl?: string | null;
  image?: SanityImageSource | null;
}): string | undefined {
  const u = row.imageUrl;
  if (u != null && String(u).trim() !== "") return String(u).trim();
  if (row.image == null) return undefined;
  try {
    return urlFor(row.image).width(1600).quality(85).url();
  } catch {
    return undefined;
  }
}

function normalizeExhibitionFromSanityRow(row: Record<string, unknown>): Exhibition {
  const { image, imageUrl, coverFallbackUrl, ...rest } = row;
  const fromMain = imageUrl != null && String(imageUrl).trim() !== "" ? String(imageUrl).trim() : "";
  const fromBody =
    coverFallbackUrl != null && String(coverFallbackUrl).trim() !== ""
      ? String(coverFallbackUrl).trim()
      : "";
  const resolved = resolveExhibitionImageUrl({
    imageUrl: fromMain || fromBody || null,
    image: image as SanityImageSource | null | undefined,
  });
  return {
    ...rest,
    imageUrl: resolved,
  } as Exhibition;
}

export type PaintingRef = { _id: string; title: string; slug?: string | null };

export interface Painting {
  _id: string;
  title: string;
  slug: string;
  year: number;
  /** Cote catalogue (ex. 24T05, 24CE03) */
  reference?: string | null;
  technique?: PaintingRef | null;
  theme?: PaintingRef | null;
  status?: PaintingRef | null;
  dimensions?: string;
  description?: string;
  price?: number;
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  inSituImageUrls?: string[];
  series?: PaintingRef | null;
  featured?: boolean;
  precisions?: unknown;
}

export interface Exhibition {
  _id: string;
  title: string;
  /** Présent si renseigné dans Sanity (page /expositions/:slug). */
  slug?: string | null;
  type?: string;
  dateStart?: string;
  dateEnd?: string;
  venue?: string;
  city?: string;
  country?: string;
  externalLink?: string;
  status: "current" | "upcoming" | "past";
  imageUrl?: string;
  description?: string;
  /** Contenu riche (page dédiée si slug ; sinon affichage liste hérité). */
  body?: unknown;
}

export interface Biography {
  _id: string;
  text: unknown;
  portraitUrl: string;
  birthYear: number;
  nationality: string;
  education?: string[];
  awards?: string[];
  professionalActivities?: string[];
  gallery?: string;
  diplomas?: Array<{
    year: number;
    title: string;
    institution: string;
    details?: string;
  }>;
}

export interface PressArticle {
  _id: string;
  title: string;
  publication: string;
  date?: string | null;
  excerpt: string;
  url?: string;
  videoUrl?: string | null;
  imageUrl?: string;
  slug?: string | null;
  content?: unknown;
}

export interface PressQuote {
  _id: string;
  quote: string;
  author: string;
  publication: string;
  date: string;
}

export interface AdvicePost {
  _id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: unknown;
  date: string;
  category: string;
  imageUrl: string;
  videoUrl?: string;
  tags?: string[];
}

export interface Performance {
  _id: string;
  title?: string | null;
  description?: string | null;
  url: string;
}

export interface Film {
  _id: string;
  title: string;
  slug?: string | null;
  director?: string;
  directorUrl?: string;
  year?: string;
  description?: string;
  videoUrl?: string;
  posterImageUrl?: string;
  duration?: string;
  status?: string;
  order?: number;
  article?: unknown;
}

export interface Resource {
  _id: string;
  title: string;
  slug: string;
  /** Slug de la catégorie feuille (categoryRef.slug ?? ancien champ category) */
  category: string;
  /** Chaîne racine → feuille (slugs), pour pages ancêtres et arbres. */
  categoryAncestorSlugs?: string[];
  excerpt: string;
  content: unknown;
  date: string;
  dateEnd?: string;
  /** Calculé (GROQ) à partir de date/dateEnd ; dates invalides ou sans dateEnd → past */
  status?: "current" | "upcoming" | "past";
  /** Clé de tri (décimales possibles). Le numéro affiché dans le sommaire est le rang après tri, pas ce champ. Vide = tri par date. */
  order?: number;
  /** Référence catégorie Sanity (si renseignée) */
  categoryRef?: {
    _id: string;
    title: string;
    slug: string;
    section: "ecrits" | "enseignement";
    showTableOfContents?: boolean;
    parent?: CategoryRefNode | null;
  };
  imageUrl: string;
  videoUrl?: string;
  tags?: string[];
  workshopDate?: string;
  workshopDuration?: string;
  workshopPrice?: number;
  workshopLocation?: string;
  workshopRegistrationLink?: string;
  /** Page d’origine (migration) — non requis pour l’affichage public. */
  sourceUrl?: string;
}

export interface ResourceCategory {
  _id: string;
  title: string;
  slug: string;
  description?: string;
  section: "ecrits" | "enseignement";
  order?: number;
  showTableOfContents?: boolean;
  /** Catégorie parente (sous-catégories n'apparaissent pas comme cartes sur l'accueil) */
  parent?: { _id: string; slug: string };
}

export interface NavItem {
  label: string;
  href: string;
}

export interface HeroImageItem {
  url: string;
  alt?: string | null;
}

export interface SiteSettings {
  heroImageUrl: string | null;
  heroImageAlt?: string | null;
  heroImages?: HeroImageItem[] | null;
  siteName?: string | null;
  heroTitle?: string | null;
  heroSubtitle?: string | null;
  heroCtaLabel?: string | null;
  navItems?: NavItem[] | null;
  footerSubtitle?: string | null;
  footerNavTitle?: string | null;
  footerSocialTitle?: string | null;
  instagramUrl?: string | null;
  linkedinUrl?: string | null;
  contactEmail?: string | null;
  contactTitle?: string | null;
  contactIntro?: string | null;
  contactInfoTitle?: string | null;
  contactInfoText?: string | null;
  contactSuccessMessage?: string | null;
  contactErrorMessage?: string | null;
  galleryUseFeatured?: boolean | null;
  pressKitUrl?: string | null;
  pressKitFilename?: string | null;
}

const HERO_IMAGE_FALLBACK_URL =
  "https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=1920&h=1080&fit=crop";
const HERO_IMAGE_FALLBACK_ALT = "Œuvre de Hugues Absil";

const DEFAULT_NAV_ITEMS: NavItem[] = [
  { label: "Accueil", href: "#hero" },
  { label: "Galerie", href: "#gallery" },
  { label: "Expositions", href: "#exhibitions" },
  { label: "Biographie", href: "#biography" },
  { label: "Presse", href: "#press" },
  { label: "Performances", href: "#performances" },
  { label: "Critiques", href: "#critiques" },
  { label: "Enseignement", href: "#enseignement" },
  { label: "Journal", href: "#journal" },
  { label: "Contact", href: "#contact" },
];

function normalizeHeroImages(raw: unknown): HeroImageItem[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const items: HeroImageItem[] = [];
  for (const entry of raw) {
    const url =
      entry && typeof entry === "object" && "url" in entry && typeof (entry as { url: unknown }).url === "string"
        ? (entry as { url: string }).url
        : null;
    if (!url) continue;
    const alt =
      entry && typeof entry === "object" && "alt" in entry
        ? (entry as { alt?: string | null }).alt ?? null
        : null;
    items.push({ url, alt });
  }
  return items.length > 0 ? items : null;
}

function isSanityConfigured(): boolean {
  return isClientAvailable();
}

const FALLBACK_TECHNIQUE_LABELS: Record<string, string> = {
  oil: "Huile",
  acrylic: "Acrylique",
  pastel: "Pastel",
  charcoal: "Fusain",
  mixed: "Technique Mixte",
};
const FALLBACK_THEME_LABELS: Record<string, string> = {
  portrait: "Portrait",
  landscape: "Paysage",
  abstract: "Abstrait",
  still_life: "Nature Morte",
  urban: "Urbain",
};
const FALLBACK_STATUS_LABELS: Record<string, string> = {
  available: "Disponible",
  reserved: "Réservé",
  private_collection: "Collection Privée",
};

function normalizeFallbackPainting(p: {
  id: string;
  title: string;
  year: number;
  reference?: string | null;
  technique?: string;
  theme?: string;
  status?: string;
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  description?: string;
  dimensions?: string;
  price?: number;
  series?: { _id: string; title: string; slug?: string | null };
  featured?: boolean;
}): Painting {
  return {
    _id: p.id,
    slug: p.id,
    title: p.title,
    year: p.year,
    reference: p.reference ?? undefined,
    technique:
      p.technique != null
        ? { _id: p.technique, title: FALLBACK_TECHNIQUE_LABELS[p.technique] ?? p.technique, slug: p.technique }
        : null,
    theme:
      p.theme != null
        ? { _id: p.theme, title: FALLBACK_THEME_LABELS[p.theme] ?? p.theme, slug: p.theme }
        : null,
    status:
      p.status != null
        ? { _id: p.status, title: FALLBACK_STATUS_LABELS[p.status] ?? p.status, slug: p.status }
        : null,
    dimensions: p.dimensions,
    description: p.description,
    price: p.price,
    imageUrl: p.imageUrl,
    imageWidth: p.imageWidth,
    imageHeight: p.imageHeight,
    series: p.series ?? null,
    featured: p.featured ?? false,
  };
}

export async function getPaintings(): Promise<Painting[]> {
  if (!isSanityConfigured()) {
    const { paintings } = await import("@/data/paintings");
    return paintings.map((p) => normalizeFallbackPainting(p));
  }
  try {
    const _sanity = getSanityClient();
    if (!_sanity) throw new Error("Sanity client not configured");
    const result = await _sanity.fetch(paintingsQuery);
    if (result && result.length > 0) {
      return result.map((p: { featured?: boolean }) => ({ ...p, featured: p.featured ?? false }));
    }
    const { paintings } = await import("@/data/paintings");
    return paintings.map((p) => normalizeFallbackPainting(p));
  } catch (error) {
    console.error("Error fetching paintings:", error);
    const { paintings } = await import("@/data/paintings");
    return paintings.map((p) => normalizeFallbackPainting(p));
  }
}

export async function getExhibitions(): Promise<Exhibition[]> {
  if (!isSanityConfigured()) {
    const { exhibitions } = await import("@/data/exhibitions");
    return exhibitions.map((e) => ({
      _id: e.id,
      type: "exhibition",
      title: e.title,
      dateStart: e.startDate,
      dateEnd: e.endDate,
      venue: e.gallery,
      city: e.city,
      country: e.country,
      status: e.status,
      externalLink: e.websiteUrl,
      description: e.description,
      imageUrl: e.imageUrl,
    }));
  }
  try {
    const _sanity = getSanityClient();
    if (!_sanity) throw new Error("Sanity client not configured");
    const result = await _sanity.fetch(exhibitionsQuery);
    if (result && result.length > 0) {
      return (result as Array<Record<string, unknown>>).map(normalizeExhibitionFromSanityRow);
    }
    const { exhibitions } = await import("@/data/exhibitions");
    return exhibitions.map((e) => ({
      _id: e.id,
      type: "exhibition",
      title: e.title,
      dateStart: e.startDate,
      dateEnd: e.endDate,
      venue: e.gallery,
      city: e.city,
      country: e.country,
      status: e.status,
      externalLink: e.websiteUrl,
      description: e.description,
      imageUrl: e.imageUrl,
    }));
  } catch (error) {
    console.error("Error fetching exhibitions:", error);
    const { exhibitions } = await import("@/data/exhibitions");
    return exhibitions.map((e) => ({
      _id: e.id,
      type: "exhibition",
      title: e.title,
      dateStart: e.startDate,
      dateEnd: e.endDate,
      venue: e.gallery,
      city: e.city,
      country: e.country,
      status: e.status,
      externalLink: e.websiteUrl,
      description: e.description,
      imageUrl: e.imageUrl,
    }));
  }
}

export async function getExhibitionBySlug(slug: string): Promise<Exhibition | null> {
  const _sanity = getSanityClient();
  if (!isSanityConfigured() || !_sanity) return null;
  try {
    const raw = await _sanity.fetch(exhibitionBySlugQuery, { slug });
    if (!raw || !(raw as { _id?: string })._id) return null;
    return normalizeExhibitionFromSanityRow(raw as Record<string, unknown>);
  } catch (error) {
    console.error("Error fetching exhibition by slug:", error);
    return null;
  }
}

export async function getBiography(): Promise<Biography | null> {
  if (!isSanityConfigured()) {
    const { biography } = await import("@/data/bio");
    return {
      _id: "bio-1",
      text: [{ _type: "block", children: [{ _type: "span", text: biography.text }] }],
      portraitUrl: biography.portraitUrl,
      birthYear: biography.birthYear,
      nationality: biography.nationality,
      education: biography.education,
      awards: biography.awards,
      professionalActivities: biography.professionalActivities,
      gallery: biography.gallery,
      diplomas: biography.diplomas,
    };
  }
  try {
    const _sanity = getSanityClient();
    if (!_sanity) throw new Error("Sanity client not configured");
    const bio = await _sanity.fetch(biographyQuery);
    if (bio) return bio;
    const { biography } = await import("@/data/bio");
    return {
      _id: "bio-1",
      text: [{ _type: "block", children: [{ _type: "span", text: biography.text }] }],
      portraitUrl: biography.portraitUrl,
      birthYear: biography.birthYear,
      nationality: biography.nationality,
      education: biography.education,
      awards: biography.awards,
      professionalActivities: biography.professionalActivities,
      gallery: biography.gallery,
      diplomas: biography.diplomas,
    };
  } catch (error) {
    console.error("Error fetching biography:", error);
    const { biography } = await import("@/data/bio");
    return {
      _id: "bio-1",
      text: [{ _type: "block", children: [{ _type: "span", text: biography.text }] }],
      portraitUrl: biography.portraitUrl,
      birthYear: biography.birthYear,
      nationality: biography.nationality,
      education: biography.education,
      awards: biography.awards,
      professionalActivities: biography.professionalActivities,
      gallery: biography.gallery,
      diplomas: biography.diplomas,
    };
  }
}

export async function getSiteSettings(): Promise<SiteSettings> {
  const fallback: SiteSettings = {
    heroImageUrl: HERO_IMAGE_FALLBACK_URL,
    heroImageAlt: HERO_IMAGE_FALLBACK_ALT,
    heroImages: null,
    siteName: "Hugues Absil",
    heroTitle: "Hugues Absil",
    heroSubtitle: "Artiste Contemporain",
    heroCtaLabel: "Découvrir la Galerie",
    navItems: DEFAULT_NAV_ITEMS,
    footerSubtitle: "Artiste contemporain.",
    footerNavTitle: "Navigation",
    footerSocialTitle: "Réseaux Sociaux",
    // Adresses de profil à renseigner dans Sanity (Paramètres du site) : pas d'adresse générique par défaut.
    instagramUrl: null,
    linkedinUrl: null,
    contactEmail: "contact@huguesabsil.com",
    contactTitle: "Contact",
    contactIntro: "Pour toute question, demande d'information ou intérêt pour une œuvre",
    contactInfoTitle: "Informations",
    contactInfoText:
      "N'hésitez pas à me contacter pour toute demande concernant mes œuvres, les expositions à venir ou pour organiser une visite de l'atelier.",
    contactSuccessMessage:
      "Message envoyé avec succès ! Je vous répondrai dans les plus brefs délais.",
    contactErrorMessage: "Une erreur est survenue. Veuillez réessayer.",
    galleryUseFeatured: false,
  };
  if (!isSanityConfigured()) {
    return fallback;
  }
  try {
    const _sanity = getSanityClient();
    if (!_sanity) throw new Error("Sanity client not configured");
    const result = await _sanity.fetch(siteSettingsQuery);
    if (!result) return fallback;
    return {
      heroImageUrl: result.heroImageUrl ?? fallback.heroImageUrl,
      heroImageAlt: result.heroImageAlt ?? fallback.heroImageAlt,
      heroImages: normalizeHeroImages(result.heroImages),
      siteName: result.siteName ?? fallback.siteName,
      heroTitle: result.heroTitle ?? fallback.heroTitle,
      heroSubtitle: result.heroSubtitle ?? fallback.heroSubtitle,
      heroCtaLabel: result.heroCtaLabel ?? fallback.heroCtaLabel,
      navItems:
        Array.isArray(result.navItems) && result.navItems.length > 0
          ? result.navItems.filter(
              (item: { label?: string; href?: string }) => item?.label != null && item?.href != null
            ).map((item: { label: string; href: string }) =>
              normalizeNavItem({ label: item.label, href: item.href })
            )
          : fallback.navItems,
      footerSubtitle: result.footerSubtitle ?? fallback.footerSubtitle,
      footerNavTitle: result.footerNavTitle ?? fallback.footerNavTitle,
      footerSocialTitle: result.footerSocialTitle ?? fallback.footerSocialTitle,
      instagramUrl: result.instagramUrl ?? fallback.instagramUrl,
      linkedinUrl: result.linkedinUrl ?? fallback.linkedinUrl,
      contactEmail: result.contactEmail ?? fallback.contactEmail,
      contactTitle: result.contactTitle ?? fallback.contactTitle,
      contactIntro: result.contactIntro ?? fallback.contactIntro,
      contactInfoTitle: result.contactInfoTitle ?? fallback.contactInfoTitle,
      contactInfoText: result.contactInfoText ?? fallback.contactInfoText,
      contactSuccessMessage: result.contactSuccessMessage ?? fallback.contactSuccessMessage,
      contactErrorMessage: result.contactErrorMessage ?? fallback.contactErrorMessage,
      galleryUseFeatured: result.galleryUseFeatured ?? false,
      pressKitUrl: result.pressKitUrl ?? null,
      pressKitFilename: result.pressKitFilename ?? null,
    };
  } catch (error) {
    console.error("Error fetching site settings:", error);
    return fallback;
  }
}

/** Articles avec date : plus récent en premier ; sans date : à la fin. */
function sortPressArticlesByDate(articles: PressArticle[]): PressArticle[] {
  return [...articles].sort((a, b) => {
    const da = a.date?.trim() ?? "";
    const db = b.date?.trim() ?? "";
    const aMissing = !da;
    const bMissing = !db;
    if (aMissing && bMissing) return 0;
    if (aMissing) return 1;
    if (bMissing) return -1;
    return new Date(db).getTime() - new Date(da).getTime();
  });
}

export async function getPressArticles(): Promise<PressArticle[]> {
  if (!isSanityConfigured()) {
    const { pressArticles } = await import("@/data/press");
    return sortPressArticlesByDate(
      pressArticles.map((a) => ({
        _id: a.id,
        ...a,
      }))
    );
  }
  try {
    const _sanity = getSanityClient();
    if (!_sanity) throw new Error("Sanity client not configured");
    const result = await _sanity.fetch(pressArticlesQuery);
    const list = Array.isArray(result) ? result : [];
    return sortPressArticlesByDate(list);
  } catch (error) {
    console.error("Error fetching press articles:", error);
    const { pressArticles } = await import("@/data/press");
    return sortPressArticlesByDate(
      pressArticles.map((a) => ({
        _id: a.id,
        ...a,
      }))
    );
  }
}

export async function getPressArticleBySlug(slug: string): Promise<PressArticle | null> {
  const _sanity = getSanityClient();
  if (!isSanityConfigured() || !_sanity) return null;
  try {
    const result = await _sanity.fetch(pressArticleBySlugQuery, { slug });
    return result && result._id ? result : null;
  } catch (error) {
    console.error("Error fetching press article by slug:", error);
    return null;
  }
}

export async function getPressQuotes(): Promise<PressQuote[]> {
  if (!isSanityConfigured()) {
    const { pressQuotes } = await import("@/data/press");
    return pressQuotes.map((q) => ({
      _id: q.id,
      ...q,
    }));
  }
  try {
    const _sanity = getSanityClient();
    if (!_sanity) throw new Error("Sanity client not configured");
    const result = await _sanity.fetch(pressQuotesQuery);
    // Retourner le résultat de Sanity (même vide) : pas de fallback sur les données de test
    return Array.isArray(result) ? result : [];
  } catch (error) {
    console.error("Error fetching press quotes:", error);
    const { pressQuotes } = await import("@/data/press");
    return pressQuotes.map((q) => ({
      _id: q.id,
      ...q,
    }));
  }
}

export async function getAdvicePosts(): Promise<AdvicePost[]> {
  if (!isSanityConfigured()) {
    return [];
  }
  try {
    const _sanity = getSanityClient();
    if (!_sanity) throw new Error("Sanity client not configured");
    const result = await _sanity.fetch(advicePostsQuery);
    return Array.isArray(result) ? result : [];
  } catch (error) {
    console.error("Error fetching advice posts:", error);
    return [];
  }
}

export async function getAdvicePostBySlug(slug: string): Promise<AdvicePost | null> {
  if (!isSanityConfigured()) {
    return null;
  }
  try {
    const _sanity = getSanityClient();
    if (!_sanity) throw new Error("Sanity client not configured");
    const post = await _sanity.fetch(adviceBySlugQuery, { slug });
    return post || null;
  } catch (error) {
    console.error("Error fetching advice post:", error);
    return null;
  }
}

export async function getPerformances(): Promise<Performance[]> {
  if (!isSanityConfigured()) {
    const { performances } = await import("@/data/performances");
    return performances;
  }
  try {
    const _sanity = getSanityClient();
    if (!_sanity) throw new Error("Sanity client not configured");
    const result = await _sanity.fetch(performancesQuery);
    if (result && result.length > 0) return result;
    const { performances } = await import("@/data/performances");
    return performances;
  } catch (error) {
    console.error("Error fetching performances:", error);
    const { performances } = await import("@/data/performances");
    return performances;
  }
}

export async function getFilms(): Promise<Film[]> {
  if (!isSanityConfigured()) return [];
  try {
    const _sanity = getSanityClient();
    if (!_sanity) throw new Error("Sanity client not configured");
    const result = await _sanity.fetch(filmsQuery);
    return Array.isArray(result) ? result : [];
  } catch (error) {
    console.error("Error fetching films:", error);
    return [];
  }
}

function normalizeResource(r: {
  _id: string;
  title: string;
  slug: string;
  category?: string;
  categoryRef?: CategoryRefNode | null;
  [key: string]: unknown;
}): Resource {
  const { leafSlug, ancestorSlugs } = slugsFromCategoryRef(r.categoryRef ?? null);
  const categorySlug = leafSlug || (r.category as string) || "";
  return {
    ...r,
    category: categorySlug,
    categoryAncestorSlugs: ancestorSlugs.length > 0 ? ancestorSlugs : undefined,
  } as Resource;
}

/** L’URL /section/:category/slug est valide si :category est la feuille ou un ancêtre. */
export function resourceMatchesUrlCategory(resource: Resource, urlCategory: string | undefined): boolean {
  if (!urlCategory) return true;
  if (resource.categoryRef?.slug === urlCategory || resource.category === urlCategory) return true;
  return resource.categoryAncestorSlugs?.includes(urlCategory) ?? false;
}

export async function getResources(): Promise<Resource[]> {
  if (!isSanityConfigured()) {
    return [];
  }
  try {
    const _sanity = getSanityClient();
    if (!_sanity) throw new Error("Sanity client not configured");
    const raw = await _sanity.fetch(resourcesQuery);
    return Array.isArray(raw) ? raw.map(normalizeResource) : [];
  } catch (error) {
    console.error("Error fetching resources:", error);
    return [];
  }
}

export async function getResourcesByCategory(category: string): Promise<Resource[]> {
  if (!isSanityConfigured()) {
    return [];
  }
  try {
    const _sanity = getSanityClient();
    if (!_sanity) throw new Error("Sanity client not configured");
    const raw = await _sanity.fetch(resourcesByCategoryQuery, { category });
    return Array.isArray(raw) ? raw.map(normalizeResource) : [];
  } catch (error) {
    console.error("Error fetching resources by category:", error);
    return [];
  }
}

export async function getResourceBySlug(slug: string): Promise<Resource | null> {
  if (!isSanityConfigured()) {
    return null;
  }
  try {
    const _sanity = getSanityClient();
    if (!_sanity) throw new Error("Sanity client not configured");
    const raw = await _sanity.fetch(resourceBySlugQuery, { slug });
    return raw && raw._id ? normalizeResource(raw) : null;
  } catch (error) {
    console.error("Error fetching resource:", error);
    return null;
  }
}

export async function getResourceCategories(): Promise<ResourceCategory[]> {
  if (!isSanityConfigured()) {
    return [];
  }
  try {
    const _sanity = getSanityClient();
    if (!_sanity) throw new Error("Sanity client not configured");
    const result = await _sanity.fetch(resourceCategoriesQuery);
    const list = Array.isArray(result) ? result : [];
    return list;
  } catch (error) {
    console.error("Error fetching resource categories:", error);
    return [];
  }
}

export type SearchIndexResult =
  | { ok: true; items: SearchIndexItem[] }
  | { ok: false; items: []; error: "unavailable" };

let searchIndexCache: Promise<SearchIndexResult> | null = null;

async function buildFallbackSearchIndex(): Promise<SearchIndexItem[]> {
  const [{ paintings }, { exhibitions }, { pressArticles }, { blogPosts }, { biography }, { performances }] =
    await Promise.all([
      import("@/data/paintings"),
      import("@/data/exhibitions"),
      import("@/data/press"),
      import("@/data/blog"),
      import("@/data/bio"),
      import("@/data/performances"),
    ]);

  const payload: SearchIndexPayload = {
    paintings: paintings.map((p) => ({
      _id: p.id,
      title: p.title,
      year: p.year,
      reference: p.reference,
      techniqueTitle: p.technique,
      themeTitle: p.theme,
      seriesTitle: p.series?.title,
      description: p.description,
      imageUrl: p.imageUrl,
    })),
    exhibitions: exhibitions.map((e) => ({
      _id: e.id,
      title: e.title,
      venue: e.gallery,
      city: e.city,
      country: e.country,
      description: e.description,
      imageUrl: e.imageUrl,
    })),
    pressArticles: pressArticles.map((a) => ({
      _id: a.id,
      title: a.title,
      publication: a.publication,
      excerpt: a.excerpt,
      slug: a.slug,
      imageUrl: a.imageUrl,
    })),
    advice: blogPosts.map((post) => ({
      _id: post.id,
      title: post.title,
      excerpt: post.excerpt,
      tags: post.tags,
      category: post.category,
      bodyText: post.content,
      imageUrl: post.imageUrl,
    })),
    performances: performances.map((p) => ({
      _id: p._id,
      title: p.title,
    })),
    biography: {
      _id: "bio-1",
      bodyText: biography.text,
      education: biography.education,
      awards: biography.awards,
      nationality: biography.nationality,
      birthYear: biography.birthYear,
    },
  };

  return buildSearchIndexFromPayload(payload);
}

async function loadSearchIndex(): Promise<SearchIndexResult> {
  const _sanity = getSanityClient();
  if (!isSanityConfigured() || !_sanity) {
    return { ok: true, items: await buildFallbackSearchIndex() };
  }
  try {
    const raw = (await _sanity.fetch(searchIndexQuery)) as SearchIndexPayload | null;
    if (!raw || typeof raw !== "object") {
      return { ok: false, items: [], error: "unavailable" };
    }
    return { ok: true, items: buildSearchIndexFromPayload(raw) };
  } catch (error) {
    console.error("Error fetching search index:", error);
    return { ok: false, items: [], error: "unavailable" };
  }
}

export function getSearchIndex(): Promise<SearchIndexResult> {
  if (!searchIndexCache) {
    searchIndexCache = loadSearchIndex().then((result) => {
      if (!result.ok) searchIndexCache = null;
      return result;
    });
  }
  return searchIndexCache;
}
