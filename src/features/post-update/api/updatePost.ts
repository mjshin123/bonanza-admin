import { mutationOptions } from "@tanstack/react-query";

import { supabase } from "@shared/api/supabase";
import type { Tables } from "@shared/api/supabase";
import { normalizeTags } from "@shared/lib";

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

  const { data, error } = await supabase
    .from("posts")
    .update({
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
