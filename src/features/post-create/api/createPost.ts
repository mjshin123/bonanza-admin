import { mutationOptions } from "@tanstack/react-query";

import type { Tables } from "@shared/api/supabase";

export type CreatedPost = Tables<"posts">;

export type CreatePostInput = {
  boardId: number;
  content: string;
  isPinned: boolean;
  isPublished: boolean;
  organizationId?: string | null;
  publishedAt?: string | null;
  tags: string[];
  thumbnailPath?: string | null;
  title: string;
};

async function createPost(input: CreatePostInput): Promise<CreatedPost> {
  const title = input.title.trim();

  if (!title) {
    throw new TypeError("제목을 입력해주세요.");
  }

  if (!Number.isInteger(input.boardId) || input.boardId < 1) {
    throw new TypeError("올바른 게시판을 선택해주세요.");
  }

  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}

export function createPostMutationOptions() {
  return mutationOptions({
    mutationKey: ["post", "create"],
    mutationFn: createPost,
  });
}
