import type { SanityClient } from "@sanity/client";
import type {
  ListItemBuilder,
  StructureBuilder,
  StructureResolverContext,
} from "sanity/structure";
import {
  buildResourceDirectInCategoryFilter,
  buildResourceInCategoryIdSubtreeFilter,
  buildResourceInRootCategorySubtreeFilter,
  RESOURCE_CATEGORY_ROOTS_FILTER,
  RESOURCE_UNCATEGORIZED_FILTER,
} from "@/lib/sanity/categorySubtreeFilter";
import { RESOURCE_CATEGORIES } from "../constants/resourceCategories";
import {
  canonicalDocId,
  isEditorProfile,
  profileFromRootSlug,
  type EditorProfile,
} from "../lib/resourceEditorProfile";

type CategoryNode = {
  _id: string;
  title?: string;
  slug?: string;
  editorProfile?: string;
  order?: number;
};

const API = "v2024-01-01";

const RESOURCE_ORDERING = [
  { field: "order", direction: "asc" as const },
  { field: "date", direction: "desc" as const },
];

function publishedId(id: string): string {
  return canonicalDocId(id);
}

/** Évite les doublons draft + published (même _id canonique → même id de listItem). */
function dedupeCategories(nodes: CategoryNode[]): CategoryNode[] {
  const map = new Map<string, CategoryNode>();
  for (const node of nodes) {
    const key = publishedId(node._id);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, node);
      continue;
    }
    // Préférer le brouillon (modifs non publiées visibles dans le Studio)
    if (node._id.startsWith("drafts.") && !existing._id.startsWith("drafts.")) {
      map.set(key, node);
    }
  }
  return Array.from(map.values());
}

function resolveNodeProfile(node: CategoryNode): EditorProfile | undefined {
  if (isEditorProfile(node.editorProfile)) return node.editorProfile;
  return profileFromRootSlug(node.slug);
}

async function fetchChildCategories(
  client: SanityClient,
  parentId: string
): Promise<CategoryNode[]> {
  const pid = publishedId(parentId);
  const rows = await client.fetch<CategoryNode[]>(
    `*[
      _type == "resourceCategory"
      && (parent._ref == $pid || parent._ref == "drafts." + $pid || "drafts." + parent._ref == $pid)
    ] | order(order asc, title asc) {
      _id,
      title,
      "slug": slug.current,
      editorProfile,
      order
    }`,
    { pid }
  );
  return dedupeCategories(rows);
}

async function fetchRootCategories(
  client: SanityClient,
  section: "ecrits" | "enseignement"
): Promise<CategoryNode[]> {
  const rows = await client.fetch<CategoryNode[]>(
    `*[_type == "resourceCategory" && section == $section && !defined(parent)]
      | order(order asc, title asc) {
        _id,
        title,
        "slug": slug.current,
        editorProfile,
        order
      }`,
    { section }
  );
  return dedupeCategories(rows);
}

function resourceTemplateParams(categoryId: string, editorProfile: EditorProfile | undefined) {
  const id = publishedId(categoryId);
  const params: { categoryId: string; editorProfile?: string } = { categoryId: id };
  if (editorProfile) params.editorProfile = editorProfile;
  return params;
}

function resourceListForCategory(
  S: StructureBuilder,
  title: string,
  categoryId: string,
  editorProfile: EditorProfile | undefined,
  mode: "direct" | "subtree" | "rootSlug",
  rootSlug?: string
) {
  const id = publishedId(categoryId);
  const list = S.documentList()
    .title(title)
    .schemaType("resource")
    .apiVersion(API)
    .defaultOrdering(RESOURCE_ORDERING)
    .menuItems(S.orderingMenuItemsForType("resource"));

  if (mode === "direct") {
    return list
      .filter(buildResourceDirectInCategoryFilter())
      .params({ categoryId: id })
      .initialValueTemplates([
        S.initialValueTemplateItem("resource-in-category", resourceTemplateParams(id, editorProfile)),
      ]);
  }

  if (mode === "subtree") {
    return list
      .filter(buildResourceInCategoryIdSubtreeFilter())
      .params({ categoryId: id })
      .initialValueTemplates([
        S.initialValueTemplateItem("resource-in-category", resourceTemplateParams(id, editorProfile)),
      ]);
  }

  return list
    .filter(buildResourceInRootCategorySubtreeFilter())
    .params({ rootSlug: rootSlug ?? "" })
    .initialValueTemplates([
      S.initialValueTemplateItem("resource-in-category", resourceTemplateParams(id, editorProfile)),
    ]);
}

function buildArticleCategoryItem(
  S: StructureBuilder,
  context: StructureResolverContext,
  node: CategoryNode,
  inheritedProfile?: EditorProfile
): ListItemBuilder {
  const client = context.getClient({ apiVersion: "2024-01-01" });
  const id = publishedId(node._id);
  const title = node.title || "Sans titre";
  const profile = resolveNodeProfile(node) ?? inheritedProfile;

  return S.listItem()
    .id(`articles-cat-${id}`)
    .title(title)
    .schemaType("resource")
    .child(async () => {
      const children = await fetchChildCategories(client, id);

      if (children.length === 0) {
        return resourceListForCategory(S, title, id, profile, "direct");
      }

      return S.list()
        .title(title)
        .items([
          ...children.map((child) =>
            buildArticleCategoryItem(S, context, child, profile)
          ),
          S.divider(),
          S.listItem()
            .title("Articles de ce niveau")
            .schemaType("resource")
            .child(resourceListForCategory(S, "Articles de ce niveau", id, profile, "direct")),
          S.listItem()
            .title("Tous les articles (branche)")
            .schemaType("resource")
            .child(
              resourceListForCategory(S, "Tous les articles (branche)", id, profile, "subtree")
            ),
        ]);
    });
}

function buildManageCategoryItem(
  S: StructureBuilder,
  context: StructureResolverContext,
  node: CategoryNode,
  section: "ecrits" | "enseignement",
  inheritedProfile?: EditorProfile
): ListItemBuilder {
  const client = context.getClient({ apiVersion: "2024-01-01" });
  const id = publishedId(node._id);
  const title = node.title || "Sans titre";
  const profile = resolveNodeProfile(node) ?? inheritedProfile;

  return S.listItem()
    .id(`manage-cat-${id}`)
    .title(title)
    .schemaType("resourceCategory")
    .child(async () => {
      const children = await fetchChildCategories(client, id);

      return S.list()
        .title(title)
        .items([
          S.listItem()
            .title("Éditer cette catégorie")
            .child(S.document().documentId(id).schemaType("resourceCategory")),
          S.divider(),
          ...children.map((child) =>
            buildManageCategoryItem(S, context, child, section, profile)
          ),
          S.listItem()
            .title("Sous-catégories")
            .schemaType("resourceCategory")
            .child(
              S.documentList()
                .title("Sous-catégories")
                .schemaType("resourceCategory")
                .apiVersion(API)
                .filter(
                  `_type == "resourceCategory" && (parent._ref == $parentId || parent._ref == "drafts." + $parentId || "drafts." + parent._ref == $parentId)`
                )
                .params({ parentId: id })
                .defaultOrdering([
                  { field: "order", direction: "asc" },
                  { field: "title", direction: "asc" },
                ])
                .initialValueTemplates([
                  S.initialValueTemplateItem("resourceCategory-child", {
                    parentId: id,
                    section,
                    ...(profile ? { editorProfile: profile } : {}),
                  }),
                ])
            ),
        ]);
    });
}

function buildCategoriesTree(
  S: StructureBuilder,
  context: StructureResolverContext,
  section: "ecrits" | "enseignement",
  title: string
): ListItemBuilder {
  const client = context.getClient({ apiVersion: "2024-01-01" });

  return S.listItem()
    .title(title)
    .child(async () => {
      const roots = await fetchRootCategories(client, section);
      return S.list()
        .title(title)
        .items([
          ...roots.map((root) => buildManageCategoryItem(S, context, root, section)),
          S.divider(),
          S.listItem()
            .title("Nouvelle catégorie racine")
            .schemaType("resourceCategory")
            .child(
              S.documentList()
                .title("Catégories racines")
                .schemaType("resourceCategory")
                .apiVersion(API)
                .filter(RESOURCE_CATEGORY_ROOTS_FILTER)
                .params({ section })
                .defaultOrdering([
                  { field: "order", direction: "asc" },
                  { field: "title", direction: "asc" },
                ])
                .initialValueTemplates([
                  S.initialValueTemplateItem("resourceCategory-root", { section }),
                ])
            ),
        ]);
    });
}

function buildSectionGroup(
  S: StructureBuilder,
  context: StructureResolverContext,
  section: "ecrits" | "enseignement",
  title: string
): ListItemBuilder {
  const client = context.getClient({ apiVersion: "2024-01-01" });
  const hardcodedRoots = RESOURCE_CATEGORIES.filter((c) => c.section === section);

  return S.listItem()
    .title(title)
    .child(async () => {
      const roots = await fetchRootCategories(client, section);

      const articleItems =
        roots.length > 0
          ? roots.map((root) => buildArticleCategoryItem(S, context, root))
          : hardcodedRoots.map((c) =>
              S.listItem()
                .title(c.label)
                .schemaType("resource")
                .child(
                  S.documentList()
                    .title(c.label)
                    .schemaType("resource")
                    .apiVersion(API)
                    .filter(buildResourceInRootCategorySubtreeFilter())
                    .params({ rootSlug: c.value })
                    .defaultOrdering(RESOURCE_ORDERING)
                    .menuItems(S.orderingMenuItemsForType("resource"))
                )
            );

      return S.list()
        .title(title)
        .items([
          ...articleItems,
          S.listItem()
            .title("Sans catégorie")
            .schemaType("resource")
            .child(
              S.documentList()
                .title("Sans catégorie")
                .schemaType("resource")
                .apiVersion(API)
                .filter(RESOURCE_UNCATEGORIZED_FILTER)
                .defaultOrdering([{ field: "date", direction: "desc" }])
                .menuItems(S.orderingMenuItemsForType("resource"))
            ),
          S.divider(),
          buildCategoriesTree(S, context, section, "Catégories"),
        ]);
    });
}

export function buildDeskStructure(S: StructureBuilder, context: StructureResolverContext) {
  return S.list()
    .title("Contenu")
    .items([
      S.documentTypeListItem("siteSettings").title("Paramètres du site"),
      S.documentTypeListItem("biography").title("Biographie"),
      S.documentTypeListItem("painting").title("Tableau"),
      S.documentTypeListItem("exhibition").title("Exposition"),
      S.documentTypeListItem("film").title("Films"),
      S.listItem()
        .title("Presse")
        .child(
          S.list()
            .title("Presse")
            .items([
              S.documentTypeListItem("pressArticle").title("Article de presse"),
              S.documentTypeListItem("pressQuote").title("Citation presse"),
            ])
        ),
      S.documentTypeListItem("performance").title("Performances"),
      buildSectionGroup(S, context, "ecrits", "Critiques"),
      buildSectionGroup(S, context, "enseignement", "Enseignement"),
      S.documentTypeListItem("advice").title("Journal"),
      S.documentTypeListItem("contenuAClasser").title("À classer"),
      S.listItem()
        .id("brouillons")
        .title("Brouillons et modifications non publiées")
        .child(
          S.documentList()
            .title("Brouillons et modifications non publiées")
            .apiVersion(API)
            .filter(
              `_id in path("drafts.**") && _type in ["resource","exhibition","pressArticle","advice","biography","film","performance"]`
            )
            .defaultOrdering([{ field: "_updatedAt", direction: "desc" }])
        ),
      S.documentTypeListItem("series").title("Série (tableau)"),
      S.documentTypeListItem("technique").title("Technique (tableau)"),
      S.documentTypeListItem("theme").title("Thème (tableau)"),
      S.documentTypeListItem("paintingStatus").title("Statut (tableau)"),
    ]);
}
