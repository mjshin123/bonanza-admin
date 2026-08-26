import { useState, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  adminWebAnalyticsQueryOptions,
  type WebAnalyticsRange,
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

function DailyChart({ daily }: { daily: WebAnalyticsResponse["daily"] }) {
  const maxVisits = Math.max(...daily.map((item) => item.visits), 1);
  const chartStyle = {
    "--analytics-day-count": daily.length,
  } as CSSProperties;

  return (
    <Card className="analytics-dashboard-chart-card">
      <div className="analytics-dashboard-card-heading">
        <div>
          <h2>방문 추이</h2>
          <p>Cloudflare 기준 일별 방문 수입니다.</p>
        </div>
      </div>
      <div className="analytics-dashboard-chart-scroll">
        <div
          aria-label="일별 방문 수 막대 차트"
          className="analytics-dashboard-chart"
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
                title={`${formatDay(item.date)} 방문 ${numberFormatter.format(item.visits)}회 · 페이지뷰 ${numberFormatter.format(item.pageViews)}회`}
              >
                <span>{numberFormatter.format(item.visits)}</span>
                <div className="analytics-dashboard-chart-track">
                  <div style={{ height: `${height}%` }} />
                </div>
                <small>{showLabel ? formatDay(item.date) : ""}</small>
              </div>
            );
          })}
        </div>
      </div>
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
                  {device.share.toFixed(1)}% · {numberFormatter.format(device.pageViews)}회
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
  const [range, setRange] = useState<WebAnalyticsRange>("7d");
  const analyticsQuery = useQuery(adminWebAnalyticsQueryOptions(range));
  const data = analyticsQuery.data;

  return (
    <section className="content-admin-section analytics-dashboard">
      <div className="analytics-dashboard-header">
        <div>
          <span>WEB ANALYTICS</span>
          <h1>방문 통계</h1>
          <p>공개 홈페이지의 Cloudflare Web Analytics 집계입니다.</p>
        </div>
        <div className="analytics-dashboard-actions">
          <div aria-label="통계 조회 기간" role="group">
            {(["7d", "30d"] as const).map((value) => (
              <button
                key={value}
                aria-pressed={range === value}
                className={range === value ? "is-active" : undefined}
                type="button"
                onClick={() => setRange(value)}
              >
                {value === "7d" ? "최근 7일" : "최근 30일"}
              </button>
            ))}
          </div>
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
              최근 갱신 {generatedAtFormatter.format(new Date(data.generatedAt))}
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
