import { useState, type CSSProperties, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  adminWebAnalyticsQueryOptions,
  getWebAnalyticsDateBounds,
  getWebAnalyticsPresetRange,
  webAnalyticsDateRangeSchema,
  type WebAnalyticsDateRange,
  type WebAnalyticsPreset,
  type WebAnalyticsResponse,
} from "@entities/web-analytics";
import { getErrorMessage } from "@shared/lib";
import { Button, Card, Notice } from "@shared/ui";

import "./AnalyticsDashboard.css";

const numberFormatter = new Intl.NumberFormat("ko-KR");
const generatedAtFormatter = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Seoul",
});
const PRESETS: Array<{ label: string; value: WebAnalyticsPreset }> = [
  { label: "7일", value: "7d" },
  { label: "30일", value: "30d" },
  { label: "3개월", value: "3m" },
  { label: "6개월", value: "6m" },
];

function isSamePeriod(
  left: WebAnalyticsDateRange,
  right: WebAnalyticsDateRange,
): boolean {
  return left.from === right.from && left.to === right.to;
}

function formatDay(date: string): string {
  const [, month, day] = date.split("-");
  return `${Number(month)}/${Number(day)}`;
}

function formatChangeRate(rate: number | null): string {
  if (rate === null) {
    return "전일 비교 데이터 없음";
  }

  const prefix = rate > 0 ? "+" : "";
  return `전일 같은 시각 대비 ${prefix}${rate.toFixed(1)}%`;
}

function MetricCard({
  label,
  value,
  description,
  tone,
}: {
  label: string;
  value: number;
  description: string;
  tone?: "positive" | "negative";
}) {
  return (
    <Card className="analytics-dashboard-metric-card">
      <span>{label}</span>
      <strong>{numberFormatter.format(value)}</strong>
      <small className={tone ? `is-${tone}` : undefined}>{description}</small>
    </Card>
  );
}

function DailyChart({
  daily,
}: {
  daily: WebAnalyticsResponse["daily"];
}) {
  const maxVisits = Math.max(...daily.map((item) => item.visits), 1);
  const totalVisits = daily.reduce((sum, item) => sum + item.visits, 0);
  const isDense = daily.length > 31;
  const chartStyle = {
    "--analytics-day-count": daily.length,
  } as CSSProperties;
  const [hover, setHover] = useState<{
    item: WebAnalyticsResponse["daily"][number];
    x: number;
    y: number;
  } | null>(null);

  return (
    <Card className="analytics-dashboard-chart-card">
      <div className="analytics-dashboard-chart-total">
        <span>최근 {daily.length}일 방문 수 합계</span>
        <strong>{numberFormatter.format(totalVisits)}</strong>
      </div>
      <div className="analytics-dashboard-chart-scroll">
        <div
          aria-label="일별 방문 수 막대 차트"
          className={
            isDense
              ? "analytics-dashboard-chart is-dense"
              : "analytics-dashboard-chart"
          }
          role="img"
          style={chartStyle}
        >
          {daily.map((item, index) => {
            const height = Math.max((item.visits / maxVisits) * 100, 3);
            const showLabel =
              daily.length <= 10 ||
              index === 0 ||
              index === daily.length - 1 ||
              index % 5 === 0;

            return (
              <div
                key={item.date}
                className="analytics-dashboard-chart-column"
                onMouseEnter={(event) =>
                  setHover({ item, x: event.clientX, y: event.clientY })
                }
                onMouseLeave={() => setHover(null)}
                onMouseMove={(event) =>
                  setHover({ item, x: event.clientX, y: event.clientY })
                }
              >
                <span>
                  {showLabel ? numberFormatter.format(item.visits) : ""}
                </span>
                <div className="analytics-dashboard-chart-track">
                  <div style={{ height: `${height}%` }} />
                </div>
                <small>{showLabel ? formatDay(item.date) : ""}</small>
              </div>
            );
          })}
        </div>
      </div>
      {hover ? (
        <div
          className="analytics-dashboard-chart-tooltip"
          style={{ left: hover.x + 14, top: hover.y + 14 }}
        >
          <strong>{formatDay(hover.item.date)}</strong>
          <span>방문 {numberFormatter.format(hover.item.visits)}회</span>
          <span>
            페이지뷰 {numberFormatter.format(hover.item.pageViews)}회
          </span>
        </div>
      ) : null}
    </Card>
  );
}

function RankingCard({
  title,
  description,
  items,
  unit,
}: {
  title: string;
  description: string;
  items: WebAnalyticsResponse["topPages"];
  unit: string;
}) {
  return (
    <Card className="analytics-dashboard-ranking-card">
      <div className="analytics-dashboard-card-heading">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      {items.length > 0 ? (
        <ol>
          {items.map((item, index) => (
            <li key={`${item.label}-${index}`}>
              <span>{index + 1}</span>
              <strong title={item.label}>{item.label}</strong>
              <small>
                {numberFormatter.format(item.value)} {unit}
              </small>
            </li>
          ))}
        </ol>
      ) : (
        <p className="analytics-dashboard-empty">집계된 데이터가 없습니다.</p>
      )}
    </Card>
  );
}

function DeviceCard({ devices }: { devices: WebAnalyticsResponse["devices"] }) {
  return (
    <Card className="analytics-dashboard-device-card">
      <div className="analytics-dashboard-card-heading">
        <div>
          <h2>접속 기기</h2>
          <p>페이지뷰 기준 기기 비율입니다.</p>
        </div>
      </div>
      {devices.length > 0 ? (
        <div className="analytics-dashboard-devices">
          {devices.map((device) => (
            <div key={device.label}>
              <div>
                <strong>{device.label}</strong>
                <span>
                  {device.share.toFixed(1)}% ·{" "}
                  {numberFormatter.format(device.pageViews)}회
                </span>
              </div>
              <div className="analytics-dashboard-device-track">
                <span style={{ width: `${device.share}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="analytics-dashboard-empty">집계된 데이터가 없습니다.</p>
      )}
    </Card>
  );
}

export function AnalyticsDashboard() {
  const [{ bounds, defaultPeriod }] = useState(() => ({
    bounds: getWebAnalyticsDateBounds(),
    defaultPeriod: getWebAnalyticsPresetRange("7d"),
  }));
  const [period, setPeriod] = useState<WebAnalyticsDateRange>(defaultPeriod);
  const [draftPeriod, setDraftPeriod] =
    useState<WebAnalyticsDateRange>(defaultPeriod);
  const [periodError, setPeriodError] = useState<string | null>(null);
  const analyticsQuery = useQuery(adminWebAnalyticsQueryOptions(period));
  const data = analyticsQuery.data;
  const activePreset = PRESETS.find((preset) =>
    isSamePeriod(period, getWebAnalyticsPresetRange(preset.value)),
  )?.value;

  const applyPreset = (preset: WebAnalyticsPreset) => {
    const nextPeriod = getWebAnalyticsPresetRange(preset);
    setDraftPeriod(nextPeriod);
    setPeriod(nextPeriod);
    setPeriodError(null);
  };

  const applyCustomPeriod = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = webAnalyticsDateRangeSchema.safeParse(draftPeriod);

    if (!parsed.success) {
      setPeriodError(
        parsed.error.issues[0]?.message ?? "조회 기간을 확인해주세요.",
      );
      return;
    }
    if (parsed.data.from < bounds.earliest) {
      setPeriodError(`시작일은 ${bounds.earliest} 이후여야 합니다.`);
      return;
    }
    if (parsed.data.to > bounds.yesterday) {
      setPeriodError("기간 통계는 어제까지만 조회할 수 있습니다.");
      return;
    }

    setPeriod(parsed.data);
    setPeriodError(null);
  };

  return (
    <section className="content-admin-section analytics-dashboard">
      <div className="analytics-dashboard-header">
        <div>
          <span>WEB ANALYTICS</span>
          <h1>방문 통계</h1>
          <p>공개 홈페이지의 Cloudflare Web Analytics 집계입니다.</p>
        </div>
        <div className="analytics-dashboard-actions">
          <Button
            disabled={analyticsQuery.isFetching}
            size="sm"
            variant="ghost"
            onClick={() => void analyticsQuery.refetch()}
          >
            {analyticsQuery.isFetching ? "갱신 중..." : "새로고침"}
          </Button>
        </div>
      </div>

      {data ? (
        <div className="analytics-dashboard-metrics">
          <MetricCard
            description={formatChangeRate(data.summary.visitChangeRate)}
            label="오늘 방문 수"
            tone={
              data.summary.visitChangeRate === null
                ? undefined
                : data.summary.visitChangeRate >= 0
                  ? "positive"
                  : "negative"
            }
            value={data.summary.visits}
          />
          <MetricCard
            description="오늘 00:00부터 현재까지"
            label="오늘 페이지뷰"
            value={data.summary.pageViews}
          />
        </div>
      ) : null}

      <div className="analytics-dashboard-card-heading">
        <h2>방문 추이</h2>
        <p>
          {period.from} ~ {period.to} · Cloudflare 기준 일별 방문 수입니다.
        </p>
      </div>

      <div className="analytics-dashboard-period-controls">
        <div
          aria-label="빠른 통계 조회 기간"
          className="analytics-dashboard-quick-ranges"
          role="group"
        >
          {PRESETS.map((preset) => (
            <button
              key={preset.value}
              aria-pressed={activePreset === preset.value}
              className={
                activePreset === preset.value ? "is-active" : undefined
              }
              type="button"
              onClick={() => applyPreset(preset.value)}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <form
          className="analytics-dashboard-date-form"
          onSubmit={applyCustomPeriod}
        >
          <label>
            <span>시작일</span>
            <input
              aria-label="통계 시작일"
              max={draftPeriod.to || bounds.yesterday}
              min={bounds.earliest}
              type="date"
              value={draftPeriod.from}
              onChange={(event) =>
                setDraftPeriod((current) => ({
                  ...current,
                  from: event.target.value,
                }))
              }
            />
          </label>
          <span aria-hidden="true">~</span>
          <label>
            <span>종료일</span>
            <input
              aria-label="통계 종료일"
              max={bounds.yesterday}
              min={draftPeriod.from || bounds.earliest}
              type="date"
              value={draftPeriod.to}
              onChange={(event) =>
                setDraftPeriod((current) => ({
                  ...current,
                  to: event.target.value,
                }))
              }
            />
          </label>
          <Button size="sm" type="submit">
            조회
          </Button>
        </form>
        {periodError ? (
          <p className="analytics-dashboard-period-error" role="alert">
            {periodError}
          </p>
        ) : null}
      </div>

      {analyticsQuery.isPending ? (
        <Card className="analytics-dashboard-state">
          방문 통계를 불러오고 있습니다.
        </Card>
      ) : null}

      {analyticsQuery.error ? (
        <Notice
          action={
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void analyticsQuery.refetch()}
            >
              다시 시도
            </Button>
          }
          tone="danger"
          title="방문 통계를 불러오지 못했습니다."
        >
          {getErrorMessage(analyticsQuery.error)}
        </Notice>
      ) : null}

      {data ? (
        <>
          <DailyChart daily={data.daily} />

          <div className="analytics-dashboard-detail-grid">
            <RankingCard
              description="조회 기간 동안 많이 본 경로입니다."
              items={data.topPages}
              title="인기 페이지 TOP 10"
              unit="뷰"
            />
            <RankingCard
              description="방문이 시작된 외부 유입처입니다."
              items={data.topReferrers}
              title="유입 경로 TOP 10"
              unit="회"
            />
            <DeviceCard devices={data.devices} />
          </div>

          <div className="analytics-dashboard-footnote">
            <span>
              최근 갱신{" "}
              {generatedAtFormatter.format(new Date(data.generatedAt))}
            </span>
            <p>
              방문 수는 순방문자 수가 아니라 Cloudflare가 외부 유입 또는 직접
              접속으로 판정한 방문 횟수입니다. 브라우저 차단 설정에 따라 일부
              수치가 제외될 수 있습니다.
            </p>
          </div>
        </>
      ) : null}
    </section>
  );
}
