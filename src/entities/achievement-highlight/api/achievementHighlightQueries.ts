import { queryOptions } from "@tanstack/react-query";
import { CONTENT_QUERY_OPTIONS } from "@shared/api/content";
import { getPublicAssetUrl, supabase } from "@shared/api/supabase";

export type AchievementHighlightDto = {
  id: string;
  title: string;
  content: string;
  occurredOn: string;
  imageFileId: string | null;
  imageUrl: string | null;
  position: number;
  updatedAt: string;
};

export const achievementHighlightQueryKeys = { all: ["achievement-highlights"] as const };

async function fetchHighlights(): Promise<AchievementHighlightDto[]> {
  const { data, error } = await supabase
    .from("achievement_highlights")
    .select("*, files(storage_path)")
    .order("position");
  if (error) throw error;
  return data.map((item) => ({
    id: item.id,
    title: item.title,
    content: item.content,
    occurredOn: item.occurred_on,
    imageFileId: item.image_file_id,
    imageUrl: getPublicAssetUrl(item.files?.storage_path),
    position: item.position,
    updatedAt: item.updated_at,
  }));
}

export const achievementHighlightsQueryOptions = () => queryOptions({
  ...CONTENT_QUERY_OPTIONS,
  queryKey: achievementHighlightQueryKeys.all,
  queryFn: fetchHighlights,
});
