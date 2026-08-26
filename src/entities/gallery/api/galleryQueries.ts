import { queryOptions } from "@tanstack/react-query";
import {
  CONTENT_QUERY_OPTIONS,
  mapFile,
  mapRpcFile,
  pageResult,
  requireUuid,
  resolvePageParams,
  throwContentError,
  type ContentStatus,
  type FileDto,
  type PageParams,
  type PageResult,
} from "@shared/api/content";
import { supabase } from "@shared/api/supabase";
import type { Database, Tables } from "@shared/api/supabase";
export type GalleryItemDto = {
  file: FileDto;
  caption: string;
  sortOrder: number;
  isHidden: boolean;
  createdAt: string;
};
export type GallerySourceType = "post" | "resource" | "seminar" | null;
export type GalleryListItem = {
  id: string;
  title: string;
  description: string;
  eventDate: string | null;
  coverImage: FileDto | null;
  itemCount: number;
  displayOrder: number;
  publishedAt: string | null;
  sourceType: GallerySourceType;
  sourceId: string | null;
  sourceCategory: string | null;
};
export type GalleryDetail = GalleryListItem & {
  items: GalleryItemDto[];
  status: ContentStatus;
  createdAt: string;
  updatedAt: string;
};
export type AdminGalleryListItem = GalleryListItem & {
  status: ContentStatus;
  createdAt: string;
  updatedAt: string;
};
export type GalleryListParams = PageParams & {
  from?: string;
  q?: string;
  to?: string;
};
export type AdminGalleryListParams = GalleryListParams & {
  status?: ContentStatus;
};
type Joined = Tables<"galleries"> & {
  items: Array<Tables<"gallery_items"> & { file: Tables<"files"> }>;
};
const SELECT =
  "id,title,description,event_date,status,published_at,display_order,source_type,source_id,created_at,updated_at,items:gallery_items(gallery_id,file_id,caption,sort_order,is_hidden,created_at,file:files!inner(id,file_kind,bucket_name,storage_path,original_name,mime_type,size_bytes,width_px,height_px,alt_text,created_at,updated_at))";
export function mapGallery(r: Joined): GalleryDetail {
  const items = r.items
    .map((x) => ({
      file: mapFile(x.file),
      caption: x.caption,
      sortOrder: x.sort_order,
      isHidden: x.is_hidden,
      createdAt: x.created_at,
    }))
    .sort(
      (a, b) =>
        a.sortOrder - b.sortOrder ||
        a.createdAt.localeCompare(b.createdAt) ||
        a.file.id.localeCompare(b.file.id),
    );
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    eventDate: r.event_date,
    coverImage: items[0]?.file ?? null,
    itemCount: items.length,
    displayOrder: r.display_order,
    publishedAt: r.published_at,
    sourceType: r.source_type as GallerySourceType,
    sourceId: r.source_id,
    sourceCategory: null,
    items,
    status: r.status as ContentStatus,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
function validDate(v: string | undefined, n: string) {
  if (!v) return undefined;
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(v) ||
    Number.isNaN(Date.parse(`${v}T00:00:00Z`))
  )
    throw new TypeError(`${n}은 YYYY-MM-DD 형식이어야 합니다.`);
  return v;
}
function resolveParams(p: AdminGalleryListParams = {}) {
  const from = validDate(p.from, "from"),
    to = validDate(p.to, "to");
  if (from && to && from > to)
    throw new RangeError("from은 to보다 늦을 수 없습니다.");
  return {
    ...resolvePageParams(p),
    from,
    to,
    q: p.q?.trim() || undefined,
    status: p.status,
  };
}
export const galleryQueryKeys = {
  all: ["galleries"] as const,
  publicList: (p: ReturnType<typeof resolveParams>) =>
    ["galleries", "public", "list", p] as const,
  publicDetail: (id: string) => ["galleries", "public", "detail", id] as const,
  adminList: (p: ReturnType<typeof resolveParams>) =>
    ["galleries", "admin", "list", p] as const,
  adminDetail: (id: string) => ["galleries", "admin", "detail", id] as const,
};
type RpcGalleryRow =
  Database["public"]["Functions"]["list_galleries"]["Returns"][number];

export function mapGalleryListRow(
  row: RpcGalleryRow,
  admin: false,
): GalleryListItem;
export function mapGalleryListRow(
  row: RpcGalleryRow,
  admin: true,
): AdminGalleryListItem;
export function mapGalleryListRow(row: RpcGalleryRow, admin: boolean) {
  const item: GalleryListItem = {
    id: row.id,
    title: row.title,
    description: row.description,
    eventDate: row.event_date,
    coverImage: mapRpcFile(row.cover_image),
    itemCount: row.item_count,
    displayOrder: row.display_order,
    publishedAt: row.published_at,
    sourceType: row.source_type as GallerySourceType,
    sourceId: row.source_id,
    sourceCategory: row.source_category,
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
  p: ReturnType<typeof resolveParams>,
  admin: false,
): Promise<PageResult<GalleryListItem>>;
async function fetchList(
  p: ReturnType<typeof resolveParams>,
  admin: true,
): Promise<PageResult<AdminGalleryListItem>>;
async function fetchList(
  p: ReturnType<typeof resolveParams>,
  admin: boolean,
): Promise<PageResult<GalleryListItem | AdminGalleryListItem>> {
  const { data, error } = await supabase.rpc("list_galleries", {
    p_admin: admin,
    p_from: p.from,
    p_page: p.page,
    p_page_size: p.pageSize,
    p_q: p.q,
    p_status: admin ? p.status : undefined,
    p_to: p.to,
  });
  if (error) throwContentError(error);
  const rows = data as RpcGalleryRow[];
  const items = admin
    ? rows.map((row) => mapGalleryListRow(row, true))
    : rows.map((row) => mapGalleryListRow(row, false));
  return pageResult(items, rows[0]?.total_count ?? 0, p);
}
async function fetchDetail(id: string, admin: boolean) {
  let q = supabase.from("galleries").select(SELECT).eq("id", requireUuid(id));
  if (!admin)
    q = q
      .eq("status", "published")
      .lte("published_at", new Date().toISOString());
  const { data, error } = await q.maybeSingle();
  if (error) throw error;
  return data ? mapGallery(data as Joined) : null;
}
export function galleriesQueryOptions(p: GalleryListParams = {}) {
  const r = resolveParams(p);
  return queryOptions({
    ...CONTENT_QUERY_OPTIONS,
    queryKey: galleryQueryKeys.publicList(r),
    queryFn: () => fetchList(r, false),
  });
}
export function galleryDetailQueryOptions(id: string) {
  const r = requireUuid(id);
  return queryOptions({
    ...CONTENT_QUERY_OPTIONS,
    queryKey: galleryQueryKeys.publicDetail(r),
    queryFn: () => fetchDetail(r, false),
  });
}
export function adminGalleriesQueryOptions(p: AdminGalleryListParams = {}) {
  const r = resolveParams(p);
  return queryOptions({
    ...CONTENT_QUERY_OPTIONS,
    queryKey: galleryQueryKeys.adminList(r),
    queryFn: () => fetchList(r, true),
  });
}
export function adminGalleryDetailQueryOptions(id: string) {
  const r = requireUuid(id);
  return queryOptions({
    ...CONTENT_QUERY_OPTIONS,
    queryKey: galleryQueryKeys.adminDetail(r),
    queryFn: () => fetchDetail(r, true),
  });
}
