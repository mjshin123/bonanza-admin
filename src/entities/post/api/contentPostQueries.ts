import { queryOptions } from "@tanstack/react-query";

import type { InstitutionSummary } from "@entities/institution";
import { mapInstitution } from "@entities/institution";
import {
  CONTENT_QUERY_OPTIONS,
  mapFile,
  mapRpcFile,
  pageResult,
  requireUuid,
  resolvePageParams,
  resolvePublishedDateRange,
  throwContentError,
  type ContentStatus,
  type FileDto,
  type PageParams,
  type PageResult,
  type PostCategory,
  type PostFileRole,
} from "@shared/api/content";
import { supabase } from "@shared/api/supabase";
import type { Database, Json, Tables } from "@shared/api/supabase";

export type PostFileDto = {
  file: FileDto;
  role: PostFileRole;
  showInGallery: boolean;
  sortOrder: number;
  createdAt: string;
};
export type ContentPostListItem = {
  id: string;
  category: PostCategory;
  title: string;
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
  publishedFrom?: string;
  publishedTo?: string;
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
  "id,category,title,content,institution_id,status,is_pinned,published_at,created_at,updated_at,institution:institutions(id,institution_type,category_id,name,logo_file_id,description,homepage_url,display_order,is_active,created_at,updated_at,category:institution_categories!inner(id,code,name,display_order,is_active,created_at,updated_at),logo:files(id,file_kind,bucket_name,storage_path,original_name,mime_type,size_bytes,width_px,height_px,alt_text,created_at,updated_at)),files:post_files(post_id,file_id,role,show_in_gallery,sort_order,created_at,file:files(id,file_kind,bucket_name,storage_path,original_name,mime_type,size_bytes,width_px,height_px,alt_text,created_at,updated_at))";

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
      showInGallery: relation.show_in_gallery,
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
  const { publishedFrom, publishedTo } = resolvePublishedDateRange(
    params.publishedFrom,
    params.publishedTo,
  );
  return {
    ...resolvePageParams(params),
    category: params.category,
    institutionId: params.institutionId
      ? requireUuid(params.institutionId, "institutionId")
      : undefined,
    q: params.q?.trim() || undefined,
    status: params.status,
    publishedFrom,
    publishedTo,
  };
}
export const contentPostQueryKeys = {
  all: ["content-posts"] as const,
  publicList: (params: ReturnType<typeof resolveParams>) =>
    ["content-posts", "public", "list", params] as const,
  publicDetail: (id: string) =>
    ["content-posts", "public", "detail", id] as const,
  adminList: (params: ReturnType<typeof resolveParams>) =>
    ["content-posts", "admin", "list", params] as const,
  adminDetail: (id: string) =>
    ["content-posts", "admin", "detail", id] as const,
};

type RpcPostRow =
  Database["public"]["Functions"]["list_admin_content_posts"]["Returns"][number];
type RpcInstitution = {
  id: string;
  institution_type: string;
  logo: Json | null;
  name: string;
};

function mapRpcInstitution(value: Json | null): InstitutionSummary | null {
  if (value === null) return null;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("RPC 기관 응답 형식이 올바르지 않습니다.");
  }
  const institution = value as RpcInstitution;
  return {
    id: institution.id,
    institutionType:
      institution.institution_type as InstitutionSummary["institutionType"],
    name: institution.name,
    logo: mapRpcFile(institution.logo),
  };
}

export function mapContentPostListRow(
  row: RpcPostRow,
  admin: false,
): ContentPostListItem;
export function mapContentPostListRow(
  row: RpcPostRow,
  admin: true,
): AdminContentPostListItem;
export function mapContentPostListRow(row: RpcPostRow, admin: boolean) {
  const item: ContentPostListItem = {
    id: row.id,
    category: row.category as PostCategory,
    title: row.title,
    institution: mapRpcInstitution(row.institution),
    cover: mapRpcFile(row.cover),
    isPinned: row.is_pinned,
    publishedAt: row.published_at,
  };
  return admin
    ? {
        ...item,
        status: row.status as ContentStatus,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    : item;
}

async function fetchList(
  params: ReturnType<typeof resolveParams>,
  admin: false,
): Promise<PageResult<ContentPostListItem>>;
async function fetchList(
  params: ReturnType<typeof resolveParams>,
  admin: true,
): Promise<PageResult<AdminContentPostListItem>>;
async function fetchList(
  params: ReturnType<typeof resolveParams>,
  admin: boolean,
): Promise<PageResult<ContentPostListItem | AdminContentPostListItem>> {
  const { data, error } = admin
    ? await supabase.rpc("list_admin_content_posts", {
        p_admin: true,
        p_category: params.category,
        p_institution_id: params.institutionId,
        p_page: params.page,
        p_page_size: params.pageSize,
        p_published_from: params.publishedFrom,
        p_published_to: params.publishedTo,
        p_q: params.q,
        p_status: params.status,
      })
    : await supabase.rpc("list_content_posts", {
        p_admin: false,
        p_category: params.category,
        p_institution_id: params.institutionId,
        p_page: params.page,
        p_page_size: params.pageSize,
        p_q: params.q,
        p_status: undefined,
      });
  if (error) throwContentError(error);
  const rows = data as RpcPostRow[];
  const items = admin
    ? rows.map((row) => mapContentPostListRow(row, true))
    : rows.map((row) => mapContentPostListRow(row, false));
  return pageResult(items, rows[0]?.total_count ?? 0, params);
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
