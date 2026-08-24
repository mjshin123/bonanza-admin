import { mutationOptions } from "@tanstack/react-query";

import {
  normalizeSeminarEventValues,
  type SeminarEventValues,
} from "@entities/seminar-event";
import { supabase } from "@shared/api/supabase";

export type CreateSeminarEventInput = SeminarEventValues;

async function createSeminarEvent(input: CreateSeminarEventInput) {
  const values = normalizeSeminarEventValues(input);
  const { data, error } = await supabase.rpc("create_seminar_event", {
    p_application_method: values.applicationMethod ?? undefined,
    p_application_url: values.applicationUrl ?? undefined,
    p_capacity: values.capacity ?? undefined,
    p_caption: values.caption,
    p_content: values.content,
    p_ends_at: values.endsAt ?? undefined,
    p_is_pinned: values.isPinned,
    p_is_published: values.isPublished,
    p_location: values.location,
    p_published_at: values.publishedAt ?? undefined,
    p_registration_deadline: values.registrationDeadline ?? undefined,
    p_starts_at: values.startsAt,
    p_tags: values.tags,
    p_thumbnail_path: values.thumbnailPath ?? undefined,
    p_title: values.title,
    p_topic: values.topic,
  });

  if (error) {
    throw error;
  }

  return data;
}

export function createSeminarEventMutationOptions() {
  return mutationOptions({
    mutationKey: ["seminar-event", "create"],
    mutationFn: createSeminarEvent,
  });
}
