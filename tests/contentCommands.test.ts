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
      files: [{ fileId: FILE_ID, role: "cover", showInGallery: true }],
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
    expect(result.command).not.toHaveProperty("summary");
    expect(result.files).toEqual([
      { fileId: FILE_ID, role: "cover", showInGallery: true },
    ]);
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

  it("세미나 시작 일시를 검증한다", () => {
    expect(() =>
      buildSeminarCommand({
        startsAt: "invalid-date",
        title: "세미나",
      }),
    ).toThrow("유효한 일시");
  });

  it("자료와 세미나 command에 요약 필드를 포함하지 않는다", () => {
    expect(
      buildResourceCommand({ category: "seminar_material", title: "자료" }),
    ).not.toHaveProperty("summary");
    expect(
      buildSeminarCommand({ startsAt: new Date().toISOString(), title: "행사" }),
    ).not.toHaveProperty("resultSummary");
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
