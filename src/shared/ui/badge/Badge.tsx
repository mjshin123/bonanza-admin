import type { CSSProperties, HTMLAttributes } from "react";

type BadgeTone = "default" | "neutral" | "navy" | "success" | "warning" | "danger";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
};

const TONES: Record<BadgeTone, CSSProperties> = {
  default: { background: "var(--primary-subtle-bg)", color: "var(--primary-text)" },
  neutral: { background: "var(--surface-muted)", color: "var(--text-muted)" },
  navy: { background: "var(--blue-50)", color: "var(--primary-text)" },
  success: { background: "var(--success-bg)", color: "var(--success)" },
  warning: { background: "var(--warning-bg)", color: "var(--warning)" },
  danger: { background: "var(--danger-bg)", color: "var(--danger)" },
};

export function Badge({ tone = "default", children, style, ...rest }: BadgeProps) {
  const computedStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    height: 24,
    padding: "0 8px",
    borderRadius: "var(--r-sm)",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--text-caption)",
    fontWeight: "var(--fw-semibold)",
    lineHeight: 1,
    whiteSpace: "nowrap",
    ...TONES[tone],
    ...style,
  };

  return (
    <span style={computedStyle} {...rest}>
      {children}
    </span>
  );
}
