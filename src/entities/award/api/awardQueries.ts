import { queryOptions } from "@tanstack/react-query";
import { CONTENT_QUERY_OPTIONS } from "@shared/api/content";
import { supabase } from "@shared/api/supabase";

export type AwardDto = { id: string; title: string; titleEn: string; organization: string; organizationEn: string; awardedOn: string; updatedAt: string };
export const awardQueryKeys = { all: ["awards"] as const };
export const awardsQueryOptions = () => queryOptions({
  ...CONTENT_QUERY_OPTIONS, queryKey: awardQueryKeys.all,
  queryFn: async (): Promise<AwardDto[]> => {
    const { data, error } = await supabase.from("awards").select("*").order("awarded_on", { ascending: false }).order("created_at", { ascending: false });
    if (error) throw error;
    return data.map((item) => ({ id: item.id, title: item.title, titleEn: item.title_en ?? "", organization: item.organization, organizationEn: item.organization_en ?? "", awardedOn: item.awarded_on, updatedAt: item.updated_at }));
  },
});
