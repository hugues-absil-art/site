import { Navigate, useLocation } from "react-router-dom";
import { lookupLegacy } from "@/lib/seo";
import ResourcePage from "./ResourcePage";
import ExhibitionPage from "./ExhibitionPage";
import PressArticlePage from "./PressArticlePage";
import JournalPostPage from "./JournalPostPage";
import NotFoundPage from "./NotFoundPage";

/**
 * Anciennes adresses WordPress (/wordpress/…) : la page est servie à la MÊME adresse
 * (pas de redirection, donc le référencement existant est conservé).
 * Les pages sans équivalent sont renvoyées vers la destination la plus pertinente.
 */
export default function LegacyRoute() {
  const { pathname } = useLocation();
  const entry = lookupLegacy(pathname);
  if (!entry) return <NotFoundPage />;
  if (entry.r) return <Navigate to={entry.r} replace />;
  switch (entry.t) {
    case "resource":
      return <ResourcePage slug={entry.s} />;
    case "exhibition":
      return <ExhibitionPage slug={entry.s} />;
    case "pressArticle":
      return <PressArticlePage slug={entry.s} />;
    case "advice":
      return <JournalPostPage slug={entry.s} />;
    default:
      return <NotFoundPage />;
  }
}
