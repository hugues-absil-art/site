import { useEffect, useMemo, useState } from "react";
import type { Location } from "react-router-dom";
import {
  createBrowserRouter,
  RouterProvider,
  Outlet,
  ScrollRestoration,
  useLocation,
  useParams,
  Navigate,
} from "react-router-dom";
import { CRITIQUES_LABEL, CRITIQUES_URL_PREFIX, LEGACY_CRITIQUES_URL_PREFIX, normalizeNavItems } from "@/lib/resourceSection";
import { SiteSettingsProvider, useSiteSettings } from "@/contexts/SiteSettingsContext";
import { ActiveSectionProvider } from "@/contexts/ActiveSectionContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import HomePage from "@/pages/HomePage";
import JournalPostPage from "@/pages/JournalPostPage";
import PressArticlePage from "@/pages/PressArticlePage";
import ExhibitionPage from "@/pages/ExhibitionPage";
import ResourceCategoryPage from "@/pages/ResourceCategoryPage";
import ResourcePage from "@/pages/ResourcePage";
import StudioPage from "@/pages/StudioPage";
import NotFoundPage from "@/pages/NotFoundPage";
import LegacyRoute from "@/pages/LegacyRoute";
import PreviewEnablePage from "@/pages/PreviewEnablePage";
import SanityVisualEditing from "@/components/SanityVisualEditing";

/** Pages hors accueil uniquement — l’accueil gère la position via `#` + scroll manuel. */
function scrollRestorationKey(location: Location) {
  return location.pathname + location.search;
}

const DEFAULT_NAV_ITEMS = [
  { label: "Accueil", href: "#hero" },
  { label: "Galerie", href: "#gallery" },
  { label: "Expositions", href: "#exhibitions" },
  { label: "Biographie", href: "#biography" },
  { label: "Films", href: "#films" },
  { label: "Presse", href: "#press" },
  { label: "Performances", href: "#performances" },
  { label: CRITIQUES_LABEL, href: "#critiques" },
  { label: "Enseignement", href: "#enseignement" },
  { label: "Journal", href: "#journal" },
  { label: "Contact", href: "#contact" },
];

function Layout() {
  const siteSettings = useSiteSettings();
  const location = useLocation();
  const [hasFilms, setHasFilms] = useState(false);
  const [hasJournal, setHasJournal] = useState(false);
  const isHome = location.pathname === "/" || location.pathname === "";

  useEffect(() => {
    import("@/lib/sanity/data").then(({ getFilms, getAdvicePosts }) => {
      getFilms().then((films) => setHasFilms(Array.isArray(films) && films.length > 0));
      getAdvicePosts().then((posts) => setHasJournal(Array.isArray(posts) && posts.length > 0));
    });
  }, []);

  // Empêche le navigateur de réappliquer un vieux Y au Retour (conflit avec nos ancres).
  useEffect(() => {
    const prev = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return () => {
      window.history.scrollRestoration = prev;
    };
  }, []);

  const navItems = useMemo(() => {
    const base = normalizeNavItems(siteSettings?.navItems ?? DEFAULT_NAV_ITEMS);
    return base.filter((item) => {
      if (item.href === "#films" && !hasFilms) return false;
      if (item.href === "#journal" && !hasJournal) return false;
      return true;
    });
  }, [siteSettings?.navItems, hasFilms, hasJournal]);

  return (
    <ActiveSectionProvider>
      <div className="min-h-screen flex flex-col">
        {/* Pas sur l’accueil : sinon un Y pixel écrase le scroll vers #critiques une fraction de seconde plus tard. */}
        {!isHome && <ScrollRestoration getKey={(loc) => scrollRestorationKey(loc)} />}
        <Header
          siteName={siteSettings?.siteName ?? "Hugues Absil"}
          navItems={navItems}
        />
        <main className="flex-1">
          <Outlet />
        </main>
        <Footer siteSettings={siteSettings} showFilmsLink={hasFilms} showJournalLink={hasJournal} />
        <SanityVisualEditing />
      </div>
    </ActiveSectionProvider>
  );
}
function RedirectEcritsToCritiques() {
  const { category, slug } = useParams();
  const path = slug
    ? `/${CRITIQUES_URL_PREFIX}/${category}/${slug}`
    : `/${CRITIQUES_URL_PREFIX}/${category}`;
  return <Navigate to={path} replace />;
}

const basename = import.meta.env.BASE_URL.replace(/\/$/, "") || undefined;

const router = createBrowserRouter(
  [
    { path: "studio", element: <StudioPage /> },
    { path: "studio/*", element: <StudioPage /> },
    {
      path: "/",
      element: <Layout />,
      children: [
        { index: true, element: <HomePage /> },
        { path: "preview/enable", element: <PreviewEnablePage /> },
        { path: "journal/:slug", element: <JournalPostPage /> },
        { path: "presse/:slug", element: <PressArticlePage /> },
        { path: "expositions/:slug", element: <ExhibitionPage /> },
        { path: `${CRITIQUES_URL_PREFIX}/:category`, element: <ResourceCategoryPage /> },
        { path: `${CRITIQUES_URL_PREFIX}/:category/:slug`, element: <ResourcePage /> },
        { path: `${LEGACY_CRITIQUES_URL_PREFIX}/:category`, element: <RedirectEcritsToCritiques /> },
        { path: `${LEGACY_CRITIQUES_URL_PREFIX}/:category/:slug`, element: <RedirectEcritsToCritiques /> },
        { path: "enseignement/:category", element: <ResourceCategoryPage /> },
        { path: "enseignement/:category/:slug", element: <ResourcePage /> },
        // Anciennes adresses WordPress : servies telles quelles (référencement conservé)
        { path: "wordpress", element: <Navigate to="/" replace /> },
        { path: "wordpress/:slug", element: <LegacyRoute /> },
        { path: "wordpress/:parent/:slug", element: <LegacyRoute /> },
        { path: "*", element: <NotFoundPage /> },
      ],
    },
  ],
  basename ? { basename } : undefined
);

export default function App() {
  return (
    <SiteSettingsProvider>
      <RouterProvider router={router} />
    </SiteSettingsProvider>
  );
}
