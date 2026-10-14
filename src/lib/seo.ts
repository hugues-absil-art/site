import { useEffect } from "react";
import legacyRoutes from "@/seo/legacy-routes.json";

/** Adresse publique du site (sans slash final). Surchargeable avec VITE_SITE_URL. */
export const SITE_URL = (
  (import.meta.env.VITE_SITE_URL as string | undefined) || "https://hugues-absil.com"
).replace(/\/$/, "");
export const SITE_NAME = "Hugues Absil";
export const DEFAULT_TITLE = "Hugues Absil - Artiste Contemporain";
export const DEFAULT_DESCRIPTION =
  "Hugues Absil, artiste peintre, graveur et dessinateur : œuvres, expositions, biographie, critiques d'art et cours d'histoire de l'art.";

type LegacyEntry = { t?: string; s?: string; r?: string };
const ROUTES = legacyRoutes as Record<string, LegacyEntry>;

/** type:slug → adresse WordPress d'origine (adresse canonique conservée pour le référencement). */
const REVERSE = new Map<string, string>();
for (const [path, v] of Object.entries(ROUTES)) {
  if (v.t && v.s && !REVERSE.has(`${v.t}:${v.s}`)) REVERSE.set(`${v.t}:${v.s}`, path);
}

/** Entrée de la table des anciennes adresses pour un chemin (avec ou sans slash final). */
export function lookupLegacy(pathname: string): LegacyEntry | null {
  const key = pathname.endsWith("/") ? pathname : `${pathname}/`;
  return ROUTES[key] ?? null;
}

/** Adresse WordPress d'origine d'un document, si elle existe (sinon null). */
export function legacyPathFor(type: string, slug: string | null | undefined): string | null {
  if (!slug) return null;
  return REVERSE.get(`${type}:${slug}`) ?? null;
}

/**
 * Lien vers une image de l'ancien WordPress (/wp-content/uploads/….jpg) : ces fichiers disparaîtront avec WordPress,
 * et l'image est déjà affichée dans la page. On garde le texte du lien, sans lien.
 */
export function isRetiredImageLink(href: string | null | undefined): boolean {
  return /^https?:\/\/(?:www\.)?hugues-absil\.com\/wordpress\/wp-content\/uploads\/.+\.(?:jpe?g|png|gif|webp|avif|tiff?)(?:[?#"%].*)?$/i.test(
    (href || "").trim()
  );
}

/** Texte brut d'un contenu Portable Text, tronqué proprement. */
export function plainFromPortable(blocks: unknown, max = 160): string {
  if (!Array.isArray(blocks)) return "";
  const text = (blocks as Array<Record<string, unknown>>)
    .filter((b) => b?._type === "block" && Array.isArray(b.children))
    .map((b) => (b.children as Array<{ text?: string }>).map((c) => c.text ?? "").join(""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return cut.slice(0, Math.max(cut.lastIndexOf(" "), 60)).trim() + "…";
}

function setMeta(attr: "name" | "property", key: string, content: string | null) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (content == null || content === "") {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setCanonical(href: string | null) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!href) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

function setJsonLd(data: unknown | null) {
  let el = document.getElementById("seo-jsonld");
  if (data == null) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement("script");
    el.id = "seo-jsonld";
    el.setAttribute("type", "application/ld+json");
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

export interface SeoOptions {
  /** false : ne rien modifier (données pas encore chargées). */
  enabled?: boolean;
  title: string;
  description?: string;
  /** Chemin canonique (ex. /wordpress/mon-article/), sans le domaine. */
  path: string;
  image?: string | null;
  type?: "website" | "article";
  jsonLd?: unknown;
  noindex?: boolean;
}

/**
 * Met à jour <title>, description, canonical, Open Graph et JSON-LD pour la page courante.
 * Les mêmes balises sont écrites dans le HTML pré-généré (scripts/seo/build.mjs) : elles doivent rester cohérentes.
 */
export function useSeo(o: SeoOptions) {
  const { enabled = true, title, description, path, image, type = "website", jsonLd, noindex } = o;
  const jsonKey = JSON.stringify(jsonLd ?? null);
  useEffect(() => {
    if (!enabled) return;
    const fullTitle = title === DEFAULT_TITLE ? title : `${title} | ${SITE_NAME}`;
    const desc = description || DEFAULT_DESCRIPTION;
    const url = `${SITE_URL}${path}`;
    document.title = fullTitle;
    setMeta("name", "description", desc);
    setCanonical(url);
    setMeta("name", "robots", noindex ? "noindex, follow" : null);
    setMeta("property", "og:title", fullTitle);
    setMeta("property", "og:description", desc);
    setMeta("property", "og:type", type);
    setMeta("property", "og:url", url);
    setMeta("property", "og:site_name", SITE_NAME);
    setMeta("property", "og:locale", "fr_FR");
    setMeta("property", "og:image", image || null);
    setMeta("name", "twitter:card", image ? "summary_large_image" : "summary");
    setJsonLd(jsonLd ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, title, description, path, image, type, jsonKey, noindex]);
}
