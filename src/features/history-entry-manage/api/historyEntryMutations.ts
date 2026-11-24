import { mutationOptions } from "@tanstack/react-query";

import {
  normalizeHistoryContent,
  type HistoryEntryDto,
} from "@entities/history-entry";
import { requireExpectedUpdatedAt, requireUuid } from "@shared/api/content";

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
  normalizeHistoryContent(input.content);
  if (isUpdate) {
    requireExpectedUpdatedAt(input.expectedUpdatedAt);
    requireUuid(input.id);
  }
  normalizeYear(input.year);
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}

async function deleteHistoryEntry(id: string): Promise<string> {
  requireUuid(id);
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}

async function moveHistoryEntry(
  input: MoveHistoryEntryInput,
): Promise<HistoryEntryDto> {
  requireUuid(input.id);
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
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
