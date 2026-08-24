import { mutationOptions } from "@tanstack/react-query";
import {
  ContentApiError,
  requireUuid,
  throwContentError,
} from "@shared/api/content";
import { supabase } from "@shared/api/supabase";
import type { TablesInsert } from "@shared/api/supabase";

async function deleteFile(id: string): Promise<string> {
  const normalizedId = requireUuid(id);
  const { data: snapshot, error } = await supabase
    .from("files")
    .delete()
    .eq("id", normalizedId)
    .select("*")
    .single();
  if (error) throwContentError(error);
  const removal = await supabase.storage
    .from(snapshot.bucket_name)
    .remove([snapshot.storage_path]);
  if (!removal.error) return snapshot.id;

  const restore: TablesInsert<"files"> = { ...snapshot };
  const restored = await supabase.from("files").insert(restore);
  if (restored.error) {
    throw new ContentApiError(
      "STORAGE_CLEANUP_REQUIRED",
      "Storage 삭제와 DB 메타데이터 복원에 모두 실패했습니다.",
      { storage: removal.error, database: restored.error },
    );
  }
  throw removal.error;
}
export const deleteFileMutationOptions = () =>
  mutationOptions({ mutationKey: ["files", "delete"], mutationFn: deleteFile });
