import { mutationOptions } from "@tanstack/react-query";

import { supabase } from "@shared/api/supabase";
import type { Tables } from "@shared/api/supabase";
import { normalizeTags } from "@shared/lib";

export type UpdatedPost = Tables<"posts">;

export type UpdatePostInput = {
  caption: string;
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
  const caption = input.caption.trim();

  if (!title) {
    throw new TypeError("제목을 입력해주세요.");
  }

  if (caption.length > 200) {
    throw new RangeError("캡션은 200자 이하여야 합니다.");
  }

  const { data, error } = await supabase
    .from("posts")
    .update({
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
    .eq("id", input.id)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export function updatePostMutationOptions() {
  return mutationOptions({
    mutationKey: ["post", "update"],
    mutationFn: updatePost,
  });
}
