import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Calendar, ExternalLink, MapPin } from "lucide-react";
import Image from "@/components/ui/Image";
import Button from "@/components/ui/Button";
import PortableText from "@/lib/sanity/portableText";
import { getExhibitionBySlug } from "@/lib/sanity/data";
import { useSeo, legacyPathFor, plainFromPortable, SITE_NAME } from "@/lib/seo";

const statusLabels: Record<string, string> = {
  current: "En cours",
  upcoming: "À venir",
  past: "Archives",
};

function formatDate(dateString: string | null | undefined) {
  if (dateString == null || dateString === "") return null;
  const date = new Date(dateString);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export default function ExhibitionPage(props: { slug?: string }) {
  const params = useParams<{ slug: string }>();
  const slug = props.slug ?? params.slug;
  const [exhibition, setExhibition] = useState<Awaited<ReturnType<typeof getExhibitionBySlug>>>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    getExhibitionBySlug(slug).then((e) => {
      if (!e) setNotFound(true);
      else setExhibition(e);
      setLoading(false);
    });
  }, [slug]);

  const seoPath = legacyPathFor("exhibition", slug) ?? `/expositions/${slug}`;
  const seoDescription = exhibition ? exhibition.description?.trim() || plainFromPortable(exhibition.body) : undefined;
  useSeo({
    enabled: !!exhibition,
    title: exhibition?.title ?? "",
    description: seoDescription,
    path: seoPath,
    image: exhibition?.imageUrl || null,
    type: "article",
    jsonLd: exhibition
      ? {
          "@context": "https://schema.org",
          "@type": "ExhibitionEvent",
          name: exhibition.title,
          description: seoDescription,
          startDate: exhibition.dateStart || undefined,
          endDate: exhibition.dateEnd || undefined,
          image: exhibition.imageUrl ? [exhibition.imageUrl] : undefined,
          location: exhibition.venue
            ? {
                "@type": "Place",
                name: exhibition.venue,
                address: [exhibition.city, exhibition.country].filter(Boolean).join(", ") || undefined,
              }
            : undefined,
          performer: { "@type": "Person", name: SITE_NAME },
        }
      : null,
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-20">
        <p className="text-gray-medium">Chargement...</p>
      </div>
    );
  }

  if (notFound || !exhibition) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-20 px-4">
        <div className="text-center">
          <h1 className="font-serif text-4xl font-bold mb-4">Exposition introuvable</h1>
          <p className="text-gray-medium mb-6">Vérifiez l’adresse ou revenez à l’accueil.</p>
          <Link to="/">
            <Button variant="primary">Retour à l&apos;accueil</Button>
          </Link>
        </div>
      </div>
    );
  }

  const dateStartLabel = formatDate(exhibition.dateStart);
  const dateEndLabel = formatDate(exhibition.dateEnd);
  const dateLine =
    dateStartLabel && dateEndLabel
      ? `${dateStartLabel} – ${dateEndLabel}`
      : dateStartLabel || dateEndLabel || null;

  const hasRichBody = Array.isArray(exhibition.body) && exhibition.body.length > 0;
  const locationParts = [exhibition.venue, exhibition.city, exhibition.country].filter(
    (x): x is string => x != null && String(x).trim() !== ""
  );

  return (
    <div className="pt-20 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="container mx-auto max-w-4xl">
        <Link to="/#exhibitions">
          <Button variant="ghost" className="mb-8 flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Retour aux expositions
          </Button>
        </Link>

        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-medium mb-4">
          {dateLine && (
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4 shrink-0" />
              {dateLine}
            </span>
          )}
          {exhibition.status && (
            <span className="px-2.5 py-1 text-xs font-medium bg-gray-100 text-foreground rounded-full">
              {statusLabels[exhibition.status] || exhibition.status}
            </span>
          )}
        </div>

        <h1 className="font-serif text-4xl sm:text-5xl font-bold mb-6">{exhibition.title}</h1>

        {locationParts.length > 0 && (
          <p className="flex items-start gap-2 text-gray-medium mb-8">
            <MapPin className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{locationParts.join(", ")}</span>
          </p>
        )}

        {exhibition.description?.trim() && (
          <p className="text-lg text-gray-medium leading-relaxed mb-10">{exhibition.description.trim()}</p>
        )}

        {exhibition.imageUrl && (
          <div className="mb-12 flex justify-center rounded-sm bg-gray-100 px-3 py-6 sm:px-6 sm:py-10">
            <Image
              src={exhibition.imageUrl}
              alt={exhibition.title}
              className="h-auto max-h-[min(85vh,56rem)] w-auto max-w-full rounded-sm object-contain"
              sizes="(max-width: 768px) 100vw, 896px"
            />
          </div>
        )}

        {hasRichBody ? (
          <article className="mb-12 prose prose-neutral max-w-none">
            <PortableText content={exhibition.body} />
          </article>
        ) : null}

        {exhibition.externalLink && (
          <p className="mt-8">
            <a
              href={exhibition.externalLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-foreground font-medium underline hover:opacity-80"
            >
              En savoir plus (site externe) <ExternalLink className="w-4 h-4" />
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
