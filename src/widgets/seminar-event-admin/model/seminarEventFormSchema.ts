import { z } from "zod";

import type { SeminarEventFormState } from "./seminarEventForm";

const OPTIONAL_DATE_TIME_SCHEMA = z.string().refine(
  (value) => !value || !Number.isNaN(Date.parse(value)),
  "날짜와 시간 형식이 올바르지 않습니다.",
);

const TAGS_SCHEMA = z
  .array(z.string().trim().min(1).max(30, "태그는 각각 30자 이하여야 합니다."))
  .max(10, "태그는 최대 10개까지 선택할 수 있습니다.");

function isHttpUrl(value: string) {
  if (!value) {
    return true;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export const seminarEventFormSchema: z.ZodType<
  SeminarEventFormState,
  SeminarEventFormState
> = z
  .object({
    applicationMethod: z.string(),
    applicationUrl: z
      .string()
      .trim()
      .refine(
        isHttpUrl,
        "신청 링크는 올바른 HTTP/HTTPS 주소여야 합니다.",
      ),
    capacity: z.string().refine(
      (value) =>
        !value || (/^\d+$/.test(value) && Number(value) > 0),
      "신청 인원은 1 이상의 정수여야 합니다.",
    ),
    caption: z
      .string()
      .trim()
      .max(200, "캡션은 200자 이하여야 합니다."),
    content: z.string(),
    endsAt: OPTIONAL_DATE_TIME_SCHEMA,
    isPinned: z.boolean(),
    isPublished: z.boolean(),
    location: z
      .string()
      .trim()
      .min(1, "장소를 입력해주세요.")
      .max(300, "장소는 300자 이하여야 합니다."),
    registrationDeadline: OPTIONAL_DATE_TIME_SCHEMA,
    startsAt: z
      .string()
      .min(1, "시작 일시를 입력해주세요.")
      .refine(
        (value) => !Number.isNaN(Date.parse(value)),
        "시작 일시 형식이 올바르지 않습니다.",
      ),
    tags: TAGS_SCHEMA,
    title: z
      .string()
      .trim()
      .min(1, "행사명을 입력해주세요.")
      .max(200, "행사명은 200자 이하여야 합니다."),
    topic: z
      .string()
      .trim()
      .min(1, "주제를 입력해주세요.")
      .max(200, "주제는 200자 이하여야 합니다."),
  })
  .superRefine((values, context) => {
    const startsAt = Date.parse(values.startsAt);

    if (values.endsAt && Date.parse(values.endsAt) < startsAt) {
      context.addIssue({
        code: "custom",
        message: "종료 일시는 시작 일시보다 빠를 수 없습니다.",
        path: ["endsAt"],
      });
    }

    if (
      values.registrationDeadline &&
      Date.parse(values.registrationDeadline) > startsAt
    ) {
      context.addIssue({
        code: "custom",
        message: "접수 마감일은 시작 일시보다 늦을 수 없습니다.",
        path: ["registrationDeadline"],
      });
    }
  });
