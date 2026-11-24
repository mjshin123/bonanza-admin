import { queryOptions } from "@tanstack/react-query";

import {
  CONTENT_QUERY_OPTIONS,
  requireUuid,
  resolvePageParams,
  type FileDto,
  type InstitutionType,
  type PageParams,
  type PageResult,
} from "@shared/api/content";

export type InstitutionDto = {
  id: string;
  institutionType: InstitutionType;
  name: string;
  logo: FileDto | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdByLogin?: string | null;
  updatedByLogin?: string | null;
};
export type InstitutionSummary = Pick<
  InstitutionDto,
  "id" | "institutionType" | "name" | "logo"
>;
export type InstitutionListParams = PageParams & {
  institutionType?: InstitutionType;
  q?: string;
};
export type AdminInstitutionListParams = InstitutionListParams & {
  isActive?: boolean;
};

function resolveParams(params: AdminInstitutionListParams = {}) {
  const page = resolvePageParams(params);
  return {
    ...page,
    institutionType: params.institutionType,
    q: params.q?.trim() || undefined,
    isActive: params.isActive,
  };
}

export const institutionQueryKeys = {
  all: ["institutions"] as const,
  publicList: (params: ReturnType<typeof resolveParams>) =>
    ["institutions", "public", "list", params] as const,
  publicDetail: (id: string) =>
    ["institutions", "public", "detail", id] as const,
  adminList: (params: ReturnType<typeof resolveParams>) =>
    ["institutions", "admin", "list", params] as const,
  adminDetail: (id: string) => ["institutions", "admin", "detail", id] as const,
};

async function fetchList(
  _params: ReturnType<typeof resolveParams>,
  _admin: boolean,
): Promise<PageResult<InstitutionDto>> {
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}

async function fetchDetail(
  id: string,
  _admin: boolean,
): Promise<InstitutionDto | null> {
  requireUuid(id);
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}

export function institutionsQueryOptions(params: InstitutionListParams = {}) {
  const resolved = resolveParams(params);
  return queryOptions({
    ...CONTENT_QUERY_OPTIONS,
    queryKey: institutionQueryKeys.publicList(resolved),
    queryFn: () => fetchList(resolved, false),
  });
}
export function institutionDetailQueryOptions(id: string) {
  const normalized = requireUuid(id);
  return queryOptions({
    ...CONTENT_QUERY_OPTIONS,
    queryKey: institutionQueryKeys.publicDetail(normalized),
    queryFn: () => fetchDetail(normalized, false),
  });
}
export function adminInstitutionsQueryOptions(
  params: AdminInstitutionListParams = {},
) {
  const resolved = resolveParams(params);
  return queryOptions({
    ...CONTENT_QUERY_OPTIONS,
    queryKey: institutionQueryKeys.adminList(resolved),
    queryFn: () => fetchList(resolved, true),
  });
}
export function adminInstitutionDetailQueryOptions(id: string) {
  const normalized = requireUuid(id);
  return queryOptions({
    ...CONTENT_QUERY_OPTIONS,
    queryKey: institutionQueryKeys.adminDetail(normalized),
    queryFn: () => fetchDetail(normalized, true),
  });
}
