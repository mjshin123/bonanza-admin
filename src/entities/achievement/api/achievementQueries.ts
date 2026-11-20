import { queryOptions } from "@tanstack/react-query";

import { CONTENT_QUERY_OPTIONS } from "@shared/api/content";
import { supabase } from "@shared/api/supabase";

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
  const { data, error } = await supabase
    .from("achievement_sections")
    .select("*, achievement_metrics(*)")
    .order("position")
    .order("position", { referencedTable: "achievement_metrics" });
  if (error) throw error;

  return data.map((section) => ({
    id: section.id,
    sectionKey: section.section_key,
    title: section.title,
    titleEn: section.title_en,
    source: section.source,
    sourceEn: section.source_en,
    position: section.position,
    updatedAt: section.updated_at,
    metrics: (section.achievement_metrics ?? []).map((metric) => ({
      id: metric.id,
      metricKey: metric.metric_key,
      label: metric.label,
      labelEn: metric.label_en,
      displayValue: metric.display_value,
      displayValueEn: metric.display_value_en,
      unit: metric.unit,
      unitEn: metric.unit_en,
      counterTarget: metric.counter_target,
      position: metric.position,
      showOnHome: metric.show_on_home,
      updatedAt: metric.updated_at,
    })),
  }));
}

export const achievementSectionsQueryOptions = () =>
  queryOptions({
    ...CONTENT_QUERY_OPTIONS,
    queryKey: achievementQueryKeys.admin,
    queryFn: fetchAchievementSections,
  });
