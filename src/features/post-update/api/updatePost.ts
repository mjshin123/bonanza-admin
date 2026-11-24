import { mutationOptions } from "@tanstack/react-query";

import type { Tables } from "@shared/api/supabase";

export type UpdatedPost = Tables<"posts">;

export type UpdatePostInput = {
  content: string;
  id: string;
  isPinned: boolean;
  isPublished: boolean;
  organizationId?: string | null;
  publishedAt?: string | null;
  tags: string[];
  thumbnailPath?: string | null;
  title: string;
};

async function updatePost(input: UpdatePostInput): Promise<UpdatedPost> {
  const title = input.title.trim();

  if (!title) {
    throw new TypeError("제목을 입력해주세요.");
  }

  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}

export function updatePostMutationOptions() {
  return mutationOptions({
    mutationKey: ["post", "update"],
    mutationFn: updatePost,
  });
}
