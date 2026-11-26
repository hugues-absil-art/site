import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Play, X } from "lucide-react";
import { urlFor } from "./client";

/**
 * Images et vidéos insérées dans le texte (Portable Text).
 *  - la taille choisie dans le Studio s'applique à TOUTES les mises en page (sauf « pleine largeur ») ;
 *  - un clic agrandit l'image dans une fenêtre (la lecture n'est pas coupée par de grosses images) ;
 *  - une vidéo n'est qu'une petite vignette : le lecteur s'ouvre au clic, dans la même fenêtre.
 */

export type MediaSize = "small" | "medium" | "large";

/** Largeur des médias que le texte contourne (flottants). */
const FLOAT_WIDTH: Record<MediaSize, string> = { small: "11rem", medium: "18rem", large: "28rem" };
/** Largeur des médias en bloc (centré / entre le texte). */
const BLOCK_WIDTH: Record<MediaSize, string> = { small: "14rem", medium: "30rem", large: "45rem" };

const toSize = (s?: string): MediaSize => (s === "small" || s === "large" ? s : "medium");

export interface MediaLayout {
  className: string;
  style?: CSSProperties;
}

/** Classes + variable CSS `--pt-size` pour une mise en page et une taille données. */
export function mediaLayout(layout: string | undefined, size: string | undefined, fallback: string): MediaLayout {
  const l = layout || fallback;
  const sz = toSize(size);
  if (l === "floatLeft" || l === "floatRight") {
    return {
      className: `pt-media pt-float pt-float-${l === "floatRight" ? "right" : "left"}`,
      style: { ["--pt-size" as string]: FLOAT_WIDTH[sz] },
    };
  }
  if (l === "fullWidth") return { className: "pt-media pt-img-full" };
  return {
    className: `pt-media pt-block ${l === "betweenText" ? "pt-img-between" : "pt-img-centered"}`,
    style: { ["--pt-size" as string]: BLOCK_WIDTH[sz] },
  };
}

/** Largeur (px) à demander au CDN pour une vignette : 2× la taille d'affichage (écrans HD). */
function thumbWidth(layout: string | undefined, size: string | undefined, fallback: string): number {
  const l = layout || fallback;
  if (l === "fullWidth") return 1600;
  const sz = toSize(size);
  const rem = parseFloat((l === "floatLeft" || l === "floatRight" ? FLOAT_WIDTH : BLOCK_WIDTH)[sz]);
  return Math.min(1600, Math.round(rem * 16 * 2));
}

function Lightbox({ onClose, children, label }: { onClose: () => void; children: ReactNode; label: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4"
      onClick={onClose}
    >
      <button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
      >
        <X className="h-6 w-6" />
      </button>
      <div className="max-h-full max-w-full" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body
  );
}

function sourceUrl(image: { asset?: { _ref?: string; url?: string }; alt?: string }, width: number): string | null {
  const asset = image?.asset;
  if (!asset) return null;
  if ("url" in asset && typeof asset.url === "string") {
    return `${asset.url}?w=${width}&auto=format`;
  }
  try {
    return urlFor(image).width(width).auto("format").url();
  } catch {
    return null;
  }
}

export function ImageWithLayoutBlock({
  value,
}: {
  value: {
    image?: { asset?: { _ref?: string; url?: string }; alt?: string };
    caption?: string;
    layout?: string;
    size?: string;
  };
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  if (!value?.image?.asset) return null;
  const thumb = sourceUrl(value.image, thumbWidth(value.layout, value.size, "floatLeft"));
  const full = sourceUrl(value.image, 2400);
  if (!thumb || !full) return null;
  const { className, style } = mediaLayout(value.layout, value.size, "floatLeft");

  return (
    <figure className={className} style={style}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block w-full cursor-zoom-in"
        aria-label={value.caption ? `Agrandir : ${value.caption}` : "Agrandir l'image"}
      >
        <img src={thumb} alt={value.caption || ""} loading="lazy" className="h-auto w-full rounded-sm object-contain" />
      </button>
      {value.caption && <figcaption className="mt-2 text-sm text-gray-medium">{value.caption}</figcaption>}
      {open && (
        <Lightbox onClose={close} label={value.caption || "Image agrandie"}>
          <img src={full} alt={value.caption || ""} className="max-h-[90vh] max-w-[95vw] rounded-sm object-contain" />
        </Lightbox>
      )}
    </figure>
  );
}

/** Ancien type `image` (déjà publié) : même agrandissement au clic. */
export function LegacyImageBlock({ value }: { value: { asset?: { _ref?: string; url?: string }; alt?: string } }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  if (!value?.asset) return null;
  const thumb = sourceUrl(value, 1200);
  const full = sourceUrl(value, 2400);
  if (!thumb || !full) return null;
  return (
    <figure className="my-6">
      <button type="button" onClick={() => setOpen(true)} className="block cursor-zoom-in" aria-label="Agrandir l'image">
        <img src={thumb} alt={value.alt || ""} loading="lazy" className="h-auto max-w-full rounded-sm object-contain" />
      </button>
      {value.alt && <figcaption className="mt-2 text-sm text-gray-medium">{value.alt}</figcaption>}
      {open && (
        <Lightbox onClose={close} label={value.alt || "Image agrandie"}>
          <img src={full} alt={value.alt || ""} className="max-h-[90vh] max-w-[95vw] rounded-sm object-contain" />
        </Lightbox>
      )}
    </figure>
  );
}

interface ParsedVideo {
  provider: "youtube" | "vimeo" | "other";
  id: string | null;
  embedUrl: string;
}

/** Normalise une URL vidéo (YouTube, Vimeo) : identifiant, adresse du lecteur, HTTPS forcé. */
export function parseVideoUrl(input: string): ParsedVideo | null {
  const raw = input.trim();
  if (!raw) return null;
  const url = raw.startsWith("http://") ? "https://" + raw.slice(7) : raw;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host === "youtube.com" || host === "m.youtube.com" || host === "youtu.be") {
      let id = parsed.searchParams.get("v");
      if (!id && host === "youtu.be") id = parsed.pathname.slice(1).split("/")[0];
      if (!id && parsed.pathname.startsWith("/embed/")) id = parsed.pathname.replace(/^\/embed\//, "").split("/")[0];
      if (!id && parsed.pathname.startsWith("/shorts/")) id = parsed.pathname.replace(/^\/shorts\//, "").split("/")[0];
      return id ? { provider: "youtube", id, embedUrl: `https://www.youtube-nocookie.com/embed/${id}` } : null;
    }
    if (host === "vimeo.com" || host === "player.vimeo.com") {
      const match = parsed.pathname.match(/\/(?:video\/)?(\d+)/);
      return match ? { provider: "vimeo", id: match[1], embedUrl: `https://player.vimeo.com/video/${match[1]}` } : null;
    }
    return { provider: "other", id: null, embedUrl: url };
  } catch {
    return null;
  }
}

function posterUrl(v: ParsedVideo): string | null {
  if (v.provider === "youtube" && v.id) return `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`;
  if (v.provider === "vimeo" && v.id) return `https://vumbnail.com/${v.id}.jpg`;
  return null;
}

export function VideoEmbedBlock({
  value,
}: {
  value: { url?: string; title?: string; layout?: string; size?: string };
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  if (!value?.url) return null;
  const video = parseVideoUrl(value.url);
  if (!video) return null;
  const { className, style } = mediaLayout(value.layout, value.size ?? "medium", "betweenText");
  const poster = posterUrl(video);
  const sep = video.embedUrl.includes("?") ? "&" : "?";
  const playerUrl = `${video.embedUrl}${sep}autoplay=1&rel=0`;

  return (
    <figure className={className} style={style}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative block aspect-video w-full cursor-pointer overflow-hidden rounded-sm bg-gray-900"
        aria-label={value.title ? `Lire la vidéo : ${value.title}` : "Lire la vidéo"}
      >
        {poster && <img src={poster} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-90" />}
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="rounded-full bg-black/65 p-3 text-white transition-transform group-hover:scale-110">
            <Play className="h-6 w-6 fill-current" />
          </span>
        </span>
      </button>
      {value.title && <figcaption className="mt-2 text-sm text-gray-medium">{value.title}</figcaption>}
      {open && (
        <Lightbox onClose={close} label={value.title || "Vidéo"}>
          <div className="aspect-video w-[min(95vw,1100px)]">
            <iframe
              src={playerUrl}
              className="h-full w-full rounded-sm"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
              title={value.title || "Vidéo"}
            />
          </div>
        </Lightbox>
      )}
    </figure>
  );
}
