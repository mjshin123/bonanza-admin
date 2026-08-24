import { mutationOptions } from "@tanstack/react-query";
import {
  mapResource,
  type ResourceDetail,
  type ResourceFileDto,
} from "@entities/resource";
import {
  ContentApiError,
  mapFile,
  normalizePublishedAt,
  optionalText,
  requireText,
  requireUuid,
  throwContentError,
  type ContentStatus,
  type ResourceCategory,
} from "@shared/api/content";
import { supabase } from "@shared/api/supabase";
import type { Tables, TablesInsert, TablesUpdate } from "@shared/api/supabase";

export type CreateResourceInput = {
  category: ResourceCategory;
  title: string;
  summary?: string;
  referenceYear?: number | null;
  status?: Exclude<ContentStatus, "published">;
  publishedAt?: string | null;
};
export type UpdateResourceInput = Partial<
  Omit<CreateResourceInput, "status">
> & { id: string; status?: ContentStatus };
export type LinkResourceFileInput = {
  resourceId: string;
  fileId: string;
  sortOrder?: number;
};
export type UpdateResourceFileInput = {
  resourceId: string;
  fileId: string;
  sortOrder: number;
};
export type ReorderResourceFilesInput = {
  resourceId: string;
  items: Array<{ fileId: string; sortOrder: number }>;
};
export type UnlinkResourceFileInput = { resourceId: string; fileId: string };
const SELECT = "*, files:resource_files(*,file:files!inner(*))";
type Joined = Tables<"resources"> & {
  files: Array<Tables<"resource_files"> & { file: Tables<"files"> }>;
};
function payload(
  input: Partial<Omit<CreateResourceInput, "status">> & {
    status?: ContentStatus;
  },
): TablesUpdate<"resources"> {
  const p: TablesUpdate<"resources"> = {};
  if (input.category !== undefined) p.category = input.category;
  if (input.title !== undefined)
    p.title = requireText(input.title, "title", 200);
  if (input.summary !== undefined)
    p.summary = optionalText(input.summary, "summary", 500);
  if (input.referenceYear !== undefined) {
    if (
      input.referenceYear !== null &&
      (!Number.isInteger(input.referenceYear) ||
        input.referenceYear < 1900 ||
        input.referenceYear > 2100)
    )
      throw new RangeError("referenceYear는 1900~2100 정수여야 합니다.");
    p.reference_year = input.referenceYear;
  }
  if (input.status !== undefined) p.status = input.status;
  const publishedAt = normalizePublishedAt(input.status, input.publishedAt);
  if (publishedAt !== undefined) p.published_at = publishedAt;
  return p;
}
async function createResource(
  input: CreateResourceInput,
): Promise<ResourceDetail> {
  const { data, error } = await supabase
    .from("resources")
    .insert(payload(input) as TablesInsert<"resources">)
    .select(SELECT)
    .single();
  if (error) throwContentError(error);
  return mapResource(data as Joined);
}
async function updateResource(
  input: UpdateResourceInput,
): Promise<ResourceDetail> {
  const { id, ...patch } = input;
  const { data, error } = await supabase
    .from("resources")
    .update(payload(patch))
    .eq("id", requireUuid(id))
    .select(SELECT)
    .single();
  if (error) throwContentError(error);
  return mapResource(data as Joined);
}
async function deleteResource(id: string) {
  const { data, error } = await supabase
    .from("resources")
    .delete()
    .eq("id", requireUuid(id))
    .select("id")
    .single();
  if (error) throwContentError(error);
  return data.id;
}
function mapRelation(
  row: Tables<"resource_files"> & { file: Tables<"files"> },
): ResourceFileDto {
  return {
    file: mapFile(row.file),
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}
async function linkResourceFile(input: LinkResourceFileInput) {
  const { data, error } = await supabase
    .from("resource_files")
    .insert({
      resource_id: requireUuid(input.resourceId),
      file_id: requireUuid(input.fileId),
      sort_order: input.sortOrder ?? 0,
    })
    .select("*,file:files!inner(*)")
    .single();
  if (error) throwContentError(error);
  return mapRelation(
    data as Tables<"resource_files"> & { file: Tables<"files"> },
  );
}
async function updateResourceFile(input: UpdateResourceFileInput) {
  if (!Number.isInteger(input.sortOrder) || input.sortOrder < 0)
    throw new RangeError("sortOrder는 0 이상의 정수여야 합니다.");
  const { data, error } = await supabase
    .from("resource_files")
    .update({ sort_order: input.sortOrder })
    .eq("resource_id", requireUuid(input.resourceId))
    .eq("file_id", requireUuid(input.fileId))
    .select("*,file:files!inner(*)")
    .single();
  if (error) throwContentError(error);
  return mapRelation(
    data as Tables<"resource_files"> & { file: Tables<"files"> },
  );
}
async function reorderResourceFiles(input: ReorderResourceFilesInput) {
  const resourceId = requireUuid(input.resourceId);
  const ordered = [...input.items]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((i) => requireUuid(i.fileId));
  const { error } = await supabase.rpc("reorder_content_files", {
    p_relation: "resource_files",
    p_parent_id: resourceId,
    p_file_ids: ordered,
  });
  if (error) throwContentError(error);
  const { data, error: fetchError } = await supabase
    .from("resource_files")
    .select("*,file:files!inner(*)")
    .eq("resource_id", resourceId)
    .order("sort_order")
    .order("created_at")
    .order("file_id");
  if (fetchError) throw fetchError;
  return data.map((r) =>
    mapRelation(r as Tables<"resource_files"> & { file: Tables<"files"> }),
  );
}
async function unlinkResourceFile(input: UnlinkResourceFileInput) {
  const fileId = requireUuid(input.fileId);
  const { data, error } = await supabase
    .from("resource_files")
    .delete()
    .eq("resource_id", requireUuid(input.resourceId))
    .eq("file_id", fileId)
    .select("file_id")
    .single();
  if (error) throwContentError(error);
  if (!data)
    throw new ContentApiError("NOT_FOUND", "연결된 파일을 찾을 수 없습니다.");
  return data.file_id;
}
export const createResourceMutationOptions = () =>
  mutationOptions({
    mutationKey: ["resources", "create"],
    mutationFn: createResource,
  });
export const updateResourceMutationOptions = () =>
  mutationOptions({
    mutationKey: ["resources", "update"],
    mutationFn: updateResource,
  });
export const deleteResourceMutationOptions = () =>
  mutationOptions({
    mutationKey: ["resources", "delete"],
    mutationFn: deleteResource,
  });
export const linkResourceFileMutationOptions = () =>
  mutationOptions({
    mutationKey: ["resources", "file", "link"],
    mutationFn: linkResourceFile,
  });
export const updateResourceFileMutationOptions = () =>
  mutationOptions({
    mutationKey: ["resources", "file", "update"],
    mutationFn: updateResourceFile,
  });
export const reorderResourceFilesMutationOptions = () =>
  mutationOptions({
    mutationKey: ["resources", "file", "reorder"],
    mutationFn: reorderResourceFiles,
  });
export const unlinkResourceFileMutationOptions = () =>
  mutationOptions({
    mutationKey: ["resources", "file", "unlink"],
    mutationFn: unlinkResourceFile,
  });
