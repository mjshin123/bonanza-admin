import { queryOptions } from "@tanstack/react-query";

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
  _params: ResolvedSeminarEventListParams,
): Promise<SeminarEventListResult> {
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}

async function fetchSeminarEventDetail(
  _postId: string,
): Promise<SeminarEventListItem | null> {
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}

async function fetchAdminSeminarEventList(
  _params: ResolvedSeminarEventListParams,
): Promise<SeminarEventListResult> {
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
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
