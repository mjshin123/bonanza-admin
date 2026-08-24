import type { CSSProperties } from "react";

type ImagePlaceholderProps = {
  label: string;
  height?: number | string;
  width?: number | string;
  tone?: "surface" | "navy";
  style?: CSSProperties;
  className?: string;
};

export function ImagePlaceholder({ label, height = 260, width = "100%", tone = "surface", style, className }: ImagePlaceholderProps) {
  return (
    <div
      className={className}
      style={{
        position: "relative",
        width,
        height,
        borderRadius: "var(--r-md)",
        overflow: "hidden",
        background: tone === "navy" ? "var(--navy-600)" : "var(--surface)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flex: "none",
        ...style,
      }}
    >
      <span
        style={{
          fontSize: "var(--text-caption)",
          color: tone === "navy" ? "var(--navy-300)" : "var(--text-muted)",
          textAlign: "center",
          padding: "0 var(--sp-2)",
        }}
      >
        {label}
      </span>
    </div>
  );
}
