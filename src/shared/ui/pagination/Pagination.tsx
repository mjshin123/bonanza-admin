import type { CSSProperties } from "react";

type PaginationProps = {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
  style?: CSSProperties;
};

export function Pagination({ page, pageCount, onChange, style }: PaginationProps) {
  const go = (target: number) => {
    if (target >= 1 && target <= pageCount) onChange(target);
  };

  const pages = Array.from({ length: pageCount }, (_, i) => i + 1);

  const cell = (active: boolean): CSSProperties => ({
    minWidth: 32,
    height: 32,
    padding: "0 8px",
    borderRadius: "var(--r-md)",
    border: `1px solid ${active ? "var(--teal-600)" : "transparent"}`,
    background: active ? "var(--teal-50)" : "transparent",
    color: active ? "var(--teal-700)" : "var(--text-muted)",
    fontFamily: "var(--font-data)",
    fontSize: "var(--text-body-sm)",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  });

  return (
    <nav style={{ display: "flex", alignItems: "center", gap: "var(--sp-1)", ...style }}>
      <button type="button" onClick={() => go(page - 1)} disabled={page === 1} style={{ ...cell(false), opacity: page === 1 ? 0.35 : 1 }}>
        이전
      </button>
      {pages.map((p) => (
        <button key={p} type="button" onClick={() => go(p)} style={cell(p === page)}>
          {p}
        </button>
      ))}
      <button type="button" onClick={() => go(page + 1)} disabled={page === pageCount} style={{ ...cell(false), opacity: page === pageCount ? 0.35 : 1 }}>
        다음
      </button>
    </nav>
  );
}
