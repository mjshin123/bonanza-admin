import { queryOptions } from "@tanstack/react-query";
import { CONTENT_QUERY_OPTIONS } from "@shared/api/content";

export type AchievementHighlightDto = {
  id: string;
  title: string;
  content: string;
  occurredOn: string;
  imageFileId: string | null;
  imageUrl: string | null;
  position: number;
  updatedAt: string;
  createdAt?: string;
  createdByLogin?: string | null;
  updatedByLogin?: string | null;
};

export const achievementHighlightQueryKeys = { all: ["achievement-highlights"] as const };

async function fetchHighlights(): Promise<AchievementHighlightDto[]> {
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}

export const achievementHighlightsQueryOptions = () => queryOptions({
  ...CONTENT_QUERY_OPTIONS,
  queryKey: achievementHighlightQueryKeys.all,
  queryFn: fetchHighlights,
});
