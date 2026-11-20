import { queryOptions } from "@tanstack/react-query";

import { CONTENT_QUERY_OPTIONS } from "@shared/api/content";
import { supabase } from "@shared/api/supabase";

export type HomeAchievementSettingsDto = {
  isAutoSync: boolean;
  metricOverrides: Record<string, { displayValue: string; displayValueEn: string }>;
  source: string;
  sourceEn: string;
  updatedAt: string;
};

export const homeAchievementSettingsQueryKey = ["achievements", "home-settings"] as const;

async function fetchHomeAchievementSettings(): Promise<HomeAchievementSettingsDto> {
  const { data, error } = await supabase
    .from("achievement_home_settings")
    .select("*")
    .eq("id", true)
    .single();
  if (error) throw error;
  return {
    isAutoSync: data.is_auto_sync,
    metricOverrides: data.metric_overrides as Record<string, { displayValue: string; displayValueEn: string }>,
    source: data.source,
    sourceEn: data.source_en,
    updatedAt: data.updated_at,
  };
}

export const homeAchievementSettingsQueryOptions = () =>
  queryOptions({
    ...CONTENT_QUERY_OPTIONS,
    queryKey: homeAchievementSettingsQueryKey,
    queryFn: fetchHomeAchievementSettings,
  });
