import { mutationOptions } from "@tanstack/react-query";

import {
  mapHistoryEntry,
  normalizeHistoryContent,
  type HistoryEntryDto,
} from "@entities/history-entry";
import {
  requireExpectedUpdatedAt,
  requireUuid,
  throwContentError,
} from "@shared/api/content";
import { supabase } from "@shared/api/supabase";
import type { Tables } from "@shared/api/supabase";

export type CreateHistoryEntryInput = {
  year: number;
  content: string;
  isVisible?: boolean;
};

export type UpdateHistoryEntryInput = Required<CreateHistoryEntryInput> & {
  id: string;
  expectedUpdatedAt: string;
};

export type MoveHistoryEntryInput = {
  id: string;
  direction: -1 | 1;
};

function normalizeYear(year: number): number {
  if (!Number.isInteger(year) || year < 1900 || year > 2999) {
    throw new RangeError("연도는 1900 이상 2999 이하로 입력해주세요.");
  }
  return year;
}

async function saveHistoryEntry(
  input: CreateHistoryEntryInput | UpdateHistoryEntryInput,
): Promise<HistoryEntryDto> {
  const isUpdate = "id" in input;
  const { data, error } = await supabase.rpc("save_history_entry", {
    p_content: normalizeHistoryContent(input.content),
    p_expected_updated_at: isUpdate
      ? requireExpectedUpdatedAt(input.expectedUpdatedAt)
      : undefined,
    p_id: isUpdate ? requireUuid(input.id) : undefined,
    p_is_visible: input.isVisible ?? true,
    p_year: normalizeYear(input.year),
  });
  if (error) throwContentError(error);
  return mapHistoryEntry(data as Tables<"history_entries">);
}

async function deleteHistoryEntry(id: string): Promise<string> {
  const normalizedId = requireUuid(id);
  const { data, error } = await supabase
    .from("history_entries")
    .delete()
    .eq("id", normalizedId)
    .select("id")
    .single();
  if (error) throwContentError(error);
  return data.id;
}

async function moveHistoryEntry(
  input: MoveHistoryEntryInput,
): Promise<HistoryEntryDto> {
  const { data, error } = await supabase.rpc("move_history_entry", {
    p_direction: input.direction,
    p_id: requireUuid(input.id),
  });
  if (error) throwContentError(error);
  return mapHistoryEntry(data as Tables<"history_entries">);
}

export const createHistoryEntryMutationOptions = () =>
  mutationOptions({
    mutationKey: ["history-entries", "create"],
    mutationFn: (input: CreateHistoryEntryInput) => saveHistoryEntry(input),
  });

export const updateHistoryEntryMutationOptions = () =>
  mutationOptions({
    mutationKey: ["history-entries", "update"],
    mutationFn: (input: UpdateHistoryEntryInput) => saveHistoryEntry(input),
  });

export const deleteHistoryEntryMutationOptions = () =>
  mutationOptions({
    mutationKey: ["history-entries", "delete"],
    mutationFn: deleteHistoryEntry,
  });

export const moveHistoryEntryMutationOptions = () =>
  mutationOptions({
    mutationKey: ["history-entries", "move"],
    mutationFn: moveHistoryEntry,
  });
