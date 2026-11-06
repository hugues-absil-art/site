import { useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { NavItem } from "@/lib/sanity/data";
import SiteSearch, { SiteSearchTrigger } from "@/components/SiteSearch";
import { useActiveSection } from "@/contexts/ActiveSectionContext";
import { navigateToSection, normalizeSectionId } from "@/lib/sectionHash";

interface HeaderProps {
  siteName?: string;
  navItems?: NavItem[];
}

export default function Header({ siteName = "Hugues Absil", navItems = [] }: HeaderProps) {
  const items = navItems.length > 0 ? navItems : [
    { label: "Accueil", href: "#hero" },
    { label: "Galerie", href: "#gallery" },
    { label: "Expositions", href: "#exhibitions" },
    { label: "Biographie", href: "#biography" },
    { label: "Presse", href: "#press" },
    { label: "Performances", href: "#performances" },
    { label: "Écrits critiques", href: "#critiques" },
    { label: "Enseignement", href: "#enseignement" },
    { label: "Journal", href: "#journal" },
    { label: "Contact", href: "#contact" },
  ];
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchNonce, setSearchNonce] = useState(0);
  const searchTriggerRef = useRef<HTMLButtonElement | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { activeSectionId } = useActiveSection();

  const handleNavClick = (href: string) => {
    if (!href.startsWith("/")) {
      if (location.pathname === "/") {
        navigateToSection(navigate, href, { replace: false, behavior: "smooth" });
        setTimeout(() => setIsMenuOpen(false), 600);
        return;
      }
    }
    setIsMenuOpen(false);
  };

  const isAnchorActive = (href: string) =>
    location.pathname === "/" && normalizeSectionId(href) === activeSectionId;

  const openSearch = (el: HTMLButtonElement) => {
    searchTriggerRef.current = el;
    setIsMenuOpen(false);
    setSearchNonce((n) => n + 1);
    setIsSearchOpen(true);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-gray-200">
      <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 gap-3">
          <Link
            to="/"
            className="font-serif text-2xl font-bold text-foreground hover:opacity-80 transition-opacity min-w-0 truncate lg:shrink-0"
            onClick={(e) => {
              if (location.pathname === "/") {
                e.preventDefault();
                handleNavClick("#hero");
              } else {
                e.preventDefault();
                navigate("/", { state: { scrollHomeHero: true } });
              }
            }}
            aria-current={isAnchorActive("#hero") ? "true" : undefined}
          >
            {siteName}
          </Link>

          <div className="hidden lg:flex items-center space-x-3 xl:space-x-5">
            <SiteSearchTrigger expanded={isSearchOpen} onOpen={openSearch} />
            {items.map((item) => {
              const isAnchor = !item.href.startsWith("/");
              const to = isAnchor && location.pathname !== "/" ? `/${item.href}` : item.href;
              if (!isAnchor) {
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className="text-sm font-medium text-foreground hover:text-gray-medium transition-colors"
                  >
                    {item.label}
                  </Link>
                );
              }
              const active = isAnchorActive(item.href);
              return (
                <Link
                  key={item.href}
                  to={to}
                  className={`text-sm font-medium transition-colors ${
                    active ? "text-foreground" : "text-foreground hover:text-gray-medium"
                  }`}
                  aria-current={active ? "location" : undefined}
                  onClick={(e) => {
                    if (location.pathname === "/") {
                      e.preventDefault();
                      handleNavClick(item.href);
                    }
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          <div className="flex items-center shrink-0 lg:hidden">
            <SiteSearchTrigger expanded={isSearchOpen} onOpen={openSearch} />
            <button
              className="p-2 min-w-11 min-h-11 inline-flex items-center justify-center"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label={isMenuOpen ? "Fermer le menu" : "Ouvrir le menu"}
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="lg:hidden overflow-hidden"
            >
              <div className="py-4 space-y-2">
                {items.map((item) => {
                  if (!item.href.startsWith("#")) {
                    return (
                      <Link
                        key={item.href}
                        to={item.href}
                        onClick={() => {
                          setIsMenuOpen(false);
                        }}
                        className="block w-full text-left px-4 py-2 text-sm font-medium text-foreground hover:bg-gray-100 transition-colors"
                      >
                        {item.label}
                      </Link>
                    );
                  }
                  const to = location.pathname !== "/" ? `/${item.href}` : item.href;
                  const active = isAnchorActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      to={to}
                      aria-current={active ? "location" : undefined}
                      onClick={(e) => {
                        if (location.pathname === "/") {
                          e.preventDefault();
                          handleNavClick(item.href);
                        } else {
                          setIsMenuOpen(false);
                        }
                      }}
                      className={`block w-full text-left px-4 py-2 text-sm font-medium transition-colors ${
                        active ? "bg-gray-100 text-foreground" : "text-foreground hover:bg-gray-100"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
      <SiteSearch
        key={searchNonce}
        open={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        triggerRef={searchTriggerRef}
      />
    </header>
  );
}
