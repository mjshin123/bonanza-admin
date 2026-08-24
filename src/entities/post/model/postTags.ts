export const POST_TAG_OPTIONS = [
  "공지",
  "교육",
  "보도자료",
  "통계",
  "조사",
] as const;

export type PostTagOption = (typeof POST_TAG_OPTIONS)[number];
