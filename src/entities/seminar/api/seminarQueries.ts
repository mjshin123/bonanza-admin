import { queryOptions } from "@tanstack/react-query";
import {
  CONTENT_QUERY_OPTIONS,
  requireUuid,
  resolvePageParams,
  resolvePublishedDateRange,
  type ContentStatus,
  type FileDto,
  type PageParams,
  type PageResult,
  type SeminarTiming,
} from "@shared/api/content";
export type SeminarFileDto = {
  file: FileDto;
  showInGallery: boolean;
  sortOrder: number;
  createdAt: string;
};
export type SeminarListItem = {
  id: string;
  title: string;
  introduction: string;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  poster: FileDto | null;
  publishedAt: string | null;
  isFeatured: boolean;
};
export type SeminarDetail = SeminarListItem & {
  content: string | null;
  applicationUrl: string | null;
  images: SeminarFileDto[];
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
  publishedFrom?: string;
  publishedTo?: string;
};
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
  const { publishedFrom, publishedTo } = resolvePublishedDateRange(
    p.publishedFrom,
    p.publishedTo,
  );
  return {
    ...resolvePageParams(p),
    from,
    to,
    q: p.q?.trim() || undefined,
    timing: p.timing ?? "upcoming",
    status: p.status,
    publishedFrom,
    publishedTo,
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
async function fetchList(
  p: ReturnType<typeof resolveParams>,
  admin: false,
): Promise<PageResult<SeminarListItem>>;
async function fetchList(
  p: ReturnType<typeof resolveParams>,
  admin: true,
): Promise<PageResult<AdminSeminarListItem>>;
async function fetchList(
  _p: ReturnType<typeof resolveParams>,
  _admin: boolean,
): Promise<PageResult<SeminarListItem | AdminSeminarListItem>> {
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}
async function fetchDetail(
  id: string,
  _admin: boolean,
): Promise<SeminarDetail | null> {
  requireUuid(id);
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
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
