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
  type SelectionMethod,
  type SeminarFileRole,
  type SeminarTiming,
} from "@shared/api/content";
import { supabase } from "@shared/api/supabase";
import type { Database, Tables } from "@shared/api/supabase";
export type SeminarFileDto = {
  file: FileDto;
  role: SeminarFileRole;
  showInGallery: boolean;
  sortOrder: number;
  createdAt: string;
};
export type SeminarListItem = {
  id: string;
  title: string;
  introduction: string;
  resultSummary: string;
  startsAt: string;
  endsAt: string | null;
  location: string;
  poster: FileDto | null;
  publishedAt: string | null;
};
export type SeminarDetail = SeminarListItem & {
  content: string | null;
  selectionMethod: SelectionMethod;
  selectionMethodDetail: string | null;
  capacity: number | null;
  registrationDeadline: string | null;
  applicationUrl: string | null;
  photos: SeminarFileDto[];
  status: ContentStatus;
  createdAt: string;
  updatedAt: string;
};
export type AdminSeminarListItem = SeminarListItem & {
  status: ContentStatus;
  createdAt: string;
  updatedAt: string;
};
export type SeminarListParams = PageParams & {
  from?: string;
  q?: string;
  timing?: SeminarTiming;
  to?: string;
};
export type AdminSeminarListParams = SeminarListParams & {
  status?: ContentStatus;
};
type Joined = Tables<"seminars"> & {
  files: Array<Tables<"seminar_files"> & { file: Tables<"files"> }>;
};
const SELECT =
  "id,title,introduction,result_summary,content,starts_at,ends_at,location,selection_method,selection_method_detail,capacity,registration_deadline,application_url,status,published_at,created_at,updated_at,files:seminar_files(seminar_id,file_id,role,show_in_gallery,sort_order,created_at,file:files!inner(id,file_kind,bucket_name,storage_path,original_name,mime_type,size_bytes,width_px,height_px,alt_text,created_at,updated_at))";
export function mapSeminar(row: Joined): SeminarDetail {
  const files = row.files
    .map((r) => ({
      file: mapFile(r.file),
      role: r.role as SeminarFileRole,
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
    title: row.title,
    introduction: row.introduction,
    resultSummary: row.result_summary,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    location: row.location,
    poster: files.find((f) => f.role === "poster")?.file ?? null,
    publishedAt: row.published_at,
    content: row.content,
    selectionMethod: row.selection_method as SelectionMethod,
    selectionMethodDetail: row.selection_method_detail,
    capacity: row.capacity,
    registrationDeadline: row.registration_deadline,
    applicationUrl: row.application_url,
    photos: files.filter((f) => f.role === "photo"),
    status: row.status as ContentStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
function date(value: string | undefined, name: string) {
  if (!value) return undefined;
  if (Number.isNaN(Date.parse(value)))
    throw new TypeError(`${name}은 유효한 일시여야 합니다.`);
  return new Date(value).toISOString();
}
function resolveParams(p: AdminSeminarListParams = {}) {
  const from = date(p.from, "from"),
    to = date(p.to, "to");
  if (from && to && from > to)
    throw new RangeError("from은 to보다 늦을 수 없습니다.");
  return {
    ...resolvePageParams(p),
    from,
    to,
    q: p.q?.trim() || undefined,
    timing: p.timing ?? "upcoming",
    status: p.status,
  };
}
export const seminarQueryKeys = {
  all: ["seminars"] as const,
  publicList: (p: ReturnType<typeof resolveParams>) =>
    ["seminars", "public", "list", p] as const,
  publicDetail: (id: string) => ["seminars", "public", "detail", id] as const,
  adminList: (p: ReturnType<typeof resolveParams>) =>
    ["seminars", "admin", "list", p] as const,
  adminDetail: (id: string) => ["seminars", "admin", "detail", id] as const,
};
type RpcSeminarRow =
  Database["public"]["Functions"]["list_seminars"]["Returns"][number];

export function mapSeminarListRow(
  row: RpcSeminarRow,
  admin: false,
): SeminarListItem;
export function mapSeminarListRow(
  row: RpcSeminarRow,
  admin: true,
): AdminSeminarListItem;
export function mapSeminarListRow(row: RpcSeminarRow, admin: boolean) {
  const item: SeminarListItem = {
    id: row.id,
    title: row.title,
    introduction: row.introduction,
    resultSummary: row.result_summary,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    location: row.location,
    poster: mapRpcFile(row.poster),
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
  p: ReturnType<typeof resolveParams>,
  admin: false,
): Promise<PageResult<SeminarListItem>>;
async function fetchList(
  p: ReturnType<typeof resolveParams>,
  admin: true,
): Promise<PageResult<AdminSeminarListItem>>;
async function fetchList(
  p: ReturnType<typeof resolveParams>,
  admin: boolean,
): Promise<PageResult<SeminarListItem | AdminSeminarListItem>> {
  const { data, error } = await supabase.rpc("list_seminars", {
    p_admin: admin,
    p_from: p.from,
    p_page: p.page,
    p_page_size: p.pageSize,
    p_q: p.q,
    p_status: admin ? p.status : undefined,
    p_timing: p.timing,
    p_to: p.to,
  });
  if (error) throwContentError(error);
  const rows = data as RpcSeminarRow[];
  const items = admin
    ? rows.map((row) => mapSeminarListRow(row, true))
    : rows.map((row) => mapSeminarListRow(row, false));
  return pageResult(items, rows[0]?.total_count ?? 0, p);
}
async function fetchDetail(id: string, admin: boolean) {
  let q = supabase.from("seminars").select(SELECT).eq("id", requireUuid(id));
  if (!admin)
    q = q
      .eq("status", "published")
      .lte("published_at", new Date().toISOString());
  const { data, error } = await q.maybeSingle();
  if (error) throw error;
  return data ? mapSeminar(data as Joined) : null;
}
export function seminarsQueryOptions(p: SeminarListParams = {}) {
  const r = resolveParams(p);
  return queryOptions({
    ...CONTENT_QUERY_OPTIONS,
    queryKey: seminarQueryKeys.publicList(r),
    queryFn: () => fetchList(r, false),
  });
}
export function seminarDetailQueryOptions(id: string) {
  const r = requireUuid(id);
  return queryOptions({
    ...CONTENT_QUERY_OPTIONS,
    queryKey: seminarQueryKeys.publicDetail(r),
    queryFn: () => fetchDetail(r, false),
  });
}
export function adminSeminarsQueryOptions(p: AdminSeminarListParams = {}) {
  const r = resolveParams({ ...p, timing: p.timing ?? "all" });
  return queryOptions({
    ...CONTENT_QUERY_OPTIONS,
    queryKey: seminarQueryKeys.adminList(r),
    queryFn: () => fetchList(r, true),
  });
}
export function adminSeminarDetailQueryOptions(id: string) {
  const r = requireUuid(id);
  return queryOptions({
    ...CONTENT_QUERY_OPTIONS,
    queryKey: seminarQueryKeys.adminDetail(r),
    queryFn: () => fetchDetail(r, true),
  });
}
