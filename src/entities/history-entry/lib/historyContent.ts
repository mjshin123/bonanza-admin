export type HistoryContentPart = {
  text: string;
  emphasized: boolean;
};

export const HISTORY_CONTENT_MAX_LENGTH = 500;

export function validateHistoryContent(content: string): string | null {
  const normalized = content.trim();
  if (!normalized) return "내용을 입력해주세요.";
  if (normalized.length > HISTORY_CONTENT_MAX_LENGTH) {
    return `내용은 ${HISTORY_CONTENT_MAX_LENGTH}자 이하여야 합니다.`;
  }

  const segments = normalized.split("**");
  if (segments.length % 2 === 0) {
    return "강조 표시는 **문구**처럼 양쪽을 닫아주세요.";
  }
  if (segments.some((segment, index) => index % 2 === 1 && !segment.trim())) {
    return "강조할 문구를 ** 사이에 입력해주세요.";
  }
  return null;
}

export function normalizeHistoryContent(content: string): string {
  const error = validateHistoryContent(content);
  if (error) throw new TypeError(error);
  return content.trim();
}

export function parseHistoryContent(content: string): HistoryContentPart[] {
  if (validateHistoryContent(content)) {
    return [{ text: content, emphasized: false }];
  }
  return content
    .trim()
    .split("**")
    .flatMap((text, index) =>
      text ? [{ text, emphasized: index % 2 === 1 }] : [],
    );
}
