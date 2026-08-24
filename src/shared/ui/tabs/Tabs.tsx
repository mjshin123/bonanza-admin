import type { CSSProperties } from "react";

export type TabItem = {
  value: string;
  label: string;
};

type TabsProps = {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  style?: CSSProperties;
};

export function Tabs({ items, value, onChange, style }: TabsProps) {
  return (
    <div
      role="tablist"
      className="kfcpa-scroll-x-mobile"
      style={{ display: "flex", gap: "var(--sp-6)", borderBottom: "1px solid var(--border)", ...style }}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(item.value)}
            style={{
              position: "relative",
              flex: "none",
              whiteSpace: "nowrap",
              background: "transparent",
              border: 0,
              padding: "0 0 12px",
              font: "inherit",
              fontSize: "var(--text-body-base)",
              fontWeight: active ? "var(--fw-semibold)" : "var(--fw-regular)",
              color: active ? "var(--ink)" : "var(--text-muted)",
              cursor: "pointer",
            }}
          >
            {item.label}
            {active ? (
              <span style={{ position: "absolute", left: 0, right: 0, bottom: -1, height: 2, background: "var(--teal-600)" }} />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
