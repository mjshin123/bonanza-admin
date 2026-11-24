import { mutationOptions } from "@tanstack/react-query";

import {
  type AdminFileDto,
  type FileKind,
} from "@shared/api/content";

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
  if (input.fileKind === "video" && !input.file.type.startsWith("video/"))
    throw new TypeError("동영상 MIME 파일만 업로드할 수 있습니다.");

  const fileId = crypto.randomUUID();
  const storagePath = `local/${fileId}.${extensionOf(input.file.name)}`;
  let dimensions: { width: number; height: number } | null = null;
  if (input.fileKind === "image")
    dimensions = await imageDimensions(input.file);

  const now = new Date().toISOString();
  return {
    id: fileId,
    fileKind: input.fileKind,
    originalName: input.file.name,
    mimeType: input.file.type || "application/octet-stream",
    sizeBytes: input.file.size,
    widthPx: dimensions?.width ?? null,
    heightPx: dimensions?.height ?? null,
    altText: input.altText ?? null,
    url: URL.createObjectURL(input.file),
    bucketName: "local",
    storagePath,
    uploadedBy: null,
    createdAt: now,
    updatedAt: now,
  };
}

export const uploadFileMutationOptions = () =>
  mutationOptions({ mutationKey: ["files", "upload"], mutationFn: uploadFile });
