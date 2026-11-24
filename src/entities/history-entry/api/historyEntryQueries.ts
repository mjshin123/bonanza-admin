import { queryOptions } from "@tanstack/react-query";

import {
  CONTENT_QUERY_OPTIONS,
  resolvePageParams,
  type PageParams,
  type PageResult,
} from "@shared/api/content";

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

export const historyEntryQueryKeys = {
  all: ["history-entries"] as const,
  adminList: (params: ReturnType<typeof resolveParams>) =>
    ["history-entries", "admin", "list", params] as const,
};

async function fetchAdminHistoryEntries(
  _params: ReturnType<typeof resolveParams>,
): Promise<PageResult<HistoryEntryDto>> {
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
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
