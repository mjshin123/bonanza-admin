import { mutationOptions } from "@tanstack/react-query";
import { type PostFileDto } from "@entities/post";
import {
  mapFile,
  normalizeFileItems,
  normalizePublishedAt,
  requireExpectedUpdatedAt,
  requireText,
  requireUuid,
  throwContentError,
  type ContentStatus,
  type PostCategory,
  type PostFileRole,
} from "@shared/api/content";
import { supabase } from "@shared/api/supabase";
import type {
  Json,
  Tables,
  TablesInsert,
  TablesUpdate,
} from "@shared/api/supabase";

export type SavePostFileInput = {
  fileId: string;
  role: PostFileRole;
  showInGallery?: boolean;
};

export type CreateContentPostInput = {
  category: PostCategory;
  title: string;
  content: string;
  institutionId?: string | null;
  status?: ContentStatus;
  isPinned?: boolean;
  publishedAt?: string | null;
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
    throw new TypeError("공지사항과 협회소식에는 기관을 연결할 수 없습니다.");
}
export function buildContentPostCommand(input: CreateContentPostInput) {
  validateInstitution(input.category, input.institutionId);
  const status = input.status ?? "draft";
  const command = {
    category: input.category,
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
  } satisfies Json;
  return { command, files: normalizeFileItems(input.files ?? []) };
}
async function createContentPost(
  input: CreateContentPostInput,
): Promise<string> {
  const { command, files } = buildContentPostCommand(input);
  const { data, error } = await supabase
    .rpc("save_content_post", { p_input: command, p_files: files })
    .single();
  if (error) throwContentError(error);
  return (data as Tables<"posts">).id;
}
async function updateContentPost(
  input: UpdateContentPostInput,
): Promise<string> {
  const { command, files } = buildContentPostCommand(input);
  const { data, error } = await supabase
    .rpc("save_content_post", {
      p_expected_updated_at: requireExpectedUpdatedAt(input.expectedUpdatedAt),
      p_files: files,
      p_id: requireUuid(input.id),
      p_input: command,
    })
    .single();
  if (error) throwContentError(error);
  return (data as Tables<"posts">).id;
}
async function deleteContentPost(id: string) {
  const { data, error } = await supabase
    .from("posts")
    .delete()
    .eq("id", requireUuid(id))
    .select("id")
    .single();
  if (error) throwContentError(error);
  return data.id;
}
async function bulkHideContentPosts(ids: string[]) {
  const normalized = ids.map((id) => requireUuid(id));
  const { error } = await supabase
    .from("posts")
    .update({ status: "hidden" })
    .in("id", normalized);
  if (error) throwContentError(error);
  return normalized;
}
async function bulkPublishContentPosts(ids: string[]) {
  const normalized = ids.map((id) => requireUuid(id));
  const { data: rows, error: fetchError } = await supabase
    .from("posts")
    .select("id, published_at")
    .in("id", normalized);
  if (fetchError) throwContentError(fetchError);
  const needsPublishedAt = (rows ?? [])
    .filter((row) => !row.published_at)
    .map((row) => row.id);
  const hasPublishedAt = (rows ?? [])
    .filter((row) => row.published_at)
    .map((row) => row.id);
  if (needsPublishedAt.length) {
    const { error } = await supabase
      .from("posts")
      .update({ status: "published", published_at: new Date().toISOString() })
      .in("id", needsPublishedAt);
    if (error) throwContentError(error);
  }
  if (hasPublishedAt.length) {
    const { error } = await supabase
      .from("posts")
      .update({ status: "published" })
      .in("id", hasPublishedAt);
    if (error) throwContentError(error);
  }
  return normalized;
}
async function bulkDeleteContentPosts(ids: string[]) {
  const normalized = ids.map((id) => requireUuid(id));
  const { error } = await supabase.from("posts").delete().in("id", normalized);
  if (error) throwContentError(error);
  return normalized;
}
function mapRelation(
  row: Tables<"post_files"> & { file: Tables<"files"> },
): PostFileDto {
  return {
    file: mapFile(row.file),
    role: row.role as PostFileRole,
    showInGallery: row.show_in_gallery,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}
async function linkPostFile(input: LinkPostFileInput) {
  const insert = {
    post_id: requireUuid(input.postId),
    file_id: requireUuid(input.fileId),
    role: input.role,
    show_in_gallery: input.showInGallery ?? false,
    sort_order: input.sortOrder ?? 0,
  } as TablesInsert<"post_files">;
  const { data, error } = await supabase
    .from("post_files")
    .insert(insert)
    .select("*,file:files!inner(*)")
    .single();
  if (error) throwContentError(error);
  return mapRelation(data as Tables<"post_files"> & { file: Tables<"files"> });
}
async function updatePostFile(input: UpdatePostFileInput) {
  const patch: TablesUpdate<"post_files"> = {};
  if (input.role !== undefined) patch.role = input.role;
  if (input.showInGallery !== undefined)
    patch.show_in_gallery = input.showInGallery;
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;
  const { data, error } = await supabase
    .from("post_files")
    .update(patch)
    .eq("post_id", requireUuid(input.postId))
    .eq("file_id", requireUuid(input.fileId))
    .select("*,file:files!inner(*)")
    .single();
  if (error) throwContentError(error);
  return mapRelation(data as Tables<"post_files"> & { file: Tables<"files"> });
}
async function reorderPostFiles(input: ReorderPostFilesInput) {
  const postId = requireUuid(input.postId);
  const ids = [...input.items]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item) => requireUuid(item.fileId));
  const { error } = await supabase.rpc("reorder_content_files", {
    p_relation: "post_files",
    p_parent_id: postId,
    p_file_ids: ids,
  });
  if (error) throwContentError(error);
  const { data, error: fetchError } = await supabase
    .from("post_files")
    .select("*,file:files!inner(*)")
    .eq("post_id", postId)
    .not("file_id", "is", null)
    .order("sort_order")
    .order("created_at")
    .order("file_id");
  if (fetchError) throw fetchError;
  return data.map((row) =>
    mapRelation(row as Tables<"post_files"> & { file: Tables<"files"> }),
  );
}
async function unlinkPostFile(input: UnlinkPostFileInput) {
  const { data, error } = await supabase
    .from("post_files")
    .delete()
    .eq("post_id", requireUuid(input.postId))
    .eq("file_id", requireUuid(input.fileId))
    .select("file_id")
    .single();
  if (error) throwContentError(error);
  return data.file_id!;
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
