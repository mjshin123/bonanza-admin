import { queryOptions } from "@tanstack/react-query";
import { CONTENT_QUERY_OPTIONS } from "@shared/api/content";

export type AwardDto = { id: string; title: string; titleEn: string; organization: string; organizationEn: string; awardedOn: string; updatedAt: string; createdAt?: string; createdByLogin?: string | null; updatedByLogin?: string | null };
export const awardQueryKeys = { all: ["awards"] as const };
export const awardsQueryOptions = () => queryOptions({
  ...CONTENT_QUERY_OPTIONS, queryKey: awardQueryKeys.all,
  queryFn: async (): Promise<AwardDto[]> => {
    throw new Error("백엔드가 아직 연결되지 않았습니다.");
  },
});
