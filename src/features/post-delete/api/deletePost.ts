import { mutationOptions } from "@tanstack/react-query";

import { getPostContentImagePaths } from "@entities/post";
import {
  PUBLIC_ASSETS_BUCKET,
  supabase,
} from "@shared/api/supabase";

type PostAssets = {
  content: string;
  files: { storage_path: string }[];
  id: string;
  thumbnail_path: string | null;
};

async function deletePost(id: string): Promise<string> {
  const { data: post, error: fetchError } = await supabase
    .from("posts")
    .select("id, content, thumbnail_path, files:post_files(storage_path)")
    .eq("id", id)
    .single();

  if (fetchError) {
    throw fetchError;
  }

  const assets = post as PostAssets;
  const expectedAssetPrefix = `posts/${id}/`;
  const storagePaths = Array.from(
    new Set(
      [
        assets.thumbnail_path,
        ...getPostContentImagePaths(assets.content),
        ...assets.files.map((file) => file.storage_path),
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

  const { data, error } = await supabase
    .from("posts")
    .delete()
    .eq("id", id)
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("삭제할 게시물을 찾지 못했습니다.");
  }

  return data.id;
}

export function deletePostMutationOptions() {
  return mutationOptions({
    mutationKey: ["post", "delete"],
    mutationFn: deletePost,
  });
}
