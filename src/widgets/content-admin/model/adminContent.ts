import type { ContentStatus } from "@shared/api/content";
import { useEffect, useRef, useState } from "react";

export const PAGE_SIZE = 20;

/**
 * Makes the browser Back button close an open editor/detail panel and land
 * back on the list underneath, instead of leaving the page entirely — since
 * opening the panel is normally just local state with no history entry of
 * its own. Call the returned function from Cancel/Save so it also unwinds
 * the extra history entry when the panel is closed without using Back.
 */
export function useBackNavCloses(open: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const close = useRef(() => {
    onCloseRef.current();
    if (
      (window.history.state as { contentAdminEditor?: boolean } | null)
        ?.contentAdminEditor
    ) {
      window.history.back();
    }
  }).current;

  useEffect(() => {
    if (!open) return;
    window.history.pushState({ contentAdminEditor: true }, "");
    window.addEventListener("popstate", close);
    return () => window.removeEventListener("popstate", close);
  }, [open, close]);

  return close;
}

export const STATUS_OPTIONS = [
  { value: "", label: "전체 상태" },
  { value: "draft", label: "임시저장" },
  { value: "published", label: "게시" },
  { value: "hidden", label: "숨김" },
];

export type DisplayStatus = ContentStatus | "scheduled";

export function resolveDisplayStatus(
  status: ContentStatus,
  publishedAt: string | null | undefined,
): DisplayStatus {
  if (status === "published" && publishedAt && new Date(publishedAt) > new Date())
    return "scheduled";
  return status;
}

export function statusLabel(status: DisplayStatus) {
  return {
    draft: "임시저장",
    published: "게시",
    hidden: "숨김",
    scheduled: "예약",
  }[status];
}

export function statusTone(status: DisplayStatus) {
  return {
    draft: "neutral",
    published: "success",
    hidden: "warning",
    scheduled: "navy",
  }[status] as "neutral" | "success" | "warning" | "navy";
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function toDateTimeLocal(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function toIsoOrNull(value: string) {
  return value ? new Date(value).toISOString() : null;
}

export function startOfDayIso(value: string) {
  return value ? new Date(`${value}T00:00:00`).toISOString() : undefined;
}

export function endOfDayIso(value: string) {
  return value ? new Date(`${value}T23:59:59.999`).toISOString() : undefined;
}

export function bytesLabel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function useDebouncedValue<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [delay, value]);
  return debounced;
}
