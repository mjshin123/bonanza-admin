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
  categoryId: string;
  name: string;
  logoFileId?: string | null;
  description?: string;
  homepageUrl?: string | null;
  displayOrder?: number;
  isActive?: boolean;
  isPending?: boolean;
};
export type UpdateInstitutionInput = Partial<CreateInstitutionInput> & {
  id: string;
};

const SELECT = "*, category:institution_categories!inner(*), logo:files(*)";
type Joined = Tables<"institutions"> & {
  category: Tables<"institution_categories">;
  logo: Tables<"files"> | null;
};

function mapInput(
  input: Partial<CreateInstitutionInput>,
): TablesUpdate<"institutions"> {
  const payload: TablesUpdate<"institutions"> = {};
  if (input.institutionType !== undefined)
    payload.institution_type = input.institutionType;
  if (input.categoryId !== undefined)
    payload.category_id = requireUuid(input.categoryId, "categoryId");
  if (input.name !== undefined)
    payload.name = requireText(input.name, "name", 200);
  if (input.logoFileId !== undefined)
    payload.logo_file_id =
      input.logoFileId === null
        ? null
        : requireUuid(input.logoFileId, "logoFileId");
  if (input.description !== undefined) payload.description = input.description;
  if (input.homepageUrl !== undefined) {
    if (input.homepageUrl !== null) {
      const url = new URL(input.homepageUrl);
      if (
        !["http:", "https:"].includes(url.protocol) ||
        input.homepageUrl.length > 2048
      ) {
        throw new TypeError(
          "homepageUrl은 2,048자 이하의 HTTP(S) URL이어야 합니다.",
        );
      }
    }
    payload.homepage_url = input.homepageUrl;
  }
  if (input.displayOrder !== undefined) {
    if (!Number.isInteger(input.displayOrder) || input.displayOrder < 0)
      throw new RangeError("displayOrder는 0 이상의 정수여야 합니다.");
    payload.display_order = input.displayOrder;
  }
  if (input.isActive !== undefined) payload.is_active = input.isActive;
  if (input.isPending !== undefined) payload.is_pending = input.isPending;
  return payload;
}

async function nextDisplayOrder() {
  const { data, error } = await supabase
    .from("institutions")
    .select("display_order")
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
  if (!payload.institution_type || !payload.category_id || !payload.name)
    throw new TypeError("institutionType, categoryId, name은 필수입니다.");
  if (payload.display_order === undefined)
    payload.display_order = await nextDisplayOrder();
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
export type ReorderInstitutionsInput = Array<{
  id: string;
  displayOrder: number;
}>;

async function reorderInstitutions(input: ReorderInstitutionsInput) {
  const results = await Promise.all(
    input.map((entry) =>
      supabase
        .from("institutions")
        .update({ display_order: entry.displayOrder })
        .eq("id", requireUuid(entry.id)),
    ),
  );
  const failed = results.find((result) => result.error);
  if (failed?.error) throwContentError(failed.error);
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
export const reorderInstitutionsMutationOptions = () =>
  mutationOptions({
    mutationKey: ["institutions", "reorder"],
    mutationFn: reorderInstitutions,
  });
export const bulkHideInstitutionsMutationOptions = () =>
  mutationOptions({
    mutationKey: ["institutions", "bulk-hide"],
    mutationFn: bulkHideInstitutions,
  });
export const bulkDeleteInstitutionsMutationOptions = () =>
  mutationOptions({
    mutationKey: ["institutions", "bulk-delete"],
    mutationFn: bulkDeleteInstitutions,
  });
