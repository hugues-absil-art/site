import { PortableText as SanityPortableText } from "@portabletext/react";
import type {
  PortableTextComponentProps,
  PortableTextMarkComponentProps,
} from "@portabletext/react";
import type { PortableTextBlock, TypedObject } from "@portabletext/types";
import type { ReactNode } from "react";
import { ImageWithLayoutBlock, LegacyImageBlock, VideoEmbedBlock } from "./mediaBlocks";
import { isRetiredImageLink } from "@/lib/seo";

interface PortableTextProps {
  content: TypedObject | TypedObject[] | unknown;
  className?: string;
}

/** Typo pour items de liste (pas de vrai heading HTML — garde les marqueurs ol/ul). */
function listItemInnerClass(style?: string): string {
  if (style === "h1") return "pt-li-heading pt-li-h1 font-serif text-2xl font-bold text-foreground";
  if (style === "h2") return "pt-li-heading pt-li-h2 font-serif text-xl font-semibold text-foreground";
  if (style === "h3") return "pt-li-heading pt-li-h3 font-serif text-lg font-semibold text-foreground";
  if (style === "blockquote") return "text-gray-medium italic";
  return "text-foreground";
}

const portableTextComponents = {
  types: {
    videoEmbed: VideoEmbedBlock,
    image: LegacyImageBlock,
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
