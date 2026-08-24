import { mutationOptions } from "@tanstack/react-query";
import {
  ContentApiError,
  requireUuid,
  throwContentError,
} from "@shared/api/content";
import { supabase } from "@shared/api/supabase";
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
  const normalizedId = requireUuid(id);
  const { data, error } = await supabase.rpc("begin_file_delete", {
    p_file_id: normalizedId,
  });
  if (error) throwContentError(error);
  const operation = mapFileDeleteOperation(data);
  const removal = await supabase.storage
    .from(operation.bucketName)
    .remove([operation.storagePath]);
  if (removal.error) {
    const restored = await supabase.rpc("restore_file_delete", {
      p_operation_id: operation.operationId,
    });
    if (restored.error) {
      throw new ContentApiError(
        "STORAGE_CLEANUP_REQUIRED",
        "Storage 삭제와 DB 메타데이터 복원에 모두 실패했습니다.",
        { storage: removal.error, database: restored.error },
      );
    }
    throw removal.error;
  }

  const completed = await supabase.rpc("complete_file_delete", {
    p_operation_id: operation.operationId,
  });
  if (completed.error) {
    throw new ContentApiError(
      "STORAGE_CLEANUP_REQUIRED",
      "Storage 객체는 삭제됐지만 삭제 작업 마무리에 실패했습니다.",
      completed.error,
    );
  }
  return completed.data;
}
export const deleteFileMutationOptions = () =>
  mutationOptions({ mutationKey: ["files", "delete"], mutationFn: deleteFile });
