import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Calendar, ExternalLink } from "lucide-react";
import Image from "@/components/ui/Image";
import { getResourceBySlug, getResourcesByCategory, resourceMatchesUrlCategory } from "@/lib/sanity/data";
import { formatResourceDate, formatResourceDateRange, hasMeaningfulPortableContent } from "@/lib/utils";
import PortableText from "@/lib/sanity/portableText";
import Button from "@/components/ui/Button";
import { getVideoEmbedUrl } from "@/lib/videoEmbed";
import { RESOURCE_CATEGORY_LABELS, RESOURCE_CATEGORY_SECTION } from "@/sanity/constants/resourceCategories";
import { sectionHomePath, sectionUrlPrefix } from "@/lib/resourceSection";
import { useSeo, legacyPathFor, plainFromPortable, SITE_URL, SITE_NAME } from "@/lib/seo";

const categoryLabels: Record<string, string> = RESOURCE_CATEGORY_LABELS as Record<string, string>;
const categorySection: Record<string, "ecrits" | "enseignement"> =
  RESOURCE_CATEGORY_SECTION as Record<string, "ecrits" | "enseignement">;

const RESOURCE_STATUS_LABELS: Record<string, string> = {
  current: "En cours",
  upcoming: "À venir",
  past: "Archives",
};

const CATEGORIES_WITH_PREV_NEXT = ["histoire-art", "technique-picturale"] as const;

/** Mélange Fisher-Yates puis prend les n premiers. */
function shuffleAndTake<T>(array: T[], count: number): T[] {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

export default function ResourcePage(props: { slug?: string; category?: string }) {
  const params = useParams<{ category: string; slug: string }>();
  const slug = props.slug ?? params.slug;
  const category = props.category ?? params.category;
  const [resource, setResource] = useState<Awaited<ReturnType<typeof getResourceBySlug>>>(null);
  const [relatedResources, setRelatedResources] = useState<Awaited<ReturnType<typeof getResourcesByCategory>>>([]);
  const [categoryResourceList, setCategoryResourceList] = useState<Awaited<ReturnType<typeof getResourcesByCategory>>>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    getResourceBySlug(slug).then((r) => {
      if (!r || (category && !resourceMatchesUrlCategory(r, category))) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setResource(r);
      const leaf = r.categoryRef?.slug ?? r.category;
      if (leaf) {
        getResourcesByCategory(leaf).then((all) => {
          setCategoryResourceList(all);
          const others = all.filter((x) => x._id !== r._id);
          setRelatedResources(shuffleAndTake(others, 2));
        });
      }
      setLoading(false);
    });
  }, [slug, category]);

  const seoPath = resource
    ? legacyPathFor("resource", resource.slug) ??
      `/${sectionUrlPrefix(resource.categoryRef?.section ?? categorySection[resource.category])}/${resource.category}/${resource.slug}`
    : "/";
  const seoDescription = resource ? resource.excerpt?.trim() || plainFromPortable(resource.content) : undefined;
  useSeo({
    enabled: !!resource,
    title: resource?.title ?? "",
    description: seoDescription,
    path: seoPath,
    image: resource?.imageUrl || null,
    type: "article",
    jsonLd: resource
      ? {
          "@context": "https://schema.org",
          "@type": "Article",
          headline: resource.title,
          description: seoDescription,
          image: resource.imageUrl ? [resource.imageUrl] : undefined,
          datePublished: resource.date || undefined,
          author: { "@type": "Person", name: SITE_NAME },
          mainEntityOfPage: `${SITE_URL}${seoPath}`,
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

  if (notFound || !resource) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-20">
        <div className="text-center">
          <h1 className="font-serif text-4xl font-bold mb-4">Ressource non trouvée</h1>
          <Link to="/">
            <Button variant="primary">Retour à l'accueil</Button>
          </Link>
        </div>
      </div>
    );
  }

  const leafCategorySlug = resource.categoryRef?.slug ?? resource.category;
  const section =
    (resource.categoryRef?.section ?? categorySection[leafCategorySlug]) || "ecrits";
  const urlPrefix = sectionUrlPrefix(section);
  const sectionAnchor = sectionHomePath(section);
  const dateRangeLabel = formatResourceDateRange(resource.date, resource.dateEnd);
  const categoryTitle =
    resource.categoryRef?.title ?? categoryLabels[leafCategorySlug] ?? leafCategorySlug;

  const showPrevNext =
    CATEGORIES_WITH_PREV_NEXT.includes(leafCategorySlug as (typeof CATEGORIES_WITH_PREV_NEXT)[number]) ||
    resource.categoryRef?.showTableOfContents === true;
  const currentIndex = categoryResourceList.findIndex((r) => r._id === resource._id);
  const prevResource = showPrevNext && currentIndex > 0 ? categoryResourceList[currentIndex - 1] : null;
  const nextResource =
    showPrevNext && currentIndex >= 0 && currentIndex < categoryResourceList.length - 1
      ? categoryResourceList[currentIndex + 1]
      : null;

  const hasContent = hasMeaningfulPortableContent(resource.content);
  const renderContent = hasContent;
  const renderExcerptFallback = !hasContent && !!resource.excerpt;

  return (
    <div className="pt-20 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="container mx-auto max-w-4xl">
        <Link to={category ? `/${urlPrefix}/${category}` : sectionAnchor}>
          <Button variant="ghost" className="mb-8 flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Retour à {categoryTitle}
          </Button>
        </Link>

        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4 flex-wrap">
            <span className="px-3 py-1 text-sm font-medium bg-gray-100 text-foreground rounded-full">
              {categoryTitle}
            </span>
            {(leafCategorySlug === "oeil-expo" || leafCategorySlug === "atelier-stages") && resource.status && (
              <span className="px-3 py-1 text-sm font-medium bg-gray-100 text-foreground rounded-full">
                {RESOURCE_STATUS_LABELS[resource.status] || resource.status}
              </span>
            )}
            {dateRangeLabel != null && (
              <div className="flex items-center text-sm text-gray-medium">
                <Calendar className="w-4 h-4 mr-1" />
                {dateRangeLabel}
              </div>
            )}
          </div>
          <h1 className="font-serif text-4xl sm:text-5xl font-bold mb-4">{resource.title}</h1>
        </div>

        {resource.imageUrl ? (
          <div className="relative aspect-video mb-12">
            <Image
              src={resource.imageUrl}
              alt={resource.title}
              fill
              className="object-cover"
            />
          </div>
        ) : null}

        {resource.workshopDate && (
          <div className="mb-12 p-6 bg-gray-50 rounded-sm">
            <h2 className="font-serif text-2xl font-semibold mb-4">Informations pratiques</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {formatResourceDate(resource.workshopDate) != null && (
                <div>
                  <p className="text-gray-medium mb-1">Date</p>
                  <p className="text-foreground font-medium">{formatResourceDate(resource.workshopDate)}</p>
                </div>
              )}
              {resource.workshopDuration && (
                <div>
                  <p className="text-gray-medium mb-1">Durée</p>
                  <p className="text-foreground font-medium">{resource.workshopDuration}</p>
                </div>
              )}
              {resource.workshopLocation && (
                <div>
                  <p className="text-gray-medium mb-1">Lieu</p>
                  <p className="text-foreground font-medium">{resource.workshopLocation}</p>
                </div>
              )}
              {resource.workshopPrice != null && (
                <div>
                  <p className="text-gray-medium mb-1">Prix</p>
                  <p className="text-foreground font-medium">{resource.workshopPrice} €</p>
                </div>
              )}
            </div>
            {resource.workshopRegistrationLink && (
              <a
                href={resource.workshopRegistrationLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center mt-6 px-6 py-3 bg-foreground text-background hover:opacity-90 transition-opacity"
              >
                S'inscrire
                <ExternalLink className="w-4 h-4 ml-2" />
              </a>
            )}
          </div>
        )}

        <article className="mb-12">
          {renderContent ? (
            <PortableText content={resource.content} />
          ) : renderExcerptFallback ? (
            <p className="text-lg text-gray-medium leading-relaxed whitespace-pre-wrap">
              {resource.excerpt}
            </p>
          ) : null}
        </article>

        {resource.videoUrl && (() => {
          const embedUrl = getVideoEmbedUrl(resource.videoUrl);
          if (embedUrl) {
            return (
              <div className="mb-12">
                <div className="relative aspect-video bg-gray-100 rounded-sm overflow-hidden">
                  <iframe
                    src={embedUrl}
                    className="absolute inset-0 w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title={resource.title}
                  />
                </div>
              </div>
            );
          }
          return (
            <div className="mb-12">
              <a
                href={resource.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-foreground hover:underline"
              >
                Voir la vidéo
                <ExternalLink className="w-4 h-4 ml-2" />
              </a>
            </div>
          );
        })()}

        {(prevResource || nextResource) && (
          <nav
            aria-label="Navigation entre articles"
            className="mb-12 pt-8 border-t border-gray-200 flex flex-col sm:flex-row gap-4 sm:gap-6"
          >
            {prevResource ? (
              <Link
                to={`/${urlPrefix}/${leafCategorySlug}/${prevResource.slug}`}
                className="flex-1 text-left text-foreground hover:underline focus:outline-none focus:underline"
              >
                <span className="text-sm text-gray-medium block mb-1">Précédent</span>
                <span className="font-serif font-semibold">← {prevResource.title}</span>
              </Link>
            ) : (
              <span className="flex-1" />
            )}
            {nextResource ? (
              <Link
                to={`/${urlPrefix}/${leafCategorySlug}/${nextResource.slug}`}
                className="flex-1 text-right text-foreground hover:underline focus:outline-none focus:underline"
              >
                <span className="text-sm text-gray-medium block mb-1">Suivant</span>
                <span className="font-serif font-semibold">{nextResource.title} →</span>
              </Link>
            ) : (
              <span className="flex-1" />
            )}
          </nav>
        )}

        {relatedResources.length > 0 && (
          <div className="mt-16 pt-8 border-t border-gray-200">
            <h3 className="font-serif text-2xl font-semibold mb-6">Ressources similaires</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {relatedResources.map((relatedResource) => (
                <Link
                  key={relatedResource._id}
                  to={`/${urlPrefix}/${leafCategorySlug}/${relatedResource.slug}`}
                  className="group block"
                >
                  {relatedResource.imageUrl ? (
                    <div className="relative aspect-video mb-4">
                      <Image
                        src={relatedResource.imageUrl}
                        alt={relatedResource.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="(max-width: 768px) 100vw, 50vw"
                      />
                    </div>
                  ) : null}
                  <h4 className="font-serif text-xl font-semibold group-hover:opacity-80 transition-opacity">
                    {relatedResource.title}
                  </h4>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
