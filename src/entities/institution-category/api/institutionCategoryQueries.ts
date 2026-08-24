import { queryOptions } from "@tanstack/react-query";

import { CONTENT_QUERY_OPTIONS } from "@shared/api/content";
import { requireUuid } from "@shared/api/content";
import { supabase } from "@shared/api/supabase";
import type { Tables } from "@shared/api/supabase";

export type InstitutionCategoryDto = {
  id: string;
  code: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export function mapInstitutionCategory(
  row: Tables<"institution_categories">,
): InstitutionCategoryDto {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    displayOrder: row.display_order,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const institutionCategoryQueryKeys = {
  all: ["institution-categories"] as const,
  publicList: () => ["institution-categories", "public", "list"] as const,
  adminList: () => ["institution-categories", "admin", "list"] as const,
  adminDetail: (id: string) =>
    ["institution-categories", "admin", "detail", id] as const,
};

async function fetchCategories(admin: boolean) {
  let query = supabase
    .from("institution_categories")
    .select("id,code,name,display_order,is_active,created_at,updated_at")
    .order("display_order")
    .order("name")
    .order("id");
  if (!admin) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw error;
  return data.map((row) =>
    mapInstitutionCategory(row as Tables<"institution_categories">),
  );
}

async function fetchAdminCategoryById(id: string) {
  const normalizedId = requireUuid(id);
  const { data, error } = await supabase
    .from("institution_categories")
    .select("*")
    .eq("id", normalizedId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapInstitutionCategory(data) : null;
}

export function institutionCategoriesQueryOptions() {
  return queryOptions({
    ...CONTENT_QUERY_OPTIONS,
    queryKey: institutionCategoryQueryKeys.publicList(),
    queryFn: () => fetchCategories(false),
  });
}

export function adminInstitutionCategoriesQueryOptions() {
  return queryOptions({
    ...CONTENT_QUERY_OPTIONS,
    queryKey: institutionCategoryQueryKeys.adminList(),
    queryFn: () => fetchCategories(true),
  });
}

export function adminInstitutionCategoryDetailQueryOptions(id: string) {
  const normalizedId = requireUuid(id);
  return queryOptions({
    ...CONTENT_QUERY_OPTIONS,
    queryKey: institutionCategoryQueryKeys.adminDetail(normalizedId),
    queryFn: () => fetchAdminCategoryById(normalizedId),
  });
}
