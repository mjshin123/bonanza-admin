import { mutationOptions } from "@tanstack/react-query";

import {
  normalizeSeminarEventValues,
  type SeminarEventValues,
} from "@entities/seminar-event";

export type UpdateSeminarEventInput = SeminarEventValues & {
  postId: string;
};

async function updateSeminarEvent(
  input: UpdateSeminarEventInput,
): Promise<string> {
  normalizeSeminarEventValues(input);
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}

export function updateSeminarEventMutationOptions() {
  return mutationOptions({
    mutationKey: ["seminar-event", "update"],
    mutationFn: updateSeminarEvent,
  });
}
