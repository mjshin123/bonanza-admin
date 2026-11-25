import { describe, expect, it } from "vitest";

import { validateApiAdminSearch } from "../src/pages/api-test/model/apiAdminSearch";

describe("관리자 화면 검색 파라미터", () => {
  it.each([
    "institutions",
    "posts",
    "resources",
    "galleries",
    "history",
  ])("콘텐츠 관리 섹션 %s를 허용한다", (section) => {
    expect(validateApiAdminSearch({ section })).toEqual({ section });
  });

  it("알 수 없는 섹션과 기존 게시판 파라미터를 제거한다", () => {
    expect(
      validateApiAdminSearch({ board: "notice", section: "unknown" }),
    ).toEqual({ section: undefined });
  });
});
