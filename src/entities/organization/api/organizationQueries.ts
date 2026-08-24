import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@shared/api/supabase";
import type { Tables } from "@shared/api/supabase";

export const ORGANIZATION_TYPES = [
  "member",
  "domestic_partner",
  "international_partner",
] as const;

export type Organization = Tables<"organizations">;
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
  filters: OrganizationListFilters,
): Promise<Organization[]> {
  let query = supabase
    .from("organizations")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (filters.type) {
    query = query.eq("organization_type", filters.type);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data;
}

async function fetchOrganizationById(
  id: string,
): Promise<Organization | null> {
  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
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
