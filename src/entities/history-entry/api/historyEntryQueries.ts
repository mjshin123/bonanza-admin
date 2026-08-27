import { queryOptions } from "@tanstack/react-query";

import {
  CONTENT_QUERY_OPTIONS,
  pageRange,
  pageResult,
  resolvePageParams,
  type PageParams,
  type PageResult,
} from "@shared/api/content";
import { supabase } from "@shared/api/supabase";
import type { Tables } from "@shared/api/supabase";

export type HistoryEntryDto = {
  id: string;
  year: number;
  content: string;
  position: number;
  isVisible: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminHistoryEntryListParams = PageParams & {
  year?: number;
  isVisible?: boolean;
};

function resolveHistoryYear(year: number | undefined): number | undefined {
  if (year === undefined) return undefined;
  if (!Number.isInteger(year) || year < 1900 || year > 2999) {
    throw new RangeError("year는 1900 이상 2999 이하의 정수여야 합니다.");
  }
  return year;
}

function resolveParams(params: AdminHistoryEntryListParams = {}) {
  return {
    ...resolvePageParams(params),
    year: resolveHistoryYear(params.year),
    isVisible: params.isVisible,
  };
}

export function mapHistoryEntry(
  row: Tables<"history_entries">,
): HistoryEntryDto {
  return {
    id: row.id,
    year: row.year,
    content: row.content,
    position: row.position,
    isVisible: row.is_visible,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const historyEntryQueryKeys = {
  all: ["history-entries"] as const,
  adminList: (params: ReturnType<typeof resolveParams>) =>
    ["history-entries", "admin", "list", params] as const,
};

async function fetchAdminHistoryEntries(
  params: ReturnType<typeof resolveParams>,
): Promise<PageResult<HistoryEntryDto>> {
  const { from, to } = pageRange(params);
  let query = supabase
    .from("history_entries")
    .select("*", { count: "exact" })
    .order("year", { ascending: false })
    .order("position")
    .order("id")
    .range(from, to);
  if (params.year !== undefined) query = query.eq("year", params.year);
  if (params.isVisible !== undefined) {
    query = query.eq("is_visible", params.isVisible);
  }
  const { data, error, count } = await query;
  if (error) throw error;
  return pageResult(data.map(mapHistoryEntry), count, params);
}

export function adminHistoryEntriesQueryOptions(
  params: AdminHistoryEntryListParams = {},
) {
  const resolved = resolveParams(params);
  return queryOptions({
    ...CONTENT_QUERY_OPTIONS,
    queryKey: historyEntryQueryKeys.adminList(resolved),
    queryFn: () => fetchAdminHistoryEntries(resolved),
  });
}
