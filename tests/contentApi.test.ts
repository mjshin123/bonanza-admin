import { describe, expect, it } from "vitest";

import {
  ContentApiError,
  mapFile,
  normalizeFileItems,
  normalizePublishedAt,
  pageResult,
  requireText,
  requireUuid,
  requireExpectedUpdatedAt,
  resolvePageParams,
  throwContentError,
} from "@shared/api/content";

const FILE_ID = "123e4567-e89b-42d3-a456-426614174000";

describe("content API 입력 정규화", () => {
  it("기본 페이지와 명시한 페이지를 정규화한다", () => {
    expect(resolvePageParams()).toEqual({ page: 1, pageSize: 10 });
    expect(resolvePageParams({ page: 3, pageSize: 50 })).toEqual({
      page: 3,
      pageSize: 50,
    });
  });

  it("페이지 범위, UUID, 필수 문자열을 검증한다", () => {
    expect(() => resolvePageParams({ page: 0 })).toThrow(RangeError);
    expect(() => resolvePageParams({ pageSize: 101 })).toThrow(RangeError);
    expect(requireUuid(` ${FILE_ID} `)).toBe(FILE_ID);
    expect(() => requireUuid("not-a-uuid")).toThrow(TypeError);
    expect(requireText("  제목  ", "title", 20)).toBe("제목");
  });

  it("공개 전환 시 게시일을 보완하고 페이지 결과를 계산한다", () => {
    expect(normalizePublishedAt("published", null)).toMatch(
      /^\d{4}-\d{2}-\d{2}T/,
    );
    expect(pageResult(["item"], 21, { page: 2, pageSize: 10 })).toEqual({
      items: ["item"],
      page: 2,
      pageSize: 10,
      total: 21,
      totalPages: 3,
    });
  });

  it("optimistic timestamp와 파일 관계 배열을 정규화한다", () => {
    expect(
      requireExpectedUpdatedAt(" 2026-08-25T01:56:14.282999+00:00 "),
    ).toBe("2026-08-25T01:56:14.282999+00:00");
    expect(requireExpectedUpdatedAt("2026-08-24T09:00:00+09:00")).toBe(
      "2026-08-24T09:00:00+09:00",
    );
    expect(() => requireExpectedUpdatedAt("invalid-date")).toThrow(TypeError);
    expect(normalizeFileItems([{ fileId: ` ${FILE_ID} ` }])).toEqual([
      { fileId: FILE_ID },
    ]);
    expect(() =>
      normalizeFileItems([{ fileId: FILE_ID }, { fileId: FILE_ID }]),
    ).toThrow("중복");
    expect(() =>
      normalizeFileItems(
        Array.from({ length: 1001 }, (_, index) => ({
          fileId: `${index}`,
        })),
      ),
    ).toThrow("1,000개");
  });
});

describe("파일 DTO와 오류 매핑", () => {
  it("로컬 정적 경로로 파일 URL을 만든다", () => {
    const file = mapFile({
      alt_text: null,
      bucket_name: "custom-bucket",
      created_at: "2026-08-24T00:00:00.000Z",
      file_kind: "image",
      height_px: 200,
      id: FILE_ID,
      mime_type: "image/png",
      original_name: "sample.png",
      size_bytes: 100,
      storage_path: "images/sample.png",
      updated_at: "2026-08-24T00:00:00.000Z",
      width_px: 300,
    });

    expect(file.url).toBe("/assets/images/sample.png");
  });

  it.each([
    ["PGRST116", "NOT_FOUND"],
    ["23503", "IN_USE"],
    ["23505", "CONFLICT"],
    ["23514", "INVALID_STATE"],
    ["P0002", "NOT_FOUND"],
    ["40001", "CONFLICT"],
    ["22023", "INVALID_STATE"],
  ] as const)("DB 오류 %s를 %s로 변환한다", (databaseCode, apiCode) => {
    try {
      throwContentError({ code: databaseCode });
    } catch (error) {
      expect(error).toBeInstanceOf(ContentApiError);
      expect((error as ContentApiError).code).toBe(apiCode);
    }
  });
});
