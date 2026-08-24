import { queryOptions } from "@tanstack/react-query";

import {
  CONTENT_QUERY_OPTIONS,
  mapFile,
  pageResult,
  requireUuid,
  resolvePageParams,
  throwContentError,
  type AdminFileDto,
  type FileKind,
  type PageParams,
} from "@shared/api/content";
import { supabase } from "@shared/api/supabase";
import type { Database } from "@shared/api/supabase";

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

type AdminFileListRow =
  Database["public"]["Functions"]["list_admin_files"]["Returns"][number];
type AdminFileDetailRow =
  Database["public"]["Functions"]["get_admin_file_detail"]["Returns"][number];

function mapUsage(row: AdminFileDetailRow): FileUsageSummary {
  return {
    institutionLogoCount: row.institution_logo_count,
    postCount: row.post_count,
    resourceCount: row.resource_count,
    seminarCount: row.seminar_count,
    galleryCount: row.gallery_count,
  };
}

export function mapAdminFileListRow(
  row: AdminFileListRow,
): AdminFileListItem {
  const usage = mapUsage(row);
  return {
    ...mapFile(row),
    usage,
    isUsed: Object.values(usage).some((count) => count > 0),
  };
}

export function mapAdminFileDetailRow(
  row: AdminFileDetailRow,
): AdminFileDetail {
  return { ...mapFile(row), usage: mapUsage(row) };
}

async function fetchAdminFiles(params: ReturnType<typeof resolveParams>) {
  const { data, error } = await supabase.rpc("list_admin_files", {
    p_file_kind: params.fileKind,
    p_page: params.page,
    p_page_size: params.pageSize,
    p_q: params.q,
    p_usage: params.usage,
  });
  if (error) throwContentError(error);
  const rows = data as AdminFileListRow[];
  return pageResult(
    rows.map(mapAdminFileListRow),
    rows[0]?.total_count ?? 0,
    params,
  );
}

async function fetchAdminFileById(id: string): Promise<AdminFileDetail | null> {
  const normalizedId = requireUuid(id);
  const { data, error } = await supabase.rpc("get_admin_file_detail", {
    p_file_id: normalizedId,
  });
  if (error) throwContentError(error);
  const row = (data as AdminFileDetailRow[])[0];
  return row ? mapAdminFileDetailRow(row) : null;
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

export function getPublicFileUrl(bucketName: string, storagePath: string) {
  return supabase.storage.from(bucketName).getPublicUrl(storagePath).data
    .publicUrl;
}
