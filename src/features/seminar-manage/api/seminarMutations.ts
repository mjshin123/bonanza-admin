import { mutationOptions } from "@tanstack/react-query";
import { mapSeminar, type SeminarFileDto } from "@entities/seminar";
import {
  mapFile,
  normalizePublishedAt,
  requireText,
  requireUuid,
  throwContentError,
  type ContentStatus,
  type SelectionMethod,
  type SeminarFileRole,
} from "@shared/api/content";
import { supabase } from "@shared/api/supabase";
import type { Tables, TablesInsert, TablesUpdate } from "@shared/api/supabase";
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
};
export type UpdateSeminarInput = Partial<CreateSeminarInput> & { id: string };
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
function payload(i: Partial<CreateSeminarInput>): TablesUpdate<"seminars"> {
  const p: TablesUpdate<"seminars"> = {};
  if (i.title !== undefined) p.title = requireText(i.title, "title", 200);
  if (i.introduction !== undefined) p.introduction = i.introduction;
  if (i.resultSummary !== undefined) p.result_summary = i.resultSummary;
  if (i.content !== undefined) p.content = i.content;
  if (i.startsAt !== undefined)
    p.starts_at = validDate(i.startsAt, "startsAt")!;
  if (i.endsAt !== undefined) p.ends_at = validDate(i.endsAt, "endsAt");
  if (i.location !== undefined)
    p.location = requireText(i.location, "location", 300);
  if (i.selectionMethod !== undefined) p.selection_method = i.selectionMethod;
  if (i.selectionMethodDetail !== undefined)
    p.selection_method_detail = i.selectionMethodDetail;
  if (i.capacity !== undefined) {
    if (
      i.capacity !== null &&
      (!Number.isInteger(i.capacity) || i.capacity < 1)
    )
      throw new RangeError("capacity는 1 이상의 정수여야 합니다.");
    p.capacity = i.capacity;
  }
  if (i.registrationDeadline !== undefined)
    p.registration_deadline = validDate(
      i.registrationDeadline,
      "registrationDeadline",
    );
  if (i.applicationUrl !== undefined) p.application_url = i.applicationUrl;
  if (i.status !== undefined) p.status = i.status;
  const at = normalizePublishedAt(i.status, i.publishedAt);
  if (at !== undefined) p.published_at = at;
  return p;
}
async function createSeminar(i: CreateSeminarInput) {
  const { data, error } = await supabase
    .from("seminars")
    .insert(payload(i) as TablesInsert<"seminars">)
    .select(SELECT)
    .single();
  if (error) throwContentError(error);
  return mapSeminar(data as Joined);
}
async function updateSeminar(i: UpdateSeminarInput) {
  const { id, ...patch } = i,
    { data, error } = await supabase
      .from("seminars")
      .update(payload(patch))
      .eq("id", requireUuid(id))
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
