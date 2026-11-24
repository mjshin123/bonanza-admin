import { mutationOptions } from "@tanstack/react-query";
import type { GalleryDetail, GalleryItemDto } from "@entities/gallery";
import {
  normalizeFileItems,
  normalizePublishedAt,
  optionalText,
  requireExpectedUpdatedAt,
  requireText,
  requireUuid,
  type ContentStatus,
} from "@shared/api/content";
import type { Json } from "@shared/api/supabase";
export type SaveGalleryItemInput = { fileId: string; caption?: string };
export type CreateGalleryInput = {
  title: string;
  description?: string;
  eventDate?: string | null;
  status?: ContentStatus;
  publishedAt?: string | null;
  displayOrder?: number;
  files?: SaveGalleryItemInput[];
};
export type UpdateGalleryInput = Required<CreateGalleryInput> & {
  id: string;
  expectedUpdatedAt: string;
};
export type AddGalleryItemInput = {
  galleryId: string;
  fileId: string;
  caption?: string;
  sortOrder?: number;
};
export type UpdateGalleryItemInput = {
  galleryId: string;
  fileId: string;
  caption?: string;
  sortOrder?: number;
};
export type ReorderGalleryItemsInput = {
  galleryId: string;
  items: Array<{ fileId: string; sortOrder: number }>;
};
export type RemoveGalleryItemInput = { galleryId: string; fileId: string };
export function buildGalleryCommand(i: CreateGalleryInput): Json {
  if (
    i.eventDate !== undefined &&
    i.eventDate !== null &&
    !/^\d{4}-\d{2}-\d{2}$/.test(i.eventDate)
  ) {
    throw new TypeError("eventDate는 YYYY-MM-DD 형식이어야 합니다.");
  }
  if (
    i.displayOrder !== undefined &&
    (!Number.isInteger(i.displayOrder) || i.displayOrder < 0)
  ) {
    throw new RangeError("displayOrder는 0 이상의 정수여야 합니다.");
  }
  const status = i.status ?? "draft";
  return {
    title: requireText(i.title, "title", 200),
    description: i.description ?? "",
    eventDate: i.eventDate ?? null,
    status,
    publishedAt: normalizePublishedAt(status, i.publishedAt) ?? null,
    displayOrder: i.displayOrder ?? 0,
  };
}
export function buildGalleryFiles(i: SaveGalleryItemInput[]) {
  return normalizeFileItems(i).map((item) => ({
    fileId: item.fileId,
    caption: optionalText(item.caption, "caption", 500) ?? "",
  }));
}
async function createGallery(i: CreateGalleryInput): Promise<GalleryDetail> {
  buildGalleryCommand(i);
  buildGalleryFiles(i.files ?? []);
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}
async function updateGallery(i: UpdateGalleryInput): Promise<GalleryDetail> {
  requireExpectedUpdatedAt(i.expectedUpdatedAt);
  buildGalleryFiles(i.files);
  requireUuid(i.id);
  buildGalleryCommand(i);
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}
async function deleteGallery(id: string): Promise<string> {
  requireUuid(id);
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}
async function addGalleryItem(i: AddGalleryItemInput): Promise<GalleryItemDto> {
  optionalText(i.caption, "caption", 500);
  requireUuid(i.galleryId);
  requireUuid(i.fileId);
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}
async function updateGalleryItem(
  i: UpdateGalleryItemInput,
): Promise<GalleryItemDto> {
  if (i.caption !== undefined) optionalText(i.caption, "caption", 500);
  requireUuid(i.galleryId);
  requireUuid(i.fileId);
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}
async function reorderGalleryItems(
  i: ReorderGalleryItemsInput,
): Promise<GalleryItemDto[]> {
  requireUuid(i.galleryId);
  for (const item of i.items) requireUuid(item.fileId);
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}
async function removeGalleryItem(i: RemoveGalleryItemInput): Promise<string> {
  const fileId = requireUuid(i.fileId);
  requireUuid(i.galleryId);
  void fileId;
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}
export const createGalleryMutationOptions = () =>
  mutationOptions({
    mutationKey: ["galleries", "create"],
    mutationFn: createGallery,
  });
export const updateGalleryMutationOptions = () =>
  mutationOptions({
    mutationKey: ["galleries", "update"],
    mutationFn: updateGallery,
  });
export const deleteGalleryMutationOptions = () =>
  mutationOptions({
    mutationKey: ["galleries", "delete"],
    mutationFn: deleteGallery,
  });
export const addGalleryItemMutationOptions = () =>
  mutationOptions({
    mutationKey: ["galleries", "item", "add"],
    mutationFn: addGalleryItem,
  });
export const updateGalleryItemMutationOptions = () =>
  mutationOptions({
    mutationKey: ["galleries", "item", "update"],
    mutationFn: updateGalleryItem,
  });
export const reorderGalleryItemsMutationOptions = () =>
  mutationOptions({
    mutationKey: ["galleries", "item", "reorder"],
    mutationFn: reorderGalleryItems,
  });
export const removeGalleryItemMutationOptions = () =>
  mutationOptions({
    mutationKey: ["galleries", "item", "remove"],
    mutationFn: removeGalleryItem,
  });
