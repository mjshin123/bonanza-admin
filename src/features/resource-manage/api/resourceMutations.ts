import { mutationOptions } from "@tanstack/react-query";
import type { ResourceDetail, ResourceFileDto } from "@entities/resource";
import {
  normalizeFileItems,
  normalizePublishedAt,
  requireExpectedUpdatedAt,
  requireText,
  requireUuid,
  type ContentStatus,
  type ResourceCategory,
} from "@shared/api/content";
import type { Json } from "@shared/api/supabase";

export type SaveResourceFileInput = {
  fileId: string;
  showInGallery?: boolean;
};

export type CreateResourceInput = {
  category: ResourceCategory;
  title: string;
  status?: ContentStatus;
  publishedAt?: string | null;
  files?: SaveResourceFileInput[];
};
export type UpdateResourceInput = Required<CreateResourceInput> & {
  id: string;
  expectedUpdatedAt: string;
};
export type LinkResourceFileInput = {
  resourceId: string;
  fileId: string;
  showInGallery?: boolean;
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
export function buildResourceCommand(input: CreateResourceInput): Json {
  const status = input.status ?? "draft";
  return {
    category: input.category,
    title: requireText(input.title, "title", 200),
    status,
    publishedAt: normalizePublishedAt(status, input.publishedAt) ?? null,
  };
}
async function createResource(
  input: CreateResourceInput,
): Promise<ResourceDetail> {
  normalizeFileItems(input.files ?? []);
  buildResourceCommand(input);
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}
async function updateResource(
  input: UpdateResourceInput,
): Promise<ResourceDetail> {
  normalizeFileItems(input.files);
  requireExpectedUpdatedAt(input.expectedUpdatedAt);
  requireUuid(input.id);
  buildResourceCommand(input);
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}
async function deleteResource(id: string): Promise<string> {
  requireUuid(id);
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}
async function bulkHideResources(ids: string[]): Promise<string[]> {
  ids.map((id) => requireUuid(id));
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}
async function bulkPublishResources(ids: string[]): Promise<string[]> {
  ids.map((id) => requireUuid(id));
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}
async function bulkDeleteResources(ids: string[]): Promise<string[]> {
  ids.map((id) => requireUuid(id));
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}
async function linkResourceFile(
  input: LinkResourceFileInput,
): Promise<ResourceFileDto> {
  requireUuid(input.resourceId);
  requireUuid(input.fileId);
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}
async function updateResourceFile(
  input: UpdateResourceFileInput,
): Promise<ResourceFileDto> {
  if (!Number.isInteger(input.sortOrder) || input.sortOrder < 0)
    throw new RangeError("sortOrder는 0 이상의 정수여야 합니다.");
  requireUuid(input.resourceId);
  requireUuid(input.fileId);
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}
async function reorderResourceFiles(
  input: ReorderResourceFilesInput,
): Promise<ResourceFileDto[]> {
  requireUuid(input.resourceId);
  for (const item of input.items) requireUuid(item.fileId);
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}
async function unlinkResourceFile(
  input: UnlinkResourceFileInput,
): Promise<string> {
  const fileId = requireUuid(input.fileId);
  requireUuid(input.resourceId);
  void fileId;
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
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
export const bulkHideResourcesMutationOptions = () =>
  mutationOptions({
    mutationKey: ["resources", "bulk-hide"],
    mutationFn: bulkHideResources,
  });
export const bulkPublishResourcesMutationOptions = () =>
  mutationOptions({
    mutationKey: ["resources", "bulk-publish"],
    mutationFn: bulkPublishResources,
  });
export const bulkDeleteResourcesMutationOptions = () =>
  mutationOptions({
    mutationKey: ["resources", "bulk-delete"],
    mutationFn: bulkDeleteResources,
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
