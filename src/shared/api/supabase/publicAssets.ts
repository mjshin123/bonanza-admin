import { supabase } from "./client";

export const PUBLIC_ASSETS_BUCKET = "public-assets";

export function getPublicAssetUrl(
  storagePath: string | null | undefined,
  bucketName = PUBLIC_ASSETS_BUCKET,
) {
  if (!storagePath) {
    return null;
  }

  const { data } = supabase.storage
    .from(bucketName)
    .getPublicUrl(storagePath);

  return data.publicUrl;
}
