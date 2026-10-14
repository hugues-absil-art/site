import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { useSectionHashSync } from "@/hooks/useSectionHashSync";
import {
  consumeHashScrollSuppression,
  getHashFromLocation,
  navigateToSection,
  resolveValidHomeHash,
  scrollToHashOnArrival,
} from "@/lib/sectionHash";
import Hero from "@/components/Hero";
import Gallery from "@/components/Gallery";
import Exhibitions from "@/components/Exhibitions";
import Biography from "@/components/Biography";
import Films from "@/components/Films";
import Press from "@/components/Press";
import Performances from "@/components/Performances";
import Critiques from "@/components/Critiques";
import Enseignement from "@/components/Enseignement";
import Journal from "@/components/Journal";
import Contact from "@/components/Contact";
import {
  getPaintings,
  getExhibitions,
  getBiography,
  getFilms,
  getPressArticles,
  getPressQuotes,
  getPerformances,
  getAdvicePosts,
} from "@/lib/sanity/data";
import { useSeo, DEFAULT_TITLE, DEFAULT_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/seo";

/** Même contrat que dans App.tsx (clic logo → accueil). */
type LogoHomeLocationState = { scrollHomeHero?: boolean };

export default function HomePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const siteSettings = useSiteSettings();
  useSeo({
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    path: "/",
    jsonLd: [
      { "@context": "https://schema.org", "@type": "WebSite", name: SITE_NAME, url: `${SITE_URL}/`, inLanguage: "fr" },
      {
        "@context": "https://schema.org",
        "@type": "Person",
        name: SITE_NAME,
        url: `${SITE_URL}/`,
        jobTitle: "Artiste peintre, graveur et dessinateur",
      },
    ],
  });
  const [paintings, setPaintings] = useState<Awaited<ReturnType<typeof getPaintings>>>([]);
  const [exhibitions, setExhibitions] = useState<Awaited<ReturnType<typeof getExhibitions>>>([]);
  const [biography, setBiography] = useState<Awaited<ReturnType<typeof getBiography>>>(null);
  const [films, setFilms] = useState<Awaited<ReturnType<typeof getFilms>>>([]);
  const [pressArticles, setPressArticles] = useState<Awaited<ReturnType<typeof getPressArticles>>>([]);
  const [pressQuotes, setPressQuotes] = useState<Awaited<ReturnType<typeof getPressQuotes>>>([]);
  const [performances, setPerformances] = useState<Awaited<ReturnType<typeof getPerformances>>>([]);
  const [posts, setPosts] = useState<Awaited<ReturnType<typeof getAdvicePosts>>>([]);
  const [loading, setLoading] = useState(true);
  const scrollHomeFromLogo = useMemo(
    () => Boolean((location.state as LogoHomeLocationState | null)?.scrollHomeHero),
    [location.state]
  );

  useSectionHashSync(!loading);

  // Pendant « Chargement… », annuler le Y hérité de la page détail (sinon on atterrit en bas = Contact).
  useLayoutEffect(() => {
    if (!loading) return;
    const hasHash = Boolean(location.hash || getHashFromLocation());
    if (hasHash) {
      window.scrollTo(0, 0);
    }
  }, [loading, location.key, location.hash]);

  useEffect(() => {
    Promise.all([
      getPaintings(),
      getExhibitions(),
      getBiography(),
      getFilms(),
      getPressArticles(),
      getPressQuotes(),
      getPerformances(),
      getAdvicePosts(),
    ]).then(([p, e, b, f, pa, pq, perfs, journalPosts]) => {
      setPaintings(p);
      setExhibitions(e);
      setBiography(b);
      setFilms(f);
      setPressArticles(pa);
      setPressQuotes(pq);
      setPerformances(perfs);
      setPosts(journalPosts);
      setLoading(false);
    });
  }, []);

  // Retour / deep-link uniquement (les clics menu passent par navigateToSection + suppress).
  useLayoutEffect(() => {
    if (loading) return;
    if (consumeHashScrollSuppression()) return;

    const raw = location.hash || getHashFromLocation() || "";
    const id = resolveValidHomeHash(raw);
    if (!id) return;

    scrollToHashOnArrival(id);
  }, [loading, location.hash, location.key]);

  useLayoutEffect(() => {
    if (loading || !scrollHomeFromLogo) return;
    navigateToSection(navigate, "hero", { replace: true, behavior: "smooth" });
  }, [loading, scrollHomeFromLogo, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-medium">Chargement...</p>
      </div>
    );
  }

  return (
    <>
      <Hero
        heroImageUrl={siteSettings?.heroImageUrl ?? undefined}
        heroImageAlt={siteSettings?.heroImageAlt ?? undefined}
        heroImages={siteSettings?.heroImages ?? undefined}
        heroTitle={siteSettings?.heroTitle ?? undefined}
        heroSubtitle={siteSettings?.heroSubtitle ?? undefined}
        heroCtaLabel={siteSettings?.heroCtaLabel ?? undefined}
      />
      <Gallery
        paintings={paintings}
        galleryUseFeatured={siteSettings?.galleryUseFeatured ?? false}
      />
      <Exhibitions exhibitions={exhibitions} />
      <Biography biography={biography} />
      {films.length > 0 && <Films films={films} />}
      <Press
        articles={pressArticles}
        quotes={pressQuotes}
        pressKitUrl={siteSettings?.pressKitUrl}
        pressKitFilename={siteSettings?.pressKitFilename}
      />
      <Performances performances={performances} />
      <Critiques />
      <Enseignement />
      {posts.length > 0 && <Journal posts={posts} />}
      <Contact siteSettings={siteSettings ?? undefined} />
    </>
  );
}
