import { queryOptions } from "@tanstack/react-query";

export const ORGANIZATION_TYPES = [
  "member",
  "domestic_partner",
  "international_partner",
] as const;

export type Organization = {
  id: string;
  name: string;
  logo_path: string | null;
  organization_type: (typeof ORGANIZATION_TYPES)[number];
  is_active: boolean;
  sort_order: number;
};
export type OrganizationType = (typeof ORGANIZATION_TYPES)[number];

export type OrganizationListFilters = {
  type?: OrganizationType;
};

export const organizationQueryKeys = {
  all: ["organizations"] as const,
  list: (filters: OrganizationListFilters = {}) =>
    [...organizationQueryKeys.all, "list", filters] as const,
  detail: (id: string) =>
    [...organizationQueryKeys.all, "detail", id] as const,
};

async function fetchOrganizations(
  _filters: OrganizationListFilters,
): Promise<Organization[]> {
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}

async function fetchOrganizationById(
  _id: string,
): Promise<Organization | null> {
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}

export function organizationsQueryOptions(
  filters: OrganizationListFilters = {},
) {
  return queryOptions({
    queryKey: organizationQueryKeys.list(filters),
    queryFn: () => fetchOrganizations(filters),
  });
}

export function organizationByIdQueryOptions(id: string) {
  return queryOptions({
    queryKey: organizationQueryKeys.detail(id),
    queryFn: () => fetchOrganizationById(id),
  });
}
