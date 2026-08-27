import { describe, expect, it } from "vitest";

import {
  adminPostsQueryOptions,
  mapContentPostListRow,
  postsQueryOptions,
} from "@entities/post";
import {
  adminResourcesQueryOptions,
  mapResourceListRow,
  resourcesQueryOptions,
} from "@entities/resource";
import {
  adminSeminarsQueryOptions,
  mapSeminarListRow,
  seminarsQueryOptions,
} from "@entities/seminar";
import {
  adminGalleriesQueryOptions,
  adminGalleryPhotosQueryOptions,
  galleriesQueryOptions,
  getGallerySourceLabel,
  mapAdminGalleryPhotoListRow,
  mapGalleryListRow,
} from "@entities/gallery";
import { mapAdminFileListRow } from "@entities/file";
import { mapInstitutionCategory } from "@entities/institution-category";
import {
  adminHistoryEntriesQueryOptions,
  mapHistoryEntry,
  parseHistoryContent,
  validateHistoryContent,
} from "@entities/history-entry";

const ID = "123e4567-e89b-42d3-a456-426614174000";
const NOW = "2026-08-24T00:00:00.000Z";
const FILE_JSON = {
  alt_text: "대체 텍스트",
  bucket_name: "public-assets",
  created_at: NOW,
  file_kind: "image",
  height_px: 200,
  id: ID,
  mime_type: "image/png",
  original_name: "cover.png",
  size_bytes: 100,
  storage_path: "cover.png",
  updated_at: NOW,
  width_px: 300,
};

describe("v2 Query key", () => {
  it("검색어를 정규화하고 public/admin cache를 분리한다", () => {
    const publicPost = postsQueryOptions({ q: "  검색어  " }).queryKey;
    const adminPost = adminPostsQueryOptions({ q: "검색어" }).queryKey;
    expect(publicPost).toEqual([
      "content-posts",
      "public",
      "list",
      expect.objectContaining({ q: "검색어" }),
    ]);
    expect(adminPost[1]).toBe("admin");
    expect(adminPost).not.toEqual(publicPost);

    expect(resourcesQueryOptions().queryKey[1]).toBe("public");
    expect(adminResourcesQueryOptions().queryKey[1]).toBe("admin");
    expect(seminarsQueryOptions().queryKey[1]).toBe("public");
    expect(adminSeminarsQueryOptions().queryKey[1]).toBe("admin");
    expect(galleriesQueryOptions().queryKey[1]).toBe("public");
    expect(adminGalleriesQueryOptions().queryKey[1]).toBe("admin");
    expect(adminGalleryPhotosQueryOptions({ q: "  제목  " }).queryKey).toEqual([
      "galleries",
      "admin",
      "photos",
      expect.objectContaining({ q: "제목" }),
    ]);
    expect(adminHistoryEntriesQueryOptions({ year: 2026 }).queryKey).toEqual([
      "history-entries",
      "admin",
      "list",
      expect.objectContaining({ year: 2026 }),
    ]);
  });

  it("연혁 행을 DTO로 변환한다", () => {
    expect(
      mapHistoryEntry({
        content: "**협회 설립** (1월)",
        created_at: NOW,
        id: ID,
        is_visible: true,
        position: 0,
        updated_at: NOW,
        year: 2023,
      }),
    ).toEqual({
      content: "**협회 설립** (1월)",
      createdAt: NOW,
      id: ID,
      isVisible: true,
      position: 0,
      updatedAt: NOW,
      year: 2023,
    });
  });
});

describe("연혁 강조 문법", () => {
  it("**로 감싼 부분만 강조 조각으로 변환한다", () => {
    expect(parseHistoryContent("협회 **본사무소 이전** (2월)")).toEqual([
      { text: "협회 ", emphasized: false },
      { text: "본사무소 이전", emphasized: true },
      { text: " (2월)", emphasized: false },
    ]);
  });

  it("닫히지 않거나 비어 있는 강조 문법을 거부한다", () => {
    expect(validateHistoryContent("협회 **설립")).toContain("닫아주세요");
    expect(validateHistoryContent("협회 **** 설립")).toContain("문구");
  });
});

describe("목록 RPC DTO 매핑", () => {
  it("기관 분류의 적용 대상을 DTO로 변환한다", () => {
    const result = mapInstitutionCategory({
      code: "bank",
      created_at: NOW,
      display_order: 0,
      id: ID,
      institution_type: "partner",
      is_active: true,
      name: "은행",
      updated_at: NOW,
    });

    expect(result.institutionType).toBe("partner");
  });

  it("게시물의 기관과 cover를 목록 DTO로 변환한다", () => {
    const result = mapContentPostListRow(
      {
        category: "member_news",
        cover: FILE_JSON,
        created_at: NOW,
        id: ID,
        institution: {
          id: ID,
          institution_type: "member",
          logo: FILE_JSON,
          name: "회원사",
        },
        is_pinned: true,
        published_at: NOW,
        status: "published",
        title: "제목",
        total_count: 1,
        updated_at: NOW,
      },
      false,
    );
    expect(result.institution?.name).toBe("회원사");
    expect(result.cover?.originalName).toBe("cover.png");
    expect(result).not.toHaveProperty("status");
  });

  it("자료·세미나·갤러리의 집계와 대표 이미지를 변환한다", () => {
    const resource = mapResourceListRow(
      {
        category: "resource",
        created_at: NOW,
        file_count: 3,
        id: ID,
        published_at: NOW,
        status: "published",
        title: "자료",
        total_count: 1,
        updated_at: NOW,
      },
      false,
    );
    const seminar = mapSeminarListRow(
      {
        created_at: NOW,
        ends_at: NOW,
        id: ID,
        introduction: "소개",
        location: "서울",
        poster: FILE_JSON,
        published_at: NOW,
        starts_at: NOW,
        status: "published",
        title: "세미나",
        total_count: 1,
        updated_at: NOW,
      },
      false,
    );
    const gallery = mapGalleryListRow(
      {
        cover_image: FILE_JSON,
        created_at: NOW,
        description: "설명",
        display_order: 0,
        event_date: "2026-08-24",
        id: ID,
        item_count: 4,
        published_at: NOW,
        source_category: "notice",
        source_id: ID,
        source_type: "post",
        status: "published",
        title: "갤러리",
        total_count: 1,
        updated_at: NOW,
      },
      false,
    );
    expect(resource.fileCount).toBe(3);
    expect(seminar.poster?.id).toBe(ID);
    expect(gallery.itemCount).toBe(4);
    expect(gallery.sourceType).toBe("post");
    expect(gallery.sourceId).toBe(ID);
    expect(gallery.sourceCategory).toBe("notice");

    const galleryPhoto = mapAdminGalleryPhotoListRow({
      event_date: "2026-08-24",
      file_id: ID,
      gallery_id: ID,
      photo: FILE_JSON,
      source_category: "notice",
      source_id: ID,
      source_type: "post",
      title: "갤러리",
      total_count: 4,
    });
    expect(galleryPhoto.photo.originalName).toBe("cover.png");
    expect(galleryPhoto.galleryId).toBe(ID);
  });

  it("파일 사용량을 합산해 사용 여부를 판정한다", () => {
    const result = mapAdminFileListRow({
      ...FILE_JSON,
      gallery_count: 0,
      institution_logo_count: 0,
      post_count: 1,
      resource_count: 0,
      seminar_count: 0,
      total_count: 1,
      uploaded_by: ID,
    });
    expect(result.isUsed).toBe(true);
    expect(result.usage.postCount).toBe(1);
  });
});

describe("갤러리 원문 라벨", () => {
  it("출처 유형과 게시글 카테고리를 라벨로 변환한다", () => {
    expect(
      getGallerySourceLabel({
        sourceType: "post",
        sourceId: ID,
        sourceCategory: "notice",
      }),
    ).toBe("공지사항");
    expect(
      getGallerySourceLabel({
        sourceType: "resource",
        sourceId: ID,
        sourceCategory: null,
      }),
    ).toBe("자료실");
    expect(
      getGallerySourceLabel({
        sourceType: "seminar",
        sourceId: ID,
        sourceCategory: null,
      }),
    ).toBe("세미나");
  });
});
