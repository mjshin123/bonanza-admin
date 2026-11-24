import { mutationOptions } from "@tanstack/react-query";
import { requireUuid } from "@shared/api/content";
import type { Json } from "@shared/api/supabase";

type FileDeleteOperation = {
  operationId: string;
  fileId: string;
  bucketName: string;
  storagePath: string;
};

export function mapFileDeleteOperation(value: Json): FileDeleteOperation {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("파일 삭제 준비 응답이 올바르지 않습니다.");
  }
  const operation = value as Record<string, Json | undefined>;
  if (
    typeof operation.operationId !== "string" ||
    typeof operation.fileId !== "string" ||
    typeof operation.bucketName !== "string" ||
    typeof operation.storagePath !== "string"
  ) {
    throw new TypeError("파일 삭제 준비 응답이 올바르지 않습니다.");
  }
  return operation as FileDeleteOperation;
}

async function deleteFile(id: string): Promise<string> {
  requireUuid(id);
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}
export const deleteFileMutationOptions = () =>
  mutationOptions({ mutationKey: ["files", "delete"], mutationFn: deleteFile });
