import { mutationOptions } from "@tanstack/react-query";

import { throwContentError } from "@shared/api/content";
import { supabase } from "@shared/api/supabase";

export type UpdateAchievementSectionInput = {
  id: string;
  title: string;
  titleEn: string;
  source: string;
  sourceEn: string;
};

export type UpdateAchievementMetricInput = {
  id: string;
  label: string;
  labelEn: string;
  displayValue: string;
  displayValueEn: string;
  unit: string;
  unitEn: string;
  counterTarget: number | null;
  showOnHome: boolean;
};

function requiredText(value: string, field: string, maxLength: number) {
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new RangeError(`${field}을(를) 확인해 주세요.`);
  }
  return normalized;
}

async function updateAchievementSection(input: UpdateAchievementSectionInput) {
  const { error } = await supabase
    .from("achievement_sections")
    .update({
      title: requiredText(input.title, "국문 제목", 200),
      title_en: requiredText(input.titleEn, "영문 제목", 200),
      source: requiredText(input.source, "국문 기준일자", 100),
      source_en: requiredText(input.sourceEn, "영문 기준일자", 100),
    })
    .eq("id", input.id);
  if (error) throwContentError(error);
}

async function updateAchievementMetric(input: UpdateAchievementMetricInput) {
  const { error } = await supabase
    .from("achievement_metrics")
    .update({
      label: requiredText(input.label, "국문 항목명", 100),
      label_en: requiredText(input.labelEn, "영문 항목명", 100),
      display_value: requiredText(input.displayValue, "국문 수치", 30),
      display_value_en: requiredText(input.displayValueEn, "영문 수치", 30),
      unit: requiredText(input.unit, "국문 단위", 30),
      unit_en: requiredText(input.unitEn, "영문 단위", 30),
      counter_target: input.counterTarget,
      show_on_home: input.showOnHome,
    })
    .eq("id", input.id);
  if (error) throwContentError(error);
}

export const updateAchievementSectionMutationOptions = () =>
  mutationOptions({
    mutationKey: ["achievements", "section", "update"],
    mutationFn: updateAchievementSection,
  });

export const updateAchievementMetricMutationOptions = () =>
  mutationOptions({
    mutationKey: ["achievements", "metric", "update"],
    mutationFn: updateAchievementMetric,
  });
