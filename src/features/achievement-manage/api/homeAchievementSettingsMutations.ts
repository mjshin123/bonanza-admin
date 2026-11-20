import { mutationOptions } from "@tanstack/react-query";

import { throwContentError } from "@shared/api/content";
import { supabase, type Json } from "@shared/api/supabase";

export type UpdateHomeAchievementSettingsInput = {
  isAutoSync: boolean;
  metricOverrides: Record<string, { displayValue: string; displayValueEn: string }>;
  source: string;
  sourceEn: string;
};

const requireText = (value: string, field: string) => {
  const normalized = value.trim();
  if (!normalized || normalized.length > 100) throw new RangeError(`${field}을 확인해주세요.`);
  return normalized;
};

async function updateHomeAchievementSettings(input: UpdateHomeAchievementSettingsInput) {
  const { error } = await supabase
    .from("achievement_home_settings")
    .update({
      is_auto_sync: input.isAutoSync,
      metric_overrides: input.metricOverrides as Json,
      source: requireText(input.source, "기준(한글)"),
      source_en: requireText(input.sourceEn, "기준(영문)"),
    })
    .eq("id", true);
  if (error) throwContentError(error);
}

export const updateHomeAchievementSettingsMutationOptions = () =>
  mutationOptions({ mutationKey: ["achievements", "home-settings", "update"], mutationFn: updateHomeAchievementSettings });
