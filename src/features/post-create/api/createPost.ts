import { mutationOptions } from "@tanstack/react-query";

import { supabase } from "@shared/api/supabase";
import type { Tables } from "@shared/api/supabase";
import { normalizeTags } from "@shared/lib";

export type CreatedPost = Tables<"posts">;

export type CreatePostInput = {
  boardId: number;
  caption: string;
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
  const caption = input.caption.trim();

  if (!title) {
    throw new TypeError("제목을 입력해주세요.");
  }

  if (!Number.isInteger(input.boardId) || input.boardId < 1) {
    throw new TypeError("올바른 게시판을 선택해주세요.");
  }

  if (caption.length > 200) {
    throw new RangeError("캡션은 200자 이하여야 합니다.");
  }

  const { data, error } = await supabase
    .from("posts")
    .insert({
      board_id: input.boardId,
      caption,
      content: input.content,
      is_pinned: input.isPinned,
      is_published: input.isPublished,
      organization_id: input.organizationId || null,
      published_at: input.isPublished
        ? input.publishedAt ?? new Date().toISOString()
        : null,
      tags: normalizeTags(input.tags),
      thumbnail_path: input.thumbnailPath ?? null,
      title,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export function createPostMutationOptions() {
  return mutationOptions({
    mutationKey: ["post", "create"],
    mutationFn: createPost,
  });
}
