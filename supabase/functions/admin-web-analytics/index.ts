import { createClient } from "npm:@supabase/supabase-js@2.112.1";

const CLOUDFLARE_GRAPHQL_URL = "https://api.cloudflare.com/client/v4/graphql";
const KST_OFFSET_MS = 9 * 60 * 60 * 1_000;
const DAY_MS = 24 * 60 * 60 * 1_000;
const MAX_DAYS_PER_QUERY = 31;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type AnalyticsRange = "7d" | "30d";

type AnalyticsDateRange = {
  from: string;
  to: string;
};

type DayWindow = {
  date: string;
  end: string;
  start: string;
};

type OverviewWindows = {
  periodEnd: string;
  periodStart: string;
  previousEnd: string;
  previousStart: string;
  todayEnd: string;
  todayStart: string;
};

type AnalyticsGroup = {
  count?: number | string | null;
  dimensions?: {
    deviceType?: string | null;
    refererHost?: string | null;
    requestPath?: string | null;
  } | null;
  sum?: {
    visits?: number | string | null;
  } | null;
};

type CloudflareAccount = Record<string, AnalyticsGroup[] | undefined>;

type CloudflareGraphqlResponse = {
  data?: {
    viewer?: {
      accounts?: CloudflareAccount[];
    };
  };
  errors?: Array<{ message?: string }>;
};

class FunctionError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Cache-Control": "private, max-age=300",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function getRequiredEnvironment(name: string): string {
  const value = Deno.env.get(name)?.trim();

  if (!value) {
    throw new FunctionError("방문 통계 연동 설정이 완료되지 않았습니다.", 503);
  }

  return value;
}

function toDateLabel(dayTimestamp: number): string {
  return new Date(dayTimestamp).toISOString().slice(0, 10);
}

function toKstMidnightUtc(date: string): Date {
  return new Date(`${date}T00:00:00+09:00`);
}

function parseDateLabel(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);

  return Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
    ? null
    : parsed;
}

function addDays(date: string, days: number): string {
  const parsed = parseDateLabel(date);
  if (!parsed) {
    throw new FunctionError("날짜 형식이 올바르지 않습니다.", 400);
  }

  return toDateLabel(parsed.getTime() + days * DAY_MS);
}

function subtractMonths(date: string, months: number): string {
  const parsed = parseDateLabel(date);
  if (!parsed) {
    throw new FunctionError("날짜 형식이 올바르지 않습니다.", 400);
  }

  const targetMonthIndex =
    parsed.getUTCFullYear() * 12 + parsed.getUTCMonth() - months;
  const targetYear = Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
  const lastDay = new Date(
    Date.UTC(targetYear, targetMonth + 1, 0),
  ).getUTCDate();

  return toDateLabel(
    Date.UTC(targetYear, targetMonth, Math.min(parsed.getUTCDate(), lastDay)),
  );
}

function getKstToday(now: Date): string {
  const nowInKst = new Date(now.getTime() + KST_OFFSET_MS);

  return toDateLabel(
    Date.UTC(
      nowInKst.getUTCFullYear(),
      nowInKst.getUTCMonth(),
      nowInKst.getUTCDate(),
    ),
  );
}

function getLegacyPeriod(range: AnalyticsRange, now: Date): AnalyticsDateRange {
  const yesterday = addDays(getKstToday(now), -1);

  return {
    from: addDays(yesterday, range === "30d" ? -29 : -6),
    to: yesterday,
  };
}

function resolveAnalyticsPeriod(
  input: { from?: unknown; range?: unknown; to?: unknown },
  now: Date,
): { legacyRange: AnalyticsRange | null; period: AnalyticsDateRange } {
  if (input.range === "7d" || input.range === "30d") {
    return {
      legacyRange: input.range,
      period: getLegacyPeriod(input.range, now),
    };
  }

  if (typeof input.from !== "string" || typeof input.to !== "string") {
    throw new FunctionError("시작일과 종료일을 선택해주세요.", 400);
  }

  const from = input.from.trim();
  const to = input.to.trim();

  if (!parseDateLabel(from) || !parseDateLabel(to)) {
    throw new FunctionError("날짜 형식은 YYYY-MM-DD여야 합니다.", 400);
  }
  if (from > to) {
    throw new FunctionError("시작일은 종료일보다 늦을 수 없습니다.", 400);
  }

  const yesterday = addDays(getKstToday(now), -1);
  const earliest = addDays(subtractMonths(yesterday, 6), 1);

  if (to > yesterday) {
    throw new FunctionError("기간 통계는 어제까지만 조회할 수 있습니다.", 400);
  }
  if (from < earliest) {
    throw new FunctionError(
      `방문 통계는 ${earliest} 이후부터 조회할 수 있습니다.`,
      400,
    );
  }

  return { legacyRange: null, period: { from, to } };
}

function buildDayWindows(period: AnalyticsDateRange): DayWindow[] {
  const from = parseDateLabel(period.from);
  const to = parseDateLabel(period.to);

  if (!from || !to) {
    throw new FunctionError("통계 조회 기간을 계산하지 못했습니다.", 500);
  }

  const dayCount = Math.floor((to.getTime() - from.getTime()) / DAY_MS) + 1;

  return Array.from({ length: dayCount }, (_, index) => {
    const date = toDateLabel(from.getTime() + index * DAY_MS);
    const nextDate = toDateLabel(from.getTime() + (index + 1) * DAY_MS);

    return {
      date,
      start: toKstMidnightUtc(date).toISOString(),
      end: toKstMidnightUtc(nextDate).toISOString(),
    };
  });
}

function chunkDays(days: DayWindow[], size: number): DayWindow[][] {
  return Array.from({ length: Math.ceil(days.length / size) }, (_, index) =>
    days.slice(index * size, (index + 1) * size),
  );
}

function graphqlString(value: string): string {
  return JSON.stringify(value);
}

function analyticsFilter(siteTag: string, start: string, end: string): string {
  return `{
    datetime_geq: ${graphqlString(start)}
    datetime_lt: ${graphqlString(end)}
    siteTag: ${graphqlString(siteTag)}
  }`;
}

function buildCloudflareQuery(
  accountTag: string,
  siteTag: string,
  days: DayWindow[],
  overview?: OverviewWindows,
): string {
  const dailySelections = days
    .map(
      (day, index) => `
        day${index}: rumPageloadEventsAdaptiveGroups(
          limit: 1
          filter: ${analyticsFilter(siteTag, day.start, day.end)}
        ) {
          count
          sum { visits }
        }`,
    )
    .join("\n");
  const overviewSelections = overview
    ? `
        today: rumPageloadEventsAdaptiveGroups(
          limit: 1
          filter: ${analyticsFilter(siteTag, overview.todayStart, overview.todayEnd)}
        ) {
          count
          sum { visits }
        }
        previous: rumPageloadEventsAdaptiveGroups(
          limit: 1
          filter: ${analyticsFilter(siteTag, overview.previousStart, overview.previousEnd)}
        ) {
          count
          sum { visits }
        }
        topPages: rumPageloadEventsAdaptiveGroups(
          limit: 10
          orderBy: [count_DESC]
          filter: ${analyticsFilter(siteTag, overview.periodStart, overview.periodEnd)}
        ) {
          count
          dimensions { requestPath }
        }
        topReferrers: rumPageloadEventsAdaptiveGroups(
          limit: 10
          orderBy: [sum_visits_DESC]
          filter: ${analyticsFilter(siteTag, overview.periodStart, overview.periodEnd)}
        ) {
          sum { visits }
          dimensions { refererHost }
        }
        devices: rumPageloadEventsAdaptiveGroups(
          limit: 20
          orderBy: [count_DESC]
          filter: ${analyticsFilter(siteTag, overview.periodStart, overview.periodEnd)}
        ) {
          count
          dimensions { deviceType }
        }`
    : "";

  return `query AdminWebAnalytics {
    viewer {
      accounts(filter: { accountTag: ${graphqlString(accountTag)} }) {
        ${dailySelections}
        ${overviewSelections}
      }
    }
  }`;
}

function toNonnegativeNumber(
  value: number | string | null | undefined,
): number {
  const number = typeof value === "number" ? value : Number(value ?? 0);

  return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
}

function readMetric(groups: AnalyticsGroup[] | undefined) {
  const group = groups?.[0];

  return {
    pageViews: toNonnegativeNumber(group?.count),
    visits: toNonnegativeNumber(group?.sum?.visits),
  };
}

function getDeviceLabel(value: string | null | undefined): string {
  switch (value?.toLowerCase()) {
    case "desktop":
      return "데스크톱";
    case "mobile":
      return "모바일";
    case "tablet":
      return "태블릿";
    default:
      return "기타";
  }
}

async function authenticateAdmin(request: Request): Promise<void> {
  const authorization = request.headers.get("Authorization");

  if (!authorization?.startsWith("Bearer ")) {
    throw new FunctionError("관리자 로그인이 필요합니다.", 401);
  }

  const supabaseUrl = getRequiredEnvironment("SUPABASE_URL");
  const supabaseKey =
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY")?.trim() ||
    Deno.env.get("SUPABASE_ANON_KEY")?.trim();

  if (!supabaseKey) {
    throw new FunctionError("인증 설정을 확인해주세요.", 503);
  }

  const accessToken = authorization.slice("Bearer ".length).trim();
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(accessToken);

  if (error || !user) {
    throw new FunctionError("관리자 세션이 유효하지 않습니다.", 401);
  }
}

async function requestCloudflareAnalytics(
  apiToken: string,
  query: string,
): Promise<CloudflareAccount> {
  const response = await fetch(CLOUDFLARE_GRAPHQL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    console.error("Cloudflare analytics HTTP request failed", {
      status: response.status,
    });
    throw new FunctionError(
      response.status === 429
        ? "방문 통계 요청이 일시 제한되었습니다. 잠시 후 다시 시도해주세요."
        : "Cloudflare 방문 통계를 조회하지 못했습니다.",
      response.status === 429 ? 503 : 502,
    );
  }

  const payload = (await response.json()) as CloudflareGraphqlResponse;

  if (payload.errors?.length) {
    console.error("Cloudflare analytics GraphQL request failed", {
      errorCount: payload.errors.length,
      message: payload.errors[0]?.message ?? "unknown",
    });
    throw new FunctionError(
      "Cloudflare 방문 통계 쿼리를 처리하지 못했습니다.",
      502,
    );
  }

  const account = payload.data?.viewer?.accounts?.[0];

  if (!account) {
    throw new FunctionError(
      "Cloudflare 방문 통계 사이트 설정을 확인해주세요.",
      502,
    );
  }

  return account;
}

async function fetchCloudflareAnalytics(
  period: AnalyticsDateRange,
  legacyRange: AnalyticsRange | null,
  now: Date,
) {
  const apiToken = getRequiredEnvironment("CLOUDFLARE_API_TOKEN");
  const accountTag = getRequiredEnvironment("CLOUDFLARE_ACCOUNT_TAG");
  const siteTag = getRequiredEnvironment("CLOUDFLARE_SITE_TAG");
  const days = buildDayWindows(period);
  const dayChunks = chunkDays(days, MAX_DAYS_PER_QUERY);
  const todayDate = getKstToday(now);
  const yesterdayDate = addDays(todayDate, -1);
  const periodStart = days.at(0)?.start;
  const periodEnd = days.at(-1)?.end;

  if (!periodStart || !periodEnd || dayChunks.length === 0) {
    throw new FunctionError("통계 조회 기간을 계산하지 못했습니다.", 500);
  }

  const overview: OverviewWindows = {
    todayStart: toKstMidnightUtc(todayDate).toISOString(),
    todayEnd: now.toISOString(),
    previousStart: toKstMidnightUtc(yesterdayDate).toISOString(),
    previousEnd: new Date(now.getTime() - DAY_MS).toISOString(),
    periodStart,
    periodEnd,
  };
  const accounts = await Promise.all(
    dayChunks.map((chunk, index) =>
      requestCloudflareAnalytics(
        apiToken,
        buildCloudflareQuery(
          accountTag,
          siteTag,
          chunk,
          index === 0 ? overview : undefined,
        ),
      ),
    ),
  );
  const overviewAccount = accounts[0];
  const daily = dayChunks.flatMap((chunk, chunkIndex) =>
    chunk.map((day, dayIndex) => ({
      date: day.date,
      ...readMetric(accounts[chunkIndex]?.[`day${dayIndex}`]),
    })),
  );
  const today = readMetric(overviewAccount?.today);
  const previous = readMetric(overviewAccount?.previous);
  const visitChangeRate =
    previous.visits > 0
      ? Math.round(
          ((today.visits - previous.visits) / previous.visits) * 1_000,
        ) / 10
      : null;
  const topPages = (overviewAccount?.topPages ?? [])
    .map((group) => ({
      label: group.dimensions?.requestPath?.trim() || "/",
      value: toNonnegativeNumber(group.count),
    }))
    .filter((item) => item.value > 0);
  const topReferrers = (overviewAccount?.topReferrers ?? [])
    .map((group) => ({
      label: group.dimensions?.refererHost?.trim() || "직접 방문",
      value: toNonnegativeNumber(group.sum?.visits),
    }))
    .filter((item) => item.value > 0);
  const deviceTotals = new Map<string, number>();

  for (const group of overviewAccount?.devices ?? []) {
    const label = getDeviceLabel(group.dimensions?.deviceType);
    const pageViews = toNonnegativeNumber(group.count);
    deviceTotals.set(label, (deviceTotals.get(label) ?? 0) + pageViews);
  }

  const totalDevicePageViews = Array.from(deviceTotals.values()).reduce(
    (sum, value) => sum + value,
    0,
  );
  const devices = Array.from(deviceTotals.entries())
    .map(([label, pageViews]) => ({
      label,
      pageViews,
      share:
        totalDevicePageViews > 0
          ? Math.round((pageViews / totalDevicePageViews) * 1_000) / 10
          : 0,
    }))
    .sort((left, right) => right.pageViews - left.pageViews);

  return {
    ...(legacyRange ? { range: legacyRange } : {}),
    period,
    generatedAt: now.toISOString(),
    timeZone: "Asia/Seoul" as const,
    summary: {
      pageViews: today.pageViews,
      visits: today.visits,
      previousVisits: previous.visits,
      visitChangeRate,
    },
    daily,
    topPages,
    topReferrers,
    devices,
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ message: "지원하지 않는 요청 방식입니다." }, 405);
  }

  try {
    await authenticateAdmin(request);

    const input = (await request.json().catch(() => ({}))) as {
      from?: unknown;
      range?: unknown;
      to?: unknown;
    };
    const now = new Date();
    const { legacyRange, period } = resolveAnalyticsPeriod(input, now);

    return jsonResponse(
      await fetchCloudflareAnalytics(period, legacyRange, now),
    );
  } catch (error) {
    if (error instanceof FunctionError) {
      return jsonResponse({ message: error.message }, error.status);
    }

    console.error("Admin web analytics function failed", {
      name: error instanceof Error ? error.name : "unknown",
    });
    return jsonResponse(
      { message: "방문 통계를 처리하는 중 오류가 발생했습니다." },
      500,
    );
  }
});
