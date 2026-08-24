import { useId, useState, type CSSProperties, type SelectHTMLAttributes } from "react";

type SelectOption = {
  value: string;
  label: string;
};

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "style"> & {
  options: SelectOption[];
  label?: string;
  style?: CSSProperties;
};

export function Select({ options, label, id, disabled, style, ...rest }: SelectProps) {
  const [focus, setFocus] = useState(false);
  const generatedId = useId();
  const selectId = id || generatedId;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)", ...style }}>
      {label ? (
        <label htmlFor={selectId} style={{ fontSize: "var(--text-body-sm)", fontWeight: "var(--fw-semibold)", color: "var(--text-strong)" }}>
          {label}
        </label>
      ) : null}
      <select
        id={selectId}
        disabled={disabled}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={{
          width: "100%",
          height: "var(--control-h-md)",
          padding: "0 12px",
          borderRadius: "var(--r-md)",
          border: `1px solid ${focus ? "var(--teal-600)" : "var(--border)"}`,
          background: disabled ? "var(--surface)" : "var(--bg)",
          color: "var(--ink)",
          font: "inherit",
          fontSize: "var(--text-body-base)",
          boxShadow: focus ? "0 0 0 3px var(--focus-ring)" : "none",
          transition: "border-color var(--dur-fast) var(--ease), box-shadow var(--dur-fast) var(--ease)",
          cursor: disabled ? "not-allowed" : "pointer",
        }}
        {...rest}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
