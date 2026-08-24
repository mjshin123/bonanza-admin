import type { LegacyAdminPostListItem } from "@entities/post";

export type GeneralPostFormState = {
  caption: string;
  content: string;
  isPinned: boolean;
  isPublished: boolean;
  organizationId: string;
  tags: string[];
  title: string;
};

export type GeneralPostMode =
  "gallery" | "member-news" | "resource" | "standard";

export const EMPTY_GENERAL_POST_FORM: GeneralPostFormState = {
  caption: "",
  content: "",
  isPinned: false,
  isPublished: false,
  organizationId: "",
  tags: [],
  title: "",
};

const RESOURCE_BOARD_CODES = new Set([
  "seminar_resource",
  "policy_resource",
  "financial_disclosure",
]);

export function resolveGeneralPostMode(boardCode: string): GeneralPostMode {
  if (boardCode === "member_news") {
    return "member-news";
  }

  if (boardCode === "gallery") {
    return "gallery";
  }

  if (RESOURCE_BOARD_CODES.has(boardCode)) {
    return "resource";
  }

  return "standard";
}

export function postToGeneralForm(
  post: LegacyAdminPostListItem,
): GeneralPostFormState {
  return {
    caption: post.caption,
    content: post.content,
    isPinned: post.is_pinned,
    isPublished: post.is_published,
    organizationId: post.organization_id ?? "",
    tags: post.tags,
    title: post.title,
  };
}

export function formatPostDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
