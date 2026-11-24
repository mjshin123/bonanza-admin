import { mutationOptions } from "@tanstack/react-query";
import { type PostFileDto } from "@entities/post";
import {
  normalizeFileItems,
  normalizePublishedAt,
  requireExpectedUpdatedAt,
  requireText,
  requireUuid,
  type ContentStatus,
  type PostCategory,
  type PostFileRole,
} from "@shared/api/content";
import type { Json } from "@shared/api/supabase";

export type SavePostFileInput = {
  fileId: string;
  role: PostFileRole;
  showInGallery?: boolean;
};

export type CreateContentPostInput = {
  affiliate?: string | null;
  category: PostCategory;
  title: string;
  content: string;
  institutionId?: string | null;
  status?: ContentStatus;
  isPinned?: boolean;
  publishedAt?: string | null;
  sourceUrl?: string | null;
  titleEn?: string | null;
  contentEn?: string | null;
  files?: SavePostFileInput[];
};
export type UpdateContentPostInput = Required<CreateContentPostInput> & {
  id: string;
  expectedUpdatedAt: string;
};
export type CreatePostInput = CreateContentPostInput;
export type UpdatePostInput = UpdateContentPostInput;
export type LinkPostFileInput = {
  postId: string;
  fileId: string;
  role: PostFileRole;
  showInGallery?: boolean;
  sortOrder?: number;
};
export type UpdatePostFileInput = {
  postId: string;
  fileId: string;
  role?: PostFileRole;
  showInGallery?: boolean;
  sortOrder?: number;
};
export type ReorderPostFilesInput = {
  postId: string;
  items: Array<{ fileId: string; sortOrder: number }>;
};
export type UnlinkPostFileInput = { postId: string; fileId: string };
function validateInstitution(
  category: PostCategory | undefined,
  institutionId: string | null | undefined,
) {
  if (category === "member_news" && !institutionId)
    throw new TypeError("회원기관 소식에는 institutionId가 필요합니다.");
  if (category && category !== "member_news" && institutionId)
    throw new TypeError("공지사항과 보도자료에는 기관을 연결할 수 없습니다.");
}

function normalizePressSourceUrl(
  category: PostCategory,
  value: string | null | undefined,
) {
  const sourceUrl = value?.trim() || null;
  if (!sourceUrl) return null;
  if (category !== "association_news")
    throw new TypeError("기사 원문 링크는 보도자료에만 입력할 수 있습니다.");
  let url: URL;
  try {
    url = new URL(sourceUrl);
  } catch {
    throw new TypeError("기사 원문 링크는 올바른 URL이어야 합니다.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:")
    throw new TypeError("기사 원문 링크는 http 또는 https 주소여야 합니다.");
  return url.href;
}

function normalizeAffiliate(
  category: PostCategory,
  value: string | null | undefined,
) {
  const affiliate = value?.trim() || null;
  if (category === "association_news" && !affiliate)
    throw new TypeError("보도자료에는 계열사가 필요합니다.");
  if (category !== "association_news" && affiliate)
    throw new TypeError("계열사는 보도자료에만 입력할 수 있습니다.");
  return affiliate;
}

export function buildContentPostCommand(input: CreateContentPostInput) {
  validateInstitution(input.category, input.institutionId);
  const affiliate = normalizeAffiliate(input.category, input.affiliate);
  const sourceUrl = normalizePressSourceUrl(input.category, input.sourceUrl);
  const status = input.status ?? "draft";
  const command = {
    category: input.category,
    affiliate,
    title: requireText(input.title, "title", 200),
    content: input.content,
    institutionId:
      input.category === "member_news"
        ? requireUuid(input.institutionId!, "institutionId")
        : null,
    status,
    isPinned: input.isPinned ?? false,
    publishedAt:
      normalizePublishedAt(status, input.publishedAt) ??
      new Date().toISOString(),
    sourceUrl,
  } satisfies Json;
  return { command, files: normalizeFileItems(input.files ?? []) };
}
async function createContentPost(
  input: CreateContentPostInput,
): Promise<string> {
  buildContentPostCommand(input);
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}
async function updateContentPost(
  input: UpdateContentPostInput,
): Promise<string> {
  buildContentPostCommand(input);
  requireExpectedUpdatedAt(input.expectedUpdatedAt);
  requireUuid(input.id);
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}
async function deleteContentPost(id: string): Promise<string> {
  requireUuid(id);
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}
async function bulkHideContentPosts(ids: string[]): Promise<string[]> {
  ids.map((id) => requireUuid(id));
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}
async function bulkPublishContentPosts(ids: string[]): Promise<string[]> {
  ids.map((id) => requireUuid(id));
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}
async function bulkSetContentPostPinned(input: {
  ids: string[];
  isPinned: boolean;
}): Promise<string[]> {
  input.ids.map((id) => requireUuid(id));
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}
async function bulkDeleteContentPosts(ids: string[]): Promise<string[]> {
  ids.map((id) => requireUuid(id));
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}
async function linkPostFile(input: LinkPostFileInput): Promise<PostFileDto> {
  requireUuid(input.postId);
  requireUuid(input.fileId);
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}
async function updatePostFile(
  input: UpdatePostFileInput,
): Promise<PostFileDto> {
  requireUuid(input.postId);
  requireUuid(input.fileId);
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}
async function reorderPostFiles(
  input: ReorderPostFilesInput,
): Promise<PostFileDto[]> {
  requireUuid(input.postId);
  for (const item of input.items) requireUuid(item.fileId);
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}
async function unlinkPostFile(input: UnlinkPostFileInput): Promise<string> {
  requireUuid(input.postId);
  const fileId = requireUuid(input.fileId);
  void fileId;
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}
export const createContentPostMutationOptions = () =>
  mutationOptions({
    mutationKey: ["content-posts", "create"],
    mutationFn: createContentPost,
  });
export const updateContentPostMutationOptions = () =>
  mutationOptions({
    mutationKey: ["content-posts", "update"],
    mutationFn: updateContentPost,
  });
export const deleteContentPostMutationOptions = () =>
  mutationOptions({
    mutationKey: ["content-posts", "delete"],
    mutationFn: deleteContentPost,
  });
export const bulkHideContentPostsMutationOptions = () =>
  mutationOptions({
    mutationKey: ["content-posts", "bulk-hide"],
    mutationFn: bulkHideContentPosts,
  });
export const bulkPublishContentPostsMutationOptions = () =>
  mutationOptions({
    mutationKey: ["content-posts", "bulk-publish"],
    mutationFn: bulkPublishContentPosts,
  });
export const bulkSetContentPostPinnedMutationOptions = () =>
  mutationOptions({
    mutationKey: ["content-posts", "bulk-set-pinned"],
    mutationFn: bulkSetContentPostPinned,
  });
export const bulkDeleteContentPostsMutationOptions = () =>
  mutationOptions({
    mutationKey: ["content-posts", "bulk-delete"],
    mutationFn: bulkDeleteContentPosts,
  });
export const createPostMutationOptions = createContentPostMutationOptions;
export const updatePostMutationOptions = updateContentPostMutationOptions;
export const deletePostMutationOptions = deleteContentPostMutationOptions;
export const linkPostFileMutationOptions = () =>
  mutationOptions({
    mutationKey: ["content-posts", "file", "link"],
    mutationFn: linkPostFile,
  });
export const updatePostFileMutationOptions = () =>
  mutationOptions({
    mutationKey: ["content-posts", "file", "update"],
    mutationFn: updatePostFile,
  });
export const reorderPostFilesMutationOptions = () =>
  mutationOptions({
    mutationKey: ["content-posts", "file", "reorder"],
    mutationFn: reorderPostFiles,
  });
export const unlinkPostFileMutationOptions = () =>
  mutationOptions({
    mutationKey: ["content-posts", "file", "unlink"],
    mutationFn: unlinkPostFile,
  });
