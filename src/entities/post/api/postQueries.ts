import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@shared/api/supabase";
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

const POST_LIST_SELECT = `
  id,
  title,
  thumbnail_path,
  tags,
  is_pinned,
  published_at,
  source_url,
  created_at,
  board:boards!inner (
    id,
    code,
    name
  ),
  organization:organizations (
    id,
    name,
    logo_path
  ),
  files:post_files (*)
`;

const POST_DETAIL_SELECT = `
  id,
  board_id,
  organization_id,
  title,
  content,
  thumbnail_path,
  tags,
  is_pinned,
  is_published,
  published_at,
  source_url,
  created_at,
  updated_at,
  category,
  institution_id,
  status,
  board:boards!inner (*),
  organization:organizations (*),
  files:post_files (*)
`;

const ADMIN_POST_LIST_SELECT = `
  *,
  board:boards!inner (
    id,
    code,
    name
  ),
  organization:organizations (
    id,
    name,
    logo_path
  ),
  files:post_files (*)
`;

export const postQueryKeys = {
  all: ["posts"] as const,
  adminList: (boardCode: string) =>
    [...postQueryKeys.all, "admin-list", boardCode] as const,
  list: (params: ResolvedPostListParams) =>
    [...postQueryKeys.all, "list", params] as const,
  detail: (id: string) => [...postQueryKeys.all, "detail", id] as const,
};

async function fetchAdminPostList(
  boardCode: string,
): Promise<AdminPostListResult> {
  const { data, error, count } = await supabase
    .from("posts")
    .select(ADMIN_POST_LIST_SELECT, { count: "exact" })
    .eq("board.code", boardCode)
    .order("is_pinned", { ascending: false })
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(MAX_PAGE_SIZE);

  if (error) {
    throw error;
  }

  return {
    items: data.map((post) => ({
      ...post,
      files: [...post.files].sort((left, right) =>
        left.sort_order === right.sort_order
          ? left.created_at.localeCompare(right.created_at)
          : left.sort_order - right.sort_order,
      ),
    })),
    total: count ?? 0,
  };
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
  params: ResolvedPostListParams,
): Promise<PostListResult> {
  const from = (params.page - 1) * params.pageSize;
  const to = from + params.pageSize - 1;

  const { data, error, count } = await supabase
    .from("posts")
    .select(POST_LIST_SELECT, { count: "exact" })
    .eq("is_published", true)
    .eq("board.is_active", true)
    .eq("board.code", params.boardCode)
    .order("is_pinned", { ascending: false })
    .order("published_at", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw error;
  }

  return {
    items: data.map((post) => ({
      ...post,
      files: [...post.files].sort((left, right) =>
        left.sort_order === right.sort_order
          ? left.created_at.localeCompare(right.created_at)
          : left.sort_order - right.sort_order,
      ),
    })),
    total: count ?? 0,
    page: params.page,
    pageSize: params.pageSize,
  };
}

async function fetchPostDetail(id: string): Promise<LegacyPostDetail | null> {
  const { data, error } = await supabase
    .from("posts")
    .select(POST_DETAIL_SELECT)
    .eq("id", id)
    .eq("is_published", true)
    .eq("board.is_active", true)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    ...data,
    files: [...data.files].sort((left, right) =>
      left.sort_order === right.sort_order
        ? left.created_at.localeCompare(right.created_at)
        : left.sort_order - right.sort_order,
    ),
  };
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
