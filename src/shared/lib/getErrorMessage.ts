type ErrorRecord = {
  code?: unknown;
  details?: unknown;
  hint?: unknown;
  message?: unknown;
};

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function getErrorMessage(error: unknown) {
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  if (error && typeof error === "object") {
    const errorRecord = error as ErrorRecord;
    const message = readString(errorRecord.message);
    const details = readString(errorRecord.details);
    const hint = readString(errorRecord.hint);
    const code = readString(errorRecord.code);
    const parts = Array.from(new Set([message, details, hint].filter(Boolean)));

    if (parts.length > 0) {
      return code ? `[${code}] ${parts.join(" ")}` : parts.join(" ");
    }

    if (code) {
      return `요청을 처리하지 못했습니다. 오류 코드: ${code}`;
    }
  }

  return "알 수 없는 오류가 발생했습니다.";
}
