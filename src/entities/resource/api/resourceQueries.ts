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
  type ResourceCategory,
} from "@shared/api/content";

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
async function fetchList(
  params: ReturnType<typeof resolveParams>,
  admin: false,
): Promise<PageResult<ResourceListItem>>;
async function fetchList(
  params: ReturnType<typeof resolveParams>,
  admin: true,
): Promise<PageResult<AdminResourceListItem>>;
async function fetchList(
  _params: ReturnType<typeof resolveParams>,
  _admin: boolean,
): Promise<PageResult<ResourceListItem | AdminResourceListItem>> {
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}
async function fetchDetail(
  id: string,
  _admin: boolean,
): Promise<ResourceDetail | null> {
  requireUuid(id);
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
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
