import { queryOptions } from "@tanstack/react-query";
import {
  CONTENT_QUERY_OPTIONS,
  requireUuid,
  resolvePageParams,
  type ContentStatus,
  type FileDto,
  type PageParams,
  type PageResult,
} from "@shared/api/content";
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
export type AdminGalleryPhotoListItem = {
  galleryId: string;
  fileId: string;
  photo: FileDto;
  title: string;
  eventDate: string | null;
  sourceType: GallerySourceType;
  sourceId: string | null;
  sourceCategory: string | null;
};
export type GalleryListParams = PageParams & {
  from?: string;
  q?: string;
  to?: string;
};
export type AdminGalleryListParams = GalleryListParams & {
  status?: ContentStatus;
};
export type AdminGalleryPhotoListParams = PageParams & {
  q?: string;
};
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
function resolvePhotoParams(p: AdminGalleryPhotoListParams = {}) {
  return {
    ...resolvePageParams(p),
    q: p.q?.trim() || undefined,
  };
}
export const galleryQueryKeys = {
  all: ["galleries"] as const,
  publicList: (p: ReturnType<typeof resolveParams>) =>
    ["galleries", "public", "list", p] as const,
  publicDetail: (id: string) => ["galleries", "public", "detail", id] as const,
  adminList: (p: ReturnType<typeof resolveParams>) =>
    ["galleries", "admin", "list", p] as const,
  adminPhotos: (p: ReturnType<typeof resolvePhotoParams>) =>
    ["galleries", "admin", "photos", p] as const,
  adminDetail: (id: string) => ["galleries", "admin", "detail", id] as const,
};
async function fetchList(
  p: ReturnType<typeof resolveParams>,
  admin: false,
): Promise<PageResult<GalleryListItem>>;
async function fetchList(
  p: ReturnType<typeof resolveParams>,
  admin: true,
): Promise<PageResult<AdminGalleryListItem>>;
async function fetchList(
  _p: ReturnType<typeof resolveParams>,
  _admin: boolean,
): Promise<PageResult<GalleryListItem | AdminGalleryListItem>> {
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}
async function fetchAdminGalleryPhotos(
  _p: ReturnType<typeof resolvePhotoParams>,
): Promise<PageResult<AdminGalleryPhotoListItem>> {
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}
async function fetchDetail(
  id: string,
  _admin: boolean,
): Promise<GalleryDetail | null> {
  requireUuid(id);
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
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
export function adminGalleryPhotosQueryOptions(
  p: AdminGalleryPhotoListParams = {},
) {
  const r = resolvePhotoParams(p);
  return queryOptions({
    ...CONTENT_QUERY_OPTIONS,
    queryKey: galleryQueryKeys.adminPhotos(r),
    queryFn: () => fetchAdminGalleryPhotos(r),
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
