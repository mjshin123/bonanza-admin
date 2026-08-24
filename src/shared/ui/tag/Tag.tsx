import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

type TagProps = HTMLAttributes<HTMLSpanElement> & {
  onRemove?: () => void;
  active?: boolean;
  children?: ReactNode;
};

export function Tag({ children, onRemove, active = false, style, ...rest }: TagProps) {
  const computedStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    height: 28,
    padding: "0 10px",
    borderRadius: "var(--r-full)",
    fontSize: "var(--text-body-sm)",
    lineHeight: 1,
    border: `1px solid ${active ? "var(--teal-600)" : "var(--border)"}`,
    background: active ? "var(--teal-50)" : "var(--bg)",
    color: active ? "var(--teal-700)" : "var(--ink)",
    ...style,
  };

  return (
    <span style={computedStyle} {...rest}>
      {children}
      {onRemove ? (
        <button
          type="button"
          aria-label="삭제"
          onClick={onRemove}
          style={{
            border: 0,
            background: "transparent",
            color: "var(--text-muted)",
            cursor: "pointer",
            fontSize: 14,
            lineHeight: 1,
            padding: 0,
          }}
        >
          ×
        </button>
      ) : null}
    </span>
  );
}
