import { normalizeTags } from "@shared/lib";

export type SeminarEventValues = {
  applicationMethod?: string | null;
  applicationUrl?: string | null;
  capacity?: number | null;
  caption?: string;
  content?: string;
  endsAt?: string | null;
  isPinned?: boolean;
  isPublished?: boolean;
  location: string;
  publishedAt?: string | null;
  registrationDeadline?: string | null;
  startsAt: string;
  tags?: string[];
  thumbnailPath?: string | null;
  title: string;
  topic: string;
};

export type NormalizedSeminarEventValues = {
  applicationMethod: string | null;
  applicationUrl: string | null;
  capacity: number | null;
  caption: string;
  content: string;
  endsAt: string | null;
  isPinned: boolean;
  isPublished: boolean;
  location: string;
  publishedAt: string | null;
  registrationDeadline: string | null;
  startsAt: string;
  tags: string[];
  thumbnailPath: string | null;
  title: string;
  topic: string;
};

function requireText(value: string, fieldName: string, maxLength: number) {
  const normalized = value.trim();

  if (!normalized) {
    throw new TypeError(`${fieldName}은(는) 비어 있을 수 없습니다.`);
  }

  if (normalized.length > maxLength) {
    throw new RangeError(`${fieldName}은(는) ${maxLength}자 이하여야 합니다.`);
  }

  return normalized;
}

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function requireDateTime(value: string, fieldName: string) {
  const timestamp = Date.parse(value);

  if (!value.trim() || Number.isNaN(timestamp)) {
    throw new TypeError(`${fieldName} 형식이 올바르지 않습니다.`);
  }

  return new Date(timestamp).toISOString();
}

function normalizeOptionalDateTime(
  value: string | null | undefined,
  fieldName: string,
) {
  const normalized = normalizeOptionalText(value);

  if (!normalized) {
    return null;
  }

  const timestamp = Date.parse(normalized);

  if (Number.isNaN(timestamp)) {
    throw new TypeError(`${fieldName} 형식이 올바르지 않습니다.`);
  }

  return new Date(timestamp).toISOString();
}

function normalizeApplicationUrl(value: string | null | undefined) {
  const normalized = normalizeOptionalText(value);

  if (!normalized) {
    return null;
  }

  let url: URL;

  try {
    url = new URL(normalized);
  } catch {
    throw new TypeError("신청 링크 형식이 올바르지 않습니다.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new TypeError("신청 링크는 HTTP 또는 HTTPS 주소여야 합니다.");
  }

  return url.toString();
}

export function normalizeSeminarEventValues(
  values: SeminarEventValues,
): NormalizedSeminarEventValues {
  const title = requireText(values.title, "행사명", 200);
  const topic = requireText(values.topic, "주제", 200);
  const location = requireText(values.location, "장소", 300);
  const startsAt = requireDateTime(values.startsAt, "시작 일시");
  const endsAt = normalizeOptionalDateTime(values.endsAt, "종료 일시");
  const registrationDeadline = normalizeOptionalDateTime(
    values.registrationDeadline,
    "접수 마감일",
  );
  const caption = values.caption?.trim() ?? "";

  if (caption.length > 200) {
    throw new RangeError("캡션은 200자 이하여야 합니다.");
  }

  if (endsAt && Date.parse(endsAt) < Date.parse(startsAt)) {
    throw new RangeError("종료 일시는 시작 일시보다 빠를 수 없습니다.");
  }

  if (
    registrationDeadline &&
    Date.parse(registrationDeadline) > Date.parse(startsAt)
  ) {
    throw new RangeError("접수 마감일은 시작 일시보다 늦을 수 없습니다.");
  }

  const capacity = values.capacity ?? null;

  if (
    capacity !== null &&
    (!Number.isInteger(capacity) || capacity <= 0)
  ) {
    throw new RangeError("신청 인원은 1 이상의 정수여야 합니다.");
  }

  return {
    applicationMethod: normalizeOptionalText(values.applicationMethod),
    applicationUrl: normalizeApplicationUrl(values.applicationUrl),
    capacity,
    caption,
    content: values.content ?? "",
    endsAt,
    isPinned: values.isPinned ?? false,
    isPublished: values.isPublished ?? false,
    location,
    publishedAt: normalizeOptionalDateTime(values.publishedAt, "게시일"),
    registrationDeadline,
    startsAt,
    tags: normalizeTags(values.tags),
    thumbnailPath: normalizeOptionalText(values.thumbnailPath),
    title,
    topic,
  };
}
