import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import Image from "@/components/ui/Image";
import { X, Eye, Maximize2, ChevronLeft, ChevronRight, ChevronDown, RotateCcw } from "lucide-react";
import type { Painting, PaintingRef } from "@/lib/sanity/data";
import PortableText from "@/lib/sanity/portableText";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { navigateToSection } from "@/lib/sectionHash";
import {
  comparePaintingsCatalogOrder,
  normalizeReference,
} from "@/lib/catalogSort";

const INITIAL_DISPLAY_COUNT_DESKTOP = 20;
const INITIAL_DISPLAY_COUNT_MOBILE = 8;
const LOAD_MORE_STEP = 20;

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Hauteur relative à largeur de colonne fixe (ratio h/w), pour équilibrer les piles sans mesurer le DOM. */
function paintingUnitHeight(p: Painting): number {
  const w = p.imageWidth > 0 ? p.imageWidth : 1;
  const h = p.imageHeight > 0 ? p.imageHeight : 1;
  return h / w;
}

/**
 * Chaque œuvre va dans la colonne dont la somme des hauteurs relatives est la plus faible.
 * Réduit les grands vides entre colonnes ; l’ordre de lecture n’est plus « ligne par ligne ».
 * Réservé à `!catalogOrder` — avec l’ordre catalogue, utiliser le round-robin strict.
 */
function balanceColumnBuckets(paintings: Painting[], columnCount: number): Painting[][] {
  const n = columnCount;
  if (n <= 1) return [paintings];
  const buckets: Painting[][] = Array.from({ length: n }, () => []);
  const heights = new Array(n).fill(0);
  for (const p of paintings) {
    const uh = paintingUnitHeight(p);
    let best = 0;
    for (let j = 1; j < n; j++) {
      if (heights[j] < heights[best]) best = j;
    }
    buckets[best].push(p);
    heights[best] += uh;
  }
  return buckets;
}

interface GalleryProps {
  paintings: Painting[];
  galleryUseFeatured?: boolean;
}

export default function Gallery({ paintings, galleryUseFeatured = false }: GalleryProps) {
  const navigate = useNavigate();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const isSm = useMediaQuery("(min-width: 640px)");
  const isLg = useMediaQuery("(min-width: 1024px)");
  const isXl = useMediaQuery("(min-width: 1280px)");
  const initialDisplayCount = isMobile ? INITIAL_DISPLAY_COUNT_MOBILE : INITIAL_DISPLAY_COUNT_DESKTOP;
  const [selectedPainting, setSelectedPainting] = useState<Painting | null>(null);
  const [selectedTechnique, setSelectedTechnique] = useState<string>("all");
  const [selectedTheme, setSelectedTheme] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedSeries, setSelectedSeries] = useState<string>("all");
  const [showInSitu, setShowInSitu] = useState(false);
  const [fullscreenMode, setFullscreenMode] = useState<null | "painting" | "inSitu">(null);
  const [fullscreenZoom, setFullscreenZoom] = useState(1);
  const [fullscreenPan, setFullscreenPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number } | null>(null);
  const didPanThisGestureRef = useRef(false);
  const [selectedInSituIndex, setSelectedInSituIndex] = useState(0);
  const [showFullGallery, setShowFullGallery] = useState(false);
  const [displayCount, setDisplayCount] = useState(initialDisplayCount);
  const [openFilter, setOpenFilter] = useState<
    null | "technique" | "theme" | "status" | "series" | "reference"
  >(null);
  const [catalogOrder, setCatalogOrder] = useState(false);
  /** Filtre référence : correspondance par préfixe (saisie progressive), après normalisation. */
  const [referenceSearch, setReferenceSearch] = useState("");
  const modalContentRef = useRef<HTMLDivElement>(null);
  const filterDropdownRef = useRef<HTMLDivElement>(null);

  const gridRef = useRef<HTMLDivElement>(null);
  const leftColRef = useRef<HTMLDivElement>(null);
  const rightColRef = useRef<HTMLDivElement>(null);
  const fullscreenContentRef = useRef<HTMLDivElement>(null);
  const inSituContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedInSituIndex(0);
  }, [selectedPainting]);

  useEffect(() => {
    if (selectedPainting) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [selectedPainting]);

  useEffect(() => {
    if (fullscreenMode == null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreenMode(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [fullscreenMode]);

  useEffect(() => {
    setFullscreenZoom(1);
    setFullscreenPan({ x: 0, y: 0 });
  }, [fullscreenMode]);

  useEffect(() => {
    if (isMobile) setDisplayCount((c: number) => Math.min(c, INITIAL_DISPLAY_COUNT_MOBILE));
  }, [isMobile]);

  useEffect(() => {
    if (!isPanning) return;
    const onMove = (e: MouseEvent) => {
      const start = panStartRef.current;
      if (!start) return;
      didPanThisGestureRef.current = true;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      setFullscreenPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      panStartRef.current = { x: e.clientX, y: e.clientY };
    };
    const onUp = () => {
      setIsPanning(false);
      panStartRef.current = null;
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [isPanning]);

  useEffect(() => {
    if (openFilter == null) return;
    const handler = (e: MouseEvent) => {
      const el = filterDropdownRef.current;
      if (el && !el.contains(e.target as Node)) setOpenFilter(null);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [openFilter]);

  useEffect(() => {
    if (openFilter == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenFilter(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openFilter]);

  const getRefKey = (ref: PaintingRef) => ref.slug ?? ref._id;

  const techniqueList = useMemo(() => {
    const map = new Map<string, PaintingRef>();
    paintings.forEach((p) => {
      if (p.technique) {
        const key = getRefKey(p.technique);
        if (!map.has(key)) map.set(key, p.technique);
      }
    });
    return Array.from(map.values()).sort((a, b) => (a.title ?? "").localeCompare(b.title ?? ""));
  }, [paintings]);

  const themeList = useMemo(() => {
    const map = new Map<string, PaintingRef>();
    paintings.forEach((p) => {
      if (p.theme) {
        const key = getRefKey(p.theme);
        if (!map.has(key)) map.set(key, p.theme);
      }
    });
    return Array.from(map.values()).sort((a, b) => (a.title ?? "").localeCompare(b.title ?? ""));
  }, [paintings]);

  const statusList = useMemo(() => {
    const map = new Map<string, PaintingRef>();
    paintings.forEach((p) => {
      if (p.status) {
        const key = getRefKey(p.status);
        if (!map.has(key)) map.set(key, p.status);
      }
    });
    return Array.from(map.values()).sort((a, b) => (a.title ?? "").localeCompare(b.title ?? ""));
  }, [paintings]);

  const seriesList = useMemo(() => {
    const map = new Map<string, PaintingRef>();
    paintings.forEach((p) => {
      if (p.series) {
        const key = getRefKey(p.series);
        if (!map.has(key)) map.set(key, p.series);
      }
    });
    return Array.from(map.values()).sort((a, b) => (a.title ?? "").localeCompare(b.title ?? ""));
  }, [paintings]);

  const categoryFilteredPaintings = useMemo(() => {
    return paintings.filter((painting) => {
      if (selectedTechnique !== "all") {
        const key = painting.technique ? getRefKey(painting.technique) : null;
        if (key !== selectedTechnique) return false;
      }
      if (selectedTheme !== "all") {
        const key = painting.theme ? getRefKey(painting.theme) : null;
        if (key !== selectedTheme) return false;
      }
      if (selectedStatus !== "all") {
        const key = painting.status ? getRefKey(painting.status) : null;
        if (key !== selectedStatus) return false;
      }
      if (selectedSeries !== "all") {
        const key = painting.series ? getRefKey(painting.series) : null;
        if (key !== selectedSeries) return false;
      }
      return true;
    });
  }, [paintings, selectedTechnique, selectedTheme, selectedStatus, selectedSeries]);

  const referenceQueryNorm = normalizeReference(referenceSearch);

  const afterReferenceFilter = useMemo(() => {
    if (!referenceQueryNorm) return categoryFilteredPaintings;
    return categoryFilteredPaintings.filter((p) => {
      const ref = normalizeReference(p.reference);
      if (!ref) return false;
      return ref.startsWith(referenceQueryNorm);
    });
  }, [categoryFilteredPaintings, referenceQueryNorm]);

  const galleryPaintings = useMemo(() => {
    if (!catalogOrder) return afterReferenceFilter;
    return [...afterReferenceFilter].sort(comparePaintingsCatalogOrder);
  }, [afterReferenceFilter, catalogOrder]);

  const referenceFilterActive = referenceQueryNorm.length > 0;

  const selectedSeriesTitle =
    selectedSeries !== "all"
      ? seriesList.find((s) => getRefKey(s) === selectedSeries)?.title
      : undefined;
  const selectedTechniqueTitle =
    selectedTechnique !== "all"
      ? techniqueList.find((t) => getRefKey(t) === selectedTechnique)?.title
      : undefined;
  const selectedThemeTitle =
    selectedTheme !== "all"
      ? themeList.find((t) => getRefKey(t) === selectedTheme)?.title
      : undefined;
  const selectedStatusTitle =
    selectedStatus !== "all"
      ? statusList.find((s) => getRefKey(s) === selectedStatus)?.title
      : undefined;

  const anyFilterActive =
    selectedSeries !== "all" ||
    selectedTechnique !== "all" ||
    selectedTheme !== "all" ||
    selectedStatus !== "all" ||
    catalogOrder ||
    referenceFilterActive;

  const resetAllFilters = () => {
    setSelectedSeries("all");
    setSelectedTechnique("all");
    setSelectedTheme("all");
    setSelectedStatus("all");
    setCatalogOrder(false);
    setReferenceSearch("");
    setOpenFilter(null);
  };

  useEffect(() => {
    setShowFullGallery(false);
    setDisplayCount(initialDisplayCount);
  }, [
    selectedTechnique,
    selectedTheme,
    selectedStatus,
    selectedSeries,
    catalogOrder,
    referenceSearch,
    initialDisplayCount,
  ]);

  const initialSelection = useMemo(() => {
    if (galleryUseFeatured) {
      const featured = galleryPaintings.filter((p) => p.featured).slice(0, initialDisplayCount);
      if (featured.length > 0) return featured;
    }
    if (catalogOrder) {
      return galleryPaintings.slice(0, initialDisplayCount);
    }
    return shuffleArray([...galleryPaintings]).slice(0, initialDisplayCount);
  }, [galleryPaintings, galleryUseFeatured, initialDisplayCount, catalogOrder]);

  const displayedPaintings = useMemo(() => {
    if (!showFullGallery) return initialSelection;
    return galleryPaintings.slice(0, displayCount);
  }, [showFullGallery, initialSelection, galleryPaintings, displayCount]);

  /** Aligné sur sm:2 / lg:3 / xl:4 — lecture « ligne par ligne » : indices 0…n-1 sur la 1ʳᵉ rangée, etc. */
  const galleryColumnCount = useMemo(() => {
    if (isXl) return 4;
    if (isLg) return 3;
    if (isSm) return 2;
    return 1;
  }, [isSm, isLg, isXl]);

  const galleryColumnBuckets = useMemo(() => {
    const n = galleryColumnCount;
    if (catalogOrder) {
      const buckets: Painting[][] = Array.from({ length: n }, () => []);
      displayedPaintings.forEach((p, i) => {
        buckets[i % n].push(p);
      });
      return buckets;
    }
    return balanceColumnBuckets(displayedPaintings, n);
  }, [displayedPaintings, galleryColumnCount, catalogOrder]);

  const openLightbox = (painting: Painting) => {
    setSelectedPainting(painting);
    setShowInSitu(false);
  };

  const closeLightbox = () => {
    setSelectedPainting(null);
    setShowInSitu(false);
  };

  return (
    <section id="gallery" className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="container mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="font-serif text-4xl sm:text-5xl font-bold mb-4">Galerie</h2>
          <p className="text-gray-medium max-w-2xl mx-auto">
            Découvrez une sélection d'œuvres récentes et passées
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-12"
          ref={filterDropdownRef}
        >
          <div className="flex flex-wrap gap-6 justify-center items-center">
            {seriesList.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenFilter((f) => (f === "series" ? null : "series"))}
                  className={`flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-foreground/80 transition-colors ${
                    selectedSeriesTitle ? "font-semibold" : ""
                  }`}
                  aria-expanded={openFilter === "series"}
                  aria-haspopup="listbox"
                >
                  <span className="max-w-[10rem] truncate sm:max-w-[14rem]">
                    {selectedSeriesTitle ? `Série · ${selectedSeriesTitle}` : "Série"}
                  </span>
                  {selectedSeriesTitle && (
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/70" aria-hidden />
                  )}
                  <ChevronDown
                    className={`w-4 h-4 shrink-0 transition-transform ${openFilter === "series" ? "rotate-180" : ""}`}
                  />
                </button>
                {openFilter === "series" && (
                  <ul
                    className="absolute left-0 top-full mt-1 min-w-[180px] py-1 bg-white text-foreground text-sm shadow-[0_2px_12px_rgba(0,0,0,0.08)] border border-gray-100 rounded-sm z-10 max-h-64 overflow-y-auto"
                    role="listbox"
                  >
                    <li role="option">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSeries("all");
                          setOpenFilter(null);
                        }}
                        className={`w-full text-left px-4 py-2 hover:bg-gray-50 ${selectedSeries === "all" ? "bg-gray-50 font-medium" : ""}`}
                      >
                        Toutes
                      </button>
                    </li>
                    {seriesList.map((series) => (
                      <li key={getRefKey(series)} role="option">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSeries(getRefKey(series));
                            setOpenFilter(null);
                          }}
                          className={`w-full text-left px-4 py-2 hover:bg-gray-50 ${selectedSeries === getRefKey(series) ? "bg-gray-50 font-medium" : ""}`}
                        >
                          {series.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {techniqueList.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenFilter((f) => (f === "technique" ? null : "technique"))}
                  className={`flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-foreground/80 transition-colors ${
                    selectedTechniqueTitle ? "font-semibold" : ""
                  }`}
                  aria-expanded={openFilter === "technique"}
                  aria-haspopup="listbox"
                >
                  <span className="max-w-[10rem] truncate sm:max-w-[14rem]">
                    {selectedTechniqueTitle ? `Technique · ${selectedTechniqueTitle}` : "Technique"}
                  </span>
                  {selectedTechniqueTitle && (
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/70" aria-hidden />
                  )}
                  <ChevronDown
                    className={`w-4 h-4 shrink-0 transition-transform ${openFilter === "technique" ? "rotate-180" : ""}`}
                  />
                </button>
                {openFilter === "technique" && (
                  <ul
                    className="absolute left-0 top-full mt-1 min-w-[180px] py-1 bg-white text-foreground text-sm shadow-[0_2px_12px_rgba(0,0,0,0.08)] border border-gray-100 rounded-sm z-10 max-h-64 overflow-y-auto"
                    role="listbox"
                  >
                    <li role="option">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTechnique("all");
                          setOpenFilter(null);
                        }}
                        className={`w-full text-left px-4 py-2 hover:bg-gray-50 ${selectedTechnique === "all" ? "bg-gray-50 font-medium" : ""}`}
                      >
                        Toutes
                      </button>
                    </li>
                    {techniqueList.map((tech) => (
                      <li key={getRefKey(tech)} role="option">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTechnique(getRefKey(tech));
                            setOpenFilter(null);
                          }}
                          className={`w-full text-left px-4 py-2 hover:bg-gray-50 ${selectedTechnique === getRefKey(tech) ? "bg-gray-50 font-medium" : ""}`}
                        >
                          {tech.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {themeList.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenFilter((f) => (f === "theme" ? null : "theme"))}
                  className={`flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-foreground/80 transition-colors ${
                    selectedThemeTitle ? "font-semibold" : ""
                  }`}
                  aria-expanded={openFilter === "theme"}
                  aria-haspopup="listbox"
                >
                  <span className="max-w-[10rem] truncate sm:max-w-[14rem]">
                    {selectedThemeTitle ? `Thème · ${selectedThemeTitle}` : "Thème"}
                  </span>
                  {selectedThemeTitle && (
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/70" aria-hidden />
                  )}
                  <ChevronDown
                    className={`w-4 h-4 shrink-0 transition-transform ${openFilter === "theme" ? "rotate-180" : ""}`}
                  />
                </button>
                {openFilter === "theme" && (
                  <ul
                    className="absolute left-0 top-full mt-1 min-w-[180px] py-1 bg-white text-foreground text-sm shadow-[0_2px_12px_rgba(0,0,0,0.08)] border border-gray-100 rounded-sm z-10 max-h-64 overflow-y-auto"
                    role="listbox"
                  >
                    <li role="option">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTheme("all");
                          setOpenFilter(null);
                        }}
                        className={`w-full text-left px-4 py-2 hover:bg-gray-50 ${selectedTheme === "all" ? "bg-gray-50 font-medium" : ""}`}
                      >
                        Tous
                      </button>
                    </li>
                    {themeList.map((t) => (
                      <li key={getRefKey(t)} role="option">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTheme(getRefKey(t));
                            setOpenFilter(null);
                          }}
                          className={`w-full text-left px-4 py-2 hover:bg-gray-50 ${selectedTheme === getRefKey(t) ? "bg-gray-50 font-medium" : ""}`}
                        >
                          {t.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {statusList.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenFilter((f) => (f === "status" ? null : "status"))}
                  className={`flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-foreground/80 transition-colors ${
                    selectedStatusTitle ? "font-semibold" : ""
                  }`}
                  aria-expanded={openFilter === "status"}
                  aria-haspopup="listbox"
                >
                  <span className="max-w-[10rem] truncate sm:max-w-[14rem]">
                    {selectedStatusTitle ? `Disponibilité · ${selectedStatusTitle}` : "Disponibilité"}
                  </span>
                  {selectedStatusTitle && (
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/70" aria-hidden />
                  )}
                  <ChevronDown
                    className={`w-4 h-4 shrink-0 transition-transform ${openFilter === "status" ? "rotate-180" : ""}`}
                  />
                </button>
                {openFilter === "status" && (
                  <ul
                    className="absolute left-0 top-full mt-1 min-w-[180px] py-1 bg-white text-foreground text-sm shadow-[0_2px_12px_rgba(0,0,0,0.08)] border border-gray-100 rounded-sm z-10 max-h-64 overflow-y-auto"
                    role="listbox"
                  >
                    <li role="option">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedStatus("all");
                          setOpenFilter(null);
                        }}
                        className={`w-full text-left px-4 py-2 hover:bg-gray-50 ${selectedStatus === "all" ? "bg-gray-50 font-medium" : ""}`}
                      >
                        Toutes
                      </button>
                    </li>
                    {statusList.map((s) => (
                      <li key={getRefKey(s)} role="option">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedStatus(getRefKey(s));
                            setOpenFilter(null);
                          }}
                          className={`w-full text-left px-4 py-2 hover:bg-gray-50 ${selectedStatus === getRefKey(s) ? "bg-gray-50 font-medium" : ""}`}
                        >
                          {s.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenFilter((f) => (f === "reference" ? null : "reference"))}
                className={`flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-foreground/80 transition-colors ${
                  catalogOrder || referenceFilterActive ? "font-semibold" : ""
                }`}
                aria-expanded={openFilter === "reference"}
                aria-haspopup="dialog"
              >
                <span className="max-w-[10rem] truncate sm:max-w-[14rem]">
                  {referenceFilterActive
                    ? `Référence · ${referenceSearch.trim()}`
                    : catalogOrder
                      ? "Référence · Ordre catalogue"
                      : "Référence"}
                </span>
                {(catalogOrder || referenceFilterActive) && (
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/70" aria-hidden />
                )}
                <ChevronDown
                  className={`w-4 h-4 shrink-0 transition-transform ${openFilter === "reference" ? "rotate-180" : ""}`}
                />
              </button>
              {openFilter === "reference" && (
                <div
                  className="absolute top-full z-20 mt-1 min-w-[min(260px,calc(100vw-2rem))] max-w-[min(100vw-2rem,320px)] rounded-sm border border-gray-100 bg-white p-3 text-left text-foreground shadow-[0_2px_12px_rgba(0,0,0,0.08)] left-auto right-0 md:left-0 md:right-auto"
                  role="dialog"
                  aria-label="Référence et ordre catalogue"
                >
                  <label className="mb-3 flex cursor-pointer items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={catalogOrder}
                      onChange={(e) => setCatalogOrder(e.target.checked)}
                    />
                    <span>Ordre catalogue (chronologique)</span>
                  </label>
                  <label htmlFor="gallery-ref-search" className="mb-1 block text-sm font-medium">
                    Filtrer par référence
                  </label>
                  <p className="mb-2 text-xs text-gray-medium">
                    Saisissez le début de la cote : la liste se réduit au fil de la frappe (ex.{" "}
                    <span className="font-mono">24</span> puis <span className="font-mono">24T</span>).
                  </p>
                  <input
                    id="gallery-ref-search"
                    type="search"
                    value={referenceSearch}
                    onChange={(e) => setReferenceSearch(e.target.value)}
                    placeholder="ex. 24, 24T, 24CE…"
                    className="w-full rounded-sm border border-gray-200 px-2 py-1.5 text-sm"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className="mt-2 text-sm text-foreground/80 underline hover:text-foreground"
                    onClick={() => setReferenceSearch("")}
                  >
                    Effacer le filtre
                  </button>
                </div>
              )}
            </div>
            {anyFilterActive && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="inline-flex items-center gap-1.5 rounded-sm border border-foreground/25 px-2.5 py-1 text-sm text-foreground/80 transition-colors hover:border-foreground/50 hover:text-foreground"
              >
                <RotateCcw className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Réinitialiser
              </button>
            )}
          </div>
        </motion.div>

        {/* Ordre catalogue : round-robin strict (lecture ligne par ligne). Sinon : colonnes équilibrées par hauteur cumulée (ratios). */}
        <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {galleryColumnBuckets.map((bucket, colIdx) => (
            <div key={colIdx} className="flex flex-col gap-4">
              <AnimatePresence>
                {bucket.map((painting) => (
                  <motion.div
                    key={painting._id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Card onClick={() => openLightbox(painting)} className="group relative overflow-hidden">
                      <div
                        className="relative w-full"
                        style={{ aspectRatio: `${painting.imageWidth} / ${painting.imageHeight}` }}
                      >
                        <Image
                          src={painting.imageUrl}
                          alt={painting.title}
                          fill
                          className="object-cover transition-transform duration-500 group-hover:scale-110"
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-300 flex items-center justify-center">
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-center text-white px-4">
                            {painting.reference && (
                              <p className="text-xs font-mono tracking-wide mb-1 opacity-90">{painting.reference}</p>
                            )}
                            <h3 className="font-serif text-xl font-semibold mb-1">{painting.title}</h3>
                            <p className="text-sm">{painting.year}</p>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ))}
        </div>

        {categoryFilteredPaintings.length === 0 && (
          <div className="text-center py-12 text-gray-medium">
            <p>Aucune œuvre ne correspond aux filtres sélectionnés.</p>
          </div>
        )}

        {categoryFilteredPaintings.length > 0 && galleryPaintings.length === 0 && referenceFilterActive && (
          <div className="text-center py-12 text-gray-medium">
            <p>Aucune œuvre ne correspond à ce filtre de référence.</p>
          </div>
        )}

        {galleryPaintings.length > 0 && !showFullGallery && (
          <div className="text-center mt-8">
            <p className="text-gray-medium text-sm mb-4">
              Une sélection de {initialSelection.length} œuvre{initialSelection.length > 1 ? "s" : ""}
            </p>
            {galleryPaintings.length > initialSelection.length && (
              <Button
                variant="outline"
                onClick={() => {
                  setShowFullGallery(true);
                  setDisplayCount(initialDisplayCount);
                }}
              >
                Voir toute la galerie
              </Button>
            )}
          </div>
        )}

        {galleryPaintings.length > 0 && showFullGallery && displayCount < galleryPaintings.length && (
          <div className="text-center mt-8">
            <Button
              variant="outline"
              onClick={() => setDisplayCount((d: number) => d + LOAD_MORE_STEP)}
            >
              Charger plus
            </Button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedPainting && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
              onClick={closeLightbox}
            >
              <motion.div
                ref={modalContentRef}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative max-w-6xl w-full h-[90vh] max-h-[90vh] overflow-y-auto md:overflow-hidden flex flex-col md:flex-row bg-white rounded-sm"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={closeLightbox}
                  className="absolute top-4 right-4 z-10 p-2 bg-white/90 hover:bg-white rounded-full transition-colors"
                  aria-label="Fermer"
                >
                  <X className="w-6 h-6" />
                </button>

                <div ref={gridRef} className="flex-1 min-h-0 flex flex-col md:flex-row">
                  <div ref={leftColRef} className="relative flex-shrink-0 w-full md:w-1/2 h-[50vh] md:h-full min-h-0 bg-gray-100">
                    <div className="relative w-full h-full min-h-0">
                        {!showInSitu && (
                          <>
                            <Image
                              src={selectedPainting.imageUrl}
                              alt={selectedPainting.title}
                              fill
                              className="object-cover object-center"
                              sizes="50vw"
                            />
                            <button
                              type="button"
                              onClick={() => setFullscreenMode("painting")}
                              className="absolute top-2 left-2 z-10 p-2 bg-transparent hover:bg-black/10 rounded-sm transition-colors text-white [&>svg]:drop-shadow-[0_0_1px_rgba(0,0,0,0.6)] [&>svg]:drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
                              aria-label="Plein écran"
                            >
                              <Maximize2 className="w-5 h-5" />
                            </button>
                          </>
                        )}
                        {showInSitu && selectedPainting.inSituImageUrls && selectedPainting.inSituImageUrls.length > 0 && (
                          <>
                            <Image
                              src={selectedPainting.inSituImageUrls[selectedInSituIndex]}
                              alt="Œuvre in situ"
                              fill
                              objectFit="cover"
                              sizes="50vw"
                            />
                            {selectedPainting.inSituImageUrls.length > 1 && (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedInSituIndex((i) =>
                                      i === 0 ? selectedPainting.inSituImageUrls!.length - 1 : i - 1
                                    );
                                  }}
                                  className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-2 bg-white/90 hover:bg-white rounded-full transition-colors text-foreground"
                                  aria-label="Image précédente"
                                >
                                  <ChevronLeft className="w-5 h-5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedInSituIndex((i) =>
                                      i === selectedPainting.inSituImageUrls!.length - 1 ? 0 : i + 1
                                    );
                                  }}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-2 bg-white/90 hover:bg-white rounded-full transition-colors text-foreground"
                                  aria-label="Image suivante"
                                >
                                  <ChevronRight className="w-5 h-5" />
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() => setFullscreenMode("inSitu")}
                              className="absolute top-2 left-2 z-10 p-2 bg-transparent hover:bg-black/10 rounded-sm transition-colors text-white [&>svg]:drop-shadow-[0_0_1px_rgba(0,0,0,0.6)] [&>svg]:drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
                              aria-label="Plein écran"
                            >
                              <Maximize2 className="w-5 h-5" />
                            </button>
                          </>
                        )}
                      </div>
                  </div>

                  <div ref={rightColRef} className="flex-1 min-h-0 overflow-y-auto p-8 md:p-12">
                    <h2 className="font-serif text-3xl md:text-4xl font-bold mb-2">
                      {selectedPainting.title}
                    </h2>
                    {selectedPainting.reference && (
                      <p className="text-sm font-mono text-gray-medium mb-1">{selectedPainting.reference}</p>
                    )}
                    <p className="text-gray-medium mb-6">{selectedPainting.year}</p>

                    {selectedPainting.description && (
                      <p className="text-foreground mb-6 leading-relaxed">
                        {selectedPainting.description}
                      </p>
                    )}

                    <div className="space-y-3 mb-6 text-sm">
                      {selectedPainting.series && (
                        <div className="flex justify-between">
                          <span className="text-gray-medium">Série:</span>
                          <span className="text-foreground font-medium">{selectedPainting.series.title}</span>
                        </div>
                      )}
                      {selectedPainting.technique && (
                        <div className="flex justify-between">
                          <span className="text-gray-medium">Technique:</span>
                          <span className="text-foreground font-medium">{selectedPainting.technique.title}</span>
                        </div>
                      )}
                      {selectedPainting.theme && (
                        <div className="flex justify-between">
                          <span className="text-gray-medium">Thème:</span>
                          <span className="text-foreground font-medium">{selectedPainting.theme.title}</span>
                        </div>
                      )}
                      {selectedPainting.dimensions && (
                        <div className="flex justify-between">
                          <span className="text-gray-medium">Dimensions:</span>
                          <span className="text-foreground font-medium">{selectedPainting.dimensions}</span>
                        </div>
                      )}
                      {selectedPainting.status && (
                        <div className="flex justify-between">
                          <span className="text-gray-medium">Statut:</span>
                          <span className="text-foreground font-medium">{selectedPainting.status.title}</span>
                        </div>
                      )}
                      {selectedPainting.price && (
                        <div className="flex justify-between">
                          <span className="text-gray-medium">Prix:</span>
                          <span className="text-foreground font-medium">
                            {selectedPainting.price.toLocaleString("fr-FR")} €
                          </span>
                        </div>
                      )}
                    </div>

                    {Array.isArray(selectedPainting.precisions) &&
                      selectedPainting.precisions.length > 0 && (
                        <div className="mt-6 pt-6 border-t border-gray-200">
                          <h3 className="font-serif text-xl font-semibold mb-4 text-foreground">
                            Précisions sur l'œuvre
                          </h3>
                          <PortableText content={selectedPainting.precisions} className="text-foreground" />
                        </div>
                      )}

                    <div className="flex flex-col sm:flex-row gap-4">
                      {selectedPainting.inSituImageUrls && selectedPainting.inSituImageUrls.length > 0 && (
                        <Button
                          variant="outline"
                          onClick={() => setShowInSitu(!showInSitu)}
                          className="flex items-center justify-center gap-2"
                        >
                          <Eye className="w-4 h-4" />
                          Voir in situ
                        </Button>
                      )}
                      <Button
                        variant="primary"
                        onClick={() => {
                          closeLightbox();
                          navigateToSection(navigate, "contact", {
                            replace: false,
                            behavior: "smooth",
                          });
                        }}
                      >
                        S'intéresser à cette œuvre
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>

            <AnimatePresence>
              {fullscreenMode && selectedPainting && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[60] bg-black/95 flex flex-col p-4 overflow-visible"
                  onClick={() => setFullscreenMode(null)}
                >
                  <button
                    type="button"
                    onClick={() => setFullscreenMode(null)}
                    className="absolute top-4 right-4 z-10 p-2 bg-white/90 hover:bg-white rounded-full transition-colors text-foreground"
                    aria-label="Fermer"
                  >
                    <X className="w-6 h-6" />
                  </button>
                  <div
                    ref={fullscreenContentRef}
                    className="relative flex-1 min-h-0 w-full flex items-center justify-center overflow-visible"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {fullscreenMode === "painting" && (
                      <div
                        className={`relative w-full h-full flex items-center justify-center select-none overflow-visible ${
                          fullscreenZoom > 1 ? (isPanning ? "cursor-grabbing" : "cursor-grab") : "cursor-default"
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (didPanThisGestureRef.current) return;
                          setFullscreenZoom((z) => {
                            if (z === 2) setFullscreenPan({ x: 0, y: 0 });
                            return z === 1 ? 2 : 1;
                          });
                        }}
                        onMouseDown={(e) => {
                          if (fullscreenZoom <= 1) return;
                          e.preventDefault();
                          didPanThisGestureRef.current = false;
                          panStartRef.current = { x: e.clientX, y: e.clientY };
                          setIsPanning(true);
                        }}
                        onMouseLeave={() => {
                          if (isPanning) setIsPanning(false);
                          panStartRef.current = null;
                        }}
                      >
                        <div
                          className="w-full h-full origin-center transition-transform duration-150"
                          style={{
                            transform: `translate(${fullscreenPan?.x ?? 0}px, ${fullscreenPan?.y ?? 0}px) scale(${fullscreenZoom})`,
                          }}
                        >
                          <div className="relative w-full h-full">
                            <Image
                              src={selectedPainting.imageUrl}
                              alt={selectedPainting.title}
                              fill
                              objectFit="contain"
                              className="pointer-events-none"
                              sizes="100vw"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                    {fullscreenMode === "inSitu" &&
                      selectedPainting.inSituImageUrls &&
                      selectedPainting.inSituImageUrls.length > 0 && (
                      <div ref={inSituContainerRef} className="absolute inset-0 flex items-center justify-center min-w-0 min-h-0">
                        <Image
                          src={selectedPainting.inSituImageUrls[selectedInSituIndex]}
                          alt="Œuvre in situ"
                          fill
                          objectFit="contain"
                          className="object-contain"
                          sizes="100vw"
                        />
                        {selectedPainting.inSituImageUrls.length > 1 && (
                          <>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedInSituIndex((i) =>
                                  i === 0 ? selectedPainting.inSituImageUrls!.length - 1 : i - 1
                                );
                              }}
                              className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-2 bg-white/90 hover:bg-white rounded-full transition-colors text-foreground"
                              aria-label="Image précédente"
                            >
                              <ChevronLeft className="w-8 h-8" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedInSituIndex((i) =>
                                  i === selectedPainting.inSituImageUrls!.length - 1 ? 0 : i + 1
                                );
                              }}
                              className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-2 bg-white/90 hover:bg-white rounded-full transition-colors text-foreground"
                              aria-label="Image suivante"
                            >
                              <ChevronRight className="w-8 h-8" />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </AnimatePresence>
    </section>
  );
}
