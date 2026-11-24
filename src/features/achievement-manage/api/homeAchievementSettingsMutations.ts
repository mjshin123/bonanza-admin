import { mutationOptions } from "@tanstack/react-query";

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

async function updateHomeAchievementSettings(
  input: UpdateHomeAchievementSettingsInput,
): Promise<void> {
  requireText(input.source, "기준(한글)");
  requireText(input.sourceEn, "기준(영문)");
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}

export const updateHomeAchievementSettingsMutationOptions = () =>
  mutationOptions({ mutationKey: ["achievements", "home-settings", "update"], mutationFn: updateHomeAchievementSettings });
