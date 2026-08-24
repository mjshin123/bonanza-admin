import { queryOptions } from "@tanstack/react-query";

import type { InstitutionSummary } from "@entities/institution";
import { mapInstitution } from "@entities/institution";
import {
  CONTENT_QUERY_OPTIONS,
  mapFile,
  pageRange,
  pageResult,
  requireUuid,
  resolvePageParams,
  type ContentStatus,
  type FileDto,
  type PageParams,
  type PostCategory,
  type PostFileRole,
} from "@shared/api/content";
import { supabase } from "@shared/api/supabase";
import type { Tables } from "@shared/api/supabase";

export type PostFileDto = {
  file: FileDto;
  role: PostFileRole;
  sortOrder: number;
  createdAt: string;
};
export type ContentPostListItem = {
  id: string;
  category: PostCategory;
  title: string;
  summary: string;
  institution: InstitutionSummary | null;
  cover: FileDto | null;
  isPinned: boolean;
  publishedAt: string | null;
};
export type ContentPostDetail = ContentPostListItem & {
  content: string;
  files: PostFileDto[];
  status: ContentStatus;
  createdAt: string;
  updatedAt: string;
};
export type AdminContentPostListItem = ContentPostListItem & {
  status: ContentStatus;
  createdAt: string;
  updatedAt: string;
};
export type PostListParamsV2 = PageParams & {
  category?: PostCategory;
  institutionId?: string;
  q?: string;
};
export type AdminPostListParamsV2 = PostListParamsV2 & {
  status?: ContentStatus;
};
export type PostListItem = ContentPostListItem;
export type PostDetail = ContentPostDetail;
export type AdminPostListItem = AdminContentPostListItem;
export type AdminPostDetail = ContentPostDetail;
export type PostListParams = PostListParamsV2;
export type AdminPostListParams = AdminPostListParamsV2;

type JoinedPost = Tables<"posts"> & {
  institution:
    | (Tables<"institutions"> & {
        category: Tables<"institution_categories">;
        logo: Tables<"files"> | null;
      })
    | null;
  files: Array<Tables<"post_files"> & { file: Tables<"files"> | null }>;
};
const SELECT =
  "id,category,title,summary,content,institution_id,status,is_pinned,published_at,created_at,updated_at,institution:institutions(id,institution_type,category_id,name,logo_file_id,description,homepage_url,display_order,is_active,created_at,updated_at,category:institution_categories!inner(id,code,name,display_order,is_active,created_at,updated_at),logo:files(id,file_kind,bucket_name,storage_path,original_name,mime_type,size_bytes,width_px,height_px,alt_text,created_at,updated_at)),files:post_files(post_id,file_id,role,sort_order,created_at,file:files(id,file_kind,bucket_name,storage_path,original_name,mime_type,size_bytes,width_px,height_px,alt_text,created_at,updated_at))";

function mapPost(row: JoinedPost): ContentPostDetail {
  const files = row.files
    .filter(
      (
        relation,
      ): relation is typeof relation & {
        file: Tables<"files">;
        role: PostFileRole;
      } => Boolean(relation.file && relation.role),
    )
    .map((relation) => ({
      file: mapFile(relation.file),
      role: relation.role,
      sortOrder: relation.sort_order,
      createdAt: relation.created_at,
    }))
    .sort(
      (a, b) =>
        a.sortOrder - b.sortOrder ||
        a.createdAt.localeCompare(b.createdAt) ||
        a.file.id.localeCompare(b.file.id),
    );
  const institution = row.institution ? mapInstitution(row.institution) : null;
  return {
    id: row.id,
    category: row.category as PostCategory,
    title: row.title,
    summary: row.summary,
    institution: institution
      ? {
          id: institution.id,
          institutionType: institution.institutionType,
          name: institution.name,
          logo: institution.logo,
        }
      : null,
    cover: files.find((file) => file.role === "cover")?.file ?? null,
    isPinned: row.is_pinned,
    publishedAt: row.published_at,
    content: row.content,
    files,
    status: row.status as ContentStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function resolveParams(params: AdminPostListParamsV2 = {}) {
  return {
    ...resolvePageParams(params),
    category: params.category,
    institutionId: params.institutionId
      ? requireUuid(params.institutionId, "institutionId")
      : undefined,
    q: params.q?.trim() || undefined,
    status: params.status,
  };
}
export const contentPostQueryKeys = {
  all: ["posts"] as const,
  publicList: (params: ReturnType<typeof resolveParams>) =>
    ["posts", "public", "list", params] as const,
  publicDetail: (id: string) => ["posts", "public", "detail", id] as const,
  adminList: (params: ReturnType<typeof resolveParams>) =>
    ["posts", "admin", "list", params] as const,
  adminDetail: (id: string) => ["posts", "admin", "detail", id] as const,
};

async function fetchList(
  params: ReturnType<typeof resolveParams>,
  admin: boolean,
) {
  const { from, to } = pageRange(params);
  let query = supabase
    .from("posts")
    .select(SELECT, { count: "exact" })
    .not("category", "is", null)
    .order("is_pinned", { ascending: false })
    .order("published_at", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to);
  if (!admin)
    query = query
      .eq("status", "published")
      .lte("published_at", new Date().toISOString());
  if (params.category) query = query.eq("category", params.category);
  if (params.institutionId)
    query = query.eq("institution_id", params.institutionId);
  if (params.status) query = query.eq("status", params.status);
  if (params.q)
    query = query.or(`title.ilike.%${params.q}%,summary.ilike.%${params.q}%`);
  const { data, error, count } = await query;
  if (error) throw error;
  const details = data.map((row) => mapPost(row as JoinedPost));
  const items = details.map(
    ({
      content: _content,
      files: _files,
      status: _status,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      ...item
    }) =>
      admin
        ? {
            ...item,
            status: _status,
            createdAt: _createdAt,
            updatedAt: _updatedAt,
          }
        : item,
  );
  return pageResult(items, count, params);
}
async function fetchDetail(id: string, admin: boolean) {
  let query = supabase
    .from("posts")
    .select(SELECT)
    .eq("id", requireUuid(id))
    .not("category", "is", null);
  if (!admin)
    query = query
      .eq("status", "published")
      .lte("published_at", new Date().toISOString());
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data ? mapPost(data as JoinedPost) : null;
}

export function postsQueryOptions(params: PostListParamsV2 = {}) {
  const resolved = resolveParams(params);
  return queryOptions({
    ...CONTENT_QUERY_OPTIONS,
    queryKey: contentPostQueryKeys.publicList(resolved),
    queryFn: () => fetchList(resolved, false),
  });
}
export function postDetailQueryOptions(id: string) {
  const normalized = requireUuid(id);
  return queryOptions({
    ...CONTENT_QUERY_OPTIONS,
    queryKey: contentPostQueryKeys.publicDetail(normalized),
    queryFn: () => fetchDetail(normalized, false),
  });
}
export function adminPostsQueryOptions(params: AdminPostListParamsV2 = {}) {
  const resolved = resolveParams(params);
  return queryOptions({
    ...CONTENT_QUERY_OPTIONS,
    queryKey: contentPostQueryKeys.adminList(resolved),
    queryFn: () => fetchList(resolved, true),
  });
}
export function adminPostDetailQueryOptions(id: string) {
  const normalized = requireUuid(id);
  return queryOptions({
    ...CONTENT_QUERY_OPTIONS,
    queryKey: contentPostQueryKeys.adminDetail(normalized),
    queryFn: () => fetchDetail(normalized, true),
  });
}
export { mapPost as mapContentPost };
