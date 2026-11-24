import { mutationOptions } from "@tanstack/react-query";

import type { InstitutionDto } from "@entities/institution";
import {
  requireText,
  requireUuid,
  type InstitutionType,
} from "@shared/api/content";
import type { TablesUpdate } from "@shared/api/supabase";

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

async function createInstitution(
  input: CreateInstitutionInput,
): Promise<InstitutionDto> {
  const payload = mapInput(input);
  if (!payload.institution_type || !payload.name || !payload.logo_file_id)
    throw new TypeError("institutionType, name, logoFileId는 필수입니다.");
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}
async function updateInstitution(
  input: UpdateInstitutionInput,
): Promise<InstitutionDto> {
  const { id, ...patch } = input;
  mapInput(patch);
  requireUuid(id);
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}
export type SwapInstitutionOrderInput = {
  first: { id: string; displayOrder: number };
  second: { id: string; displayOrder: number };
};

async function swapInstitutionOrder(
  input: SwapInstitutionOrderInput,
): Promise<void> {
  requireUuid(input.first.id);
  requireUuid(input.second.id);
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}

async function deleteInstitution(id: string): Promise<string> {
  requireUuid(id);
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}

async function bulkHideInstitutions(ids: string[]): Promise<string[]> {
  ids.map((id) => requireUuid(id));
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}

async function bulkShowInstitutions(ids: string[]): Promise<string[]> {
  ids.map((id) => requireUuid(id));
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}

async function bulkDeleteInstitutions(ids: string[]): Promise<string[]> {
  ids.map((id) => requireUuid(id));
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
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
