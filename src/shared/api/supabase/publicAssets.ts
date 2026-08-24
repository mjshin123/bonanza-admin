import { supabase } from "./client";

export const PUBLIC_ASSETS_BUCKET = "public-assets";

export function getPublicAssetUrl(storagePath: string | null | undefined) {
  if (!storagePath) {
    return null;
  }

  const { data } = supabase.storage
    .from(PUBLIC_ASSETS_BUCKET)
    .getPublicUrl(storagePath);

  return data.publicUrl;
}
