import { queryOptions } from "@tanstack/react-query";

export type Board = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export const boardQueryKeys = {
  all: ["boards"] as const,
  list: () => [...boardQueryKeys.all, "list"] as const,
  detail: (code: string) => [...boardQueryKeys.all, "detail", code] as const,
};

async function fetchBoards(): Promise<Board[]> {
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}

async function fetchBoardByCode(_code: string): Promise<Board | null> {
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}

export function boardsQueryOptions() {
  return queryOptions({
    queryKey: boardQueryKeys.list(),
    queryFn: fetchBoards,
  });
}

export function boardByCodeQueryOptions(code: string) {
  return queryOptions({
    queryKey: boardQueryKeys.detail(code),
    queryFn: () => fetchBoardByCode(code),
  });
}
