import { describe, expect, it } from "vitest";

import {
  getWebAnalyticsDateBounds,
  getWebAnalyticsPresetRange,
  webAnalyticsDateRangeSchema,
} from "../src/entities/web-analytics/model/webAnalytics";

const KST_AFTERNOON = new Date("2026-08-26T05:00:00.000Z");

describe("방문 통계 조회 기간", () => {
  it("한국 시간 기준 어제와 6개월 조회 하한을 계산한다", () => {
    expect(getWebAnalyticsDateBounds(KST_AFTERNOON)).toEqual({
      earliest: "2026-02-26",
      yesterday: "2026-08-25",
    });
  });

  it.each([
    ["7d", "2026-08-19", "2026-08-25"],
    ["30d", "2026-07-27", "2026-08-25"],
    ["3m", "2026-05-26", "2026-08-25"],
    ["6m", "2026-02-26", "2026-08-25"],
  ] as const)("%s 퀵 기간은 어제까지의 완결된 기간이다", (preset, from, to) => {
    expect(getWebAnalyticsPresetRange(preset, KST_AFTERNOON)).toEqual({
      from,
      to,
    });
  });

  it("UTC 날짜가 달라도 한국 날짜를 기준으로 계산한다", () => {
    const afterKstMidnight = new Date("2026-08-25T16:00:00.000Z");

    expect(getWebAnalyticsPresetRange("7d", afterKstMidnight)).toEqual({
      from: "2026-08-19",
      to: "2026-08-25",
    });
  });

  it("실재하지 않는 날짜와 역전된 기간을 거부한다", () => {
    expect(
      webAnalyticsDateRangeSchema.safeParse({
        from: "2026-02-30",
        to: "2026-03-01",
      }).success,
    ).toBe(false);
    expect(
      webAnalyticsDateRangeSchema.safeParse({
        from: "2026-08-25",
        to: "2026-08-24",
      }).success,
    ).toBe(false);
  });
});
