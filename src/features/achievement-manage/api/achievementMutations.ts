import { mutationOptions } from "@tanstack/react-query";

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

async function updateAchievementSection(
  input: UpdateAchievementSectionInput,
): Promise<void> {
  requiredText(input.title, "국문 제목", 200);
  requiredText(input.titleEn, "영문 제목", 200);
  requiredText(input.source, "국문 기준일자", 100);
  requiredText(input.sourceEn, "영문 기준일자", 100);
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}

async function updateAchievementMetric(
  input: UpdateAchievementMetricInput,
): Promise<void> {
  requiredText(input.label, "국문 항목명", 100);
  requiredText(input.labelEn, "영문 항목명", 100);
  requiredText(input.displayValue, "국문 수치", 30);
  requiredText(input.displayValueEn, "영문 수치", 30);
  requiredText(input.unit, "국문 단위", 30);
  requiredText(input.unitEn, "영문 단위", 30);
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
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
