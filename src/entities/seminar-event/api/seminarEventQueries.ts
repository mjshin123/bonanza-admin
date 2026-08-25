import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@shared/api/supabase";
import type { Tables } from "@shared/api/supabase";

type Board = Tables<"boards">;
type Post = Tables<"posts">;
type PostFile = Tables<"post_files">;
export type SeminarEvent = Tables<"seminar_events">;

type SeminarBoardSummary = Pick<Board, "id" | "code" | "name">;
type SeminarPostSummary = Pick<
  Post,
  | "id"
  | "title"
  | "content"
  | "thumbnail_path"
  | "tags"
  | "is_pinned"
  | "is_published"
  | "published_at"
  | "created_at"
  | "updated_at"
> & {
  board: SeminarBoardSummary;
  files: PostFile[];
};

export type SeminarEventListItem = SeminarEvent & {
  post: SeminarPostSummary;
};

export type SeminarEventTiming = "all" | "past" | "upcoming";

export type SeminarEventListParams = {
  page?: number;
  pageSize?: number;
  timing?: SeminarEventTiming;
};

export type SeminarEventListResult = {
  items: SeminarEventListItem[];
  page: number;
  pageSize: number;
  total: number;
};

type ResolvedSeminarEventListParams = {
  page: number;
  pageSize: number;
  timing: SeminarEventTiming;
};

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

const SEMINAR_EVENT_SELECT = `
  *,
  post:posts!inner (
    id,
    title,
    content,
    thumbnail_path,
    tags,
    is_pinned,
    is_published,
    published_at,
    created_at,
    updated_at,
    files:post_files (*),
    board:boards!inner (
      id,
      code,
      name
    )
  )
`;

export const seminarEventQueryKeys = {
  all: ["seminar-events"] as const,
  adminList: (params: ResolvedSeminarEventListParams) =>
    [...seminarEventQueryKeys.all, "admin-list", params] as const,
  detail: (postId: string) =>
    [...seminarEventQueryKeys.all, "detail", postId] as const,
  list: (params: ResolvedSeminarEventListParams) =>
    [...seminarEventQueryKeys.all, "list", params] as const,
};

function resolveListParams(
  params: SeminarEventListParams,
): ResolvedSeminarEventListParams {
  const page = params.page ?? DEFAULT_PAGE;
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
  const timing = params.timing ?? "upcoming";

  if (!Number.isInteger(page) || page < 1) {
    throw new RangeError("page는 1 이상의 정수여야 합니다.");
  }

  if (
    !Number.isInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > MAX_PAGE_SIZE
  ) {
    throw new RangeError(
      `pageSize는 1 이상 ${MAX_PAGE_SIZE} 이하의 정수여야 합니다.`,
    );
  }

  return { page, pageSize, timing };
}

async function fetchSeminarEventList(
  params: ResolvedSeminarEventListParams,
): Promise<SeminarEventListResult> {
  const from = (params.page - 1) * params.pageSize;
  const to = from + params.pageSize - 1;
  const now = new Date().toISOString();

  let query = supabase
    .from("seminar_events")
    .select(SEMINAR_EVENT_SELECT, { count: "exact" })
    .eq("post.is_published", true)
    .eq("post.board.is_active", true)
    .eq("post.board.code", "seminar");

  if (params.timing === "upcoming") {
    query = query.gte("starts_at", now).order("starts_at", {
      ascending: true,
    });
  } else if (params.timing === "past") {
    query = query.lt("starts_at", now).order("starts_at", {
      ascending: false,
    });
  } else {
    query = query.order("starts_at", { ascending: false });
  }

  const { data, error, count } = await query.range(from, to);

  if (error) {
    throw error;
  }

  return {
    items: data,
    total: count ?? 0,
    page: params.page,
    pageSize: params.pageSize,
  };
}

async function fetchSeminarEventDetail(
  postId: string,
): Promise<SeminarEventListItem | null> {
  const { data, error } = await supabase
    .from("seminar_events")
    .select(SEMINAR_EVENT_SELECT)
    .eq("post_id", postId)
    .eq("post.is_published", true)
    .eq("post.board.is_active", true)
    .eq("post.board.code", "seminar")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function fetchAdminSeminarEventList(
  params: ResolvedSeminarEventListParams,
): Promise<SeminarEventListResult> {
  const from = (params.page - 1) * params.pageSize;
  const to = from + params.pageSize - 1;
  const { data, error, count } = await supabase
    .from("seminar_events")
    .select(SEMINAR_EVENT_SELECT, { count: "exact" })
    .eq("post.board.code", "seminar")
    .order("starts_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw error;
  }

  return {
    items: data,
    total: count ?? 0,
    page: params.page,
    pageSize: params.pageSize,
  };
}

export function seminarEventListQueryOptions(
  params: SeminarEventListParams = {},
) {
  const resolvedParams = resolveListParams(params);

  return queryOptions({
    queryKey: seminarEventQueryKeys.list(resolvedParams),
    queryFn: () => fetchSeminarEventList(resolvedParams),
  });
}

export function seminarEventDetailQueryOptions(postId: string) {
  return queryOptions({
    queryKey: seminarEventQueryKeys.detail(postId),
    queryFn: () => fetchSeminarEventDetail(postId),
  });
}

export function adminSeminarEventListQueryOptions(
  params: Omit<SeminarEventListParams, "timing"> = {},
) {
  const resolvedParams = resolveListParams({ ...params, timing: "all" });

  return queryOptions({
    queryKey: seminarEventQueryKeys.adminList(resolvedParams),
    queryFn: () => fetchAdminSeminarEventList(resolvedParams),
  });
}
