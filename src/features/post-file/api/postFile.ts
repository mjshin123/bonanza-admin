import { mutationOptions } from "@tanstack/react-query";

import {
  PUBLIC_ASSETS_BUCKET,
  supabase,
} from "@shared/api/supabase";
import type { Tables } from "@shared/api/supabase";

const MAX_GALLERY_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

const GALLERY_EXTENSION_BY_MIME_TYPE = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type PostFile = Tables<"post_files">;
export type PostFileType = "attachment" | "gallery_image";
export type PendingPostFile = {
  file: File;
  fileType: PostFileType;
  id: string;
  previewUrl: string | null;
};

export type UploadPostFileInput = {
  file: File;
  fileType: PostFileType;
  postId: string;
  sortOrder: number;
};

export type DeletePostFileInput = {
  fileId: string;
  postId: string;
};

function resolveFileExtension(file: File, fileType: PostFileType) {
  if (file.size <= 0) {
    throw new RangeError("빈 파일은 첨부할 수 없습니다.");
  }

  if (fileType === "gallery_image") {
    if (!(file.type in GALLERY_EXTENSION_BY_MIME_TYPE)) {
      throw new TypeError("갤러리 사진은 JPG, PNG 또는 WebP 형식이어야 합니다.");
    }

    if (file.size > MAX_GALLERY_IMAGE_SIZE_BYTES) {
      throw new RangeError("갤러리 사진은 파일당 10MB 이하여야 합니다.");
    }

    return `.${GALLERY_EXTENSION_BY_MIME_TYPE[file.type as keyof typeof GALLERY_EXTENSION_BY_MIME_TYPE]}`;
  }

  const matchedExtension = file.name.toLowerCase().match(/\.[a-z0-9]{1,10}$/);
  return matchedExtension?.[0] ?? "";
}

async function uploadPostFile(input: UploadPostFileInput): Promise<PostFile> {
  const extension = resolveFileExtension(input.file, input.fileType);
  const directory = input.fileType === "gallery_image" ? "gallery" : "attachments";
  const storagePath = `posts/${input.postId}/${directory}/${crypto.randomUUID()}${extension}`;
  const { error: uploadError } = await supabase.storage
    .from(PUBLIC_ASSETS_BUCKET)
    .upload(storagePath, input.file, {
      cacheControl: "3600",
      contentType: input.file.type || undefined,
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data, error: insertError } = await supabase
    .from("post_files")
    .insert({
      file_type: input.fileType,
      mime_type: input.file.type || null,
      original_name: input.file.name,
      post_id: input.postId,
      size_bytes: input.file.size,
      sort_order: input.sortOrder,
      storage_path: storagePath,
    })
    .select("*")
    .single();

  if (insertError) {
    await supabase.storage.from(PUBLIC_ASSETS_BUCKET).remove([storagePath]);
    throw insertError;
  }

  return data;
}

async function deletePostFile(input: DeletePostFileInput): Promise<string> {
  const { data: file, error: fetchError } = await supabase
    .from("post_files")
    .select("id, storage_path")
    .eq("id", input.fileId)
    .eq("post_id", input.postId)
    .single();

  if (fetchError) {
    throw fetchError;
  }

  const { error: storageError } = await supabase.storage
    .from(PUBLIC_ASSETS_BUCKET)
    .remove([file.storage_path]);

  if (storageError) {
    throw storageError;
  }

  const { error: deleteError } = await supabase
    .from("post_files")
    .delete()
    .eq("id", file.id)
    .eq("post_id", input.postId);

  if (deleteError) {
    throw deleteError;
  }

  return file.id;
}

export function uploadPostFileMutationOptions() {
  return mutationOptions({
    mutationKey: ["post", "file", "upload"],
    mutationFn: uploadPostFile,
  });
}

export function deletePostFileMutationOptions() {
  return mutationOptions({
    mutationKey: ["post", "file", "delete"],
    mutationFn: deletePostFile,
  });
}
