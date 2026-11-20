import { mutationOptions } from "@tanstack/react-query";

import { mapInstitution, type InstitutionDto } from "@entities/institution";
import {
  requireText,
  requireUuid,
  throwContentError,
  type InstitutionType,
} from "@shared/api/content";
import { supabase } from "@shared/api/supabase";
import type { Tables, TablesInsert, TablesUpdate } from "@shared/api/supabase";

export type CreateInstitutionInput = {
  institutionType: InstitutionType;
  name: string;
  logoFileId?: string | null;
  displayOrder?: number;
  isActive?: boolean;
};
export type UpdateInstitutionInput = Partial<CreateInstitutionInput> & {
  id: string;
};

const SELECT = "*, logo:files(*)";
type Joined = Tables<"institutions"> & {
  logo: Tables<"files"> | null;
};

function mapInput(
  input: Partial<CreateInstitutionInput>,
): TablesUpdate<"institutions"> {
  const payload: TablesUpdate<"institutions"> = {};
  if (input.institutionType !== undefined)
    payload.institution_type = input.institutionType;
  if (input.name !== undefined)
    payload.name = requireText(input.name, "name", 200);
  if (input.logoFileId !== undefined) {
    if (input.logoFileId === null)
      throw new TypeError("logoFileId는 필수입니다.");
    payload.logo_file_id = requireUuid(input.logoFileId, "logoFileId");
  }
  if (input.displayOrder !== undefined) {
    if (!Number.isInteger(input.displayOrder) || input.displayOrder < 0)
      throw new RangeError("displayOrder는 0 이상의 정수여야 합니다.");
    payload.display_order = input.displayOrder;
  }
  if (input.isActive !== undefined) payload.is_active = input.isActive;
  return payload;
}

async function nextDisplayOrder(institutionType: InstitutionType) {
  const { data, error } = await supabase
    .from("institutions")
    .select("display_order")
    .eq("institution_type", institutionType)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throwContentError(error);
  return (data?.display_order ?? -1) + 1;
}

async function createInstitution(
  input: CreateInstitutionInput,
): Promise<InstitutionDto> {
  const payload = mapInput(input);
  if (!payload.institution_type || !payload.name || !payload.logo_file_id)
    throw new TypeError("institutionType, name, logoFileId는 필수입니다.");
  if (payload.display_order === undefined)
    payload.display_order = await nextDisplayOrder(
      payload.institution_type as InstitutionType,
    );
  const { data, error } = await supabase
    .from("institutions")
    .insert(payload as TablesInsert<"institutions">)
    .select(SELECT)
    .single();
  if (error) throwContentError(error);
  return mapInstitution(data as Joined);
}
async function updateInstitution(
  input: UpdateInstitutionInput,
): Promise<InstitutionDto> {
  const { id, ...patch } = input;
  const { data, error } = await supabase
    .from("institutions")
    .update(mapInput(patch))
    .eq("id", requireUuid(id))
    .select(SELECT)
    .single();
  if (error) throwContentError(error);
  return mapInstitution(data as Joined);
}
export type SwapInstitutionOrderInput = {
  first: { id: string; displayOrder: number };
  second: { id: string; displayOrder: number };
};

async function swapInstitutionOrder(input: SwapInstitutionOrderInput) {
  const results = await Promise.all([
    supabase
      .from("institutions")
      .update({ display_order: input.second.displayOrder })
      .eq("id", requireUuid(input.first.id)),
    supabase
      .from("institutions")
      .update({ display_order: input.first.displayOrder })
      .eq("id", requireUuid(input.second.id)),
  ]);
  const failed = results.find((result) => result.error);
  if (failed?.error) throwContentError(failed.error);
}

async function deleteInstitution(id: string) {
  const { data, error } = await supabase
    .from("institutions")
    .delete()
    .eq("id", requireUuid(id))
    .select("id")
    .single();
  if (error) throwContentError(error);
  return data.id;
}

async function bulkHideInstitutions(ids: string[]) {
  const normalized = ids.map((id) => requireUuid(id));
  const { error } = await supabase
    .from("institutions")
    .update({ is_active: false })
    .in("id", normalized);
  if (error) throwContentError(error);
  return normalized;
}

async function bulkShowInstitutions(ids: string[]) {
  const normalized = ids.map((id) => requireUuid(id));
  const { error } = await supabase
    .from("institutions")
    .update({ is_active: true })
    .in("id", normalized);
  if (error) throwContentError(error);
  return normalized;
}

async function bulkDeleteInstitutions(ids: string[]) {
  const normalized = ids.map((id) => requireUuid(id));
  const { error } = await supabase
    .from("institutions")
    .delete()
    .in("id", normalized);
  if (error) throwContentError(error);
  return normalized;
}

export const createInstitutionMutationOptions = () =>
  mutationOptions({
    mutationKey: ["institutions", "create"],
    mutationFn: createInstitution,
  });
export const updateInstitutionMutationOptions = () =>
  mutationOptions({
    mutationKey: ["institutions", "update"],
    mutationFn: updateInstitution,
  });
export const deleteInstitutionMutationOptions = () =>
  mutationOptions({
    mutationKey: ["institutions", "delete"],
    mutationFn: deleteInstitution,
  });
export const swapInstitutionOrderMutationOptions = () =>
  mutationOptions({
    mutationKey: ["institutions", "swap-order"],
    mutationFn: swapInstitutionOrder,
  });
export const bulkHideInstitutionsMutationOptions = () =>
  mutationOptions({
    mutationKey: ["institutions", "bulk-hide"],
    mutationFn: bulkHideInstitutions,
  });
export const bulkShowInstitutionsMutationOptions = () =>
  mutationOptions({
    mutationKey: ["institutions", "bulk-show"],
    mutationFn: bulkShowInstitutions,
  });
export const bulkDeleteInstitutionsMutationOptions = () =>
  mutationOptions({
    mutationKey: ["institutions", "bulk-delete"],
    mutationFn: bulkDeleteInstitutions,
  });
