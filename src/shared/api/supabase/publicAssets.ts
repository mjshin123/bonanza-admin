export const PUBLIC_ASSETS_BUCKET = "local-assets";

export function getPublicAssetUrl(
  storagePath: string | null | undefined,
  _bucketName = PUBLIC_ASSETS_BUCKET,
) {
  return storagePath ? `/assets/${storagePath.replace(/^\/+/, "")}` : null;
}
