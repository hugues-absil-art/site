import { Instagram, Linkedin, Rss } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { SiteSettings } from "@/lib/sanity/data";
import { navigateToSection } from "@/lib/sectionHash";
import { realProfileUrl } from "@/lib/seo";

interface FooterProps {
  siteSettings?: SiteSettings | null;
  showFilmsLink?: boolean;
  showJournalLink?: boolean;
}

const normalizeFooterSubtitle = (s: string | null | undefined): string => {
  const raw = s ?? "Artiste contemporain.";
  if (raw.includes("Peintre") || raw.includes("Explorateur de la lumière")) return "Artiste contemporain.";
  return raw;
};

const FOOTER_ANCHORS: { label: string; hash: string; show?: "films" | "journal" }[] = [
  { label: "Galerie", hash: "gallery" },
  { label: "Expositions", hash: "exhibitions" },
  { label: "Biographie", hash: "biography" },
  { label: "Films", hash: "films", show: "films" },
  { label: "Presse", hash: "press" },
  { label: "Performances", hash: "performances" },
  { label: "Critiques", hash: "critiques" },
  { label: "Enseignement", hash: "enseignement" },
  { label: "Journal", hash: "journal", show: "journal" },
  { label: "Contact", hash: "contact" },
];

export default function Footer({ siteSettings, showFilmsLink = false, showJournalLink = false }: FooterProps) {
  const siteName = siteSettings?.siteName ?? "Hugues Absil";
  const footerSubtitle = normalizeFooterSubtitle(siteSettings?.footerSubtitle);
  const footerNavTitle = siteSettings?.footerNavTitle ?? "Navigation";
  const footerSocialTitle = siteSettings?.footerSocialTitle ?? "Réseaux Sociaux";
  const instagramUrl = realProfileUrl(siteSettings?.instagramUrl);
  const linkedinUrl = realProfileUrl(siteSettings?.linkedinUrl);
  const location = useLocation();
  const navigate = useNavigate();

  const visibleAnchors = FOOTER_ANCHORS.filter((item) => {
    if (item.show === "films") return showFilmsLink;
    if (item.show === "journal") return showJournalLink;
    return true;
  });

  return (
    <footer className="bg-background border-t border-gray-200 mt-20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="font-serif text-lg font-semibold mb-4">{siteName}</h3>
            <p className="text-sm text-gray-medium">
              {footerSubtitle}
            </p>
          </div>

          <div>
            <h3 className="font-serif text-lg font-semibold mb-4">{footerNavTitle}</h3>
            <ul className="space-y-2 text-sm">
              {visibleAnchors.map((item) => (
                <li key={item.hash}>
                  <Link
                    to={`/#${item.hash}`}
                    className="text-gray-medium hover:text-foreground transition-colors"
                    onClick={(e) => {
                      if (location.pathname === "/") {
                        e.preventDefault();
                        navigateToSection(navigate, item.hash, {
                          replace: false,
                          behavior: "smooth",
                        });
                      }
                    }}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-serif text-lg font-semibold mb-4">{footerSocialTitle}</h3>
            <div className="flex space-x-4">
              <a
                href={`${import.meta.env.BASE_URL}feed.xml`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-medium hover:text-foreground transition-colors"
                aria-label="Flux RSS"
                title="Flux RSS : dernières publications"
              >
                <Rss className="w-5 h-5" />
              </a>
              <>
                {instagramUrl && (
                  <a
                    href={instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-medium hover:text-foreground transition-colors"
                    aria-label="Instagram"
                  >
                    <Instagram className="w-5 h-5" />
                  </a>
                )}
                {linkedinUrl && (
                  <a
                    href={linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-medium hover:text-foreground transition-colors"
                    aria-label="LinkedIn"
                  >
                    <Linkedin className="w-5 h-5" />
                  </a>
                )}
              </>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-gray-200 text-center text-sm text-gray-medium">
          <p>&copy; {new Date().getFullYear()} {siteName}. Tous droits réservés.</p>
        </div>
      </div>
    </footer>
  );
}
