import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@shared/api/supabase";

import {
  webAnalyticsResponseSchema,
  type WebAnalyticsDateRange,
  type WebAnalyticsResponse,
} from "../model/webAnalytics";

export const webAnalyticsQueryKeys = {
  all: ["web-analytics"] as const,
  admin: (period: WebAnalyticsDateRange) =>
    [...webAnalyticsQueryKeys.all, "admin", period] as const,
};

async function readFunctionError(error: unknown): Promise<Error> {
  if (error && typeof error === "object" && "context" in error) {
    const context = error.context;

    if (context instanceof Response) {
      try {
        const body = (await context.clone().json()) as {
          message?: unknown;
        };

        if (typeof body.message === "string" && body.message.trim()) {
          return new Error(body.message.trim());
        }
      } catch {
        // Supabase 기본 오류 메시지로 대체한다.
      }
    }
  }

  return error instanceof Error
    ? error
    : new Error("방문 통계를 불러오지 못했습니다.");
}

async function getAdminWebAnalytics(
  period: WebAnalyticsDateRange,
): Promise<WebAnalyticsResponse> {
  const { data, error } = await supabase.functions.invoke(
    "admin-web-analytics",
    {
      body: period,
    },
  );

  if (error) {
    throw await readFunctionError(error);
  }

  const parsed = webAnalyticsResponseSchema.safeParse(data);

  if (!parsed.success) {
    throw new Error("방문 통계 응답 형식이 올바르지 않습니다.");
  }

  return parsed.data;
}

export function adminWebAnalyticsQueryOptions(period: WebAnalyticsDateRange) {
  return queryOptions({
    queryKey: webAnalyticsQueryKeys.admin(period),
    queryFn: () => getAdminWebAnalytics(period),
    staleTime: 10 * 60 * 1_000,
    gcTime: 30 * 60 * 1_000,
    retry: 1,
  });
}
