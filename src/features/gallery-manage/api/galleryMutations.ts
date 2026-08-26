import { mutationOptions } from "@tanstack/react-query";
import { mapGallery, type GalleryItemDto } from "@entities/gallery";
import {
  mapFile,
  normalizeFileItems,
  normalizePublishedAt,
  optionalText,
  requireExpectedUpdatedAt,
  requireText,
  requireUuid,
  throwContentError,
  type ContentStatus,
} from "@shared/api/content";
import { supabase } from "@shared/api/supabase";
import type { Json, Tables, TablesUpdate } from "@shared/api/supabase";
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
export type SetGalleryItemHiddenInput = {
  galleryId: string;
  fileId: string;
  isHidden: boolean;
};
export type ReorderGalleryItemsInput = {
  galleryId: string;
  items: Array<{ fileId: string; sortOrder: number }>;
};
export type RemoveGalleryItemInput = { galleryId: string; fileId: string };
export type ReorderGalleriesInput = string[];
const SELECT = "*,items:gallery_items(*,file:files!inner(*))";
type Joined = Tables<"galleries"> & {
  items: Array<Tables<"gallery_items"> & { file: Tables<"files"> }>;
};
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
async function createGallery(i: CreateGalleryInput) {
  const { data, error } = await supabase
    .rpc("save_gallery", {
      p_input: buildGalleryCommand(i),
      p_files: buildGalleryFiles(i.files ?? []),
    })
    .select(SELECT)
    .single();
  if (error) throwContentError(error);
  return mapGallery(data as Joined);
}
async function updateGallery(i: UpdateGalleryInput) {
  const { data, error } = await supabase
    .rpc("save_gallery", {
      p_expected_updated_at: requireExpectedUpdatedAt(i.expectedUpdatedAt),
      p_files: buildGalleryFiles(i.files),
      p_id: requireUuid(i.id),
      p_input: buildGalleryCommand(i),
    })
    .select(SELECT)
    .single();
  if (error) throwContentError(error);
  return mapGallery(data as Joined);
}
async function deleteGallery(id: string) {
  const { data, error } = await supabase
    .from("galleries")
    .delete()
    .eq("id", requireUuid(id))
    .select("id")
    .single();
  if (error) throwContentError(error);
  return data.id;
}
function mapItem(
  r: Tables<"gallery_items"> & { file: Tables<"files"> },
): GalleryItemDto {
  return {
    file: mapFile(r.file),
    caption: r.caption,
    sortOrder: r.sort_order,
    isHidden: r.is_hidden,
    createdAt: r.created_at,
  };
}
async function addGalleryItem(i: AddGalleryItemInput) {
  const caption = optionalText(i.caption, "caption", 500) ?? "";
  const { data, error } = await supabase
    .from("gallery_items")
    .insert({
      gallery_id: requireUuid(i.galleryId),
      file_id: requireUuid(i.fileId),
      caption,
      sort_order: i.sortOrder ?? 0,
    })
    .select("*,file:files!inner(*)")
    .single();
  if (error) throwContentError(error);
  return mapItem(data as Tables<"gallery_items"> & { file: Tables<"files"> });
}
async function updateGalleryItem(i: UpdateGalleryItemInput) {
  const p: TablesUpdate<"gallery_items"> = {};
  if (i.caption !== undefined)
    p.caption = optionalText(i.caption, "caption", 500);
  if (i.sortOrder !== undefined) p.sort_order = i.sortOrder;
  const { data, error } = await supabase
    .from("gallery_items")
    .update(p)
    .eq("gallery_id", requireUuid(i.galleryId))
    .eq("file_id", requireUuid(i.fileId))
    .select("*,file:files!inner(*)")
    .single();
  if (error) throwContentError(error);
  return mapItem(data as Tables<"gallery_items"> & { file: Tables<"files"> });
}
async function reorderGalleryItems(i: ReorderGalleryItemsInput) {
  const id = requireUuid(i.galleryId),
    ids = [...i.items]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((x) => requireUuid(x.fileId));
  const { error } = await supabase.rpc("reorder_content_files", {
    p_relation: "gallery_items",
    p_parent_id: id,
    p_file_ids: ids,
  });
  if (error) throwContentError(error);
  const { data, error: e } = await supabase
    .from("gallery_items")
    .select("*,file:files!inner(*)")
    .eq("gallery_id", id)
    .order("sort_order")
    .order("created_at")
    .order("file_id");
  if (e) throw e;
  return data.map((r) =>
    mapItem(r as Tables<"gallery_items"> & { file: Tables<"files"> }),
  );
}
async function removeGalleryItem(i: RemoveGalleryItemInput) {
  const fileId = requireUuid(i.fileId);
  const { error } = await supabase.rpc("remove_gallery_item_from_source", {
    p_gallery_id: requireUuid(i.galleryId),
    p_file_id: fileId,
  });
  if (error) throwContentError(error);
  return fileId;
}
async function setGalleryItemHidden(i: SetGalleryItemHiddenInput) {
  const { error } = await supabase.rpc("set_gallery_item_hidden", {
    p_gallery_id: requireUuid(i.galleryId),
    p_file_id: requireUuid(i.fileId),
    p_hidden: i.isHidden,
  });
  if (error) throwContentError(error);
  return i;
}
async function reorderGalleries(ids: ReorderGalleriesInput) {
  const normalized = ids.map((id) => requireUuid(id));
  const { error } = await supabase.rpc("reorder_galleries", {
    p_ids: normalized,
  });
  if (error) throwContentError(error);
  return normalized;
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
export const setGalleryItemHiddenMutationOptions = () =>
  mutationOptions({
    mutationKey: ["galleries", "item", "hidden"],
    mutationFn: setGalleryItemHidden,
  });
export const reorderGalleriesMutationOptions = () =>
  mutationOptions({
    mutationKey: ["galleries", "reorder"],
    mutationFn: reorderGalleries,
  });
