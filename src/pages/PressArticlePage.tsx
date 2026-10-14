import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Calendar } from "lucide-react";
import Image from "@/components/ui/Image";
import { getPressArticleBySlug } from "@/lib/sanity/data";
import { useSeo, legacyPathFor, plainFromPortable, SITE_URL, SITE_NAME } from "@/lib/seo";
import PortableText from "@/lib/sanity/portableText";
import Button from "@/components/ui/Button";
import { getVideoEmbedUrl } from "@/lib/videoEmbed";

function formatDate(dateString: string | null | undefined) {
  if (!dateString?.trim()) return null;
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export default function PressArticlePage(props: { slug?: string }) {
  const params = useParams<{ slug: string }>();
  const slug = props.slug ?? params.slug;
  const [article, setArticle] = useState<Awaited<ReturnType<typeof getPressArticleBySlug>>>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    getPressArticleBySlug(slug).then((a) => {
      if (!a) {
        setNotFound(true);
      } else {
        setArticle(a);
      }
      setLoading(false);
    });
  }, [slug]);

  const seoPath = legacyPathFor("pressArticle", slug) ?? `/presse/${slug}`;
  const seoDescription = article ? article.excerpt?.trim() || plainFromPortable(article.content) : undefined;
  useSeo({
    enabled: !!article,
    title: article?.title ?? "",
    description: seoDescription,
    path: seoPath,
    image: article?.imageUrl || null,
    type: "article",
    jsonLd: article
      ? {
          "@context": "https://schema.org",
          "@type": "Article",
          headline: article.title,
          description: seoDescription,
          image: article.imageUrl ? [article.imageUrl] : undefined,
          datePublished: article.date || undefined,
          author: { "@type": "Person", name: SITE_NAME },
          publisher: article.publication ? { "@type": "Organization", name: article.publication } : undefined,
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

  if (notFound || !article) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-20">
        <div className="text-center">
          <h1 className="font-serif text-4xl font-bold mb-4">Article non trouvé</h1>
          <Link to="/">
            <Button variant="primary">Retour à l'accueil</Button>
          </Link>
        </div>
      </div>
    );
  }

  const pressVideoEmbed = article.videoUrl ? getVideoEmbedUrl(article.videoUrl) : null;

  return (
    <div className="pt-20 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="container mx-auto max-w-4xl">
        <Link to="/">
          <Button variant="ghost" className="mb-8 flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Retour à l'accueil
          </Button>
        </Link>

        <div className="mb-8">
          <div className="flex items-center text-sm text-gray-medium mb-4">
            <Calendar className="w-4 h-4 mr-1" />
            {formatDate(article.date) ?? "—"}
            {article.publication && (
              <span className="ml-2">• {article.publication}</span>
            )}
          </div>
          <h1 className="font-serif text-4xl sm:text-5xl font-bold mb-4">{article.title}</h1>
          {article.excerpt && (
            <p className="text-lg text-gray-medium leading-relaxed">{article.excerpt}</p>
          )}
        </div>

        {article.imageUrl && (
          <div className="relative aspect-video mb-12">
            <Image
              src={article.imageUrl}
              alt={article.title}
              fill
              className="object-cover rounded-sm"
              sizes="(max-width: 768px) 100vw, 896px"
            />
          </div>
        )}

        {pressVideoEmbed && (
          <div className="relative aspect-video mb-12 rounded-sm overflow-hidden bg-gray-100">
            <iframe
              src={pressVideoEmbed}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={article.title}
            />
          </div>
        )}

        {article.content ? (
          <article className="mb-12">
            <PortableText content={article.content} />
          </article>
        ) : article.url ? (
          <p className="mb-12">
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground underline hover:opacity-80"
            >
              Lire l'article sur le site de la publication
            </a>
          </p>
        ) : null}
      </div>
    </div>
  );
}
