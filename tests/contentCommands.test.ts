import { describe, expect, it } from "vitest";

import { buildContentPostCommand } from "@features/post-manage";
import { buildResourceCommand } from "@features/resource-manage";
import { buildSeminarCommand } from "@features/seminar-manage";
import {
  buildGalleryCommand,
  buildGalleryFiles,
} from "@features/gallery-manage";
import { mapFileDeleteOperation } from "@features/file-delete";

const FILE_ID = "123e4567-e89b-42d3-a456-426614174000";

describe("콘텐츠 command payload", () => {
  it("회원기관 게시물과 파일 순서를 RPC 입력으로 정규화한다", () => {
    const result = buildContentPostCommand({
      category: "member_news",
      content: "본문",
      files: [{ fileId: FILE_ID, role: "cover" }],
      institutionId: FILE_ID,
      status: "published",
      title: " 제목 ",
    });
    expect(result.command).toEqual(
      expect.objectContaining({
        category: "member_news",
        institutionId: FILE_ID,
        status: "published",
        title: "제목",
      }),
    );
    expect(result.command.publishedAt).toEqual(expect.any(String));
    expect(result.files).toEqual([{ fileId: FILE_ID, role: "cover" }]);
  });

  it("회원기관 소식의 기관 누락을 차단한다", () => {
    expect(() =>
      buildContentPostCommand({
        category: "member_news",
        content: "본문",
        title: "제목",
      }),
    ).toThrow("institutionId");
  });

  it("자료 기준연도와 세미나 모집 인원을 검증한다", () => {
    expect(() =>
      buildResourceCommand({
        category: "financial_disclosure",
        referenceYear: 1800,
        title: "자료",
      }),
    ).toThrow("1900~2100");
    expect(() =>
      buildSeminarCommand({
        capacity: 0,
        location: "서울",
        selectionMethod: "first_come",
        startsAt: "2026-09-01T00:00:00.000Z",
        title: "세미나",
      }),
    ).toThrow("1 이상");
  });

  it("갤러리 command와 caption을 정규화한다", () => {
    expect(buildGalleryCommand({ title: " 갤러리 ", displayOrder: 2 })).toEqual(
      expect.objectContaining({ title: "갤러리", displayOrder: 2 }),
    );
    expect(buildGalleryFiles([{ fileId: FILE_ID }])).toEqual([
      { fileId: FILE_ID, caption: "" },
    ]);
    expect(() =>
      buildGalleryFiles([{ fileId: FILE_ID, caption: "x".repeat(501) }]),
    ).toThrow("500자");
  });
});

describe("파일 삭제 보상 응답", () => {
  it("서버가 발급한 삭제 operation을 변환한다", () => {
    expect(
      mapFileDeleteOperation({
        bucketName: "public-assets",
        fileId: FILE_ID,
        operationId: FILE_ID,
        storagePath: "assets/file.png",
      }),
    ).toEqual({
      bucketName: "public-assets",
      fileId: FILE_ID,
      operationId: FILE_ID,
      storagePath: "assets/file.png",
    });
  });

  it("불완전한 operation 응답을 거부한다", () => {
    expect(() => mapFileDeleteOperation({ fileId: FILE_ID })).toThrow(
      "올바르지 않습니다",
    );
  });
});
