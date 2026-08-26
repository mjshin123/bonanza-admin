import { createClient } from "npm:@supabase/supabase-js@2.112.1";

const CLOUDFLARE_GRAPHQL_URL =
  "https://api.cloudflare.com/client/v4/graphql";
const KST_OFFSET_MS = 9 * 60 * 60 * 1_000;
const DAY_MS = 24 * 60 * 60 * 1_000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type AnalyticsRange = "7d" | "30d";

type DayWindow = {
  date: string;
  end: string;
  start: string;
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

type CloudflareGraphqlResponse = {
  data?: {
    viewer?: {
      accounts?: Array<Record<string, AnalyticsGroup[] | undefined>>;
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
    throw new FunctionError(
      "방문 통계 연동 설정이 완료되지 않았습니다.",
      503,
    );
  }

  return value;
}

function toDateLabel(dayTimestamp: number): string {
  return new Date(dayTimestamp).toISOString().slice(0, 10);
}

function toKstMidnightUtc(date: string): Date {
  return new Date(`${date}T00:00:00+09:00`);
}

function buildDayWindows(range: AnalyticsRange, now: Date): DayWindow[] {
  const dayCount = range === "30d" ? 30 : 7;
  const nowInKst = new Date(now.getTime() + KST_OFFSET_MS);
  const currentKstDay = Date.UTC(
    nowInKst.getUTCFullYear(),
    nowInKst.getUTCMonth(),
    nowInKst.getUTCDate(),
  );

  return Array.from({ length: dayCount }, (_, index) => {
    const dayOffset = index - (dayCount - 1);
    const date = toDateLabel(currentKstDay + dayOffset * DAY_MS);
    const nextDate = toDateLabel(currentKstDay + (dayOffset + 1) * DAY_MS);
    const start = toKstMidnightUtc(date);
    const nextStart = toKstMidnightUtc(nextDate);
    const end = nextStart.getTime() < now.getTime() ? nextStart : now;

    return {
      date,
      start: start.toISOString(),
      end: end.toISOString(),
    };
  });
}

function graphqlString(value: string): string {
  return JSON.stringify(value);
}

function analyticsFilter(
  siteTag: string,
  start: string,
  end: string,
): string {
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
  previousStart: string,
  previousEnd: string,
): string {
  const rangeStart = days[0].start;
  const rangeEnd = days.at(-1)?.end ?? new Date().toISOString();
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
  const rangeFilter = analyticsFilter(siteTag, rangeStart, rangeEnd);

  return `query AdminWebAnalytics {
    viewer {
      accounts(filter: { accountTag: ${graphqlString(accountTag)} }) {
        ${dailySelections}
        previous: rumPageloadEventsAdaptiveGroups(
          limit: 1
          filter: ${analyticsFilter(siteTag, previousStart, previousEnd)}
        ) {
          count
          sum { visits }
        }
        topPages: rumPageloadEventsAdaptiveGroups(
          limit: 10
          orderBy: [count_DESC]
          filter: ${rangeFilter}
        ) {
          count
          dimensions { requestPath }
        }
        topReferrers: rumPageloadEventsAdaptiveGroups(
          limit: 10
          orderBy: [sum_visits_DESC]
          filter: ${rangeFilter}
        ) {
          sum { visits }
          dimensions { refererHost }
        }
        devices: rumPageloadEventsAdaptiveGroups(
          limit: 20
          orderBy: [count_DESC]
          filter: ${rangeFilter}
        ) {
          count
          dimensions { deviceType }
        }
      }
    }
  }`;
}

function toNonnegativeNumber(value: number | string | null | undefined): number {
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

async function fetchCloudflareAnalytics(range: AnalyticsRange) {
  const apiToken = getRequiredEnvironment("CLOUDFLARE_API_TOKEN");
  const accountTag = getRequiredEnvironment("CLOUDFLARE_ACCOUNT_TAG");
  const siteTag = getRequiredEnvironment("CLOUDFLARE_SITE_TAG");
  const now = new Date();
  const days = buildDayWindows(range, now);
  const yesterday = days.at(-2);
  const previousStart = yesterday?.start;
  const previousEnd = new Date(now.getTime() - DAY_MS).toISOString();

  if (!previousStart) {
    throw new FunctionError("통계 조회 기간을 계산하지 못했습니다.", 500);
  }

  const response = await fetch(CLOUDFLARE_GRAPHQL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: buildCloudflareQuery(
        accountTag,
        siteTag,
        days,
        previousStart,
        previousEnd,
      ),
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    console.error("Cloudflare analytics HTTP request failed", {
      status: response.status,
    });
    throw new FunctionError(
      response.status === 429
        ? "방문 통계 요청이 잠시 제한되었습니다. 잠시 후 다시 시도해주세요."
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

  const daily = days.map((day, index) => ({
    date: day.date,
    ...readMetric(account[`day${index}`]),
  }));
  const today = daily.at(-1) ?? { pageViews: 0, visits: 0 };
  const previous = readMetric(account.previous);
  const visitChangeRate =
    previous.visits > 0
      ? Math.round(((today.visits - previous.visits) / previous.visits) * 1_000) /
        10
      : null;
  const topPages = (account.topPages ?? [])
    .map((group) => ({
      label: group.dimensions?.requestPath?.trim() || "/",
      value: toNonnegativeNumber(group.count),
    }))
    .filter((item) => item.value > 0);
  const topReferrers = (account.topReferrers ?? [])
    .map((group) => ({
      label: group.dimensions?.refererHost?.trim() || "직접 방문",
      value: toNonnegativeNumber(group.sum?.visits),
    }))
    .filter((item) => item.value > 0);
  const deviceTotals = new Map<string, number>();

  for (const group of account.devices ?? []) {
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
    range,
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
      range?: unknown;
    };

    if (input.range !== "7d" && input.range !== "30d") {
      throw new FunctionError("조회 기간은 7d 또는 30d여야 합니다.", 400);
    }

    return jsonResponse(await fetchCloudflareAnalytics(input.range));
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
