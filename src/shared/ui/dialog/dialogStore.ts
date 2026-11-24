export type DialogTone = "primary" | "danger";

export type DialogOptions = {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: DialogTone;
};

export type DialogRequest = {
  kind: "confirm" | "alert";
  message: string;
  options: DialogOptions;
  resolve: (result: boolean) => void;
};

type Listener = (request: DialogRequest) => void;

let listener: Listener | null = null;

export function subscribeDialog(next: Listener) {
  listener = next;
  return () => {
    if (listener === next) listener = null;
  };
}

function open(
  kind: DialogRequest["kind"],
  message: string,
  options: DialogOptions,
) {
  return new Promise<boolean>((resolve) => {
    if (!listener) {
      resolve(kind === "alert");
      return;
    }
    listener({ kind, message, options, resolve });
  });
}

/** window.confirm 대체. 확인하면 true, 취소·닫기는 false. */
export function confirmDialog(message: string, options: DialogOptions = {}) {
  return open("confirm", message, options);
}

/** window.alert 대체. */
export async function alertDialog(message: string, options: DialogOptions = {}) {
  await open("alert", message, options);
}
