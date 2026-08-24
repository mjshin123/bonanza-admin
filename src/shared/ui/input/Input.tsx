import {
  forwardRef,
  useId,
  useState,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "style" | "prefix"> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  prefix?: ReactNode;
  suffix?: ReactNode;
  style?: CSSProperties;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    hint,
    error,
    id,
    type = "text",
    prefix,
    suffix,
    disabled,
    style,
    onBlur,
    onFocus,
    ...rest
  },
  ref,
) {
  const [focus, setFocus] = useState(false);
  const generatedId = useId();
  const inputId = id || generatedId;
  const borderColor = error ? "var(--danger)" : focus ? "var(--teal-600)" : "var(--border)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)", ...style }}>
      {label ? (
        <label
          htmlFor={inputId}
          style={{ fontSize: "var(--text-body-sm)", fontWeight: "var(--fw-semibold)", color: "var(--text-strong)" }}
        >
          {label}
        </label>
      ) : null}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--sp-2)",
          height: "var(--control-h-md)",
          padding: "0 12px",
          borderRadius: "var(--r-md)",
          border: `1px solid ${borderColor}`,
          background: disabled ? "var(--surface)" : "var(--bg)",
          boxShadow: focus && !error ? "0 0 0 3px var(--focus-ring)" : "none",
          transition: "border-color var(--dur-fast) var(--ease), box-shadow var(--dur-fast) var(--ease)",
        }}
      >
        {prefix ? <span style={{ color: "var(--text-muted)", display: "flex" }}>{prefix}</span> : null}
        <input
          ref={ref}
          id={inputId}
          type={type}
          disabled={disabled}
          onFocus={(event) => {
            setFocus(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocus(false);
            onBlur?.(event);
          }}
          style={{
            flex: 1,
            minWidth: 0,
            border: 0,
            outline: "none",
            background: "transparent",
            font: "inherit",
            fontSize: "var(--text-body-base)",
            color: "var(--ink)",
          }}
          {...rest}
        />
        {suffix ? <span style={{ color: "var(--text-muted)", display: "flex" }}>{suffix}</span> : null}
      </div>
      {error || hint ? (
        <span style={{ fontSize: "var(--text-caption)", lineHeight: "var(--lh-caption)", color: error ? "var(--danger)" : "var(--text-muted)" }}>
          {error || hint}
        </span>
      ) : null}
    </div>
  );
});
