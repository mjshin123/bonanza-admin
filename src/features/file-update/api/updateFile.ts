import { mutationOptions } from "@tanstack/react-query";
import { mapFile, requireUuid, throwContentError } from "@shared/api/content";
import { supabase } from "@shared/api/supabase";

export type UpdateFileInput = { id: string; altText: string | null };
async function updateFile(input: UpdateFileInput) {
  if (input.altText && input.altText.length > 500)
    throw new RangeError("altText는 500자 이하여야 합니다.");
  const { data, error } = await supabase
    .from("files")
    .update({ alt_text: input.altText })
    .eq("id", requireUuid(input.id))
    .select("*")
    .single();
  if (error) throwContentError(error);
  return mapFile(data);
}
export const updateFileMutationOptions = () =>
  mutationOptions({ mutationKey: ["files", "update"], mutationFn: updateFile });
