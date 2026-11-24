import { queryOptions } from "@tanstack/react-query";

import {
  CONTENT_QUERY_OPTIONS,
  requireUuid,
  resolvePageParams,
  type AdminFileDto,
  type FileKind,
  type PageParams,
  type PageResult,
} from "@shared/api/content";

export type AdminFileUsage = "all" | "used" | "unused";
export type AdminFileListParams = PageParams & {
  fileKind?: FileKind;
  q?: string;
  usage?: AdminFileUsage;
};
export type FileUsageSummary = {
  institutionLogoCount: number;
  postCount: number;
  resourceCount: number;
  seminarCount: number;
  galleryCount: number;
};
export type AdminFileDetail = AdminFileDto & { usage: FileUsageSummary };
export type AdminFileListItem = AdminFileDetail & { isUsed: boolean };

function resolveParams(params: AdminFileListParams = {}) {
  return {
    ...resolvePageParams(params),
    fileKind: params.fileKind,
    q: params.q?.trim() || undefined,
    usage: params.usage ?? "all",
  };
}

export const fileQueryKeys = {
  all: ["files"] as const,
  adminList: (params: ReturnType<typeof resolveParams>) =>
    ["files", "admin", "list", params] as const,
  adminDetail: (id: string) => ["files", "admin", "detail", id] as const,
};

async function fetchAdminFiles(
  _params: ReturnType<typeof resolveParams>,
): Promise<PageResult<AdminFileListItem>> {
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}

async function fetchAdminFileById(id: string): Promise<AdminFileDetail | null> {
  requireUuid(id);
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}

export function adminFilesQueryOptions(params: AdminFileListParams = {}) {
  const resolved = resolveParams(params);
  return queryOptions({
    ...CONTENT_QUERY_OPTIONS,
    queryKey: fileQueryKeys.adminList(resolved),
    queryFn: () => fetchAdminFiles(resolved),
  });
}
export function adminFileDetailQueryOptions(id: string) {
  const normalized = requireUuid(id);
  return queryOptions({
    ...CONTENT_QUERY_OPTIONS,
    queryKey: fileQueryKeys.adminDetail(normalized),
    queryFn: () => fetchAdminFileById(normalized),
  });
}

export function getPublicFileUrl(_bucketName: string, storagePath: string) {
  return `/assets/${storagePath.replace(/^\/+/, "")}`;
}
