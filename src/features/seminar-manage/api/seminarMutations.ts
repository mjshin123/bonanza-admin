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
  type SelectionMethod,
  type SeminarFileRole,
} from "@shared/api/content";
import { supabase } from "@shared/api/supabase";
import type { Json, Tables, TablesUpdate } from "@shared/api/supabase";
export type SaveSeminarFileInput = { fileId: string; role: SeminarFileRole };
export type CreateSeminarInput = {
  title: string;
  introduction?: string;
  resultSummary?: string;
  content?: string | null;
  startsAt: string;
  endsAt?: string | null;
  location: string;
  selectionMethod: SelectionMethod;
  selectionMethodDetail?: string | null;
  capacity?: number | null;
  registrationDeadline?: string | null;
  applicationUrl?: string | null;
  status?: ContentStatus;
  publishedAt?: string | null;
  files?: SaveSeminarFileInput[];
};
export type UpdateSeminarInput = Required<CreateSeminarInput> & {
  id: string;
  expectedUpdatedAt: string;
};
export type LinkSeminarFileInput = {
  seminarId: string;
  fileId: string;
  role: SeminarFileRole;
  sortOrder?: number;
};
export type UpdateSeminarFileInput = {
  seminarId: string;
  fileId: string;
  role?: SeminarFileRole;
  sortOrder?: number;
};
export type ReorderSeminarFilesInput = {
  seminarId: string;
  role: SeminarFileRole;
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
  if (
    i.capacity !== undefined &&
    i.capacity !== null &&
    (!Number.isInteger(i.capacity) || i.capacity < 1)
  ) {
    throw new RangeError("capacity는 1 이상의 정수여야 합니다.");
  }
  const status = i.status ?? "draft";
  return {
    title: requireText(i.title, "title", 200),
    introduction: i.introduction ?? "",
    resultSummary: i.resultSummary ?? "",
    content: i.content ?? null,
    startsAt: validDate(i.startsAt, "startsAt")!,
    endsAt: validDate(i.endsAt, "endsAt") ?? null,
    location: requireText(i.location, "location", 300),
    selectionMethod: i.selectionMethod,
    selectionMethodDetail: i.selectionMethodDetail ?? null,
    capacity: i.capacity ?? null,
    registrationDeadline:
      validDate(i.registrationDeadline, "registrationDeadline") ?? null,
    applicationUrl: i.applicationUrl ?? null,
    status,
    publishedAt: normalizePublishedAt(status, i.publishedAt) ?? null,
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
function mapRelation(
  r: Tables<"seminar_files"> & { file: Tables<"files"> },
): SeminarFileDto {
  return {
    file: mapFile(r.file),
    role: r.role as SeminarFileRole,
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
      role: i.role,
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
  if (i.role !== undefined) patch.role = i.role;
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
    .eq("role", i.role)
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
