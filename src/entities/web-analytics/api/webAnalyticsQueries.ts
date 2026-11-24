import { queryOptions } from "@tanstack/react-query";

import { isDemoMode } from "@shared/api/content";

import type {
  WebAnalyticsDateRange,
  WebAnalyticsResponse,
} from "../model/webAnalytics";

export const webAnalyticsQueryKeys = {
  all: ["web-analytics"] as const,
  admin: (period: WebAnalyticsDateRange) =>
    [...webAnalyticsQueryKeys.all, "admin", period] as const,
};

async function getAdminWebAnalytics(
  _period: WebAnalyticsDateRange,
): Promise<WebAnalyticsResponse> {
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}

export function adminWebAnalyticsQueryOptions(period: WebAnalyticsDateRange) {
  return queryOptions({
    queryKey: webAnalyticsQueryKeys.admin(period),
    queryFn: () => getAdminWebAnalytics(period),
    staleTime: 10 * 60 * 1_000,
    gcTime: 30 * 60 * 1_000,
    enabled: !isDemoMode,
    retry: isDemoMode ? false : 1,
  });
}
