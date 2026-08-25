import { z } from "zod";

import { hasMeaningfulPostContent } from "@entities/post";

import type {
  GeneralPostFormState,
  GeneralPostMode,
} from "./generalPostForm";

const TAGS_SCHEMA = z
  .array(z.string().trim().min(1).max(30, "태그는 각각 30자 이하여야 합니다."))
  .max(10, "태그는 최대 10개까지 선택할 수 있습니다.");

export function createGeneralPostFormSchema(
  mode: GeneralPostMode,
): z.ZodType<GeneralPostFormState, GeneralPostFormState> {
  return z
    .object({
      content: z.string(),
      isPinned: z.boolean(),
      isPublished: z.boolean(),
      organizationId: z.string(),
      tags: TAGS_SCHEMA,
      title: z
        .string()
        .trim()
        .min(1, "제목을 입력해주세요.")
        .max(200, "제목은 200자 이하여야 합니다."),
    })
    .superRefine((values, context) => {
      if (
        mode !== "gallery" &&
        mode !== "resource" &&
        !hasMeaningfulPostContent(values.content)
      ) {
        context.addIssue({
          code: "custom",
          message: "본문을 입력해주세요.",
          path: ["content"],
        });
      }

      if (mode === "member-news" && !values.organizationId) {
        context.addIssue({
          code: "custom",
          message: "회원사를 선택해주세요.",
          path: ["organizationId"],
        });
      }
    });
}
