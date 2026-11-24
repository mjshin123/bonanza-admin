import { queryOptions } from "@tanstack/react-query";

import { CONTENT_QUERY_OPTIONS } from "@shared/api/content";

export type HomeAchievementSettingsDto = {
  isAutoSync: boolean;
  metricOverrides: Record<string, { displayValue: string; displayValueEn: string }>;
  source: string;
  sourceEn: string;
  updatedAt: string;
};

export const homeAchievementSettingsQueryKey = ["achievements", "home-settings"] as const;

async function fetchHomeAchievementSettings(): Promise<HomeAchievementSettingsDto> {
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}

export const homeAchievementSettingsQueryOptions = () =>
  queryOptions({
    ...CONTENT_QUERY_OPTIONS,
    queryKey: homeAchievementSettingsQueryKey,
    queryFn: fetchHomeAchievementSettings,
  });
