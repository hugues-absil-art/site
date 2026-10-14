import { LaunchIcon } from "@sanity/icons";
import { useClient } from "sanity";
import {
  isPreviewableType,
  resolvePreviewHref,
  sitePath,
} from "../presentation/previewPaths";

/** Types sans page propre : on renvoie vers leur section de la page d'accueil. */
const HOME_SECTION: Record<string, string> = {
  performance: "performances",
  film: "films",
  painting: "gallery",
};

/**
 * Action « Voir la page » : ouvre la page publique du site dans un nouvel onglet.
 * (Contrairement à « Prévisualiser », reste hors du Studio ; ne montre que la version publiée.)
 */
export function ViewLiveAction(props: {
  id: string;
  type: string;
  draft: unknown;
  published: unknown;
  onComplete?: () => void;
}) {
  const { type, draft, published, onComplete } = props;
  const client = useClient({ apiVersion: "2024-01-01" });

  const homeSection = HOME_SECTION[type];
  if (!isPreviewableType(type) && !homeSection) return null;

  const doc = (published ?? draft) as Record<string, unknown> | null;
  const isPublished = Boolean(published);

  return {
    label: "Voir la page",
    icon: LaunchIcon,
    disabled: !isPublished,
    title: isPublished
      ? "Ouvre la page publique du site dans un nouvel onglet."
      : "Cette fiche n'est pas encore publiée : elle n'a pas de page publique.",
    onHandle: async () => {
      const href = homeSection
        ? sitePath(`/#${homeSection}`)
        : await resolvePreviewHref(type, doc, client);
      if (href) {
        window.open(`${window.location.origin}${href}`, "_blank", "noopener");
      }
      onComplete?.();
    },
  };
}
