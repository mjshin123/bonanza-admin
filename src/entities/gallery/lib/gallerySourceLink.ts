import type { GallerySourceType } from "../api/galleryQueries";

type GallerySource = {
  sourceType: GallerySourceType;
  sourceId: string | null;
  sourceCategory: string | null;
};

export function getGallerySourceLabel({
  sourceType,
  sourceCategory,
}: GallerySource): string {
  if (sourceType === "post") {
    if (sourceCategory === "notice") return "공지사항";
    if (sourceCategory === "association_news") return "협회소식";
    if (sourceCategory === "member_news") return "회원기관 소식";
    return "게시글";
  }
  if (sourceType === "resource") return "자료실";
  if (sourceType === "seminar") return "세미나";
  return "독립 갤러리";
}

export function getGallerySourcePath({
  sourceType,
  sourceId,
  sourceCategory,
}: GallerySource): string | null {
  if (sourceType !== "post" || !sourceId) return null;
  if (sourceCategory === "notice") return `/archive/notice/${sourceId}`;
  if (sourceCategory === "association_news")
    return `/archive/news/${sourceId}`;
  if (sourceCategory === "member_news") return `/members/${sourceId}`;
  return null;
}

export function getGallerySourceUrl(
  source: GallerySource,
  publicSiteUrl = import.meta.env.VITE_PUBLIC_SITE_URL,
): string | null {
  const path = getGallerySourcePath(source);
  const baseUrl = publicSiteUrl?.trim();
  if (!path || !baseUrl) return null;

  try {
    return new URL(path, baseUrl).toString();
  } catch {
    return null;
  }
}
