import { queryOptions } from "@tanstack/react-query";
import {
  CONTENT_QUERY_OPTIONS,
  mapFile,
  pageResult,
  requireUuid,
  resolvePageParams,
  resolvePublishedDateRange,
  throwContentError,
  type ContentStatus,
  type FileDto,
  type PageParams,
  type PageResult,
  type ResourceCategory,
} from "@shared/api/content";
import { supabase } from "@shared/api/supabase";
import type { Database, Tables } from "@shared/api/supabase";

export type ResourceFileDto = {
  file: FileDto;
  showInGallery: boolean;
  sortOrder: number;
  createdAt: string;
};
export type ResourceListItem = {
  id: string;
  category: ResourceCategory;
  title: string;
  fileCount: number;
  publishedAt: string | null;
};
export type ResourceDetail = ResourceListItem & {
  files: ResourceFileDto[];
  status: ContentStatus;
  createdAt: string;
  updatedAt: string;
};
export type AdminResourceListItem = ResourceListItem & {
  status: ContentStatus;
  createdAt: string;
  updatedAt: string;
};
export type ResourceListParams = PageParams & {
  category?: ResourceCategory;
  q?: string;
};
export type AdminResourceListParams = ResourceListParams & {
  status?: ContentStatus;
  publishedFrom?: string;
  publishedTo?: string;
};
type Joined = Tables<"resources"> & {
  files: Array<Tables<"resource_files"> & { file: Tables<"files"> }>;
};
const SELECT =
  "id,category,title,status,published_at,created_at,updated_at,files:resource_files(resource_id,file_id,show_in_gallery,sort_order,created_at,file:files!inner(id,file_kind,bucket_name,storage_path,original_name,mime_type,size_bytes,width_px,height_px,alt_text,created_at,updated_at))";

export function mapResource(row: Joined): ResourceDetail {
  const files = row.files
    .map((r) => ({
      file: mapFile(r.file),
      showInGallery: r.show_in_gallery,
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
    fileCount: files.length,
    publishedAt: row.published_at,
    files,
    status: row.status as ContentStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
function resolveParams(params: AdminResourceListParams = {}) {
  const { publishedFrom, publishedTo } = resolvePublishedDateRange(
    params.publishedFrom,
    params.publishedTo,
  );
  return {
    ...resolvePageParams(params),
    category: params.category,
    q: params.q?.trim() || undefined,
    status: params.status,
    publishedFrom,
    publishedTo,
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
type RpcResourceRow =
  Database["public"]["Functions"]["list_admin_resources"]["Returns"][number];

export function mapResourceListRow(
  row: RpcResourceRow,
  admin: false,
): ResourceListItem;
export function mapResourceListRow(
  row: RpcResourceRow,
  admin: true,
): AdminResourceListItem;
export function mapResourceListRow(row: RpcResourceRow, admin: boolean) {
  const item: ResourceListItem = {
    id: row.id,
    category: row.category as ResourceCategory,
    title: row.title,
    fileCount: row.file_count,
    publishedAt: row.published_at,
  };
  return admin
    ? {
        ...item,
        status: row.status as ContentStatus,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    : item;
}
async function fetchList(
  params: ReturnType<typeof resolveParams>,
  admin: false,
): Promise<PageResult<ResourceListItem>>;
async function fetchList(
  params: ReturnType<typeof resolveParams>,
  admin: true,
): Promise<PageResult<AdminResourceListItem>>;
async function fetchList(
  params: ReturnType<typeof resolveParams>,
  admin: boolean,
): Promise<PageResult<ResourceListItem | AdminResourceListItem>> {
  const { data, error } = await supabase.rpc("list_admin_resources", {
    p_admin: admin,
    p_category: params.category,
    p_page: params.page,
    p_page_size: params.pageSize,
    p_published_from: params.publishedFrom,
    p_published_to: params.publishedTo,
    p_q: params.q,
    p_status: admin ? params.status : undefined,
  });
  if (error) throwContentError(error);
  const rows = data as RpcResourceRow[];
  const items = admin
    ? rows.map((row) => mapResourceListRow(row, true))
    : rows.map((row) => mapResourceListRow(row, false));
  return pageResult(items, rows[0]?.total_count ?? 0, params);
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
