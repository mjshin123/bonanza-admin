import { mutationOptions } from "@tanstack/react-query";

import {
  normalizeSeminarEventValues,
  type SeminarEventValues,
} from "@entities/seminar-event";

export type CreateSeminarEventInput = SeminarEventValues;

async function createSeminarEvent(
  input: CreateSeminarEventInput,
): Promise<string> {
  normalizeSeminarEventValues(input);
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}

export function createSeminarEventMutationOptions() {
  return mutationOptions({
    mutationKey: ["seminar-event", "create"],
    mutationFn: createSeminarEvent,
  });
}
