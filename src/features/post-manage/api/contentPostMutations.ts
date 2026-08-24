import { mutationOptions } from "@tanstack/react-query";
import {
  mapContentPost,
  type ContentPostDetail,
  type PostFileDto,
} from "@entities/post";
import {
  mapFile,
  normalizePublishedAt,
  optionalText,
  requireText,
  requireUuid,
  throwContentError,
  type ContentStatus,
  type PostCategory,
  type PostFileRole,
} from "@shared/api/content";
import { supabase } from "@shared/api/supabase";
import type { Tables, TablesInsert, TablesUpdate } from "@shared/api/supabase";

export type CreateContentPostInput = {
  category: PostCategory;
  title: string;
  summary?: string;
  content: string;
  institutionId?: string | null;
  status?: ContentStatus;
  isPinned?: boolean;
  publishedAt?: string | null;
};
export type UpdateContentPostInput = Partial<
  Omit<CreateContentPostInput, "category">
> & { id: string; category?: PostCategory };
export type CreatePostInput = CreateContentPostInput;
export type UpdatePostInput = UpdateContentPostInput;
export type LinkPostFileInput = {
  postId: string;
  fileId: string;
  role: PostFileRole;
  sortOrder?: number;
};
export type UpdatePostFileInput = {
  postId: string;
  fileId: string;
  role?: PostFileRole;
  sortOrder?: number;
};
export type ReorderPostFilesInput = {
  postId: string;
  items: Array<{ fileId: string; sortOrder: number }>;
};
export type UnlinkPostFileInput = { postId: string; fileId: string };
const SELECT =
  "*, institution:institutions(category:institution_categories!inner(*),logo:files(*)), files:post_files(*,file:files(*))";
type Joined = Tables<"posts"> & {
  institution:
    | (Tables<"institutions"> & {
        category: Tables<"institution_categories">;
        logo: Tables<"files"> | null;
      })
    | null;
  files: Array<Tables<"post_files"> & { file: Tables<"files"> | null }>;
};

function payload(
  input: Partial<CreateContentPostInput>,
): TablesUpdate<"posts"> {
  const result: TablesUpdate<"posts"> = {};
  if (input.category !== undefined) result.category = input.category;
  if (input.title !== undefined)
    result.title = requireText(input.title, "title", 200);
  if (input.summary !== undefined)
    result.summary = optionalText(input.summary, "summary", 500);
  if (input.content !== undefined) result.content = input.content;
  if (input.institutionId !== undefined)
    result.institution_id =
      input.institutionId === null
        ? null
        : requireUuid(input.institutionId, "institutionId");
  if (input.status !== undefined) result.status = input.status;
  if (input.isPinned !== undefined) result.is_pinned = input.isPinned;
  const publishedAt = normalizePublishedAt(input.status, input.publishedAt);
  if (publishedAt !== undefined) result.published_at = publishedAt;
  return result;
}
function validateInstitution(
  category: PostCategory | undefined,
  institutionId: string | null | undefined,
) {
  if (category === "member_news" && !institutionId)
    throw new TypeError("회원기관 소식에는 institutionId가 필요합니다.");
  if (category && category !== "member_news" && institutionId)
    throw new TypeError("공지사항과 협회소식에는 기관을 연결할 수 없습니다.");
}
async function createContentPost(
  input: CreateContentPostInput,
): Promise<ContentPostDetail> {
  validateInstitution(input.category, input.institutionId);
  const insert = payload(input) as TablesInsert<"posts">;
  if (input.category !== "member_news") insert.institution_id = null;
  const { data, error } = await supabase
    .from("posts")
    .insert(insert)
    .select(SELECT)
    .single();
  if (error) throwContentError(error);
  return mapContentPost(data as Joined);
}
async function updateContentPost(
  input: UpdateContentPostInput,
): Promise<ContentPostDetail> {
  validateInstitution(input.category, input.institutionId);
  const { id, ...patch } = input;
  const updatePayload = payload(patch);
  if (patch.category && patch.category !== "member_news") {
    updatePayload.institution_id = null;
  }
  const { data, error } = await supabase
    .from("posts")
    .update(updatePayload)
    .eq("id", requireUuid(id))
    .select(SELECT)
    .single();
  if (error) throwContentError(error);
  return mapContentPost(data as Joined);
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
function mapRelation(
  row: Tables<"post_files"> & { file: Tables<"files"> },
): PostFileDto {
  return {
    file: mapFile(row.file),
    role: row.role as PostFileRole,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}
async function linkPostFile(input: LinkPostFileInput) {
  const insert = {
    post_id: requireUuid(input.postId),
    file_id: requireUuid(input.fileId),
    role: input.role,
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
    mutationKey: ["posts", "create"],
    mutationFn: createContentPost,
  });
export const updateContentPostMutationOptions = () =>
  mutationOptions({
    mutationKey: ["posts", "update"],
    mutationFn: updateContentPost,
  });
export const deleteContentPostMutationOptions = () =>
  mutationOptions({
    mutationKey: ["posts", "delete"],
    mutationFn: deleteContentPost,
  });
export const createPostMutationOptions = createContentPostMutationOptions;
export const updatePostMutationOptions = updateContentPostMutationOptions;
export const deletePostMutationOptions = deleteContentPostMutationOptions;
export const linkPostFileMutationOptions = () =>
  mutationOptions({
    mutationKey: ["posts", "file", "link"],
    mutationFn: linkPostFile,
  });
export const updatePostFileMutationOptions = () =>
  mutationOptions({
    mutationKey: ["posts", "file", "update"],
    mutationFn: updatePostFile,
  });
export const reorderPostFilesMutationOptions = () =>
  mutationOptions({
    mutationKey: ["posts", "file", "reorder"],
    mutationFn: reorderPostFiles,
  });
export const unlinkPostFileMutationOptions = () =>
  mutationOptions({
    mutationKey: ["posts", "file", "unlink"],
    mutationFn: unlinkPostFile,
  });
