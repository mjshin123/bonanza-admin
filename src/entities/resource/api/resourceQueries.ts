import { queryOptions } from "@tanstack/react-query";
import {
  CONTENT_QUERY_OPTIONS,
  mapFile,
  pageRange,
  pageResult,
  requireUuid,
  resolvePageParams,
  type ContentStatus,
  type FileDto,
  type PageParams,
  type ResourceCategory,
} from "@shared/api/content";
import { supabase } from "@shared/api/supabase";
import type { Tables } from "@shared/api/supabase";

export type ResourceFileDto = {
  file: FileDto;
  sortOrder: number;
  createdAt: string;
};
export type ResourceListItem = {
  id: string;
  category: ResourceCategory;
  title: string;
  summary: string;
  referenceYear: number | null;
  fileCount: number;
  publishedAt: string | null;
};
export type ResourceDetail = ResourceListItem & {
  files: ResourceFileDto[];
  status: ContentStatus;
  createdAt: string;
  updatedAt: string;
};
export type ResourceListParams = PageParams & {
  category?: ResourceCategory;
  q?: string;
  referenceYear?: number;
};
export type AdminResourceListParams = ResourceListParams & {
  status?: ContentStatus;
};
type Joined = Tables<"resources"> & {
  files: Array<Tables<"resource_files"> & { file: Tables<"files"> }>;
};
const SELECT =
  "id,category,title,summary,reference_year,status,published_at,created_at,updated_at,files:resource_files(resource_id,file_id,sort_order,created_at,file:files!inner(id,file_kind,bucket_name,storage_path,original_name,mime_type,size_bytes,width_px,height_px,alt_text,created_at,updated_at))";

export function mapResource(row: Joined): ResourceDetail {
  const files = row.files
    .map((r) => ({
      file: mapFile(r.file),
      sortOrder: r.sort_order,
      createdAt: r.created_at,
    }))
    .sort(
      (a, b) =>
        a.sortOrder - b.sortOrder ||
        a.createdAt.localeCompare(b.createdAt) ||
        a.file.id.localeCompare(b.file.id),
    );
  return {
    id: row.id,
    category: row.category as ResourceCategory,
    title: row.title,
    summary: row.summary,
    referenceYear: row.reference_year,
    fileCount: files.length,
    publishedAt: row.published_at,
    files,
    status: row.status as ContentStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
function resolveParams(params: AdminResourceListParams = {}) {
  if (
    params.referenceYear !== undefined &&
    (!Number.isInteger(params.referenceYear) ||
      params.referenceYear < 1900 ||
      params.referenceYear > 2100)
  )
    throw new RangeError("referenceYear는 1900~2100 정수여야 합니다.");
  return {
    ...resolvePageParams(params),
    category: params.category,
    q: params.q?.trim() || undefined,
    referenceYear: params.referenceYear,
    status: params.status,
  };
}
export const resourceQueryKeys = {
  all: ["resources"] as const,
  publicList: (p: ReturnType<typeof resolveParams>) =>
    ["resources", "public", "list", p] as const,
  publicDetail: (id: string) => ["resources", "public", "detail", id] as const,
  adminList: (p: ReturnType<typeof resolveParams>) =>
    ["resources", "admin", "list", p] as const,
  adminDetail: (id: string) => ["resources", "admin", "detail", id] as const,
};
async function fetchList(
  params: ReturnType<typeof resolveParams>,
  admin: boolean,
) {
  const { from, to } = pageRange(params);
  let query = supabase
    .from("resources")
    .select(SELECT, { count: "exact" })
    .order("published_at", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to);
  if (!admin)
    query = query
      .eq("status", "published")
      .lte("published_at", new Date().toISOString());
  if (params.category) query = query.eq("category", params.category);
  if (params.referenceYear)
    query = query.eq("reference_year", params.referenceYear);
  if (params.status) query = query.eq("status", params.status);
  if (params.q)
    query = query.or(`title.ilike.%${params.q}%,summary.ilike.%${params.q}%`);
  const { data, error, count } = await query;
  if (error) throw error;
  const details = data.map((r) => mapResource(r as Joined));
  const items = details.map(
    ({
      files: _files,
      status: _status,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      ...item
    }) =>
      admin
        ? {
            ...item,
            status: _status,
            createdAt: _createdAt,
            updatedAt: _updatedAt,
          }
        : item,
  );
  return pageResult(items, count, params);
}
async function fetchDetail(id: string, admin: boolean) {
  let query = supabase
    .from("resources")
    .select(SELECT)
    .eq("id", requireUuid(id));
  if (!admin)
    query = query
      .eq("status", "published")
      .lte("published_at", new Date().toISOString());
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data ? mapResource(data as Joined) : null;
}
export function resourcesQueryOptions(params: ResourceListParams = {}) {
  const r = resolveParams(params);
  return queryOptions({
    ...CONTENT_QUERY_OPTIONS,
    queryKey: resourceQueryKeys.publicList(r),
    queryFn: () => fetchList(r, false),
  });
}
export function resourceDetailQueryOptions(id: string) {
  const r = requireUuid(id);
  return queryOptions({
    ...CONTENT_QUERY_OPTIONS,
    queryKey: resourceQueryKeys.publicDetail(r),
    queryFn: () => fetchDetail(r, false),
  });
}
export function adminResourcesQueryOptions(
  params: AdminResourceListParams = {},
) {
  const r = resolveParams(params);
  return queryOptions({
    ...CONTENT_QUERY_OPTIONS,
    queryKey: resourceQueryKeys.adminList(r),
    queryFn: () => fetchList(r, true),
  });
}
export function adminResourceDetailQueryOptions(id: string) {
  const r = requireUuid(id);
  return queryOptions({
    ...CONTENT_QUERY_OPTIONS,
    queryKey: resourceQueryKeys.adminDetail(r),
    queryFn: () => fetchDetail(r, true),
  });
}
