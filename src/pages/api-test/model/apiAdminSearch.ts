export type ApiAdminView = "list" | "write";

export type ApiAdminSearch = {
  board?: string;
  postId?: string;
  view?: ApiAdminView;
};

export function validateApiAdminSearch(
  search: Record<string, unknown>,
): ApiAdminSearch {
  const board = typeof search.board === "string" ? search.board.trim() : "";
  const postId =
    typeof search.postId === "string" ? search.postId.trim() : "";

  return {
    board: board || undefined,
    postId: postId || undefined,
    view: search.view === "write" ? "write" : undefined,
  };
}
