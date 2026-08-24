import { mutationOptions } from "@tanstack/react-query";
import { mapGallery, type GalleryItemDto } from "@entities/gallery";
import {
  mapFile,
  normalizePublishedAt,
  optionalText,
  requireText,
  requireUuid,
  throwContentError,
  type ContentStatus,
} from "@shared/api/content";
import { supabase } from "@shared/api/supabase";
import type { Tables, TablesInsert, TablesUpdate } from "@shared/api/supabase";
export type CreateGalleryInput = {
  title: string;
  description?: string;
  eventDate?: string | null;
  status?: Exclude<ContentStatus, "published">;
  publishedAt?: string | null;
  displayOrder?: number;
};
export type UpdateGalleryInput = Partial<Omit<CreateGalleryInput, "status">> & {
  id: string;
  status?: ContentStatus;
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
const SELECT = "*,items:gallery_items(*,file:files!inner(*))";
type Joined = Tables<"galleries"> & {
  items: Array<Tables<"gallery_items"> & { file: Tables<"files"> }>;
};
function payload(
  i: Partial<Omit<CreateGalleryInput, "status">> & { status?: ContentStatus },
): TablesUpdate<"galleries"> {
  const p: TablesUpdate<"galleries"> = {};
  if (i.title !== undefined) p.title = requireText(i.title, "title", 200);
  if (i.description !== undefined) p.description = i.description;
  if (i.eventDate !== undefined) {
    if (i.eventDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(i.eventDate))
      throw new TypeError("eventDate는 YYYY-MM-DD 형식이어야 합니다.");
    p.event_date = i.eventDate;
  }
  if (i.displayOrder !== undefined) {
    if (!Number.isInteger(i.displayOrder) || i.displayOrder < 0)
      throw new RangeError("displayOrder는 0 이상의 정수여야 합니다.");
    p.display_order = i.displayOrder;
  }
  if (i.status !== undefined) p.status = i.status;
  const at = normalizePublishedAt(i.status, i.publishedAt);
  if (at !== undefined) p.published_at = at;
  return p;
}
async function createGallery(i: CreateGalleryInput) {
  const { data, error } = await supabase
    .from("galleries")
    .insert(payload(i) as TablesInsert<"galleries">)
    .select(SELECT)
    .single();
  if (error) throwContentError(error);
  return mapGallery(data as Joined);
}
async function updateGallery(i: UpdateGalleryInput) {
  const { id, ...patch } = i,
    { data, error } = await supabase
      .from("galleries")
      .update(payload(patch))
      .eq("id", requireUuid(id))
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
  const { data, error } = await supabase
    .from("gallery_items")
    .delete()
    .eq("gallery_id", requireUuid(i.galleryId))
    .eq("file_id", requireUuid(i.fileId))
    .select("file_id")
    .single();
  if (error) throwContentError(error);
  return data.file_id;
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
