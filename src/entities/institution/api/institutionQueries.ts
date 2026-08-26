import { queryOptions } from "@tanstack/react-query";

import {
  mapInstitutionCategory,
  type InstitutionCategoryDto,
} from "@entities/institution-category";
import {
  CONTENT_QUERY_OPTIONS,
  mapFile,
  pageRange,
  pageResult,
  requireUuid,
  resolvePageParams,
  type FileDto,
  type InstitutionType,
  type PageParams,
  type PageResult,
} from "@shared/api/content";
import { supabase } from "@shared/api/supabase";
import type { Tables } from "@shared/api/supabase";

export type InstitutionDto = {
  id: string;
  institutionType: InstitutionType;
  category: InstitutionCategoryDto;
  name: string;
  logo: FileDto | null;
  description: string;
  homepageUrl: string | null;
  displayOrder: number;
  isActive: boolean;
  isPending: boolean;
  createdAt: string;
  updatedAt: string;
};
export type InstitutionSummary = Pick<
  InstitutionDto,
  "id" | "institutionType" | "name" | "logo"
>;
export type InstitutionListParams = PageParams & {
  categoryId?: string;
  institutionType?: InstitutionType;
  q?: string;
};
export type AdminInstitutionListParams = InstitutionListParams & {
  isActive?: boolean;
};

type InstitutionJoinedRow = Tables<"institutions"> & {
  category: Tables<"institution_categories">;
  logo: Tables<"files"> | null;
};

const SELECT =
  "id,institution_type,category_id,name,logo_file_id,description,homepage_url,display_order,is_active,is_pending,created_at,updated_at,category:institution_categories!inner(id,code,name,institution_type,display_order,is_active,created_at,updated_at),logo:files(id,file_kind,bucket_name,storage_path,original_name,mime_type,size_bytes,width_px,height_px,alt_text,created_at,updated_at)";

export function mapInstitution(row: InstitutionJoinedRow): InstitutionDto {
  return {
    id: row.id,
    institutionType: row.institution_type as InstitutionType,
    category: mapInstitutionCategory(row.category),
    name: row.name,
    logo: row.logo ? mapFile(row.logo) : null,
    description: row.description,
    homepageUrl: row.homepage_url,
    displayOrder: row.display_order,
    isActive: row.is_active,
    isPending: row.is_pending,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function resolveParams(params: AdminInstitutionListParams = {}) {
  const page = resolvePageParams(params);
  return {
    ...page,
    categoryId: params.categoryId
      ? requireUuid(params.categoryId, "categoryId")
      : undefined,
    institutionType: params.institutionType,
    q: params.q?.trim() || undefined,
    isActive: params.isActive,
  };
}

export const institutionQueryKeys = {
  all: ["institutions"] as const,
  publicList: (params: ReturnType<typeof resolveParams>) =>
    ["institutions", "public", "list", params] as const,
  publicDetail: (id: string) =>
    ["institutions", "public", "detail", id] as const,
  adminList: (params: ReturnType<typeof resolveParams>) =>
    ["institutions", "admin", "list", params] as const,
  adminDetail: (id: string) => ["institutions", "admin", "detail", id] as const,
};

async function fetchList(
  params: ReturnType<typeof resolveParams>,
  admin: boolean,
): Promise<PageResult<InstitutionDto>> {
  const { from, to } = pageRange(params);
  let query = supabase
    .from("institutions")
    .select(SELECT, { count: "exact" })
    .order("display_order")
    .order("name")
    .order("id")
    .range(from, to);
  if (!admin)
    query = query.eq("is_active", true).eq("category.is_active", true);
  if (params.categoryId) query = query.eq("category_id", params.categoryId);
  if (params.institutionType)
    query = query.eq("institution_type", params.institutionType);
  if (params.q) query = query.ilike("name", `%${params.q}%`);
  if (admin && params.isActive !== undefined)
    query = query.eq("is_active", params.isActive);
  const { data, error, count } = await query;
  if (error) throw error;
  return pageResult(
    data.map((row) => mapInstitution(row as InstitutionJoinedRow)),
    count,
    params,
  );
}

async function fetchDetail(id: string, admin: boolean) {
  let query = supabase
    .from("institutions")
    .select(SELECT)
    .eq("id", requireUuid(id));
  if (!admin)
    query = query.eq("is_active", true).eq("category.is_active", true);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data ? mapInstitution(data as InstitutionJoinedRow) : null;
}

export function institutionsQueryOptions(params: InstitutionListParams = {}) {
  const resolved = resolveParams(params);
  return queryOptions({
    ...CONTENT_QUERY_OPTIONS,
    queryKey: institutionQueryKeys.publicList(resolved),
    queryFn: () => fetchList(resolved, false),
  });
}
export function institutionDetailQueryOptions(id: string) {
  const normalized = requireUuid(id);
  return queryOptions({
    ...CONTENT_QUERY_OPTIONS,
    queryKey: institutionQueryKeys.publicDetail(normalized),
    queryFn: () => fetchDetail(normalized, false),
  });
}
export function adminInstitutionsQueryOptions(
  params: AdminInstitutionListParams = {},
) {
  const resolved = resolveParams(params);
  return queryOptions({
    ...CONTENT_QUERY_OPTIONS,
    queryKey: institutionQueryKeys.adminList(resolved),
    queryFn: () => fetchList(resolved, true),
  });
}
export function adminInstitutionDetailQueryOptions(id: string) {
  const normalized = requireUuid(id);
  return queryOptions({
    ...CONTENT_QUERY_OPTIONS,
    queryKey: institutionQueryKeys.adminDetail(normalized),
    queryFn: () => fetchDetail(normalized, true),
  });
}
