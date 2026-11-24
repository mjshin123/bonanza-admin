import { useEffect, useState } from "react";

import { Button } from "../button";
import { Modal } from "../modal/Modal";
import { subscribeDialog, type DialogRequest } from "./dialogStore";

/** 앱 루트에 한 번만 두면 confirmDialog·alertDialog가 디자인 모달로 열린다. */
export function DialogHost() {
  const [queue, setQueue] = useState<DialogRequest[]>([]);
  const current = queue[0];

  useEffect(
    () => subscribeDialog((request) => setQueue((items) => [...items, request])),
    [],
  );

  const close = (result: boolean) => {
    if (!current) return;
    current.resolve(result);
    setQueue((items) => items.slice(1));
  };

  const isConfirm = current?.kind === "confirm";
  const options = current?.options ?? {};

  return (
    <Modal
      compact
      open={Boolean(current)}
      title={options.title ?? (isConfirm ? "확인" : "안내")}
      onClose={() => close(false)}
    >
      <p
        style={{
          color: "var(--text-body)",
          fontSize: "var(--text-body-sm)",
          whiteSpace: "pre-line",
        }}
      >
        {current?.message}
      </p>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: "var(--sp-3)",
          paddingTop: "var(--sp-4)",
        }}
      >
        {isConfirm ? (
          <Button variant="ghost" onClick={() => close(false)}>
            {options.cancelLabel ?? "취소"}
          </Button>
        ) : null}
        <Button
          variant={options.tone === "danger" ? "danger" : "primary"}
          onClick={() => close(true)}
        >
          {options.confirmLabel ?? "확인"}
        </Button>
      </div>
    </Modal>
  );
}
