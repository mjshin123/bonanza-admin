import { mutationOptions } from "@tanstack/react-query";

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

const IMAGE_EXTENSION_BY_MIME_TYPE = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

type SupportedImageMimeType = keyof typeof IMAGE_EXTENSION_BY_MIME_TYPE;

export type UploadPostContentImageInput = {
  file: File;
  postId: string;
};

export type UploadedPostContentImage = {
  mimeType: SupportedImageMimeType;
  originalName: string;
  sizeBytes: number;
  storagePath: string;
};

export type DeletePostContentImageInput = {
  postId: string;
  storagePath: string;
};

function resolveImageFile(file: File) {
  if (!(file.type in IMAGE_EXTENSION_BY_MIME_TYPE)) {
    throw new TypeError("본문 이미지는 JPG, PNG 또는 WebP 형식이어야 합니다.");
  }

  if (file.size <= 0 || file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new RangeError("본문 이미지는 파일당 10MB 이하여야 합니다.");
  }

  const mimeType = file.type as SupportedImageMimeType;

  return {
    extension: IMAGE_EXTENSION_BY_MIME_TYPE[mimeType],
    mimeType,
  };
}

async function uploadPostContentImage(
  input: UploadPostContentImageInput,
): Promise<UploadedPostContentImage> {
  resolveImageFile(input.file);
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}

async function deletePostContentImage(
  input: DeletePostContentImageInput,
): Promise<string> {
  const expectedPrefix = `posts/${input.postId}/`;

  if (!input.storagePath.startsWith(expectedPrefix)) {
    throw new TypeError("삭제할 이미지 경로가 게시물과 일치하지 않습니다.");
  }

  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}

export function uploadPostContentImageMutationOptions() {
  return mutationOptions({
    mutationKey: ["post", "content-image", "upload"],
    mutationFn: uploadPostContentImage,
  });
}

export function deletePostContentImageMutationOptions() {
  return mutationOptions({
    mutationKey: ["post", "content-image", "delete"],
    mutationFn: deletePostContentImage,
  });
}
