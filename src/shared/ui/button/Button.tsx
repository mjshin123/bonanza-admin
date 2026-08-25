import { useState, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "text" | "danger";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
};

const SIZES: Record<ButtonSize, CSSProperties> = {
  sm: { height: "var(--control-h-sm)", padding: "0 13px", fontSize: "var(--text-body-sm)" },
  md: { height: "var(--control-h-md)", padding: "0 16px", fontSize: "var(--text-body-base)" },
  lg: { height: "var(--control-h-lg)", padding: "0 19px", fontSize: "var(--text-body-base)" },
};

const VARIANTS: Record<ButtonVariant, CSSProperties> = {
  primary: { background: "linear-gradient(135deg, var(--teal-500), var(--teal-600))", color: "#FFFFFF", border: "1px solid transparent" },
  secondary: { background: "var(--bg)", color: "var(--navy-600)", border: "1px solid var(--navy-600)" },
  ghost: { background: "transparent", color: "var(--ink)", border: "1px solid var(--border)" },
  text: {
    background: "transparent",
    color: "var(--teal-700)",
    border: "1px solid transparent",
    padding: 0,
    height: "auto",
  },
  danger: {
    background: "transparent",
    color: "var(--danger)",
    border: "1px solid transparent",
    padding: 0,
    height: "auto",
  },
};

const HOVER: Record<ButtonVariant, CSSProperties> = {
  primary: { background: "linear-gradient(135deg, var(--teal-600), var(--teal-700))" },
  secondary: { background: "var(--navy-50)" },
  ghost: { background: "var(--surface)" },
  text: { color: "var(--teal-600)" },
  danger: { textDecoration: "underline" },
};

export function Button({
  variant = "primary",
  size = "md",
  disabled = false,
  fullWidth = false,
  iconLeft,
  iconRight,
  type = "button",
  children,
  style,
  ...rest
}: ButtonProps) {
  const [hover, setHover] = useState(false);

  const computedStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "var(--sp-2)",
    fontFamily: "var(--font-sans)",
    fontWeight: "var(--fw-semibold)",
    lineHeight: 1,
    borderRadius: variant === "text" ? 0 : "var(--r-md)",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.4 : 1,
    width: fullWidth ? "100%" : undefined,
    transition:
      "background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease)",
    whiteSpace: "nowrap",
    textDecoration: "none",
    ...SIZES[size],
    ...VARIANTS[variant],
    ...(hover && !disabled ? HOVER[variant] : null),
    ...style,
  };

  return (
    <button
      type={type}
      disabled={disabled}
      style={computedStyle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      {...rest}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--sp-2)" }}>
        {iconLeft}
        {children}
        {iconRight}
      </span>
    </button>
  );
}
