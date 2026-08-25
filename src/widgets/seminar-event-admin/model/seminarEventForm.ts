import type {
  SeminarEventListItem,
  SeminarEventValues,
} from "@entities/seminar-event";

export type SeminarEventFormState = {
  applicationMethod: string;
  applicationUrl: string;
  capacity: string;
  content: string;
  endsAt: string;
  isPinned: boolean;
  isPublished: boolean;
  location: string;
  registrationDeadline: string;
  startsAt: string;
  tags: string[];
  title: string;
  topic: string;
};

export const EMPTY_SEMINAR_EVENT_FORM: SeminarEventFormState = {
  applicationMethod: "",
  applicationUrl: "",
  capacity: "",
  content: "",
  endsAt: "",
  isPinned: false,
  isPublished: false,
  location: "",
  registrationDeadline: "",
  startsAt: "",
  tags: [],
  title: "",
  topic: "",
};

function toDateTimeLocal(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIsoDateTime(value: string) {
  return value ? new Date(value).toISOString() : null;
}

export function seminarEventToForm(
  event: SeminarEventListItem,
): SeminarEventFormState {
  return {
    applicationMethod: event.application_method ?? "",
    applicationUrl: event.application_url ?? "",
    capacity: event.capacity === null ? "" : String(event.capacity),
    content: event.post.content,
    endsAt: toDateTimeLocal(event.ends_at),
    isPinned: event.post.is_pinned,
    isPublished: event.post.is_published,
    location: event.location,
    registrationDeadline: toDateTimeLocal(event.registration_deadline),
    startsAt: toDateTimeLocal(event.starts_at),
    tags: event.post.tags,
    title: event.post.title,
    topic: event.topic,
  };
}

export function seminarEventFormToValues(
  form: SeminarEventFormState,
  options: {
    publishedAt?: string | null;
    thumbnailPath?: string | null;
  } = {},
): SeminarEventValues {
  return {
    applicationMethod: form.applicationMethod,
    applicationUrl: form.applicationUrl,
    capacity: form.capacity ? Number(form.capacity) : null,
    content: form.content,
    endsAt: toIsoDateTime(form.endsAt),
    isPinned: form.isPinned,
    isPublished: form.isPublished,
    location: form.location,
    publishedAt: options.publishedAt ?? null,
    registrationDeadline: toIsoDateTime(form.registrationDeadline),
    startsAt: toIsoDateTime(form.startsAt) ?? "",
    tags: form.tags,
    thumbnailPath: options.thumbnailPath ?? null,
    title: form.title,
    topic: form.topic,
  };
}

export function formatSeminarDateTime(
  startsAt: string,
  endsAt: string | null,
) {
  const dateTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const timeFormatter = new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const start = new Date(startsAt);

  if (!endsAt) {
    return dateTimeFormatter.format(start);
  }

  const end = new Date(endsAt);
  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();

  return sameDay
    ? `${dateTimeFormatter.format(start)} ~ ${timeFormatter.format(end)}`
    : `${dateTimeFormatter.format(start)} ~ ${dateTimeFormatter.format(end)}`;
}
