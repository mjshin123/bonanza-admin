import { z } from "zod";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1_000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1_000;

function parseDate(date: string): Date | null {
  if (!DATE_PATTERN.test(date)) return null;
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
    ? null
    : parsed;
}

function addDays(date: string, days: number): string {
  const parsed = parseDate(date);
  if (!parsed) throw new TypeError("날짜 형식이 올바르지 않습니다.");
  return new Date(parsed.getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

function subtractMonths(date: string, months: number): string {
  const parsed = parseDate(date);
  if (!parsed) throw new TypeError("날짜 형식이 올바르지 않습니다.");

  const targetMonthIndex =
    parsed.getUTCFullYear() * 12 + parsed.getUTCMonth() - months;
  const targetYear = Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
  const lastDay = new Date(
    Date.UTC(targetYear, targetMonth + 1, 0),
  ).getUTCDate();

  return new Date(
    Date.UTC(targetYear, targetMonth, Math.min(parsed.getUTCDate(), lastDay)),
  )
    .toISOString()
    .slice(0, 10);
}

export const webAnalyticsDateSchema = z
  .string()
  .refine(
    (value) => parseDate(value) !== null,
    "날짜 형식이 올바르지 않습니다.",
  );

export const webAnalyticsDateRangeSchema = z
  .object({
    from: webAnalyticsDateSchema,
    to: webAnalyticsDateSchema,
  })
  .refine(({ from, to }) => from <= to, {
    message: "시작일은 종료일보다 늦을 수 없습니다.",
    path: ["from"],
  });

export type WebAnalyticsPreset = "7d" | "30d" | "3m" | "6m";

export function getWebAnalyticsDateBounds(now = new Date()) {
  const today = new Date(now.getTime() + KST_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
  const yesterday = addDays(today, -1);

  return {
    earliest: addDays(subtractMonths(yesterday, 6), 1),
    yesterday,
  };
}

export function getWebAnalyticsPresetRange(
  preset: WebAnalyticsPreset,
  now = new Date(),
) {
  const { yesterday } = getWebAnalyticsDateBounds(now);
  const from =
    preset === "7d"
      ? addDays(yesterday, -6)
      : preset === "30d"
        ? addDays(yesterday, -29)
        : addDays(subtractMonths(yesterday, preset === "3m" ? 3 : 6), 1);

  return { from, to: yesterday };
}

const metricSchema = z.object({
  pageViews: z.number().nonnegative(),
  visits: z.number().nonnegative(),
});

const dailyMetricSchema = metricSchema.extend({
  date: z.string(),
});

const rankedMetricSchema = z.object({
  label: z.string(),
  value: z.number().nonnegative(),
});

const deviceMetricSchema = z.object({
  label: z.string(),
  pageViews: z.number().nonnegative(),
  share: z.number().min(0).max(100),
});

export const webAnalyticsResponseSchema = z.object({
  period: webAnalyticsDateRangeSchema,
  generatedAt: z.string(),
  timeZone: z.literal("Asia/Seoul"),
  summary: metricSchema.extend({
    previousVisits: z.number().nonnegative(),
    visitChangeRate: z.number().nullable(),
  }),
  daily: z.array(dailyMetricSchema),
  topPages: z.array(rankedMetricSchema),
  topReferrers: z.array(rankedMetricSchema),
  devices: z.array(deviceMetricSchema),
});

export type WebAnalyticsDateRange = z.infer<typeof webAnalyticsDateRangeSchema>;
export type WebAnalyticsResponse = z.infer<typeof webAnalyticsResponseSchema>;
