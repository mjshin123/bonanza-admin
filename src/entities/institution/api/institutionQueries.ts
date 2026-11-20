import { queryOptions } from "@tanstack/react-query";

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
  name: string;
  logo: FileDto | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};
export type InstitutionSummary = Pick<
  InstitutionDto,
  "id" | "institutionType" | "name" | "logo"
>;
export type InstitutionListParams = PageParams & {
  institutionType?: InstitutionType;
  q?: string;
};
export type AdminInstitutionListParams = InstitutionListParams & {
  isActive?: boolean;
};

type InstitutionJoinedRow = Tables<"institutions"> & {
  logo: Tables<"files"> | null;
};

const SELECT =
  "id,institution_type,name,logo_file_id,display_order,is_active,created_at,updated_at,logo:files(id,file_kind,bucket_name,storage_path,original_name,mime_type,size_bytes,width_px,height_px,alt_text,created_at,updated_at)";

export function mapInstitution(row: InstitutionJoinedRow): InstitutionDto {
  return {
    id: row.id,
    institutionType: row.institution_type as InstitutionType,
    name: row.name,
    logo: row.logo ? mapFile(row.logo) : null,
    displayOrder: row.display_order,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function resolveParams(params: AdminInstitutionListParams = {}) {
  const page = resolvePageParams(params);
  return {
    ...page,
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
  if (!admin) query = query.eq("is_active", true);
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
  if (!admin) query = query.eq("is_active", true);
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
