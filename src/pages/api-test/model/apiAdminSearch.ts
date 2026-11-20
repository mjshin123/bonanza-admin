export type AdminSection =
  | "achievements"
  | "awards"
  | "dashboard"
  | "institutions"
  | "history"
  | "privacy-policies"
  | "posts"

export type ApiAdminSearch = {
  section?: AdminSection;
  openId?: string;
  openCategory?: string;
  tab?: string;
};

const SECTIONS = new Set<AdminSection>([
  "achievements",
  "awards",
  "dashboard",
  "institutions",
  "history",
  "privacy-policies",
  "posts",
]);

export function validateApiAdminSearch(
  search: Record<string, unknown>,
): ApiAdminSearch {
  const section = typeof search.section === "string" ? search.section : "";
  const openId = typeof search.openId === "string" ? search.openId.trim() : "";
  const openCategory =
    typeof search.openCategory === "string" ? search.openCategory.trim() : "";
  const tab = typeof search.tab === "string" ? search.tab.trim() : "";
  return {
    section: SECTIONS.has(section as AdminSection)
      ? (section as AdminSection)
      : undefined,
    openId: openId || undefined,
    openCategory: openCategory || undefined,
    tab: tab || undefined,
  };
}
