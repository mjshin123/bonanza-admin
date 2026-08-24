export type AdminSection = "institutions" | "posts" | "resources" | "seminars";

export type ApiAdminSearch = { section?: AdminSection };

const SECTIONS = new Set<AdminSection>([
  "institutions",
  "posts",
  "resources",
  "seminars",
]);

export function validateApiAdminSearch(
  search: Record<string, unknown>,
): ApiAdminSearch {
  const section = typeof search.section === "string" ? search.section : "";
  return {
    section: SECTIONS.has(section as AdminSection)
      ? (section as AdminSection)
      : undefined,
  };
}
