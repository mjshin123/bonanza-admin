import { queryOptions } from "@tanstack/react-query";

import type { ImageCrop } from "@shared/lib";

import type { InstitutionSummary } from "@entities/institution";
import {
  CONTENT_QUERY_OPTIONS,
  requireUuid,
  resolvePageParams,
  resolvePublishedDateRange,
  type ContentStatus,
  type FileDto,
  type PageParams,
  type PageResult,
  type PostCategory,
  type PostFileRole,
} from "@shared/api/content";

export type PostFileDto = {
  file: FileDto;
  role: PostFileRole;
  showInGallery: boolean;
  /** 목록 썸네일에 보일 자르기 영역(대표 이미지에만 사용) */
  crop?: ImageCrop | null;
  sortOrder: number;
  createdAt: string;
};
export type ContentPostListItem = {
  affiliate: string | null;
  id: string;
  category: PostCategory;
  title: string;
  institution: InstitutionSummary | null;
  cover: FileDto | null;
  coverCrop?: ImageCrop | null;
  isPinned: boolean;
  publishedAt: string | null;
};
export type ContentPostDetail = ContentPostListItem & {
  content: string;
  sourceUrl: string | null;
  files: PostFileDto[];
  status: ContentStatus;
  createdAt: string;
  updatedAt: string;
  createdByLogin?: string | null;
  updatedByLogin?: string | null;
};
export type AdminContentPostListItem = ContentPostListItem & {
  status: ContentStatus;
  createdAt: string;
  updatedAt: string;
  createdByLogin?: string | null;
  updatedByLogin?: string | null;
};
export type PostListParamsV2 = PageParams & {
  category?: PostCategory;
  institutionId?: string;
  q?: string;
};
export type AdminPostListParamsV2 = PostListParamsV2 & {
  status?: ContentStatus;
  publishedFrom?: string;
  publishedTo?: string;
};
export type PostListItem = ContentPostListItem;
export type PostDetail = ContentPostDetail;
export type AdminPostListItem = AdminContentPostListItem;
export type AdminPostDetail = ContentPostDetail;
export type PostListParams = PostListParamsV2;
export type AdminPostListParams = AdminPostListParamsV2;

function resolveParams(params: AdminPostListParamsV2 = {}) {
  const { publishedFrom, publishedTo } = resolvePublishedDateRange(
    params.publishedFrom,
    params.publishedTo,
  );
  return {
    ...resolvePageParams(params),
    category: params.category,
    institutionId: params.institutionId
      ? requireUuid(params.institutionId, "institutionId")
      : undefined,
    q: params.q?.trim() || undefined,
    status: params.status,
    publishedFrom,
    publishedTo,
  };
}
export const contentPostQueryKeys = {
  all: ["content-posts"] as const,
  publicList: (params: ReturnType<typeof resolveParams>) =>
    ["content-posts", "public", "list", params] as const,
  publicDetail: (id: string) =>
    ["content-posts", "public", "detail", id] as const,
  adminList: (params: ReturnType<typeof resolveParams>) =>
    ["content-posts", "admin", "list", params] as const,
  adminDetail: (id: string) =>
    ["content-posts", "admin", "detail", id] as const,
};

async function fetchList(
  p: ReturnType<typeof resolveParams>,
  admin: false,
): Promise<PageResult<ContentPostListItem>>;
async function fetchList(
  p: ReturnType<typeof resolveParams>,
  admin: true,
): Promise<PageResult<AdminContentPostListItem>>;
async function fetchList(
  _p: ReturnType<typeof resolveParams>,
  _admin: boolean,
): Promise<PageResult<ContentPostListItem | AdminContentPostListItem>> {
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}
async function fetchDetail(
  id: string,
  _admin: boolean,
): Promise<ContentPostDetail | null> {
  requireUuid(id);
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}

export function postsQueryOptions(params: PostListParamsV2 = {}) {
  const resolved = resolveParams(params);
  return queryOptions({
    ...CONTENT_QUERY_OPTIONS,
    queryKey: contentPostQueryKeys.publicList(resolved),
    queryFn: () => fetchList(resolved, false),
  });
}
export function postDetailQueryOptions(id: string) {
  const normalized = requireUuid(id);
  return queryOptions({
    ...CONTENT_QUERY_OPTIONS,
    queryKey: contentPostQueryKeys.publicDetail(normalized),
    queryFn: () => fetchDetail(normalized, false),
  });
}
export function adminPostsQueryOptions(params: AdminPostListParamsV2 = {}) {
  const resolved = resolveParams(params);
  return queryOptions({
    ...CONTENT_QUERY_OPTIONS,
    queryKey: contentPostQueryKeys.adminList(resolved),
    queryFn: () => fetchList(resolved, true),
  });
}
export function adminPostDetailQueryOptions(id: string) {
  const normalized = requireUuid(id);
  return queryOptions({
    ...CONTENT_QUERY_OPTIONS,
    queryKey: contentPostQueryKeys.adminDetail(normalized),
    queryFn: () => fetchDetail(normalized, true),
  });
}
