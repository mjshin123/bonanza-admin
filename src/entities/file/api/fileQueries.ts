import { queryOptions } from "@tanstack/react-query";

import {
  CONTENT_QUERY_OPTIONS,
  mapFile,
  pageRange,
  pageResult,
  requireUuid,
  resolvePageParams,
  type AdminFileDto,
  type FileKind,
  type PageParams,
} from "@shared/api/content";
import { supabase } from "@shared/api/supabase";

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

async function fetchUsedFileIds(): Promise<string[]> {
  const [institutions, posts, resources, seminars, galleries] =
    await Promise.all([
      supabase
        .from("institutions")
        .select("logo_file_id")
        .not("logo_file_id", "is", null),
      supabase.from("post_files").select("file_id").not("file_id", "is", null),
      supabase.from("resource_files").select("file_id"),
      supabase.from("seminar_files").select("file_id"),
      supabase.from("gallery_items").select("file_id"),
    ]);
  const error = [institutions, posts, resources, seminars, galleries].find(
    (result) => result.error,
  )?.error;
  if (error) throw error;
  return [
    ...new Set([
      ...(institutions.data ?? []).flatMap((row) =>
        row.logo_file_id ? [row.logo_file_id] : [],
      ),
      ...(posts.data ?? []).flatMap((row) =>
        row.file_id ? [row.file_id] : [],
      ),
      ...(resources.data ?? []).map((row) => row.file_id),
      ...(seminars.data ?? []).map((row) => row.file_id),
      ...(galleries.data ?? []).map((row) => row.file_id),
    ]),
  ];
}

async function fetchAdminFiles(params: ReturnType<typeof resolveParams>) {
  const { from, to } = pageRange(params);
  let query = supabase.from("files").select("*", { count: "exact" });
  if (params.fileKind) query = query.eq("file_kind", params.fileKind);
  if (params.q) query = query.ilike("original_name", `%${params.q}%`);
  if (params.usage !== "all") {
    const ids = await fetchUsedFileIds();
    if (params.usage === "used") {
      if (ids.length === 0) return pageResult([], 0, params);
      query = query.in("id", ids);
    } else if (ids.length > 0) {
      query = query.not("id", "in", `(${ids.join(",")})`);
    }
  }
  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to);
  if (error) throw error;
  return pageResult(data.map(mapFile), count, params);
}

async function fetchAdminFileById(id: string): Promise<AdminFileDetail | null> {
  const normalizedId = requireUuid(id);
  const [file, institutions, posts, resources, seminars, galleries] =
    await Promise.all([
      supabase.from("files").select("*").eq("id", normalizedId).maybeSingle(),
      supabase
        .from("institutions")
        .select("id", { count: "exact", head: true })
        .eq("logo_file_id", normalizedId),
      supabase
        .from("post_files")
        .select("post_id", { count: "exact", head: true })
        .eq("file_id", normalizedId),
      supabase
        .from("resource_files")
        .select("resource_id", { count: "exact", head: true })
        .eq("file_id", normalizedId),
      supabase
        .from("seminar_files")
        .select("seminar_id", { count: "exact", head: true })
        .eq("file_id", normalizedId),
      supabase
        .from("gallery_items")
        .select("gallery_id", { count: "exact", head: true })
        .eq("file_id", normalizedId),
    ]);
  const error = [
    file,
    institutions,
    posts,
    resources,
    seminars,
    galleries,
  ].find((result) => result.error)?.error;
  if (error) throw error;
  if (!file.data) return null;
  return {
    ...mapFile(file.data),
    usage: {
      institutionLogoCount: institutions.count ?? 0,
      postCount: posts.count ?? 0,
      resourceCount: resources.count ?? 0,
      seminarCount: seminars.count ?? 0,
      galleryCount: galleries.count ?? 0,
    },
  };
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
