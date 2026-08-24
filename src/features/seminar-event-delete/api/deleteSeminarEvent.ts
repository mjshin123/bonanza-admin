import { mutationOptions } from "@tanstack/react-query";

import { getPostContentImagePaths } from "@entities/post";
import {
  PUBLIC_ASSETS_BUCKET,
  supabase,
} from "@shared/api/supabase";

type SeminarPostAssets = {
  content: string;
  files: { storage_path: string }[];
  thumbnail_path: string | null;
};

async function fetchSeminarPostAssets(postId: string) {
  const { data, error } = await supabase
    .from("posts")
    .select(
      `
        content,
        thumbnail_path,
        files:post_files (storage_path),
        board:boards!inner (code)
      `,
    )
    .eq("id", postId)
    .eq("board.code", "seminar")
    .single();

  if (error) {
    throw error;
  }

  return data as SeminarPostAssets;
}

async function deleteSeminarEvent(postId: string) {
  const post = await fetchSeminarPostAssets(postId);
  const expectedAssetPrefix = `posts/${postId}/`;
  const storagePaths = Array.from(
    new Set(
      [
        post.thumbnail_path,
        ...getPostContentImagePaths(post.content),
        ...post.files.map((file) => file.storage_path),
      ].filter(
        (path): path is string =>
          typeof path === "string" && path.startsWith(expectedAssetPrefix),
      ),
    ),
  );

  if (storagePaths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from(PUBLIC_ASSETS_BUCKET)
      .remove(storagePaths);

    if (storageError) {
      throw storageError;
    }
  }

  const { data, error } = await supabase.rpc("delete_seminar_event", {
    p_post_id: postId,
  });

  if (error) {
    throw error;
  }

  return data;
}

export function deleteSeminarEventMutationOptions() {
  return mutationOptions({
    mutationKey: ["seminar-event", "delete"],
    mutationFn: deleteSeminarEvent,
  });
}
