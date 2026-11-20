import { mutationOptions } from "@tanstack/react-query";
import { requireExpectedUpdatedAt, requireUuid, throwContentError } from "@shared/api/content";
import { supabase } from "@shared/api/supabase";

export type SaveAwardInput = { id?: string; expectedUpdatedAt?: string; title: string; titleEn?: string; organization: string; organizationEn?: string; awardedOn: string };
const required = (value: string, label: string) => { const text = value.trim(); if (!text || text.length > 160) throw new RangeError(`${label}을(를) 확인해 주세요.`); return text; };
async function save(input: SaveAwardInput) {
  const updating = Boolean(input.id);
  const optional = (value: string | undefined) => { const text = value?.trim() ?? ""; if (text.length > 160) throw new RangeError("영문 입력은 160자 이하여야 합니다."); return text || null; };
  const { error } = await supabase.rpc("save_award", { p_title: required(input.title, "제목"), p_title_en: optional(input.titleEn), p_organization: required(input.organization, "인증기관"), p_organization_en: optional(input.organizationEn), p_awarded_on: input.awardedOn, p_id: updating ? requireUuid(input.id!) : undefined, p_expected_updated_at: updating ? requireExpectedUpdatedAt(input.expectedUpdatedAt!) : undefined });
  if (error) throwContentError(error);
}
async function remove(id: string) { const { error } = await supabase.from("awards").delete().eq("id", requireUuid(id)); if (error) throwContentError(error); }
export const saveAwardMutationOptions = () => mutationOptions({ mutationKey: ["awards", "save"], mutationFn: save });
export const deleteAwardMutationOptions = () => mutationOptions({ mutationKey: ["awards", "delete"], mutationFn: remove });
