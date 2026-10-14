import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Calendar, Search, ChevronDown, ChevronUp, BookOpen, ArrowRight } from "lucide-react";
import Image from "@/components/ui/Image";
import { getResourcesByCategory, getResourceCategories } from "@/lib/sanity/data";
import type { Resource, ResourceCategory } from "@/lib/sanity/data";
import {
  buildCategorySubtrees,
  categoryTocNodeVisible,
  countResourcesInSubtree,
  resourcesDirectlyInCategory,
  type CategoryTreeNode,
} from "@/lib/sanity/resourceCategoryTree";
import { formatResourceDate, formatResourceDateRange } from "@/lib/utils";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import ExpandableText from "@/components/ui/ExpandableText";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { RESOURCE_CATEGORY_INFO } from "@/sanity/constants/resourceCategories";
import { sectionBackLabel, sectionHomePath, sectionUrlPrefix } from "@/lib/resourceSection";
import { useSeo } from "@/lib/seo";

type CategoryInfo = { title: string; description: string; section: "ecrits" | "enseignement" };
const categoryLabelsDefault: Record<string, CategoryInfo> =
  RESOURCE_CATEGORY_INFO as Record<string, CategoryInfo>;

const RESOURCE_STATUS_LABELS: Record<string, string> = {
  current: "En cours",
  upcoming: "À venir",
  past: "Archives",
};

const SEARCH_PLACEHOLDERS: Record<string, string> = {
  "critiques-litteraires": "Rechercher un livre ou un auteur…",
  "oeil-expo": "Rechercher une exposition ou un artiste…",
};
const DEFAULT_SEARCH_PLACEHOLDER = "Rechercher…";

/** Catégories statiques qui peuvent avoir un sommaire de chapitres (et des sous-catégories Sanity). */
const CATEGORIES_WITH_TOC = ["histoire-art", "technique-picturale"] as const;

const INITIAL_DISPLAY_DESKTOP = 12;
const INITIAL_DISPLAY_MOBILE = 6;
const LOAD_MORE_STEP = 12;

const LATEST_ARTICLES_MOBILE = 3;
const LATEST_ARTICLES_TABLET = 4;
const LATEST_ARTICLES_DESKTOP = 6;

/** Articles les plus récents (date desc, sans date en fin, tri secondaire par titre). */
function getLatestResources(resources: Resource[], limit: number): Resource[] {
  return [...resources]
    .sort((a, b) => {
      const dateA = a.date ?? "";
      const dateB = b.date ?? "";
      if (dateA !== dateB) {
        if (!dateA) return 1;
        if (!dateB) return -1;
        return dateB.localeCompare(dateA);
      }
      return (a.title ?? "").localeCompare(b.title ?? "", "fr");
    })
    .slice(0, limit);
}

/** Catégories avec split courant/passé (comme les expos perso). */
const DATED_ARCHIVE_CATEGORIES = new Set(["oeil-expo", "atelier-stages"]);

function usesDatedArchiveSplit(category: string | undefined): boolean {
  return !!category && DATED_ARCHIVE_CATEGORIES.has(category);
}

/** Tri du plus récent au plus ancien (dateEnd puis date), comme les exhibitions. */
function sortByResourceDateDesc(resources: Resource[]): Resource[] {
  return [...resources].sort((a, b) => {
    const dateA = a.dateEnd ?? a.date ?? "";
    const dateB = b.dateEnd ?? b.date ?? "";
    if (dateA !== dateB) {
      if (!dateA) return 1;
      if (!dateB) return -1;
      return dateB.localeCompare(dateA);
    }
    return (a.title ?? "").localeCompare(b.title ?? "", "fr");
  });
}


function CategoryTocBranch({
  node,
  filteredResources,
  expandedSubTocSlugs,
  setExpandedSubTocSlugs,
  sectionPrefix,
  slugsWithToc,
  depth,
}: {
  node: CategoryTreeNode;
  filteredResources: Resource[];
  expandedSubTocSlugs: Record<string, boolean>;
  setExpandedSubTocSlugs: Dispatch<SetStateAction<Record<string, boolean>>>;
  sectionPrefix: string;
  slugsWithToc: Set<string>;
  depth: number;
}) {
  const nodeHasToc = slugsWithToc.has(node.slug) || node.showTableOfContents === true;
  const directRes = resourcesDirectlyInCategory(filteredResources, node.slug);
  const hasKids = node.children.length > 0;
  const isOpen = expandedSubTocSlugs[node.slug] === true;
  const subtreeCount = countResourcesInSubtree(filteredResources, node.slug);

  if (!hasKids && directRes.length === 0) return null;

  const badge =
    nodeHasToc && directRes.length > 0
      ? `${directRes.length} chapitre${directRes.length > 1 ? "s" : ""}`
      : hasKids
        ? `${node.children.length} sous-partie${node.children.length > 1 ? "s" : ""}`
        : subtreeCount > 0
          ? `${subtreeCount} ressource${subtreeCount > 1 ? "s" : ""}`
          : "";

  return (
    <nav
      aria-label={`Sommaire ${node.title}`}
      className={`group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md ${
        depth > 0 ? "ml-2 sm:ml-4 pl-4 border-l-2 border-gray-100" : ""
      }`}
    >
      <div className="absolute top-0 left-0 w-1 h-full bg-gray-900 opacity-80 rounded-l" aria-hidden />
      <div className="pl-5">
        <button
          type="button"
          onClick={() =>
            setExpandedSubTocSlugs((prev) => ({
              ...prev,
              [node.slug]: !prev[node.slug],
            }))
          }
          aria-expanded={isOpen}
          className="flex w-full items-center gap-3 text-left cursor-pointer rounded-lg -m-2 p-2 hover:bg-gray-50/80 transition-colors mb-0"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600 group-hover:bg-gray-900 group-hover:text-white transition-colors">
            <BookOpen className="w-5 h-5" />
          </span>
          <h2 className="font-serif text-xl font-semibold text-foreground flex-1 min-w-0">
            {node.title}
          </h2>
          {badge ? (
            <span className="text-sm text-gray-500 tabular-nums shrink-0 mr-1">{badge}</span>
          ) : null}
          {isOpen ? (
            <ChevronUp className="w-6 h-6 shrink-0 text-gray-500" aria-hidden />
          ) : (
            <ChevronDown className="w-6 h-6 shrink-0 text-gray-500" aria-hidden />
          )}
        </button>
        {isOpen && (
          <div className="mt-4 space-y-4 pt-4 border-t border-gray-100">
            {node.children.map((ch) => (
              <CategoryTocBranch
                key={ch._id}
                node={ch}
                filteredResources={filteredResources}
                expandedSubTocSlugs={expandedSubTocSlugs}
                setExpandedSubTocSlugs={setExpandedSubTocSlugs}
                sectionPrefix={sectionPrefix}
                slugsWithToc={slugsWithToc}
                depth={depth + 1}
              />
            ))}
            {directRes.length > 0 ? (
              <ol className="list-none pl-0 space-y-2">
                {directRes
                  .slice()
                  .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
                  .map((resource, index) => {
                    const chapterNum = index + 1;
                    const leaf = resource.categoryRef?.slug ?? node.slug;
                    return (
                      <li key={resource._id}>
                        <Link
                          to={`/${sectionPrefix}/${leaf}/${resource.slug}`}
                          className="flex items-center gap-2 text-foreground hover:text-gray-600 focus:outline-none focus:underline rounded py-1.5 -mx-2 px-2 transition-colors"
                        >
                          <span className="text-sm font-medium text-gray-400 tabular-nums w-6">
                            {chapterNum}.
                          </span>
                          <span className="flex-1">{resource.title}</span>
                          <ArrowRight className="w-4 h-4 opacity-0 -translate-x-1 group-hover:opacity-50 transition-all" />
                        </Link>
                      </li>
                    );
                  })}
              </ol>
            ) : null}
          </div>
        )}
      </div>
    </nav>
  );
}

function ResourceCard({
  resource,
  sectionPrefix,
  pageCategory,
}: {
  resource: Resource;
  sectionPrefix: string;
  /** Slug de la page liste courante (ex. oeil-expo pour le style archives). */
  pageCategory: string;
}) {
  const urlCategory = resource.categoryRef?.slug ?? pageCategory;
  const dateRangeLabel = formatResourceDateRange(resource.date, resource.dateEnd);
  const workshopDateLabel = formatResourceDate(resource.workshopDate);
  const workshopParts = [workshopDateLabel, resource.workshopDuration, resource.workshopLocation].filter(
    (x): x is string => x != null && x !== ""
  );
  return (
    <Link to={`/${sectionPrefix}/${urlCategory}/${resource.slug}`}>
      <Card className="group relative overflow-hidden h-full flex flex-col hover:shadow-lg transition-all duration-300 border border-gray-100">
        {/* Accent visuel gauche (remplace ou complète l’image) */}
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gray-200 group-hover:bg-gray-900 transition-colors z-[1]" aria-hidden />
        {resource.imageUrl ? (
          <div className="relative aspect-video flex-shrink-0">
            <Image
              src={resource.imageUrl}
              alt={resource.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          </div>
        ) : null}
        <div className="p-5 flex-1 flex flex-col min-h-0">
          <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500 mb-3">
            {dateRangeLabel != null && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {dateRangeLabel}
              </span>
            )}
            {usesDatedArchiveSplit(pageCategory) && resource.status && (
              <span className="px-2.5 py-1 font-medium bg-gray-100 text-foreground rounded-full text-xs">
                {RESOURCE_STATUS_LABELS[resource.status] || resource.status}
              </span>
            )}
          </div>
          <h3 className="font-serif text-lg font-semibold mb-3 leading-snug group-hover:text-gray-700 transition-colors line-clamp-2">
            {resource.title}
          </h3>
          <div className="mb-4 flex-1 min-h-0 text-sm text-gray-600 leading-relaxed">
            <ExpandableText
              text={resource.excerpt ?? ""}
              maxLength={150}
            />
          </div>
          {resource.workshopDate && (
            <div className="mt-4 pt-4 border-t border-gray-100 p-3 bg-gray-50/80 rounded-lg text-sm">
              <p className="font-semibold text-foreground mb-1">Stage/Atelier</p>
              {workshopParts.length > 0 && (
                <p className="text-gray-600 text-xs">{workshopParts.join(" • ")}</p>
              )}
              {resource.workshopPrice != null && (
                <p className="text-foreground font-medium mt-1">
                  {resource.workshopPrice} €
                </p>
              )}
            </div>
          )}
        </div>
      </Card>
    </Link>
  );
}

export default function ResourceCategoryPage() {
  const { category } = useParams<{ category: string }>();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const initialDisplay = isMobile ? INITIAL_DISPLAY_MOBILE : INITIAL_DISPLAY_DESKTOP;
  const latestArticlesCount = isMobile
    ? LATEST_ARTICLES_MOBILE
    : isDesktop
      ? LATEST_ARTICLES_DESKTOP
      : LATEST_ARTICLES_TABLET;
  const [categoryLabels, setCategoryLabels] = useState<Record<string, CategoryInfo>>(categoryLabelsDefault);
  const [slugsWithToc, setSlugsWithToc] = useState<Set<string>>(new Set(CATEGORIES_WITH_TOC));
  const [allResourceCategories, setAllResourceCategories] = useState<ResourceCategory[]>([]);
  const [sanityCategoriesFetched, setSanityCategoriesFetched] = useState(false);
  const [resources, setResources] = useState<Awaited<ReturnType<typeof getResourcesByCategory>>>([]);
  const [loading, setLoading] = useState(true);
  const [displayCount, setDisplayCount] = useState(initialDisplay);
  const [displayCountCurrent, setDisplayCountCurrent] = useState(initialDisplay);
  const [displayCountPast, setDisplayCountPast] = useState(initialDisplay);
  const [isArchivesOpen, setIsArchivesOpen] = useState(false);
  /** Sous-catégories (TOC) : repliées par défaut pour limiter le défilement. */
  const [expandedSubTocSlugs, setExpandedSubTocSlugs] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    getResourceCategories()
      .then((list) => {
        setAllResourceCategories(list);
        const fromSanity: Record<string, CategoryInfo> = {};
        const withToc = new Set<string>(CATEGORIES_WITH_TOC);
        for (const c of list) {
          fromSanity[c.slug] = {
            title: c.title,
            description: c.description ?? "",
            section: c.section,
          };
          if (c.showTableOfContents) withToc.add(c.slug);
        }
        if (Object.keys(fromSanity).length > 0) {
          setCategoryLabels((prev) => ({ ...prev, ...fromSanity }));
        }
        setSlugsWithToc(withToc);
      })
      .finally(() => setSanityCategoriesFetched(true));
  }, []);

  useEffect(() => {
    if (!category) {
      setLoading(false);
      return;
    }
    setDisplayCount(initialDisplay);
    setDisplayCountCurrent(initialDisplay);
    setDisplayCountPast(initialDisplay);
    setIsArchivesOpen(false);
    setExpandedSubTocSlugs({});
    getResourcesByCategory(category).then((res) => {
      setResources(res);
    })
      .finally(() => setLoading(false));
  }, [category, initialDisplay]);

  useEffect(() => {
    if (isMobile) {
      setDisplayCount((c) => Math.min(c, INITIAL_DISPLAY_MOBILE));
      setDisplayCountCurrent((c) => Math.min(c, INITIAL_DISPLAY_MOBILE));
      setDisplayCountPast((c) => Math.min(c, INITIAL_DISPLAY_MOBILE));
    }
  }, [isMobile]);

  useEffect(() => {
    setDisplayCount(initialDisplay);
  }, [searchQuery, initialDisplay]);

  const filteredResources = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return resources;
    return resources.filter((r) => {
      if (r.title?.toLowerCase().includes(query)) return true;
      if (r.excerpt?.toLowerCase().includes(query)) return true;
      if (r.tags?.some((tag) => tag?.toLowerCase().includes(query))) return true;
      return false;
    });
  }, [resources, searchQuery]);

  const subCategoryTree = useMemo(
    () => (category ? buildCategorySubtrees(allResourceCategories, category) : []),
    [allResourceCategories, category]
  );

  /** Ressources dont la catégorie est exactement la catégorie de la page (chapitres directs, sans sous-catégorie) */
  const directResources = useMemo(
    () => (category ? filteredResources.filter((r) => r.categoryRef?.slug === category) : []),
    [category, filteredResources]
  );

  const showDatedArchiveSplit = usesDatedArchiveSplit(category);
  const currentAndUpcoming = useMemo(
    () =>
      showDatedArchiveSplit
        ? sortByResourceDateDesc(
            filteredResources.filter((r) => r.status === "current" || r.status === "upcoming")
          )
        : [],
    [showDatedArchiveSplit, filteredResources]
  );
  const pastResources = useMemo(
    () =>
      showDatedArchiveSplit
        ? sortByResourceDateDesc(filteredResources.filter((r) => r.status === "past"))
        : [],
    [showDatedArchiveSplit, filteredResources]
  );

  useEffect(() => {
    if (
      showDatedArchiveSplit &&
      searchQuery.trim() !== "" &&
      currentAndUpcoming.length === 0 &&
      pastResources.length > 0
    ) {
      setIsArchivesOpen(true);
    }
  }, [showDatedArchiveSplit, searchQuery, currentAndUpcoming.length, pastResources.length]);

  if (!category) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-20">
        <div className="text-center">
          <h1 className="font-serif text-4xl font-bold mb-4">Catégorie non trouvée</h1>
          <Link to="/">
            <Button variant="primary">Retour à l'accueil</Button>
          </Link>
        </div>
      </div>
    );
  }

  const categoryInDefaults = category in categoryLabelsDefault;
  if (!sanityCategoriesFetched && !categoryInDefaults) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-20">
        <p className="text-gray-medium">Chargement...</p>
      </div>
    );
  }

  const seoInfo = category ? categoryLabels[category] : undefined;
  useSeo({
    enabled: !!seoInfo,
    title: seoInfo?.title ?? "",
    description: seoInfo?.description || undefined,
    path: `/${sectionUrlPrefix(seoInfo?.section)}/${category ?? ""}`,
  });

  if (!categoryLabels[category]) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-20">
        <div className="text-center">
          <h1 className="font-serif text-4xl font-bold mb-4">Catégorie non trouvée</h1>
          <p className="text-gray-medium text-sm mb-6 max-w-md mx-auto">
            Slug inconnu ou catégorie non publiée dans le studio. Vérifiez le parent et la section.
          </p>
          <Link to="/">
            <Button variant="primary">Retour à l'accueil</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-20">
        <p className="text-gray-medium">Chargement...</p>
      </div>
    );
  }

  const categoryInfo = categoryLabels[category];
  const sectionAnchor = sectionHomePath(categoryInfo.section);
  const sectionLabel = sectionBackLabel(categoryInfo.section);
  const sectionPrefix = sectionUrlPrefix(categoryInfo.section);

  const displayedResources = filteredResources.slice(0, displayCount);
  const hasMore = displayCount < filteredResources.length;
  const displayedCurrent = currentAndUpcoming.slice(0, displayCountCurrent);
  const displayedPast = pastResources.slice(0, displayCountPast);
  const hasMoreCurrent = displayCountCurrent < currentAndUpcoming.length;
  const hasMorePast = displayCountPast < pastResources.length;
  const searchPlaceholder = category ? (SEARCH_PLACEHOLDERS[category] ?? DEFAULT_SEARCH_PLACEHOLDER) : DEFAULT_SEARCH_PLACEHOLDER;
  const showTocLayout = slugsWithToc.has(category) && categoryInfo.section === "enseignement";
  const useLatestArticlesSection = showTocLayout && searchQuery.trim() === "";
  const latestResources = useLatestArticlesSection
    ? getLatestResources(filteredResources, latestArticlesCount)
    : [];

  return (
    <div className="pt-20 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="container mx-auto max-w-6xl">
        <Link to={sectionAnchor}>
          <Button variant="ghost" className="mb-8 flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            {sectionLabel}
          </Button>
        </Link>

        <div className="mb-8 text-center">
          <h1 className="font-serif text-4xl sm:text-5xl font-bold mb-4">
            {categoryInfo.title}
          </h1>
          <p className="text-gray-medium max-w-2xl mx-auto">{categoryInfo.description}</p>
        </div>

        {/* Champ de recherche toujours visible au scroll (sticky au-dessus des cartes) */}
        {resources.length > 0 && (
          <div className="sticky top-20 z-10 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-4 bg-white/95 backdrop-blur-sm border-b border-gray-100 mb-8">
            <div className="container mx-auto max-w-6xl">
              <label htmlFor="resource-search" className="sr-only">
                Recherche
              </label>
              <div className="relative max-w-xl mx-auto">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" aria-hidden />
                <input
                  id="resource-search"
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-lg bg-white text-foreground placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent shadow-sm"
                  aria-label="Recherche"
                />
              </div>
            </div>
          </div>
        )}

        {resources.length > 0 &&
          slugsWithToc.has(category) &&
          filteredResources.length > 0 &&
          (subCategoryTree.some((n) => categoryTocNodeVisible(n, filteredResources)) ||
            directResources.length > 0) && (
            <div className="mb-10 space-y-6">
              {subCategoryTree.map((node) =>
                categoryTocNodeVisible(node, filteredResources) ? (
                  <CategoryTocBranch
                    key={node._id}
                    node={node}
                    filteredResources={filteredResources}
                    expandedSubTocSlugs={expandedSubTocSlugs}
                    setExpandedSubTocSlugs={setExpandedSubTocSlugs}
                    sectionPrefix={sectionPrefix}
                    slugsWithToc={slugsWithToc}
                    depth={0}
                  />
                ) : null
              )}
              {directResources.length > 0 && (
                <nav
                  aria-label="Sommaire"
                  className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="absolute top-0 left-0 w-1 h-full bg-gray-900 opacity-80 rounded-l" aria-hidden />
                  <div className="pl-5">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-600 group-hover:bg-gray-900 group-hover:text-white transition-colors">
                        <BookOpen className="w-5 h-5" />
                      </span>
                      <h2 className="font-serif text-xl font-semibold text-foreground">Sommaire</h2>
                    </div>
                    <ol className="list-none pl-0 space-y-2">
                      {directResources
                        .slice()
                        .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
                        .map((resource, index) => {
                          const chapterNum = index + 1;
                          const leaf = resource.categoryRef?.slug ?? category;
                          return (
                            <li key={resource._id}>
                              <Link
                                to={`/${sectionPrefix}/${leaf}/${resource.slug}`}
                                className="flex items-center gap-2 text-foreground hover:text-gray-600 focus:outline-none focus:underline rounded py-1.5 -mx-2 px-2 transition-colors"
                              >
                                <span className="text-sm font-medium text-gray-400 tabular-nums w-6">{chapterNum}.</span>
                                <span className="flex-1">{resource.title}</span>
                                <ArrowRight className="w-4 h-4 opacity-0 -translate-x-1 group-hover:opacity-50 transition-all" />
                              </Link>
                            </li>
                          );
                        })}
                    </ol>
                  </div>
                </nav>
              )}
            </div>
          )}

        {resources.length > 0 ? (
          <>
          {filteredResources.length === 0 ? (
            <div className="text-center py-12 text-gray-medium">
              <p>Aucun résultat pour « {searchQuery.trim()} ».</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setSearchQuery("")}
              >
                Effacer la recherche
              </Button>
            </div>
          ) : showDatedArchiveSplit ? (
            <>
              {currentAndUpcoming.length > 0 && (
                <div className="mb-16">
                  <h3 className="font-serif text-2xl font-semibold mb-8">En cours / À venir</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {displayedCurrent.map((resource) => (
                      <ResourceCard
                        key={resource._id}
                        resource={resource}
                        sectionPrefix={sectionPrefix}
                        pageCategory={category}
                      />
                    ))}
                  </div>
                  {hasMoreCurrent && (
                    <div className="text-center mt-8">
                      <Button
                        variant="outline"
                        onClick={() => setDisplayCountCurrent((d) => d + LOAD_MORE_STEP)}
                      >
                        Charger plus
                      </Button>
                    </div>
                  )}
                </div>
              )}
              {pastResources.length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setIsArchivesOpen((open) => !open)}
                    className="flex items-center justify-between w-full font-serif text-2xl font-semibold mb-8 cursor-pointer text-left hover:opacity-80 transition-opacity"
                  >
                    <span>{category === "atelier-stages" ? "Stages passés" : "Expositions passées"} ({pastResources.length})</span>
                    {isArchivesOpen ? (
                      <ChevronUp className="w-6 h-6 shrink-0" />
                    ) : (
                      <ChevronDown className="w-6 h-6 shrink-0" />
                    )}
                  </button>
                  {isArchivesOpen && (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {displayedPast.map((resource) => (
                          <ResourceCard
                            key={resource._id}
                            resource={resource}
                            sectionPrefix={sectionPrefix}
                            pageCategory={category}
                          />
                        ))}
                      </div>
                      {hasMorePast && (
                        <div className="text-center mt-8">
                          <Button
                            variant="outline"
                            onClick={() => setDisplayCountPast((d) => d + LOAD_MORE_STEP)}
                          >
                            Charger plus
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          ) : useLatestArticlesSection ? (
            <>
              {latestResources.length > 0 && (
                <div>
                  <h2 className="font-serif text-2xl font-semibold mb-8">Derniers articles</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {latestResources.map((resource) => (
                      <ResourceCard
                        key={resource._id}
                        resource={resource}
                        sectionPrefix={sectionPrefix}
                        pageCategory={category}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {displayedResources.map((resource) => (
                  <ResourceCard
                    key={resource._id}
                    resource={resource}
                    sectionPrefix={sectionPrefix}
                    pageCategory={category}
                  />
                ))}
              </div>
              {hasMore && (
                <div className="text-center mt-8">
                  <Button
                    variant="outline"
                    onClick={() => setDisplayCount((d) => d + LOAD_MORE_STEP)}
                  >
                    Charger plus
                  </Button>
                </div>
              )}
            </>
          )}
          </>
        ) : (
          <div className="text-center py-12 text-gray-medium">
            <p>Aucune ressource disponible dans cette catégorie pour le moment.</p>
          </div>
        )}
      </div>
    </div>
  );
}
