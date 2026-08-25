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
  galleriesQueryOptions,
  mapGalleryListRow,
} from "@entities/gallery";
import { mapAdminFileListRow } from "@entities/file";

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
  });
});

describe("목록 RPC DTO 매핑", () => {
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
