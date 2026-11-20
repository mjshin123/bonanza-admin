import { mutationOptions } from "@tanstack/react-query";
import { requireExpectedUpdatedAt, requireUuid, throwContentError } from "@shared/api/content";
import { supabase } from "@shared/api/supabase";

export type SaveAchievementHighlightInput = {
  id?: string;
  expectedUpdatedAt?: string;
  title: string;
  content: string;
  occurredOn: string;
  imageFileId: string | null;
};

function text(value: string, label: string, max: number) {
  const result = value.trim();
  if (!result || result.length > max) throw new RangeError(`${label}을(를) 확인해 주세요.`);
  return result;
}

async function save(input: SaveAchievementHighlightInput) {
  const isUpdate = Boolean(input.id);
  const { error } = await supabase.rpc("save_achievement_highlight", {
    p_title: text(input.title, "제목", 160), p_content: text(input.content, "내용", 2000),
    p_occurred_on: input.occurredOn, p_image_file_id: input.imageFileId,
    p_id: isUpdate ? requireUuid(input.id!) : undefined,
    p_expected_updated_at: isUpdate ? requireExpectedUpdatedAt(input.expectedUpdatedAt!) : undefined,
  });
  if (error) throwContentError(error);
}

async function move(input: { id: string; direction: -1 | 1 }) {
  const { error } = await supabase.rpc("move_achievement_highlight", { p_id: requireUuid(input.id), p_direction: input.direction });
  if (error) throwContentError(error);
}

async function remove(id: string) {
  const { error } = await supabase.rpc("delete_achievement_highlight", { p_id: requireUuid(id) });
  if (error) throwContentError(error);
}

export const saveAchievementHighlightMutationOptions = () => mutationOptions({ mutationKey: ["achievement-highlights", "save"], mutationFn: save });
export const moveAchievementHighlightMutationOptions = () => mutationOptions({ mutationKey: ["achievement-highlights", "move"], mutationFn: move });
export const deleteAchievementHighlightMutationOptions = () => mutationOptions({ mutationKey: ["achievement-highlights", "delete"], mutationFn: remove });
