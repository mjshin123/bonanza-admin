import { mutationOptions } from "@tanstack/react-query";
import { requireExpectedUpdatedAt, requireUuid } from "@shared/api/content";

export type SaveAwardInput = { id?: string; expectedUpdatedAt?: string; title: string; titleEn?: string; organization: string; organizationEn?: string; awardedOn: string };
const required = (value: string, label: string) => { const text = value.trim(); if (!text || text.length > 160) throw new RangeError(`${label}을(를) 확인해 주세요.`); return text; };
async function save(input: SaveAwardInput): Promise<void> {
  const updating = Boolean(input.id);
  const optional = (value: string | undefined) => { const text = value?.trim() ?? ""; if (text.length > 160) throw new RangeError("영문 입력은 160자 이하여야 합니다."); return text || null; };
  required(input.title, "제목"); optional(input.titleEn);
  required(input.organization, "인증기관"); optional(input.organizationEn);
  if (updating) { requireUuid(input.id!); requireExpectedUpdatedAt(input.expectedUpdatedAt!); }
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}
async function remove(id: string): Promise<void> { requireUuid(id); throw new Error("백엔드가 아직 연결되지 않았습니다."); }
export const saveAwardMutationOptions = () => mutationOptions({ mutationKey: ["awards", "save"], mutationFn: save });
export const deleteAwardMutationOptions = () => mutationOptions({ mutationKey: ["awards", "delete"], mutationFn: remove });
