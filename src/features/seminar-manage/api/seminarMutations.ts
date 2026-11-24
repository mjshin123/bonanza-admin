import { mutationOptions } from "@tanstack/react-query";
import type { SeminarDetail, SeminarFileDto } from "@entities/seminar";
import {
  normalizeFileItems,
  normalizePublishedAt,
  requireExpectedUpdatedAt,
  requireText,
  requireUuid,
  type ContentStatus,
} from "@shared/api/content";
import type { Json } from "@shared/api/supabase";
export type SaveSeminarFileInput = {
  fileId: string;
  showInGallery?: boolean;
};
export type CreateSeminarInput = {
  title: string;
  introduction?: string;
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
async function createSeminar(i: CreateSeminarInput): Promise<SeminarDetail> {
  normalizeFileItems(i.files ?? []);
  buildSeminarCommand(i);
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}
async function updateSeminar(i: UpdateSeminarInput): Promise<SeminarDetail> {
  normalizeFileItems(i.files);
  requireExpectedUpdatedAt(i.expectedUpdatedAt);
  requireUuid(i.id);
  buildSeminarCommand(i);
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}
async function deleteSeminar(id: string): Promise<string> {
  requireUuid(id);
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}
async function bulkHideSeminars(ids: string[]): Promise<string[]> {
  ids.map((id) => requireUuid(id));
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}
async function bulkPublishSeminars(ids: string[]): Promise<string[]> {
  ids.map((id) => requireUuid(id));
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}
async function bulkDeleteSeminars(ids: string[]): Promise<string[]> {
  ids.map((id) => requireUuid(id));
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}
async function linkSeminarFile(
  i: LinkSeminarFileInput,
): Promise<SeminarFileDto> {
  requireUuid(i.seminarId);
  requireUuid(i.fileId);
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}
async function updateSeminarFile(
  i: UpdateSeminarFileInput,
): Promise<SeminarFileDto> {
  requireUuid(i.seminarId);
  requireUuid(i.fileId);
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}
async function reorderSeminarFiles(
  i: ReorderSeminarFilesInput,
): Promise<SeminarFileDto[]> {
  requireUuid(i.seminarId);
  for (const item of i.items) requireUuid(item.fileId);
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}
async function unlinkSeminarFile(i: UnlinkSeminarFileInput): Promise<string> {
  requireUuid(i.seminarId);
  const fileId = requireUuid(i.fileId);
  void fileId;
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
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
export const bulkPublishSeminarsMutationOptions = () =>
  mutationOptions({
    mutationKey: ["seminars", "bulk-publish"],
    mutationFn: bulkPublishSeminars,
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
