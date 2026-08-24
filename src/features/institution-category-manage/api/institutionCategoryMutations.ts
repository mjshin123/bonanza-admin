import { mutationOptions } from "@tanstack/react-query";

import {
  mapInstitutionCategory,
  type InstitutionCategoryDto,
} from "@entities/institution-category";
import {
  requireText,
  requireUuid,
  throwContentError,
} from "@shared/api/content";
import { supabase } from "@shared/api/supabase";
import type { TablesInsert } from "@shared/api/supabase";

export type CreateInstitutionCategoryInput = {
  code: string;
  name: string;
  displayOrder?: number;
  isActive?: boolean;
};
export type UpdateInstitutionCategoryInput =
  Partial<CreateInstitutionCategoryInput> & { id: string };

function mapInput(input: Partial<CreateInstitutionCategoryInput>) {
  const result: {
    code?: string;
    name?: string;
    display_order?: number;
    is_active?: boolean;
  } = {};
  if (input.code !== undefined) {
    const code = requireText(input.code, "code", 50);
    if (!/^[a-z0-9_]+$/.test(code)) {
      throw new TypeError(
        "code는 소문자 영문, 숫자, underscore만 사용할 수 있습니다.",
      );
    }
    result.code = code;
  }
  if (input.name !== undefined)
    result.name = requireText(input.name, "name", 100);
  if (input.displayOrder !== undefined) {
    if (!Number.isInteger(input.displayOrder) || input.displayOrder < 0) {
      throw new RangeError("displayOrder는 0 이상의 정수여야 합니다.");
    }
    result.display_order = input.displayOrder;
  }
  if (input.isActive !== undefined) result.is_active = input.isActive;
  return result;
}

async function createCategory(
  input: CreateInstitutionCategoryInput,
): Promise<InstitutionCategoryDto> {
  const payload = mapInput(input);
  if (!payload.code || !payload.name)
    throw new TypeError("code와 name은 필수입니다.");
  const { data, error } = await supabase
    .from("institution_categories")
    .insert(payload as TablesInsert<"institution_categories">)
    .select("*")
    .single();
  if (error) throwContentError(error);
  return mapInstitutionCategory(data);
}

async function updateCategory(
  input: UpdateInstitutionCategoryInput,
): Promise<InstitutionCategoryDto> {
  const id = requireUuid(input.id);
  const { id: _id, ...patch } = input;
  const payload = mapInput(patch);
  const { data, error } = await supabase
    .from("institution_categories")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throwContentError(error);
  return mapInstitutionCategory(data);
}

async function deleteCategory(id: string): Promise<string> {
  const normalizedId = requireUuid(id);
  const { data, error } = await supabase
    .from("institution_categories")
    .delete()
    .eq("id", normalizedId)
    .select("id")
    .single();
  if (error) throwContentError(error);
  return data.id;
}

export const createInstitutionCategoryMutationOptions = () =>
  mutationOptions({
    mutationKey: ["institution-categories", "create"],
    mutationFn: createCategory,
  });
export const updateInstitutionCategoryMutationOptions = () =>
  mutationOptions({
    mutationKey: ["institution-categories", "update"],
    mutationFn: updateCategory,
  });
export const deleteInstitutionCategoryMutationOptions = () =>
  mutationOptions({
    mutationKey: ["institution-categories", "delete"],
    mutationFn: deleteCategory,
  });
