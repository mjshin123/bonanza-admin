import { queryOptions } from "@tanstack/react-query";

import type { Tables } from "@shared/api/supabase";

type Board = Tables<"boards">;
type Organization = Tables<"organizations">;
type Post = Tables<"posts">;
type PostFile = Tables<"post_files">;

type PostBoardSummary = Pick<Board, "id" | "code" | "name">;
type PostOrganizationSummary = Pick<Organization, "id" | "name" | "logo_path">;

export type LegacyPostListItem = Pick<
  Post,
  | "id"
  | "title"
  | "thumbnail_path"
  | "tags"
  | "is_pinned"
  | "published_at"
  | "created_at"
> & {
  board: PostBoardSummary;
  files: PostFile[];
  organization: PostOrganizationSummary | null;
};

export type LegacyPostDetail = Omit<Post, "created_by"> & {
  board: Board;
  organization: Organization | null;
  files: PostFile[];
};

export type LegacyPostListParams = {
  boardCode: string;
  page?: number;
  pageSize?: number;
};

export type PostListResult = {
  items: LegacyPostListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type LegacyAdminPostListItem = Post & {
  board: PostBoardSummary;
  files: PostFile[];
  organization: PostOrganizationSummary | null;
};

export type AdminPostListResult = {
  items: LegacyAdminPostListItem[];
  total: number;
};

type ResolvedPostListParams = {
  boardCode: string;
  page: number;
  pageSize: number;
};

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

export const postQueryKeys = {
  all: ["posts"] as const,
  adminList: (boardCode: string) =>
    [...postQueryKeys.all, "admin-list", boardCode] as const,
  list: (params: ResolvedPostListParams) =>
    [...postQueryKeys.all, "list", params] as const,
  detail: (id: string) => [...postQueryKeys.all, "detail", id] as const,
};

async function fetchAdminPostList(
  _boardCode: string,
): Promise<AdminPostListResult> {
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}

function resolvePostListParams(
  params: LegacyPostListParams,
): ResolvedPostListParams {
  const boardCode = params.boardCode.trim();
  const page = params.page ?? DEFAULT_PAGE;
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;

  if (!boardCode) {
    throw new TypeError("boardCode는 비어 있을 수 없습니다.");
  }

  if (!Number.isInteger(page) || page < 1) {
    throw new RangeError("page는 1 이상의 정수여야 합니다.");
  }

  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
    throw new RangeError(
      `pageSize는 1 이상 ${MAX_PAGE_SIZE} 이하의 정수여야 합니다.`,
    );
  }

  return {
    boardCode,
    page,
    pageSize,
  };
}

async function fetchPostList(
  _params: ResolvedPostListParams,
): Promise<PostListResult> {
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}

async function fetchPostDetail(
  _id: string,
): Promise<LegacyPostDetail | null> {
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}

export function postListQueryOptions(params: LegacyPostListParams) {
  const resolvedParams = resolvePostListParams(params);

  return queryOptions({
    queryKey: postQueryKeys.list(resolvedParams),
    queryFn: () => fetchPostList(resolvedParams),
  });
}

export function legacyPostDetailQueryOptions(id: string) {
  return queryOptions({
    queryKey: postQueryKeys.detail(id),
    queryFn: () => fetchPostDetail(id),
  });
}

export function adminPostListQueryOptions(boardCode: string) {
  const normalizedBoardCode = boardCode.trim();

  if (!normalizedBoardCode) {
    throw new TypeError("boardCode는 비어 있을 수 없습니다.");
  }

  return queryOptions({
    queryKey: postQueryKeys.adminList(normalizedBoardCode),
    queryFn: () => fetchAdminPostList(normalizedBoardCode),
  });
}
