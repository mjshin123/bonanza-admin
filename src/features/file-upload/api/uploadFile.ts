import { mutationOptions } from "@tanstack/react-query";

import {
  ContentApiError,
  mapFile,
  throwContentError,
  type AdminFileDto,
  type FileKind,
} from "@shared/api/content";
import { PUBLIC_ASSETS_BUCKET, supabase } from "@shared/api/supabase";

export type UploadFileInput = {
  file: File;
  fileKind: FileKind;
  altText?: string | null;
};

function extensionOf(name: string) {
  const match = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? "bin";
}

async function imageDimensions(
  file: File,
): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const dimensions = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return dimensions;
}

async function uploadFile(input: UploadFileInput): Promise<AdminFileDto> {
  if (!input.file.name.trim() || input.file.name.length > 255)
    throw new RangeError("파일명은 1~255자여야 합니다.");
  if (input.file.size <= 0)
    throw new RangeError("빈 파일은 업로드할 수 없습니다.");
  const limit =
    input.fileKind === "image" ? 10 * 1024 * 1024 : 50 * 1024 * 1024;
  if (input.file.size > limit)
    throw new RangeError(`파일은 ${limit / 1024 / 1024} MiB 이하여야 합니다.`);
  if (input.altText && input.altText.length > 500)
    throw new RangeError("altText는 500자 이하여야 합니다.");
  if (input.fileKind === "image" && !input.file.type.startsWith("image/"))
    throw new TypeError("이미지 MIME 파일만 업로드할 수 있습니다.");

  const fileId = crypto.randomUUID();
  const now = new Date();
  const storagePath = `assets/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${fileId}/${crypto.randomUUID()}.${extensionOf(input.file.name)}`;
  let dimensions: { width: number; height: number } | null = null;
  if (input.fileKind === "image")
    dimensions = await imageDimensions(input.file);

  const upload = await supabase.storage
    .from(PUBLIC_ASSETS_BUCKET)
    .upload(storagePath, input.file, {
      contentType: input.file.type || "application/octet-stream",
      upsert: false,
    });
  if (upload.error) throw upload.error;
  const { data, error } = await supabase
    .from("files")
    .insert({
      id: fileId,
      file_kind: input.fileKind,
      bucket_name: PUBLIC_ASSETS_BUCKET,
      storage_path: storagePath,
      original_name: input.file.name,
      mime_type: input.file.type || "application/octet-stream",
      size_bytes: input.file.size,
      width_px: dimensions?.width ?? null,
      height_px: dimensions?.height ?? null,
      alt_text: input.altText ?? null,
    })
    .select("*")
    .single();
  if (error) {
    const cleanup = await supabase.storage
      .from(PUBLIC_ASSETS_BUCKET)
      .remove([storagePath]);
    if (cleanup.error) {
      throw new ContentApiError(
        "STORAGE_CLEANUP_REQUIRED",
        "파일 메타데이터 등록과 업로드 객체 정리에 모두 실패했습니다.",
        { database: error, storage: cleanup.error },
      );
    }
    throwContentError(error);
  }
  return mapFile(data);
}

export const uploadFileMutationOptions = () =>
  mutationOptions({ mutationKey: ["files", "upload"], mutationFn: uploadFile });
