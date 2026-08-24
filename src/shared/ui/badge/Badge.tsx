import type { CSSProperties, HTMLAttributes } from "react";

type BadgeTone = "default" | "neutral" | "navy" | "success" | "warning" | "danger";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
};

const TONES: Record<BadgeTone, CSSProperties> = {
  default: { background: "var(--teal-100)", color: "var(--teal-700)" },
  neutral: { background: "var(--surface)", color: "var(--text-muted)" },
  navy: { background: "var(--navy-50)", color: "var(--navy-600)" },
  success: { background: "rgba(30,142,90,.10)", color: "var(--success)" },
  warning: { background: "rgba(199,119,0,.10)", color: "var(--warning)" },
  danger: { background: "rgba(198,57,46,.10)", color: "var(--danger)" },
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
