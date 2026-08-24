import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@shared/api/supabase";
import type { Tables } from "@shared/api/supabase";

export type Board = Tables<"boards">;

export const boardQueryKeys = {
  all: ["boards"] as const,
  list: () => [...boardQueryKeys.all, "list"] as const,
  detail: (code: string) => [...boardQueryKeys.all, "detail", code] as const,
};

async function fetchBoards(): Promise<Board[]> {
  const { data, error } = await supabase
    .from("boards")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  return data;
}

async function fetchBoardByCode(code: string): Promise<Board | null> {
  const { data, error } = await supabase
    .from("boards")
    .select("*")
    .eq("code", code)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
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
