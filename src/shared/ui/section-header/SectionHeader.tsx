import type { CSSProperties, ReactNode } from "react";

type SectionHeaderProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  onDark?: boolean;
  action?: ReactNode;
  style?: CSSProperties;
};

export function SectionHeader({
  eyebrow,
  title,
  description,
  align = "left",
  onDark = false,
  action,
  style,
}: SectionHeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--sp-3)",
        alignItems: align === "center" ? "center" : "flex-start",
        textAlign: align === "center" ? "center" : "left",
        ...style,
      }}
    >
      {eyebrow ? (
        <span
          style={{
            fontSize: "var(--text-caption)",
            lineHeight: "var(--lh-caption)",
            letterSpacing: "var(--ls-caption)",
            fontWeight: "var(--fw-semibold)",
            color: onDark ? "var(--teal-300)" : "var(--teal-700)",
          }}
        >
          {eyebrow}
        </span>
      ) : null}
      <h2
        style={{
          fontSize: "var(--text-h2)",
          lineHeight: "var(--lh-h2)",
          letterSpacing: "var(--ls-h2)",
          fontWeight: "var(--fw-semibold)",
          color: onDark ? "#FFFFFF" : "var(--ink)",
        }}
      >
        {title}
      </h2>
      {description ? (
        <p
          style={{
            maxWidth: "var(--measure)",
            fontSize: "var(--text-body-lg)",
            lineHeight: "var(--lh-body-lg)",
            color: onDark ? "var(--navy-300)" : "var(--text-muted)",
          }}
        >
          {description}
        </p>
      ) : null}
      {action}
    </div>
  );
}
