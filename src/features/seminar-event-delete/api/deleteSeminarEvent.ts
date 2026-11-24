import { mutationOptions } from "@tanstack/react-query";

async function deleteSeminarEvent(postId: string): Promise<string> {
  void postId;
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}

export function deleteSeminarEventMutationOptions() {
  return mutationOptions({
    mutationKey: ["seminar-event", "delete"],
    mutationFn: deleteSeminarEvent,
  });
}
