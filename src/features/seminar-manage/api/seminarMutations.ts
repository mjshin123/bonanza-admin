import { mutationOptions } from "@tanstack/react-query";
import { mapSeminar, type SeminarFileDto } from "@entities/seminar";
import {
  mapFile,
  normalizeFileItems,
  normalizePublishedAt,
  requireExpectedUpdatedAt,
  requireText,
  requireUuid,
  throwContentError,
  type ContentStatus,
} from "@shared/api/content";
import { supabase } from "@shared/api/supabase";
import type { Json, Tables, TablesUpdate } from "@shared/api/supabase";
export type SaveSeminarFileInput = {
  fileId: string;
  showInGallery?: boolean;
};
export type CreateSeminarInput = {
  title: string;
  introduction?: string;
  resultSummary?: string;
  content?: string | null;
  startsAt: string;
  endsAt?: string | null;
  location?: string | null;
  applicationUrl?: string | null;
  status?: ContentStatus;
  publishedAt?: string | null;
  isFeatured?: boolean;
  files?: SaveSeminarFileInput[];
};
export type UpdateSeminarInput = Required<CreateSeminarInput> & {
  id: string;
  expectedUpdatedAt: string;
};
export type LinkSeminarFileInput = {
  seminarId: string;
  fileId: string;
  showInGallery?: boolean;
  sortOrder?: number;
};
export type UpdateSeminarFileInput = {
  seminarId: string;
  fileId: string;
  showInGallery?: boolean;
  sortOrder?: number;
};
export type ReorderSeminarFilesInput = {
  seminarId: string;
  items: Array<{ fileId: string; sortOrder: number }>;
};
export type UnlinkSeminarFileInput = { seminarId: string; fileId: string };
const SELECT = "*,files:seminar_files(*,file:files!inner(*))";
type Joined = Tables<"seminars"> & {
  files: Array<Tables<"seminar_files"> & { file: Tables<"files"> }>;
};
function validDate(v: string | null | undefined, n: string) {
  if (v != null && Number.isNaN(Date.parse(v)))
    throw new TypeError(`${n}은 유효한 일시여야 합니다.`);
  return v;
}
export function buildSeminarCommand(i: CreateSeminarInput): Json {
  const status = i.status ?? "draft";
  const location = i.location?.trim();
  return {
    title: requireText(i.title, "title", 200),
    introduction: i.introduction ?? "",
    resultSummary: i.resultSummary ?? "",
    content: i.content ?? null,
    startsAt: validDate(i.startsAt, "startsAt")!,
    endsAt: validDate(i.endsAt, "endsAt") ?? null,
    location: location ? requireText(location, "location", 300) : null,
    applicationUrl: i.applicationUrl ?? null,
    status,
    publishedAt: normalizePublishedAt(status, i.publishedAt) ?? null,
    isFeatured: i.isFeatured ?? false,
  };
}
async function createSeminar(i: CreateSeminarInput) {
  const files = normalizeFileItems(i.files ?? []);
  const { data, error } = await supabase
    .rpc("save_seminar", { p_input: buildSeminarCommand(i), p_files: files })
    .select(SELECT)
    .single();
  if (error) throwContentError(error);
  return mapSeminar(data as Joined);
}
async function updateSeminar(i: UpdateSeminarInput) {
  const files = normalizeFileItems(i.files);
  const { data, error } = await supabase
    .rpc("save_seminar", {
      p_expected_updated_at: requireExpectedUpdatedAt(i.expectedUpdatedAt),
      p_files: files,
      p_id: requireUuid(i.id),
      p_input: buildSeminarCommand(i),
    })
    .select(SELECT)
    .single();
  if (error) throwContentError(error);
  return mapSeminar(data as Joined);
}
async function deleteSeminar(id: string) {
  const { data, error } = await supabase
    .from("seminars")
    .delete()
    .eq("id", requireUuid(id))
    .select("id")
    .single();
  if (error) throwContentError(error);
  return data.id;
}
async function bulkHideSeminars(ids: string[]) {
  const normalized = ids.map((id) => requireUuid(id));
  const { error } = await supabase
    .from("seminars")
    .update({ status: "hidden" })
    .in("id", normalized);
  if (error) throwContentError(error);
  return normalized;
}
async function bulkDeleteSeminars(ids: string[]) {
  const normalized = ids.map((id) => requireUuid(id));
  const { error } = await supabase
    .from("seminars")
    .delete()
    .in("id", normalized);
  if (error) throwContentError(error);
  return normalized;
}
function mapRelation(
  r: Tables<"seminar_files"> & { file: Tables<"files"> },
): SeminarFileDto {
  return {
    file: mapFile(r.file),
    showInGallery: r.show_in_gallery,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
  };
}
async function linkSeminarFile(i: LinkSeminarFileInput) {
  const { data, error } = await supabase
    .from("seminar_files")
    .insert({
      seminar_id: requireUuid(i.seminarId),
      file_id: requireUuid(i.fileId),
      role: "photo",
      show_in_gallery: i.showInGallery ?? false,
      sort_order: i.sortOrder ?? 0,
    })
    .select("*,file:files!inner(*)")
    .single();
  if (error) throwContentError(error);
  return mapRelation(
    data as Tables<"seminar_files"> & { file: Tables<"files"> },
  );
}
async function updateSeminarFile(i: UpdateSeminarFileInput) {
  const patch: TablesUpdate<"seminar_files"> = {};
  if (i.showInGallery !== undefined) patch.show_in_gallery = i.showInGallery;
  if (i.sortOrder !== undefined) patch.sort_order = i.sortOrder;
  const { data, error } = await supabase
    .from("seminar_files")
    .update(patch)
    .eq("seminar_id", requireUuid(i.seminarId))
    .eq("file_id", requireUuid(i.fileId))
    .select("*,file:files!inner(*)")
    .single();
  if (error) throwContentError(error);
  return mapRelation(
    data as Tables<"seminar_files"> & { file: Tables<"files"> },
  );
}
async function reorderSeminarFiles(i: ReorderSeminarFilesInput) {
  const id = requireUuid(i.seminarId),
    ids = [...i.items]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((x) => requireUuid(x.fileId));
  const { error } = await supabase.rpc("reorder_content_files", {
    p_relation: "seminar_files",
    p_parent_id: id,
    p_file_ids: ids,
  });
  if (error) throwContentError(error);
  const { data, error: e } = await supabase
    .from("seminar_files")
    .select("*,file:files!inner(*)")
    .eq("seminar_id", id)
    .order("sort_order")
    .order("created_at")
    .order("file_id");
  if (e) throw e;
  return data.map((r) =>
    mapRelation(r as Tables<"seminar_files"> & { file: Tables<"files"> }),
  );
}
async function unlinkSeminarFile(i: UnlinkSeminarFileInput) {
  const { data, error } = await supabase
    .from("seminar_files")
    .delete()
    .eq("seminar_id", requireUuid(i.seminarId))
    .eq("file_id", requireUuid(i.fileId))
    .select("file_id")
    .single();
  if (error) throwContentError(error);
  return data.file_id;
}
export const createSeminarMutationOptions = () =>
  mutationOptions({
    mutationKey: ["seminars", "create"],
    mutationFn: createSeminar,
  });
export const updateSeminarMutationOptions = () =>
  mutationOptions({
    mutationKey: ["seminars", "update"],
    mutationFn: updateSeminar,
  });
export const deleteSeminarMutationOptions = () =>
  mutationOptions({
    mutationKey: ["seminars", "delete"],
    mutationFn: deleteSeminar,
  });
export const bulkHideSeminarsMutationOptions = () =>
  mutationOptions({
    mutationKey: ["seminars", "bulk-hide"],
    mutationFn: bulkHideSeminars,
  });
export const bulkDeleteSeminarsMutationOptions = () =>
  mutationOptions({
    mutationKey: ["seminars", "bulk-delete"],
    mutationFn: bulkDeleteSeminars,
  });
export const linkSeminarFileMutationOptions = () =>
  mutationOptions({
    mutationKey: ["seminars", "file", "link"],
    mutationFn: linkSeminarFile,
  });
export const updateSeminarFileMutationOptions = () =>
  mutationOptions({
    mutationKey: ["seminars", "file", "update"],
    mutationFn: updateSeminarFile,
  });
export const reorderSeminarFilesMutationOptions = () =>
  mutationOptions({
    mutationKey: ["seminars", "file", "reorder"],
    mutationFn: reorderSeminarFiles,
  });
export const unlinkSeminarFileMutationOptions = () =>
  mutationOptions({
    mutationKey: ["seminars", "file", "unlink"],
    mutationFn: unlinkSeminarFile,
  });
