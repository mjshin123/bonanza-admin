import { createElement, useState, type CSSProperties, type ElementType, type HTMLAttributes, type ReactNode } from "react";

type CardProps = HTMLAttributes<HTMLElement> & {
  interactive?: boolean;
  padding?: number | string;
  as?: ElementType;
  children?: ReactNode;
};

export function Card({ interactive = false, padding = 24, as: Tag = "div", style, ...rest }: CardProps) {
  const [hover, setHover] = useState(false);

  const computedStyle: CSSProperties = {
    background: "var(--bg)",
    border: `1px solid ${interactive && hover ? "var(--teal-200)" : "var(--border)"}`,
    borderRadius: "var(--r-md)",
    padding,
    transition: "border-color var(--dur-fast) var(--ease)",
    display: "block",
    color: "var(--ink)",
    textDecoration: "none",
    ...style,
  };

  return createElement(Tag, {
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: computedStyle,
    ...rest,
  });
}
