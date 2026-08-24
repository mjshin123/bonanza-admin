import { useEffect, type ReactNode } from "react";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
};

export function Modal({ open, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: "var(--z-modal)" as unknown as number,
        background: "rgba(10,19,30,.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--sp-7)",
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 420,
          borderRadius: "var(--r-md)",
          background: "var(--bg)",
          boxShadow: "var(--shadow)",
          padding: "var(--sp-8)",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          style={{
            position: "absolute",
            top: "var(--sp-5)",
            right: "var(--sp-5)",
            width: 32,
            height: 32,
            borderRadius: "50%",
            border: 0,
            background: "transparent",
            color: "var(--text-muted)",
            fontSize: 20,
            lineHeight: 1,
            cursor: "pointer",
          }}
        >
          ×
        </button>
        {title ? (
          <h3
            style={{
              fontSize: "var(--text-h3)",
              lineHeight: "30px",
              fontWeight: "var(--fw-bold)",
              color: "var(--ink)",
              paddingRight: "var(--sp-7)",
            }}
          >
            {title}
          </h3>
        ) : null}
        <div style={{ paddingTop: title ? "var(--sp-4)" : 0 }}>{children}</div>
      </div>
    </div>
  );
}
