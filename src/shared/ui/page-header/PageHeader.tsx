import type { CSSProperties, ReactNode } from "react";

type PageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  style?: CSSProperties;
};

export function PageHeader({ title, description, children, style }: PageHeaderProps) {
  return (
    <section style={{ background: "var(--bg)" }}>
      <div style={{ maxWidth: "var(--container-max)", margin: "0 auto", padding: "var(--sp-9) var(--gutter-desktop) 0" }}>
        <div
          className="bonanza-stack-mobile"
          style={{
            display: "grid",
            gridTemplateColumns: description ? "minmax(180px, max-content) 1fr" : "1fr",
            gap: "var(--sp-10)",
            alignItems: "end",
            paddingTop: "var(--sp-7)",
            ...style,
          }}
        >
          <h1 style={{ fontSize: "clamp(28px, 6vw, 44px)", lineHeight: 1.32, letterSpacing: "-.02em", fontWeight: "var(--fw-bold)", color: "var(--ink)" }}>
            {title}
          </h1>
          {description ? (
            <p style={{ fontSize: "var(--text-body-base)", lineHeight: "var(--lh-body-base)", color: "var(--text-muted)", textAlign: "right" }}>
              {description}
            </p>
          ) : null}
        </div>
        {children ? <div style={{ paddingTop: "var(--sp-8)" }}>{children}</div> : null}
      </div>
    </section>
  );
}
