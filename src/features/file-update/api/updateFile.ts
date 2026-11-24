import { mutationOptions } from "@tanstack/react-query";
import { requireUuid, type AdminFileDto } from "@shared/api/content";

export type UpdateFileInput = { id: string; altText: string | null };
async function updateFile(input: UpdateFileInput): Promise<AdminFileDto> {
  if (input.altText && input.altText.length > 500)
    throw new RangeError("altText는 500자 이하여야 합니다.");
  requireUuid(input.id);
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}
export const updateFileMutationOptions = () =>
  mutationOptions({ mutationKey: ["files", "update"], mutationFn: updateFile });
