const MAX_TAG_COUNT = 10;
const MAX_TAG_LENGTH = 30;

export function normalizeTags(tags: readonly string[] | null | undefined) {
  const normalizedTags = Array.from(
    new Set((tags ?? []).map((tag) => tag.trim()).filter(Boolean)),
  );

  if (normalizedTags.length > MAX_TAG_COUNT) {
    throw new RangeError(`태그는 최대 ${MAX_TAG_COUNT}개까지 선택할 수 있습니다.`);
  }

  if (normalizedTags.some((tag) => tag.length > MAX_TAG_LENGTH)) {
    throw new RangeError(`태그는 각각 ${MAX_TAG_LENGTH}자 이하여야 합니다.`);
  }

  return normalizedTags;
}
