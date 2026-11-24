import { mutationOptions } from "@tanstack/react-query";
import { requireExpectedUpdatedAt, requireUuid } from "@shared/api/content";

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

async function save(input: SaveAchievementHighlightInput): Promise<void> {
  const isUpdate = Boolean(input.id);
  text(input.title, "제목", 160);
  text(input.content, "내용", 2000);
  if (isUpdate) {
    requireUuid(input.id!);
    requireExpectedUpdatedAt(input.expectedUpdatedAt!);
  }
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}

async function move(input: { id: string; direction: -1 | 1 }): Promise<void> {
  requireUuid(input.id);
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}

async function remove(id: string): Promise<void> {
  requireUuid(id);
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}

export const saveAchievementHighlightMutationOptions = () => mutationOptions({ mutationKey: ["achievement-highlights", "save"], mutationFn: save });
export const moveAchievementHighlightMutationOptions = () => mutationOptions({ mutationKey: ["achievement-highlights", "move"], mutationFn: move });
export const deleteAchievementHighlightMutationOptions = () => mutationOptions({ mutationKey: ["achievement-highlights", "delete"], mutationFn: remove });
