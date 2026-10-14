/**
 * Critères de tri communs, proposés dans le menu « Trier par » (⋯) des listes du Studio.
 * `dateField` : nom du champ date propre au type (date, dateStart, year, extractedAt…).
 */
export function standardOrderings(dateField?: string, dateLabel = "Date") {
  const list = [
    { title: "Titre (A → Z)", name: "titleAsc", by: [{ field: "title", direction: "asc" as const }] },
    { title: "Titre (Z → A)", name: "titleDesc", by: [{ field: "title", direction: "desc" as const }] },
    { title: "Dernière modification (récente)", name: "updatedDesc", by: [{ field: "_updatedAt", direction: "desc" as const }] },
    { title: "Dernière modification (ancienne)", name: "updatedAsc", by: [{ field: "_updatedAt", direction: "asc" as const }] },
    { title: "Création (récente)", name: "createdDesc", by: [{ field: "_createdAt", direction: "desc" as const }] },
    { title: "Création (ancienne)", name: "createdAsc", by: [{ field: "_createdAt", direction: "asc" as const }] },
  ];
  if (!dateField) return list;
  return [
    { title: `${dateLabel} (récente)`, name: "dateDesc", by: [{ field: dateField, direction: "desc" as const }] },
    { title: `${dateLabel} (ancienne)`, name: "dateAsc", by: [{ field: dateField, direction: "asc" as const }] },
    ...list,
  ];
}
