import { queryOptions } from "@tanstack/react-query";

import { CONTENT_QUERY_OPTIONS } from "@shared/api/content";

export type AchievementMetricDto = {
  id: string;
  metricKey: string;
  label: string;
  labelEn: string;
  displayValue: string;
  displayValueEn: string;
  unit: string;
  unitEn: string;
  counterTarget: number | null;
  position: number;
  showOnHome: boolean;
  updatedAt: string;
};

export type AchievementSectionDto = {
  id: string;
  sectionKey: string;
  title: string;
  titleEn: string;
  source: string;
  sourceEn: string;
  position: number;
  updatedAt: string;
  metrics: AchievementMetricDto[];
};

export const achievementQueryKeys = {
  all: ["achievements"] as const,
  admin: ["achievements", "admin"] as const,
};

async function fetchAchievementSections(): Promise<AchievementSectionDto[]> {
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}

export const achievementSectionsQueryOptions = () =>
  queryOptions({
    ...CONTENT_QUERY_OPTIONS,
    queryKey: achievementQueryKeys.admin,
    queryFn: fetchAchievementSections,
  });
