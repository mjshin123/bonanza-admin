import { z } from "zod";

export const webAnalyticsRangeSchema = z.enum(["7d", "30d"]);

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
  range: webAnalyticsRangeSchema,
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

export type WebAnalyticsRange = z.infer<typeof webAnalyticsRangeSchema>;
export type WebAnalyticsResponse = z.infer<
  typeof webAnalyticsResponseSchema
>;
