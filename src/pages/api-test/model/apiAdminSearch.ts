export type AdminSection =
  | "dashboard"
  | "institutions"
  | "galleries"
  | "history"
  | "posts"
  | "resources"
  | "seminars";

export type ApiAdminSearch = {
  section?: AdminSection;
  openId?: string;
  openCategory?: string;
};

const SECTIONS = new Set<AdminSection>([
  "dashboard",
  "institutions",
  "galleries",
  "history",
  "posts",
  "resources",
  "seminars",
]);

export function validateApiAdminSearch(
  search: Record<string, unknown>,
): ApiAdminSearch {
  const section = typeof search.section === "string" ? search.section : "";
  const openId = typeof search.openId === "string" ? search.openId.trim() : "";
  const openCategory =
    typeof search.openCategory === "string" ? search.openCategory.trim() : "";
  return {
    section: SECTIONS.has(section as AdminSection)
      ? (section as AdminSection)
      : undefined,
    openId: openId || undefined,
    openCategory: openCategory || undefined,
  };
}
