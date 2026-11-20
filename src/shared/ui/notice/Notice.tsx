import type { CSSProperties, ReactNode } from "react";

type NoticeTone = "info" | "teal" | "warning" | "danger";

type NoticeProps = {
  tone?: NoticeTone;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  style?: CSSProperties;
};

const TONES: Record<NoticeTone, { bg: string; bar: string; text: string }> = {
  info: { bg: "var(--blue-50)", bar: "var(--primary)", text: "var(--primary-text)" },
  teal: { bg: "var(--primary-subtle-bg)", bar: "var(--primary)", text: "var(--primary-text)" },
  warning: { bg: "var(--warning-bg)", bar: "var(--warning)", text: "var(--warning)" },
  danger: { bg: "var(--danger-bg)", bar: "var(--danger)", text: "var(--danger)" },
};

export function Notice({ tone = "info", title, children, action, style }: NoticeProps) {
  const t = TONES[tone];

  return (
    <div style={{ display: "flex", gap: "var(--sp-4)", background: t.bg, borderRadius: "var(--r-md)", padding: "var(--sp-4) var(--sp-5)", ...style }}>
      <span style={{ width: 2, borderRadius: 1, background: t.bar, flex: "none" }} />
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
        {title ? (
          <span style={{ fontSize: "var(--text-body-sm)", fontWeight: "var(--fw-semibold)", color: t.text }}>{title}</span>
        ) : null}
        <div style={{ fontSize: "var(--text-body-sm)", lineHeight: "var(--lh-body-sm)", color: "var(--ink)" }}>{children}</div>
        {action}
      </div>
    </div>
  );
}
