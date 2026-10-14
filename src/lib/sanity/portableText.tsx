import { PortableText as SanityPortableText } from "@portabletext/react";
import type {
  PortableTextComponentProps,
  PortableTextMarkComponentProps,
} from "@portabletext/react";
import type { PortableTextBlock, TypedObject } from "@portabletext/types";
import type { CSSProperties, ReactNode } from "react";
import { urlFor } from "./client";
import { isRetiredImageLink } from "@/lib/seo";

interface PortableTextProps {
  content: TypedObject | TypedObject[] | unknown;
  className?: string;
}

const SIZE_MAX: Record<string, string> = {
  small: "20rem",
  medium: "28rem",
  large: "36rem",
};

/** Classes de mise en page non-float. */
const BLOCK_LAYOUT_CLASSES: Record<string, string> = {
  fullWidth: "pt-img-full w-full max-w-none my-6",
  centered: "pt-img-centered mx-auto my-6 max-w-[720px]",
  betweenText: "pt-img-between mx-auto my-6 max-w-[720px]",
};

function floatFigureStyle(layout: "floatLeft" | "floatRight", size?: string): CSSProperties {
  const maxW = SIZE_MAX[size || "medium"] || SIZE_MAX.medium;
  // Uniquement des variables CSS — pas de width inline (sinon ça écrase le float desktop).
  return {
    ["--pt-float-max" as string]: maxW,
    ["--pt-float-side" as string]: layout === "floatRight" ? "right" : "left",
  };
}

/** Typo pour items de liste (pas de vrai heading HTML — garde les marqueurs ol/ul). */
function listItemInnerClass(style?: string): string {
  if (style === "h1") return "pt-li-heading pt-li-h1 font-serif text-2xl font-bold text-foreground";
  if (style === "h2") return "pt-li-heading pt-li-h2 font-serif text-xl font-semibold text-foreground";
  if (style === "h3") return "pt-li-heading pt-li-h3 font-serif text-lg font-semibold text-foreground";
  if (style === "blockquote") return "text-gray-medium italic";
  return "text-foreground";
}

/** Normalise une URL vidéo en URL d'embed (YouTube, Vimeo) et force HTTPS. */
function normalizeVideoEmbedUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  let url = raw;
  if (url.startsWith("http://")) url = "https://" + url.slice(7);

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");

    if (host === "youtube.com" || host === "youtu.be") {
      let videoId: string | null = null;
      if (parsed.searchParams.has("v")) {
        videoId = parsed.searchParams.get("v");
      }
      if (!videoId && host === "youtu.be") {
        videoId = parsed.pathname.slice(1).split("/")[0];
      }
      if (!videoId && parsed.pathname.startsWith("/embed/")) {
        videoId = parsed.pathname.replace(/^\/embed\//, "").split("/")[0];
      }
      if (videoId) {
        return `https://www.youtube-nocookie.com/embed/${videoId}`;
      }
      return null;
    }

    if (host === "vimeo.com") {
      const match = parsed.pathname.match(/^\/(?:video\/)?(\d+)/);
      if (match) {
        return `https://player.vimeo.com/video/${match[1]}`;
      }
      return null;
    }

    return url;
  } catch {
    return null;
  }
}

function VideoEmbedBlock({
  value,
}: {
  value: { url?: string; title?: string; layout?: string };
}) {
  const rawUrl = value?.url;
  if (!rawUrl) return null;
  const url = normalizeVideoEmbedUrl(rawUrl);
  if (!url) return null;
  const layout = value.layout || "betweenText";
  const isFloat = layout === "floatLeft" || layout === "floatRight";
  const className = isFloat
    ? `pt-float pt-float-${layout === "floatRight" ? "right" : "left"}`
    : BLOCK_LAYOUT_CLASSES[layout] || BLOCK_LAYOUT_CLASSES.betweenText;
  const style = isFloat ? floatFigureStyle(layout, "medium") : undefined;
  return (
    <figure className={className} style={style}>
      <div className="relative aspect-video overflow-hidden rounded-sm bg-gray-100">
        <iframe
          src={url}
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title={value.title || "Vidéo"}
        />
      </div>
      {value.title && (
        <figcaption className="mt-2 text-sm text-gray-medium">{value.title}</figcaption>
      )}
    </figure>
  );
}

/** Rendu legacy pour les blocs `_type: "image"` déjà publiés (plus proposés à l'insertion). */
function ImageBlock({
  value,
}: {
  value: { asset?: { _ref?: string; url?: string }; alt?: string };
}) {
  if (!value?.asset) return null;
  let src: string | null = null;
  if ("url" in value.asset && typeof value.asset.url === "string") {
    src = value.asset.url;
  }
  if (!src) {
    try {
      src = urlFor(value).url();
    } catch {
      return null;
    }
  }
  return (
    <figure className="my-6">
      <img
        src={src}
        alt={value.alt || ""}
        className="h-auto max-w-full rounded-sm object-contain"
      />
      {value.alt && (
        <figcaption className="mt-2 text-sm text-gray-medium">{value.alt}</figcaption>
      )}
    </figure>
  );
}

function ImageWithLayoutBlock({
  value,
}: {
  value: {
    image?: { asset?: { _ref?: string; url?: string }; alt?: string };
    caption?: string;
    layout?: string;
    size?: string;
  };
}) {
  if (!value?.image?.asset) return null;
  let src: string | null = null;
  const asset = value.image.asset;
  if ("url" in asset && typeof asset.url === "string") {
    src = asset.url;
  }
  if (!src) {
    try {
      src = urlFor(value.image).url();
    } catch {
      return null;
    }
  }
  const layout = value.layout || "floatLeft";
  const isFloat = layout === "floatLeft" || layout === "floatRight";
  const className = isFloat
    ? `pt-float pt-float-${layout === "floatRight" ? "right" : "left"}`
    : BLOCK_LAYOUT_CLASSES[layout] || BLOCK_LAYOUT_CLASSES.centered;
  const style = isFloat
    ? floatFigureStyle(layout as "floatLeft" | "floatRight", value.size)
    : undefined;

  return (
    <figure className={className} style={style}>
      <img
        src={src}
        alt={value.caption || ""}
        className="h-auto w-full max-w-full rounded-sm object-contain"
      />
      {value.caption && (
        <figcaption className="mt-2 text-sm text-gray-medium">{value.caption}</figcaption>
      )}
    </figure>
  );
}

const portableTextComponents = {
  types: {
    videoEmbed: VideoEmbedBlock,
    image: ImageBlock,
    imageWithLayout: ImageWithLayoutBlock,
  },
  marks: {
    link: ({
      children,
      value,
    }: PortableTextMarkComponentProps<{ _type: "link"; href?: string }>) => {
      const href = value?.href?.trim();
      if (!href || isRetiredImageLink(href)) return <span>{children}</span>;
      const external = /^https?:\/\//i.test(href);
      return (
        <a
          href={href}
          className="text-foreground underline underline-offset-2 hover:opacity-80"
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {children}
        </a>
      );
    },
  },
  list: {
    bullet: ({ children }: { children?: ReactNode }) => (
      <ul className="pt-ul mb-4 space-y-1 pl-6 text-foreground">{children}</ul>
    ),
    number: ({ children }: { children?: ReactNode }) => (
      <ol className="pt-ol mb-4 space-y-1 pl-6 text-foreground">{children}</ol>
    ),
  },
  listItem: {
    bullet: ({ children }: { children?: ReactNode }) => <li className="pl-1">{children}</li>,
    number: ({ children }: { children?: ReactNode }) => (
      <li className="pt-ol-item pl-1">{children}</li>
    ),
  },
  block: (props: PortableTextComponentProps<PortableTextBlock>) => {
    const { children, value } = props;
    const style = value?.style;
    const listItem =
      value && "listItem" in value
        ? (value as { listItem?: string }).listItem
        : undefined;
    const inList = Boolean(listItem);

    if (inList) {
      return <span className={listItemInnerClass(style)}>{children}</span>;
    }

    if (style === "h1") return <h2 className="font-serif text-2xl font-bold mt-8 mb-4">{children}</h2>;
    if (style === "h2") return <h3 className="font-serif text-xl font-semibold mt-6 mb-3">{children}</h3>;
    if (style === "h3") return <h4 className="font-serif text-lg font-semibold mt-4 mb-2">{children}</h4>;
    if (style === "blockquote")
      return (
        <blockquote className="border-l-4 border-gray-300 pl-4 my-4 text-gray-medium italic">
          {children}
        </blockquote>
      );
    return <p className="mb-4 text-foreground">{children}</p>;
  },
};

export default function PortableText({ content, className = "" }: PortableTextProps) {
  const value = Array.isArray(content) || (content && typeof content === "object")
    ? (content as TypedObject | TypedObject[])
    : [];
  return (
    <div
      className={`portable-text prose prose-lg max-w-none text-foreground [&_p]:text-foreground [&_h1]:text-foreground [&_h2]:text-foreground [&_h3]:text-foreground ${className}`}
    >
      <SanityPortableText value={value} components={portableTextComponents} />
    </div>
  );
}
