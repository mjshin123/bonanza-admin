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

