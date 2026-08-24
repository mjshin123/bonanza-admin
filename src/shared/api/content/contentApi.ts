import type { Json, Tables } from "@shared/api/supabase";
import { getPublicAssetUrl } from "@shared/api/supabase";

export type ContentStatus = "draft" | "published" | "hidden";
export type FileKind = "image" | "attachment";
export type InstitutionType = "member" | "partner";
export type PostCategory = "notice" | "association_news" | "member_news";
export type ResourceCategory = "resource" | "financial_disclosure";
export type PostFileRole = "cover" | "content";
export type SeminarFileRole = "poster" | "photo";
export type SelectionMethod = "first_come" | "lottery" | "other";
export type SeminarTiming = "all" | "upcoming" | "past";

export type PageParams = { page?: number; pageSize?: number };
export type PageResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type ResolvedPageParams = { page: number; pageSize: number };

export type FileDto = {
  id: string;
  fileKind: FileKind;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  widthPx: number | null;
  heightPx: number | null;
  altText: string | null;
  url: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminFileDto = FileDto & {
  bucketName: string;
  storagePath: string;
  uploadedBy: string | null;
};

export type ContentApiErrorCode =
  | "NOT_FOUND"
  | "IN_USE"
  | "CONFLICT"
  | "INVALID_STATE"
  | "STORAGE_CLEANUP_REQUIRED";

export class ContentApiError extends Error {
  readonly code: ContentApiErrorCode;
  override readonly cause?: unknown;

  constructor(code: ContentApiErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "ContentApiError";
    this.code = code;
    this.cause = cause;
  }
}

export function resolvePageParams(params: PageParams = {}): ResolvedPageParams {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 10;
  if (!Number.isInteger(page) || page < 1) {
    throw new RangeError("page는 1 이상의 정수여야 합니다.");
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw new RangeError("pageSize는 1 이상 100 이하의 정수여야 합니다.");
  }
  return { page, pageSize };
}

export function pageRange(params: ResolvedPageParams) {
  const from = (params.page - 1) * params.pageSize;
  return { from, to: from + params.pageSize - 1 };
}

export function pageResult<T>(
  items: T[],
  count: number | null,
  params: ResolvedPageParams,
): PageResult<T> {
  const total = count ?? 0;
  return {
    items,
    page: params.page,
    pageSize: params.pageSize,
    total,
    totalPages: Math.ceil(total / params.pageSize),
  };
}

export function requireUuid(value: string, fieldName = "id"): string {
  const normalized = value.trim();
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      normalized,
    )
  ) {
    throw new TypeError(`${fieldName}는 유효한 UUID여야 합니다.`);
  }
  return normalized;
}

export function requireExpectedUpdatedAt(value: string): string {
  if (Number.isNaN(Date.parse(value))) {
    throw new TypeError("expectedUpdatedAt은 유효한 ISO 일시여야 합니다.");
  }
  return new Date(value).toISOString();
}

export function normalizeFileItems<T extends { fileId: string }>(
  items: T[],
): T[] {
  if (items.length > 1000) {
    throw new RangeError(
      "한 콘텐츠에는 파일을 최대 1,000개 연결할 수 있습니다.",
    );
  }
  const normalized = items.map((item) => ({
    ...item,
    fileId: requireUuid(item.fileId, "fileId"),
  }));
  if (
    new Set(normalized.map((item) => item.fileId)).size !== normalized.length
  ) {
    throw new TypeError("같은 파일을 한 콘텐츠에 중복 연결할 수 없습니다.");
  }
  return normalized;
}

export function requireText(
  value: string,
  fieldName: string,
  maxLength: number,
): string {
  const normalized = value.trim();
  if (!normalized) throw new TypeError(`${fieldName}는 필수입니다.`);
  if (normalized.length > maxLength) {
    throw new RangeError(`${fieldName}는 ${maxLength}자 이하여야 합니다.`);
  }
  return normalized;
}

export function optionalText(
  value: string | undefined,
  fieldName: string,
  maxLength: number,
): string | undefined {
  if (value === undefined) return undefined;
  if (value.length > maxLength) {
    throw new RangeError(`${fieldName}는 ${maxLength}자 이하여야 합니다.`);
  }
  return value;
}

export function normalizePublishedAt(
  status: ContentStatus | undefined,
  publishedAt: string | null | undefined,
): string | null | undefined {
  if (
    publishedAt !== undefined &&
    publishedAt !== null &&
    Number.isNaN(Date.parse(publishedAt))
  ) {
    throw new TypeError("publishedAt은 유효한 ISO 일시여야 합니다.");
  }
  if (status === "published" && publishedAt == null)
    return new Date().toISOString();
  return publishedAt;
}

export function mapFile(
  row: Omit<Tables<"files">, "uploaded_by"> & { uploaded_by?: string | null },
): AdminFileDto {
  return {
    id: row.id,
    fileKind: row.file_kind as FileKind,
    originalName: row.original_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    widthPx: row.width_px,
    heightPx: row.height_px,
    altText: row.alt_text,
    url: getPublicAssetUrl(row.storage_path, row.bucket_name) ?? "",
    bucketName: row.bucket_name,
    storagePath: row.storage_path,
    uploadedBy: row.uploaded_by ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

type RpcFileJson = {
  alt_text: string | null;
  bucket_name: string;
  created_at: string;
  file_kind: string;
  height_px: number | null;
  id: string;
  mime_type: string;
  original_name: string;
  size_bytes: number;
  storage_path: string;
  updated_at: string;
  width_px: number | null;
};

export function mapRpcFile(value: Json | null): FileDto | null {
  if (value === null) return null;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("RPC 파일 응답 형식이 올바르지 않습니다.");
  }
  return mapFile(value as RpcFileJson);
}

type PostgrestLikeError = { code?: string; message?: string; details?: string };

export function throwContentError(error: unknown): never {
  const candidate = error as PostgrestLikeError;
  if (candidate.code === "PGRST116" || candidate.code === "P0002") {
    throw new ContentApiError("NOT_FOUND", "대상을 찾을 수 없습니다.", error);
  }
  if (candidate.code === "23503") {
    throw new ContentApiError(
      "IN_USE",
      "다른 데이터에서 참조 중입니다.",
      error,
    );
  }
  if (candidate.code === "23505" || candidate.code === "40001") {
    throw new ContentApiError(
      "CONFLICT",
      "이미 존재하거나 서로 충돌하는 데이터입니다.",
      error,
    );
  }
  if (
    candidate.code === "23514" ||
    candidate.code === "22023" ||
    candidate.code === "22P02"
  ) {
    throw new ContentApiError(
      "INVALID_STATE",
      "현재 상태에서는 요청을 처리할 수 없습니다.",
      error,
    );
  }
  throw error;
}

export const CONTENT_QUERY_OPTIONS = {
  staleTime: 30_000,
  retry: 1,
  refetchOnWindowFocus: false,
} as const;
