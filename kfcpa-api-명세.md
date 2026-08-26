# KFCPA 홈페이지 API 명세서 v2

> 상태: **v2 조회·저장 RPC 및 데이터 접근 계층 구현 완료 · 화면 전환 진행 가능**
>
> 이 문서는 KFCPA 홈페이지의 v2 데이터 접근 계약을 정의한다. 신규 FSD entity/feature API와 DB 확장 migration은 구현됐으며, 기존 화면은 운영 데이터 검증 기간 동안 레거시 API와 호환 조회를 유지한다.

## 1. 문서 개요

### 1.1 목적

이 문서는 다음 도메인의 공개 조회, 관리자 CRUD, 파일 업로드 및 연결 API를 정의한다.

- 기관 분류와 회원기관·협력기관
- 공지사항·협회소식·회원기관 소식
- 자료실·결산/공시 자료
- 세미나
- 중앙 파일 라이브러리
- 포토 갤러리

관련 데이터 모델은 [KFCPA_DB_명세서_v1.md](./KFCPA_DB_명세서_v1.md)를 단일 기준으로 삼는다. 두 문서의 테이블명, 필드, enum, 삭제 정책이 다르면 DB 명세를 먼저 확정한 뒤 이 문서를 함께 갱신한다.

DB 문서 파일명은 사용자가 지정한 기존 경로와 외부 참조를 깨지 않기 위해 `v1`을 유지한다. 다만 두 문서의 본문 버전은 기존 구현을 대체할 목표 v2 설계를 뜻한다.

### 1.2 문서 정보

| 항목 | 값 |
|---|---|
| 문서 버전 | `2.2.0` |
| 작성일 | `2026-08-24` |
| 구현 상태 | DB·Supabase/TanStack API 구현 완료, 기존 화면 호환 단계 |
| 데이터 접근 | Supabase JavaScript SDK |
| 조회 캐시 | TanStack Query |
| 인증 | Supabase Auth |
| 파일 저장소 | Supabase Storage |

### 1.3 중요한 전제

현재 프로젝트에는 별도 WAS나 자체 REST API 서버가 없다. 이 문서의 “API”는 다음을 뜻한다.

1. `supabase.from(...)`, `supabase.rpc(...)`, `supabase.storage...`를 감싸는 데이터 접근 함수
2. 화면과 Router loader가 사용하는 TanStack Query options 함수
3. Supabase Auth 세션 함수

따라서 `/api/v1/...` 형태의 HTTP 엔드포인트는 이 명세의 범위가 아니다. 브라우저는 Supabase SDK를 통해 PostgreSQL Data API, Auth, Storage에 접근하며 실제 권한은 `GRANT`와 RLS가 최종적으로 강제한다.

### 1.4 목표 테이블

| 도메인 | 테이블 |
|---|---|
| 파일 | `files` |
| 기관 분류 | `institution_categories` |
| 기관 | `institutions` |
| 소식 게시물 | `posts`, `post_files` |
| 자료 | `resources`, `resource_files` |
| 세미나 | `seminars`, `seminar_files` |
| 갤러리 | `galleries`, `gallery_items` |

`post_files`, `resource_files`, `seminar_files`, `gallery_items`는 파일 ID 배열 컬럼을 대신하는 명시적 관계 테이블이다. 하나의 파일을 여러 콘텐츠나 여러 갤러리에서 재사용할 수 있다.

---

## 2. 목표 구조와 FSD 배치

```text
React Page / TanStack Router loader
               │
               ▼
TanStack Query queryOptions / mutationOptions
               │
               ▼
도메인 데이터 접근 함수
               │
               ▼
Supabase JavaScript SDK
    ├─ Auth
    ├─ PostgreSQL Data API / RPC
    └─ Storage
               │
               ▼
PostgreSQL constraint + GRANT + RLS
```

### 2.1 책임 원칙

- `entities`는 공개 조회 타입, Query key, Query options를 제공한다.
- `features`는 관리자 생성·수정·삭제와 파일 연결 행위를 제공한다.
- `shared/api/supabase`는 client, 생성된 DB 타입, Storage 공통 도구만 제공한다.
- 다른 slice는 각 slice의 `index.ts`에 공개된 API만 import한다.
- DB row의 `snake_case`는 데이터 접근 경계에서 애플리케이션 DTO의 `camelCase`로 변환한다.
- 페이지와 위젯이 Supabase 테이블을 직접 조회하거나 수정하지 않는다.

### 2.2 목표 경로

| 레이어 | 목표 경로 | 책임 |
|---|---|---|
| `entities` | `src/entities/file` | 파일 DTO와 관리자 조회 |
| `entities` | `src/entities/institution-category` | 기관 분류 공개·관리자 조회 |
| `entities` | `src/entities/institution` | 기관 공개·관리자 조회 |
| `entities` | `src/entities/post` | 소식 공개·관리자 조회 |
| `entities` | `src/entities/resource` | 자료 공개·관리자 조회 |
| `entities` | `src/entities/seminar` | 세미나 공개·관리자 조회 |
| `entities` | `src/entities/gallery` | 갤러리 공개·관리자 조회 |
| `features` | `src/features/admin-auth` | 관리자 로그인·로그아웃 |
| `features` | `src/features/file-upload` | 중앙 파일 업로드 |
| `features` | `src/features/file-update` | 파일 메타데이터 수정 |
| `features` | `src/features/file-delete` | 미사용 파일 삭제 |
| `features` | `src/features/institution-category-*` | 기관 분류 CRUD |
| `features` | `src/features/institution-*` | 기관 CRUD |
| `features` | `src/features/post-*` | 소식과 소식 파일 관계 CRUD |
| `features` | `src/features/resource-*` | 자료와 자료 파일 관계 CRUD |
| `features` | `src/features/seminar-*` | 세미나와 세미나 파일 관계 CRUD |
| `features` | `src/features/gallery-*` | 갤러리와 갤러리 항목 CRUD |
| `shared` | `src/shared/api/supabase` | client, DB 타입, 공개 URL 생성 |

`*`는 실제 책임이 생긴 slice만 만든다는 뜻이며 빈 slice를 미리 생성하지 않는다.

---

## 3. 공통 계약

### 3.1 명명과 값 형식

| 항목 | 계약 |
|---|---|
| DB 컬럼 | `snake_case` |
| 함수 입력·응답 DTO | `camelCase` |
| 기본 키 | UUID 문자열 |
| 일시 | ISO 8601 문자열, offset 포함 |
| 날짜 | `YYYY-MM-DD` |
| 파일 크기 | byte 정수 |
| URL | `http` 또는 `https`, 최대 2,048자 |
| nullable 값 | 값이 없으면 `null`; 응답에서 임의로 빈 문자열로 바꾸지 않음 |

예를 들어 DB의 `published_at`, `file_kind`, `sort_order`는 각각 `publishedAt`, `fileKind`, `sortOrder`로 반환한다.

### 3.2 공통 enum

```ts
export type ContentStatus = "draft" | "published" | "hidden";

export type FileKind = "image" | "attachment";

export type InstitutionType = "member" | "partner";

export type PostCategory =
  | "notice"
  | "association_news"
  | "member_news";

export type ResourceCategory =
  | "resource"
  | "financial_disclosure";

export type PostFileRole = "cover" | "content";

export type SeminarFileRole = "poster" | "photo";

export type SelectionMethod =
  | "first_come"
  | "lottery"
  | "other";

export type SeminarTiming = "all" | "upcoming" | "past";
```

DB에 영속되는 `ContentStatus`, `FileKind`, `InstitutionType`, `PostCategory`, `ResourceCategory`, `PostFileRole`, `SeminarFileRole`, `SelectionMethod` 값은 DB CHECK 제약과 완전히 같아야 한다. `SeminarTiming`은 조회 전용 필터이며 DB에 저장하지 않는다. 화면 표시 문구는 별도 label map에서 관리한다.

### 3.3 페이지네이션

```ts
export type PageParams = {
  page?: number;
  pageSize?: number;
};

export type PageResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};
```

문서에 등장하는 `Resolved...Params`는 외부 공개 타입이 아니다. 각 입력의 공백을 정리하고 기본값을 채운 뒤 필터 값을 검증한 내부 타입이며, `page`와 `pageSize`는 항상 필수 숫자가 된다.

| 항목 | 값 |
|---|---:|
| `page` 기본값 | `1` |
| `pageSize` 기본값 | `10` |
| `pageSize` 최댓값 | `100` |

- `page`는 1 이상의 정수여야 한다.
- `pageSize`는 1 이상 100 이하의 정수여야 한다.
- v2 콘텐츠와 관리자 파일 목록은 RPC에 `page`, `pageSize`를 전달하며 DB가 `LIMIT/OFFSET`을 적용한다.
- RPC 행의 `total_count`를 `total`로 변환하고 `totalPages = Math.ceil(total / pageSize)`로 계산한다.
- 정규화된 기본값까지 Query key에 포함한다.

목록 필터는 다음과 같이 정규화한다.

- `q`는 trim하고 빈 문자열이면 필터에서 제외한다.
- ID 필터는 UUID 형식을 먼저 확인한다.
- enum 필터는 이 문서에 정의된 값만 허용한다.
- `from`, `to`는 유효한 날짜 또는 일시여야 하며 둘 다 있으면 `from <= to`여야 한다.
- 같은 의미의 생략값과 기본값이 서로 다른 Query key를 만들지 않게 정규화 후 key를 생성한다.

#### 구현된 목록 RPC

| RPC | 주요 필터 | 목록 projection |
|---|---|---|
| `list_content_posts` | `category`, `institution_id`, `q`, `status` | 기관 요약, cover 1건 |
| `list_resources` | `category`, `q`, `reference_year`, `status` | `file_count` |
| `list_admin_resources` | `category`, `q`, `status`, `published_from`, `published_to` | `file_count` |
| `list_seminars` | `q`, `timing`, `from`, `to`, `status` | poster 1건 |
| `list_galleries` | `q`, `from`, `to`, `status` | 첫 이미지, `item_count` |
| `list_admin_files` | `file_kind`, `q`, `usage` | 파일 메타데이터, 도메인별 사용 수 |

네 콘텐츠 RPC의 공통 인자는 `p_page`, `p_page_size`, `p_admin`이다. `p_admin = true`는 `authenticated`만 허용하며 공개 호출은 DB 함수와 RLS 양쪽에서 `published_at <= now()`인 `published` 행으로 제한한다. 검색 문자열은 RPC 파라미터로 바인딩하며 클라이언트에서 PostgREST `.or(...)` 문자열을 조합하지 않는다.

### 3.4 게시 상태와 공개 조건

`posts`, `resources`, `seminars`, `galleries`의 공개 조건은 동일하다.

```text
status = 'published'
AND published_at IS NOT NULL
AND published_at <= now()
```

- `draft`: 관리자에게만 보이는 임시 저장 상태
- `published`: `publishedAt` 시점부터 공개
- `hidden`: 공개 중단 상태
- `status = published`인데 `publishedAt`이 생략되면 생성·수정 함수가 현재 시각을 채운다.
- 미래의 `publishedAt`을 저장하면 예약 게시로 취급한다.
- 공개 상세 조회는 미존재, 비공개, 예약 게시를 모두 `null`로 반환한다.
- 관리자 조회는 모든 상태를 반환한다.
- 콘텐츠 DTO의 `publishedAt` 타입은 관리자 draft를 표현하기 위해 `string | null`이다. 공개 Query는 공개 조건으로 `null`을 제외하므로 실제 공개 응답에서는 항상 non-null이다.

공개 파일 관계는 반드시 공개 조건을 만족하는 부모 행을 통해서만 조회한다.

### 3.5 공통 오류

입력 오류는 네트워크 요청 전에 발생시킨다.

| 상황 | 오류 |
|---|---|
| 필수 문자열 누락, UUID·날짜·URL 형식 오류 | `TypeError` |
| 길이·범위·시간 순서 오류 | `RangeError` |
| 존재하지 않는 대상 | `ContentApiError("NOT_FOUND")` |
| 참조 중인 파일·기관·분류 삭제 | `ContentApiError("IN_USE")` |
| 대표 이미지·포스터 중복 등 상태 충돌 | `ContentApiError("CONFLICT")` |
| 필수 관계 없이 게시하거나 생성 단계에서 허용하지 않는 상태를 요청 | `ContentApiError("INVALID_STATE")` |
| Storage 보상 삭제·DB 메타데이터 복원까지 실패해 운영 정리가 필요 | `ContentApiError("STORAGE_CLEANUP_REQUIRED")` |
| 권한 없음 | Supabase `AuthError` 또는 `PostgrestError` |
| DB·Storage 오류 | 원래 Supabase 오류를 `cause`로 보존 |

```ts
export type ContentApiErrorCode =
  | "NOT_FOUND"
  | "IN_USE"
  | "CONFLICT"
  | "INVALID_STATE"
  | "STORAGE_CLEANUP_REQUIRED";

export class ContentApiError extends Error {
  code: ContentApiErrorCode;
  cause?: unknown;
}
```

UI는 Supabase의 영문 오류 문자열을 그대로 노출하지 않는다. 알려진 제약조건명과 오류 코드를 사용자용 문구로 매핑한다.

### 3.6 TanStack Query 기본값

목표 기본값은 현재 프로젝트 관례를 유지한다.

| 옵션 | 값 |
|---|---:|
| `staleTime` | 30초 |
| `retry` | 1회 |
| `refetchOnWindowFocus` | `false` |

관리자 로그아웃 시 관리자 전용 Query key의 캐시를 제거한다. 공개 Query와 관리자 Query는 key에 `"public"`과 `"admin"`을 각각 포함해 서로 섞이지 않게 한다.

### 3.7 데이터 함수와 options 함수

- `async function`으로 표기한 데이터 함수는 slice 내부 구현이며 Supabase 호출과 DTO 변환을 담당한다.
- 외부 slice에는 `...QueryOptions()` 또는 `...MutationOptions()`만 public API로 공개한다.
- Query와 Mutation options의 `queryFn`·`mutationFn`은 바로 위에 명시된 데이터 함수를 한 번 감싼다.
- 데이터 함수와 options 함수의 입력·응답 타입은 같아야 하며 UI에서 DB row를 직접 다루지 않는다.

### 3.8 공통 Supabase 동작

별도 설명이 없는 관리자 CRUD는 다음 계약을 따른다.

| 동작 | Supabase 호출 |
|---|---|
| 생성 | `.from(table).insert(mappedInput).select(detailSelect).single()` |
| 수정 | `.from(table).update(mappedPatch).eq("id", id).select(detailSelect).single()` |
| 삭제 | `.from(table).delete().eq("id", id).select("id").single()` |
| v2 목록 | `.rpc(listFunction, normalizedParams)` |
| 상세 | `.select(detailSelect).eq("id", id).maybeSingle()` |

- 수정 입력에서 `undefined`는 변경하지 않음을 뜻하고 `null`은 nullable 필드를 비움을 뜻한다.
- 생성·수정 응답은 DB row를 camelCase DTO로 변환한 뒤 반환한다.
- 삭제 대상이 없으면 `NOT_FOUND`, FK RESTRICT면 `IN_USE`로 변환한다.
- 여러 테이블을 함께 검증·수정하거나 순서를 일괄 변경하는 작업은 관리용 RPC를 사용한다.

### 3.9 콘텐츠 command RPC

| RPC | 부모 테이블 | 관계 배열 항목 |
|---|---|---|
| `save_content_post` | `posts` | `{ fileId, role }` |
| `save_resource` | `resources` | `{ fileId }` |
| `save_seminar` | `seminars` | `{ fileId, role }` |
| `save_gallery` | `galleries` | `{ fileId, caption }` |

각 함수는 부모 필드와 관계 배열 전체를 한 transaction에서 저장하고 부모 row를 반환한다. 배열 순서가 `sort_order`이며 동일 파일 중복은 허용하지 않는다. 관계 배열은 최대 1,000개다. 생성은 `p_id = null`, 수정은 `p_id`와 조회 당시 `p_expected_updated_at`을 함께 전달한다. 다른 요청이 먼저 수정했다면 `40001`을 `CONFLICT`로 변환한다.

신규 저장 API는 요청 1회와 DB RPC 1회로 부모 및 관계를 반영한다. 기존 개별 link/update/reorder/unlink mutation은 관리자 화면의 단계적 전환을 위해 당분간 유지하되 신규 전체 폼 저장에는 command RPC를 우선한다.

---

## 4. 인증 API

### 4.1 권한 모델

| 역할 | 허용 범위 |
|---|---|
| `anon` | 공개 조건을 만족하는 콘텐츠와 활성 기관·분류 조회 |
| `authenticated` | 관리자 Query와 Mutation |

별도 REST 로그인 API를 만들지 않는다. Supabase Auth 이메일·비밀번호 로그인을 사용한다. 운영 환경에서는 공개 회원가입을 비활성화하고 Dashboard에서 승인된 관리자 계정만 생성한다.

현재와 같이 모든 `authenticated` 사용자를 관리자로 간주하려면 계정 발급 통제가 필수다. 향후 일반 회원 로그인이 추가되면 관리자 claim 또는 별도 관리자 프로필 정책을 도입하기 전까지 관리자 Mutation을 개방하면 안 된다.

### 4.2 함수 계약

```ts
export type AdminCredentials = {
  email: string;
  password: string;
};

export function getCurrentAdminUser(): Promise<User | null>;

export function subscribeToAdminAuthState(
  listener: (user: User | null) => void,
): () => void;

async function signInAdmin(
  credentials: AdminCredentials,
): Promise<User>;

async function signOutAdmin(): Promise<void>;

export function adminSignInMutationOptions(): MutationOptions<
  User,
  Error,
  AdminCredentials
>;

export function adminSignOutMutationOptions(): MutationOptions<
  void,
  Error,
  void
>;
```

| 기능 | Mutation key | Supabase 동작 |
|---|---|---|
| 로그인 | `["admin-auth", "sign-in"]` | `auth.signInWithPassword()` |
| 로그아웃 | `["admin-auth", "sign-out"]` | `auth.signOut({ scope: "local" })` |

각 도메인 key factory는 두 번째 segment에 `"admin"`을 둔다. 로그아웃 성공 후 존재하지 않는 `["admin"]` prefix를 제거하려 하지 말고 다음 공통 predicate로 모든 관리자 Query를 제거한다.

```ts
export function isAdminContentQueryKey(
  queryKey: readonly unknown[],
): boolean {
  return queryKey[1] === "admin";
}

queryClient.removeQueries({
  predicate: ({ queryKey }) =>
    isAdminContentQueryKey(queryKey),
});
```

---

## 5. 공통 DTO

### 5.1 파일

```ts
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

export type FileUsageSummary = {
  institutionLogoCount: number;
  postCount: number;
  resourceCount: number;
  seminarCount: number;
  galleryCount: number;
};

export type AdminFileDetail = AdminFileDto & {
  usage: FileUsageSummary;
};
```

`AdminFileDto`는 관리자 파일 API용 DTO다. `bucketName`, `storagePath`, `uploadedBy`는 일반 앱 DTO에서 제외하고 관리자 DTO에서만 반환한다. `bucketName`과 `storagePath`는 공개 URL 생성에 필요한 값이며 public bucket에서는 보안 비밀로 취급하지 않는다.

`files.uploaded_by`와 각 콘텐츠·기관·분류의 `created_by`는 anon column grant에서 제외한다. `createdBy`는 v2 앱 DTO에서 의도적으로 제공하지 않으며 Supabase Dashboard 조회 또는 후속 감사 API의 대상이다.

### 5.2 관계 파일

```ts
export type PostFileDto = {
  file: FileDto;
  role: PostFileRole;
  sortOrder: number;
  createdAt: string;
};

export type ResourceFileDto = {
  file: FileDto;
  sortOrder: number;
  createdAt: string;
};

export type SeminarFileDto = {
  file: FileDto;
  role: SeminarFileRole;
  sortOrder: number;
  createdAt: string;
};

export type GalleryItemDto = {
  file: FileDto;
  caption: string;
  sortOrder: number;
  createdAt: string;
};
```

관계 테이블은 `(부모 ID, file_id)` 복합 기본 키를 사용하므로 별도의 `linkId`는 없다. 수정·삭제 API도 부모 ID와 파일 ID를 함께 받는다.

### 5.3 목록과 상세 응답 원칙

- 목록 DTO는 긴 본문과 전체 파일 목록을 제외한다.
- 목록에는 대표 이미지, 파일 수, 관계 요약만 포함한다.
- 상세 DTO는 본문과 정렬된 관계 파일 전체를 포함한다.
- 관계 파일은 DB 명세와 같이 `sortOrder ASC`, `createdAt ASC`, `file.id ASC` 순으로 안정 정렬한다.

---

## 6. 중앙 파일 API

모든 이미지를 포함한 실제 파일 정보는 `files`에서 관리한다. 포토 갤러리는 파일 자체의 boolean 속성이 아니라 `gallery_items` 관계로 구성한다.

### 6.1 Query key

```ts
export const fileQueryKeys = {
  all: ["files"] as const,
  adminList: (params: ResolvedAdminFileListParams) =>
    ["files", "admin", "list", params] as const,
  adminDetail: (id: string) =>
    [...fileQueryKeys.all, "admin", "detail", id] as const,
};
```

### 6.2 관리자 파일 목록

```ts
export type AdminFileUsage = "all" | "used" | "unused";

export type AdminFileListParams = PageParams & {
  fileKind?: FileKind;
  q?: string;
  usage?: AdminFileUsage;
};

async function fetchAdminFiles(
  params: ResolvedAdminFileListParams,
): Promise<PageResult<AdminFileListItem>>;

export function adminFilesQueryOptions(
  params?: AdminFileListParams,
): QueryOptions<PageResult<AdminFileListItem>>;
```

| 항목 | 계약 |
|---|---|
| Query key | `["files", "admin", "list", resolvedParams]` |
| 검색 | `original_name` 부분 일치 |
| 필터 | `file_kind`, 전체 관계 및 기관 로고 참조 여부 |
| 정렬 | `created_at DESC`, `id DESC` |
| 인증 | 관리자 |

`usage = used`는 `institutions.logo_file_id`, 네 관계 테이블 중 하나 이상에서 참조되는 파일이다.
목록의 `usage`에는 도메인별 참조 수가 들어가며 `isUsed`는 합계가 1 이상인지 나타낸다. `list_admin_files` 한 번에서 관계 사용량 집계, 검색, 필터, 정렬, 페이지네이션을 수행한다.

### 6.3 관리자 파일 상세

```ts
async function fetchAdminFileById(
  id: string,
): Promise<AdminFileDetail | null>;

export function adminFileDetailQueryOptions(
  id: string,
): QueryOptions<AdminFileDetail | null>;
```

| 항목 | 계약 |
|---|---|
| Query key | `["files", "admin", "detail", id]` |
| 응답 | 파일 전체 메타데이터와 사용처 요약 |
| 미존재 | `null` |
| 인증 | 관리자 |

사용처 요약은 기관, 소식, 자료, 세미나, 갤러리별 참조 수를 포함한다.
상세는 `get_admin_file_detail(p_file_id)` RPC 한 번으로 파일과 사용처 요약을 반환한다.

### 6.4 파일 업로드

```ts
export type UploadFileInput = {
  file: File;
  fileKind: FileKind;
  altText?: string | null;
};

async function uploadFile(
  input: UploadFileInput,
): Promise<AdminFileDto>;

export function uploadFileMutationOptions(): MutationOptions<
  AdminFileDto,
  Error,
  UploadFileInput
>;
```

| 항목 | 계약 |
|---|---|
| Mutation key | `["files", "upload"]` |
| Storage | `bucket_name`에 기록된 bucket |
| 권장 경로 | `assets/{yyyy}/{mm}/{fileId}/{objectUuid}.{ext}` |
| 응답 | 생성된 `AdminFileDto` |

검증:

- 빈 파일은 허용하지 않는다.
- `originalName`은 1~255자다.
- `altText`는 최대 500자다.
- `fileKind = image`이면 Storage bucket이 허용하는 이미지 MIME이어야 한다.
- `fileKind = attachment`는 확장자를 제한하지 않는다. MIME이 없으면 `application/octet-stream`으로 저장한다.
- 애플리케이션 한도는 이미지 10 MiB, 일반 첨부파일 50 MiB다.
- Supabase Storage bucket 한도가 더 작으면 둘 중 더 작은 값을 실제 한도로 적용한다.
- 허용 MIME은 Storage bucket 설정을 기준으로 확인한다.
- 이미지의 `widthPx`, `heightPx`는 추출 가능할 때 저장한다.

### 6.5 파일 메타데이터 수정

```ts
export type UpdateFileInput = {
  id: string;
  altText: string | null;
};

async function updateFile(
  input: UpdateFileInput,
): Promise<AdminFileDto>;

export function updateFileMutationOptions(): MutationOptions<
  AdminFileDto,
  Error,
  UpdateFileInput
>;
```

| 항목 | 계약 |
|---|---|
| Mutation key | `["files", "update"]` |
| 수정 가능 | `alt_text` |
| 수정 불가 | bucket, storage path, kind, 원본명, MIME, 크기 |

파일 자체 교체는 허용하지 않는다. 새 파일을 업로드하고 관계를 새 ID로 변경한다.

### 6.6 파일 삭제

```ts
async function deleteFile(id: string): Promise<string>;

export function deleteFileMutationOptions(): MutationOptions<
  string,
  Error,
  string
>;
```

| 항목 | 계약 |
|---|---|
| Mutation key | `["files", "delete"]` |
| 입력 | `fileId` |
| 응답 | 삭제된 `fileId` |
| 전제 | 모든 참조 수가 0 |

DB FK는 파일 방향 삭제를 `RESTRICT`한다. 기관 로고나 관계 테이블에서 참조 중이면 `IN_USE` 오류를 던진다. 콘텐츠를 삭제해 관계 행이 CASCADE로 사라져도 파일 행과 Storage 객체는 자동 삭제하지 않는다.

삭제는 `begin_file_delete` → Storage remove → `complete_file_delete` 순서다. Storage remove가 실패하면 `restore_file_delete`가 private 복구 기록의 신뢰된 snapshot으로 파일 행을 복원한다.

### 6.7 공개 URL

```ts
export function getPublicFileUrl(
  bucketName: string,
  storagePath: string,
): string;
```

- `storage.from(bucketName).getPublicUrl(storagePath)`를 사용한다.
- 공개 화면은 공개 조건을 만족하는 부모를 통해 조회한 파일에만 URL을 생성한다.
- `public` bucket의 URL을 안다는 사실만으로 접근을 막을 수는 없다.
- `draft`, `hidden`, 예약 게시 파일의 기밀성이 필요하면 private bucket과 signed URL 방식으로 별도 전환해야 한다.
- 일반 첨부파일은 화면에서 다운로드 속성을 사용해 inline 실행 위험을 줄인다.
- 일반 첨부파일을 `iframe`, 이미지, 스크립트로 미리보기 하지 않는다. 확장자 무제한 업로드와 강한 접근 통제를 함께 요구하면 attachment 전용 private bucket과 signed download 방식이 필요하다.

---

## 7. 기관 분류 API

### 7.1 타입

```ts
export type InstitutionCategoryDto = {
  id: string;
  code: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};
```

검증:

- `code`: trim 후 1~50자, 고유
- `code`: 소문자 영문, 숫자, underscore만 허용
- `name`: trim 후 1~100자
- `displayOrder`: 0 이상의 정수

### 7.2 Query key

```ts
export const institutionCategoryQueryKeys = {
  all: ["institution-categories"] as const,
  publicList: () =>
    [...institutionCategoryQueryKeys.all, "public", "list"] as const,
  adminList: () =>
    [...institutionCategoryQueryKeys.all, "admin", "list"] as const,
  adminDetail: (id: string) =>
    [...institutionCategoryQueryKeys.all, "admin", "detail", id] as const,
};
```

### 7.3 공개 조회

```ts
async function fetchInstitutionCategories(): Promise<
  InstitutionCategoryDto[]
>;

export function institutionCategoriesQueryOptions(): QueryOptions<
  InstitutionCategoryDto[]
>;
```

| 항목 | 계약 |
|---|---|
| Query key | `["institution-categories", "public", "list"]` |
| 필터 | `is_active = true` |
| 정렬 | `display_order ASC`, `name ASC`, `id ASC` |
| 빈 결과 | `[]` |

### 7.4 관리자 조회와 CRUD

```ts
async function fetchAdminInstitutionCategories(): Promise<
  InstitutionCategoryDto[]
>;

async function fetchAdminInstitutionCategoryById(
  id: string,
): Promise<InstitutionCategoryDto | null>;

export function adminInstitutionCategoriesQueryOptions(): QueryOptions<
  InstitutionCategoryDto[]
>;

export function adminInstitutionCategoryDetailQueryOptions(
  id: string,
): QueryOptions<InstitutionCategoryDto | null>;

export type CreateInstitutionCategoryInput = {
  code: string;
  name: string;
  displayOrder?: number;
  isActive?: boolean;
};

export type UpdateInstitutionCategoryInput =
  Partial<CreateInstitutionCategoryInput> & { id: string };

async function createInstitutionCategory(
  input: CreateInstitutionCategoryInput,
): Promise<InstitutionCategoryDto>;

async function updateInstitutionCategory(
  input: UpdateInstitutionCategoryInput,
): Promise<InstitutionCategoryDto>;

async function deleteInstitutionCategory(
  id: string,
): Promise<string>;

export function createInstitutionCategoryMutationOptions(): MutationOptions<
  InstitutionCategoryDto,
  Error,
  CreateInstitutionCategoryInput
>;

export function updateInstitutionCategoryMutationOptions(): MutationOptions<
  InstitutionCategoryDto,
  Error,
  UpdateInstitutionCategoryInput
>;

export function deleteInstitutionCategoryMutationOptions(): MutationOptions<
  string,
  Error,
  string
>;
```

| 기능 | Mutation key |
|---|---|
| 생성 | `["institution-categories", "create"]` |
| 수정 | `["institution-categories", "update"]` |
| 삭제 | `["institution-categories", "delete"]` |

기관이 참조 중인 분류는 삭제할 수 없다. 운영 이력을 유지하려면 삭제보다 `isActive = false`를 우선한다.

---

## 8. 기관 API

### 8.1 타입

```ts
export type InstitutionDto = {
  id: string;
  institutionType: InstitutionType;
  category: InstitutionCategoryDto;
  name: string;
  logo: FileDto | null;
  description: string;
  homepageUrl: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type InstitutionSummary = Pick<
  InstitutionDto,
  "id" | "institutionType" | "name" | "logo"
>;
```

검증:

- `name`: trim 후 1~200자
- `categoryId`: 존재하는 기관 분류 UUID
- `logoFileId`: `fileKind = image`인 파일 또는 `null`
- `homepageUrl`: `http` 또는 `https`, 최대 2,048자
- `displayOrder`: 0 이상의 정수

### 8.2 Query key

```ts
export const institutionQueryKeys = {
  all: ["institutions"] as const,
  publicLists: () => [...institutionQueryKeys.all, "public", "list"] as const,
  publicList: (params: ResolvedInstitutionListParams) =>
    [...institutionQueryKeys.publicLists(), params] as const,
  publicDetail: (id: string) =>
    [...institutionQueryKeys.all, "public", "detail", id] as const,
  adminLists: () => [...institutionQueryKeys.all, "admin", "list"] as const,
  adminList: (params: ResolvedAdminInstitutionListParams) =>
    [...institutionQueryKeys.adminLists(), params] as const,
  adminDetail: (id: string) =>
    [...institutionQueryKeys.all, "admin", "detail", id] as const,
};
```

### 8.3 공개 목록과 상세

```ts
export type InstitutionListParams = PageParams & {
  categoryId?: string;
  institutionType?: InstitutionType;
  q?: string;
};

async function fetchInstitutions(
  params: ResolvedInstitutionListParams,
): Promise<PageResult<InstitutionDto>>;

async function fetchInstitutionById(
  id: string,
): Promise<InstitutionDto | null>;

export function institutionsQueryOptions(
  params?: InstitutionListParams,
): QueryOptions<PageResult<InstitutionDto>>;

export function institutionDetailQueryOptions(
  id: string,
): QueryOptions<InstitutionDto | null>;
```

| 항목 | 목록 | 상세 |
|---|---|---|
| Query key | `["institutions","public","list",params]` | `["institutions","public","detail",id]` |
| 필터 | 기관과 분류 모두 활성, 선택 type/category | 기관과 분류 모두 활성 |
| 검색 | 기관명 부분 일치 | 없음 |
| 정렬 | `display_order ASC`, `name ASC`, `id ASC` | 단건 |
| 미존재 | 해당 없음 | `null` |

### 8.4 관리자 목록과 CRUD

```ts
export type AdminInstitutionListParams = InstitutionListParams & {
  isActive?: boolean;
};

async function fetchAdminInstitutions(
  params: ResolvedAdminInstitutionListParams,
): Promise<PageResult<InstitutionDto>>;

async function fetchAdminInstitutionById(
  id: string,
): Promise<InstitutionDto | null>;

export function adminInstitutionsQueryOptions(
  params?: AdminInstitutionListParams,
): QueryOptions<PageResult<InstitutionDto>>;

export function adminInstitutionDetailQueryOptions(
  id: string,
): QueryOptions<InstitutionDto | null>;

export type CreateInstitutionInput = {
  institutionType: InstitutionType;
  categoryId: string;
  name: string;
  logoFileId?: string | null;
  description?: string;
  homepageUrl?: string | null;
  displayOrder?: number;
  isActive?: boolean;
};

export type UpdateInstitutionInput =
  Partial<CreateInstitutionInput> & { id: string };

async function createInstitution(
  input: CreateInstitutionInput,
): Promise<InstitutionDto>;

async function updateInstitution(
  input: UpdateInstitutionInput,
): Promise<InstitutionDto>;

async function deleteInstitution(id: string): Promise<string>;

export function createInstitutionMutationOptions(): MutationOptions<
  InstitutionDto,
  Error,
  CreateInstitutionInput
>;

export function updateInstitutionMutationOptions(): MutationOptions<
  InstitutionDto,
  Error,
  UpdateInstitutionInput
>;

export function deleteInstitutionMutationOptions(): MutationOptions<
  string,
  Error,
  string
>;
```

| 기능 | Mutation key |
|---|---|
| 생성 | `["institutions", "create"]` |
| 수정 | `["institutions", "update"]` |
| 삭제 | `["institutions", "delete"]` |

`institutions → posts`는 RESTRICT다. 회원기관 소식이 참조하는 기관은 삭제할 수 없으며 먼저 소식을 다른 기관으로 변경하거나 숨긴 뒤에도 참조 자체를 제거해야 한다. 일반 운영에서는 `isActive = false`를 사용한다.

---

## 9. 소식 게시물 API

### 9.1 타입

```ts
export type PostListItem = {
  id: string;
  category: PostCategory;
  title: string;
  institution: InstitutionSummary | null;
  cover: FileDto | null;
  isPinned: boolean;
  publishedAt: string | null;
};

export type PostDetail = PostListItem & {
  content: string;
  files: PostFileDto[];
  status: ContentStatus;
  createdAt: string;
  updatedAt: string;
};

export type AdminPostListItem = Omit<PostListItem, "publishedAt"> & {
  status: ContentStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminPostDetail = Omit<PostDetail, "publishedAt"> & {
  publishedAt: string | null;
};
```

검증:

- `title`: trim 후 1~200자
- `content`: 필수 문자열
- `member_news`: `member` 타입 기관의 `institutionId` 필수
- `notice`, `association_news`: `institutionId`는 `null`
- `cover`: 게시물당 최대 1개, 이미지 파일만 가능
- `post_files.role = content`: 이미지 파일만 가능

`content`가 HTML이면 생성·수정 전에 프로젝트 공통 DOMPurify allowlist로 정제한다. `script`, inline event handler, `javascript:` URL 등 허용 목록 밖의 요소·속성을 제거하고, 화면 출력 시에도 같은 allowlist로 다시 정제해 저장 데이터 오염에 대비한다.

기관과 분류의 활성 여부는 관계 자체의 무결성 조건이 아니라 공개 조건이다. 이미 연결된 기관이 비활성화되어도 게시물과 이력은 유지하되 공개 Query와 RLS에서 제외한다.

### 9.2 Query key

```ts
export const postQueryKeys = {
  all: ["posts"] as const,
  publicLists: () => [...postQueryKeys.all, "public", "list"] as const,
  publicList: (params: ResolvedPostListParams) =>
    [...postQueryKeys.publicLists(), params] as const,
  publicDetail: (id: string) =>
    [...postQueryKeys.all, "public", "detail", id] as const,
  adminLists: () => [...postQueryKeys.all, "admin", "list"] as const,
  adminList: (params: ResolvedAdminPostListParams) =>
    [...postQueryKeys.adminLists(), params] as const,
  adminDetail: (id: string) =>
    [...postQueryKeys.all, "admin", "detail", id] as const,
};
```

### 9.3 공개 목록과 상세

```ts
export type PostListParams = PageParams & {
  category?: PostCategory;
  institutionId?: string;
  q?: string;
};

async function fetchPosts(
  params: ResolvedPostListParams,
): Promise<PageResult<PostListItem>>;

async function fetchPostById(
  id: string,
): Promise<PostDetail | null>;

export function postsQueryOptions(
  params?: PostListParams,
): QueryOptions<PageResult<PostListItem>>;

export function postDetailQueryOptions(
  id: string,
): QueryOptions<PostDetail | null>;
```

| 항목 | 계약 |
|---|---|
| 공개 필터 | 공개 조건, 선택 category/institution |
| 검색 | `title` 부분 일치 |
| 목록 정렬 | `is_pinned DESC`, `published_at DESC`, `created_at DESC`, `id DESC` |
| 파일 Join | 목록은 `role = cover` 1건, 상세는 전체 |
| 회원기관 Join | `member_news`는 활성 member 기관 |
| 상세 미존재 | `null` |

### 9.4 관리자 목록과 CRUD

```ts
export type AdminPostListParams = PostListParams & {
  status?: ContentStatus;
};

async function fetchAdminPosts(
  params: ResolvedAdminPostListParams,
): Promise<PageResult<AdminPostListItem>>;

async function fetchAdminPostById(
  id: string,
): Promise<AdminPostDetail | null>;

export function adminPostsQueryOptions(
  params?: AdminPostListParams,
): QueryOptions<PageResult<AdminPostListItem>>;

export function adminPostDetailQueryOptions(
  id: string,
): QueryOptions<AdminPostDetail | null>;

export type CreatePostInput = {
  category: PostCategory;
  title: string;
  content: string;
  institutionId?: string | null;
  status?: ContentStatus;
  isPinned?: boolean;
  publishedAt?: string | null;
  files?: Array<{ fileId: string; role: PostFileRole }>;
};

export type UpdatePostInput = Required<CreatePostInput> & {
  id: string;
  expectedUpdatedAt: string;
};

async function createPost(
  input: CreatePostInput,
): Promise<AdminPostDetail>;

async function updatePost(
  input: UpdatePostInput,
): Promise<AdminPostDetail>;

async function deletePost(id: string): Promise<string>;

export function createPostMutationOptions(): MutationOptions<
  AdminPostDetail,
  Error,
  CreatePostInput
>;

export function updatePostMutationOptions(): MutationOptions<
  AdminPostDetail,
  Error,
  UpdatePostInput
>;

export function deletePostMutationOptions(): MutationOptions<
  string,
  Error,
  string
>;
```

| 기능 | Mutation key | 결과 |
|---|---|---|
| 생성 | `["posts", "create"]` | 생성된 상세 |
| 수정 | `["posts", "update"]` | 수정된 상세 |
| 삭제 | `["posts", "delete"]` | 삭제된 ID |

`UpdatePostInput.category` 변경은 다음과 같이 정규화한다.

- `member_news`로 전환하려면 요청에 `member` 타입 기관의 `institutionId`를 반드시 함께 전달한다.
- `notice` 또는 `association_news`로 전환하면 입력의 `institutionId` 유무와 관계없이 저장값을 자동으로 `null`로 만든다.
- 조건을 만족하지 않으면 DB 요청 전에 `INVALID_STATE`를 던진다.

게시물 삭제 시 `post_files`는 CASCADE로 삭제되지만 `files`와 Storage 객체는 남는다.

### 9.5 게시물 파일 관계

```ts
export type LinkPostFileInput = {
  postId: string;
  fileId: string;
  role: PostFileRole;
  sortOrder?: number;
};

export type UpdatePostFileInput = {
  postId: string;
  fileId: string;
  role?: PostFileRole;
  sortOrder?: number;
};

export type ReorderPostFilesInput = {
  postId: string;
  items: Array<{ fileId: string; sortOrder: number }>;
};

export type UnlinkPostFileInput = {
  postId: string;
  fileId: string;
};

async function linkPostFile(
  input: LinkPostFileInput,
): Promise<PostFileDto>;

async function updatePostFile(
  input: UpdatePostFileInput,
): Promise<PostFileDto>;

async function reorderPostFiles(
  input: ReorderPostFilesInput,
): Promise<PostFileDto[]>;

async function unlinkPostFile(
  input: UnlinkPostFileInput,
): Promise<string>;

export function linkPostFileMutationOptions(): MutationOptions<
  PostFileDto,
  Error,
  LinkPostFileInput
>;

export function updatePostFileMutationOptions(): MutationOptions<
  PostFileDto,
  Error,
  UpdatePostFileInput
>;

export function reorderPostFilesMutationOptions(): MutationOptions<
  PostFileDto[],
  Error,
  ReorderPostFilesInput
>;

export function unlinkPostFileMutationOptions(): MutationOptions<
  string,
  Error,
  UnlinkPostFileInput
>;
```

| 기능 | Mutation key |
|---|---|
| 연결 | `["posts", "file", "link"]` |
| 역할·순서 수정 | `["posts", "file", "update"]` |
| 일괄 재정렬 | `["posts", "file", "reorder"]` |
| 연결 해제 | `["posts", "file", "unlink"]` |

`reorderPostFiles`는 모든 파일 ID가 해당 게시물에 연결돼 있는지 확인하고 RPC로 한 트랜잭션에서 처리한다. 연결 해제는 `post_files`만 삭제하며 파일 자체는 삭제하지 않는다.

리치 텍스트 본문 이미지는 가능한 경우 공개 Storage URL이 아니라 `fileId`를 식별자로 보관한다. 게시물 저장 시 본문에서 참조하는 파일 ID 집합과 `role = content` 관계를 한 트랜잭션에서 동기화한다. 본문에서 빠진 관계는 제거하되 중앙 파일은 삭제하지 않고, 공개 조회 DTO를 만들 때만 파일 ID를 URL로 해석한다.

---

## 10. 자료 API

### 10.1 타입

```ts
export type ResourceListItem = {
  id: string;
  category: ResourceCategory;
  title: string;
  referenceYear: number | null;
  fileCount: number;
  publishedAt: string | null;
};

export type ResourceDetail = ResourceListItem & {
  files: ResourceFileDto[];
  status: ContentStatus;
  createdAt: string;
  updatedAt: string;
};

export type AdminResourceListItem = Omit<
  ResourceListItem,
  "publishedAt"
> & {
  status: ContentStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminResourceDetail = Omit<
  ResourceDetail,
  "publishedAt"
> & {
  publishedAt: string | null;
};
```

검증:

- `title`: trim 후 1~200자
- `referenceYear`: 1900~2100 정수 또는 `null`
- 첨부 확장자는 제한하지 않는다.
- `published` 전환 시 연결된 파일이 1개 이상이어야 한다.

### 10.2 Query key

```ts
export const resourceQueryKeys = {
  all: ["resources"] as const,
  publicLists: () => [...resourceQueryKeys.all, "public", "list"] as const,
  publicList: (params: ResolvedResourceListParams) =>
    [...resourceQueryKeys.publicLists(), params] as const,
  publicDetail: (id: string) =>
    [...resourceQueryKeys.all, "public", "detail", id] as const,
  adminLists: () => [...resourceQueryKeys.all, "admin", "list"] as const,
  adminList: (params: ResolvedAdminResourceListParams) =>
    [...resourceQueryKeys.adminLists(), params] as const,
  adminDetail: (id: string) =>
    [...resourceQueryKeys.all, "admin", "detail", id] as const,
};
```

### 10.3 공개 목록과 상세

```ts
export type ResourceListParams = PageParams & {
  category?: ResourceCategory;
  q?: string;
  referenceYear?: number;
};

async function fetchResources(
  params: ResolvedResourceListParams,
): Promise<PageResult<ResourceListItem>>;

async function fetchResourceById(
  id: string,
): Promise<ResourceDetail | null>;

export function resourcesQueryOptions(
  params?: ResourceListParams,
): QueryOptions<PageResult<ResourceListItem>>;

export function resourceDetailQueryOptions(
  id: string,
): QueryOptions<ResourceDetail | null>;
```

| 항목 | 계약 |
|---|---|
| 공개 필터 | 공개 조건, 선택 category/referenceYear |
| 검색 | `title` 부분 일치 |
| 목록 정렬 | `published_at DESC`, `created_at DESC`, `id DESC` |
| 상세 파일 | `sort_order ASC`, `created_at ASC`, `file_id ASC` |
| 상세 미존재 | `null` |

### 10.4 관리자 목록과 CRUD

```ts
export type AdminResourceListParams = ResourceListParams & {
  status?: ContentStatus;
};

async function fetchAdminResources(
  params: ResolvedAdminResourceListParams,
): Promise<PageResult<AdminResourceListItem>>;

async function fetchAdminResourceById(
  id: string,
): Promise<AdminResourceDetail | null>;

export function adminResourcesQueryOptions(
  params?: AdminResourceListParams,
): QueryOptions<PageResult<AdminResourceListItem>>;

export function adminResourceDetailQueryOptions(
  id: string,
): QueryOptions<AdminResourceDetail | null>;

export type CreateResourceInput = {
  category: ResourceCategory;
  title: string;
  referenceYear?: number | null;
  status?: ContentStatus;
  publishedAt?: string | null;
  files?: Array<{ fileId: string }>;
};

export type UpdateResourceInput = Required<CreateResourceInput> & {
  id: string;
  expectedUpdatedAt: string;
};

async function createResource(
  input: CreateResourceInput,
): Promise<AdminResourceDetail>;

async function updateResource(
  input: UpdateResourceInput,
): Promise<AdminResourceDetail>;

async function deleteResource(id: string): Promise<string>;

export function createResourceMutationOptions(): MutationOptions<
  AdminResourceDetail,
  Error,
  CreateResourceInput
>;

export function updateResourceMutationOptions(): MutationOptions<
  AdminResourceDetail,
  Error,
  UpdateResourceInput
>;

export function deleteResourceMutationOptions(): MutationOptions<
  string,
  Error,
  string
>;
```

| 기능 | Mutation key |
|---|---|
| 생성 | `["resources", "create"]` |
| 수정 | `["resources", "update"]` |
| 삭제 | `["resources", "delete"]` |

`createResource`와 `updateResource`는 전체 파일 배열을 `save_resource`에 함께 전달한다. 따라서 파일이 1개 이상이면 생성과 동시에 `published`로 저장할 수 있으며, 부모와 파일 관계는 같은 transaction에서 확정된다. 자료 삭제 시 관계만 CASCADE로 삭제되고 중앙 파일은 유지된다.

### 10.5 자료 파일 관계

```ts
export type LinkResourceFileInput = {
  resourceId: string;
  fileId: string;
  sortOrder?: number;
};

export type UpdateResourceFileInput = {
  resourceId: string;
  fileId: string;
  sortOrder: number;
};

export type ReorderResourceFilesInput = {
  resourceId: string;
  items: Array<{ fileId: string; sortOrder: number }>;
};

export type UnlinkResourceFileInput = {
  resourceId: string;
  fileId: string;
};

async function linkResourceFile(
  input: LinkResourceFileInput,
): Promise<ResourceFileDto>;

async function updateResourceFile(
  input: UpdateResourceFileInput,
): Promise<ResourceFileDto>;

async function reorderResourceFiles(
  input: ReorderResourceFilesInput,
): Promise<ResourceFileDto[]>;

async function unlinkResourceFile(
  input: UnlinkResourceFileInput,
): Promise<string>;

export function linkResourceFileMutationOptions(): MutationOptions<
  ResourceFileDto,
  Error,
  LinkResourceFileInput
>;

export function updateResourceFileMutationOptions(): MutationOptions<
  ResourceFileDto,
  Error,
  UpdateResourceFileInput
>;

export function reorderResourceFilesMutationOptions(): MutationOptions<
  ResourceFileDto[],
  Error,
  ReorderResourceFilesInput
>;

export function unlinkResourceFileMutationOptions(): MutationOptions<
  string,
  Error,
  UnlinkResourceFileInput
>;
```

| 기능 | Mutation key |
|---|---|
| 연결 | `["resources", "file", "link"]` |
| 순서 수정 | `["resources", "file", "update"]` |
| 일괄 재정렬 | `["resources", "file", "reorder"]` |
| 연결 해제 | `["resources", "file", "unlink"]` |

자료에는 이미지와 일반 첨부파일을 모두 연결할 수 있다.

---

## 11. 세미나 API

### 11.1 타입

```ts
export type SeminarListItem = {
  id: string;
  title: string;
  introduction: string;
  startsAt: string;
  endsAt: string | null;
  location: string;
  poster: FileDto | null;
  publishedAt: string | null;
};

export type SeminarDetail = SeminarListItem & {
  content: string | null;
  selectionMethod: SelectionMethod;
  selectionMethodDetail: string | null;
  capacity: number | null;
  registrationDeadline: string | null;
  applicationUrl: string | null;
  photos: SeminarFileDto[];
  status: ContentStatus;
  createdAt: string;
  updatedAt: string;
};

export type AdminSeminarListItem = Omit<
  SeminarListItem,
  "publishedAt"
> & {
  status: ContentStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminSeminarDetail = Omit<
  SeminarDetail,
  "publishedAt"
> & {
  publishedAt: string | null;
};
```

검증:

- `title`: trim 후 1~200자
- `startsAt`: 유효한 일시
- `endsAt`: `null` 또는 `startsAt` 이상
- `location`: trim 후 1~300자
- `capacity`: `null` 또는 1 이상의 정수
- `registrationDeadline`: `null` 또는 `startsAt` 이하
- `applicationUrl`: `null` 또는 HTTP/HTTPS URL, 최대 2,048자
- `selectionMethod = other`이면 `selectionMethodDetail` 필수
- `poster`, `photo` 역할은 이미지 파일만 가능
- 포스터는 세미나당 최대 1개

예정·진행 중/지난 행사 판정:

```text
upcoming: coalesce(ends_at, starts_at) >= now()
past:     coalesce(ends_at, starts_at) < now()
```

`upcoming`은 종료 시각이 지나지 않은 진행 중 행사를 포함한다.

### 11.2 Query key

```ts
export const seminarQueryKeys = {
  all: ["seminars"] as const,
  publicLists: () => [...seminarQueryKeys.all, "public", "list"] as const,
  publicList: (params: ResolvedSeminarListParams) =>
    [...seminarQueryKeys.publicLists(), params] as const,
  publicDetail: (id: string) =>
    [...seminarQueryKeys.all, "public", "detail", id] as const,
  adminLists: () => [...seminarQueryKeys.all, "admin", "list"] as const,
  adminList: (params: ResolvedAdminSeminarListParams) =>
    [...seminarQueryKeys.adminLists(), params] as const,
  adminDetail: (id: string) =>
    [...seminarQueryKeys.all, "admin", "detail", id] as const,
};
```

### 11.3 공개 목록과 상세

```ts
export type SeminarListParams = PageParams & {
  from?: string;
  q?: string;
  timing?: SeminarTiming;
  to?: string;
};

async function fetchSeminars(
  params: ResolvedSeminarListParams,
): Promise<PageResult<SeminarListItem>>;

async function fetchSeminarById(
  id: string,
): Promise<SeminarDetail | null>;

export function seminarsQueryOptions(
  params?: SeminarListParams,
): QueryOptions<PageResult<SeminarListItem>>;

export function seminarDetailQueryOptions(
  id: string,
): QueryOptions<SeminarDetail | null>;
```

| `timing` | 정렬 |
|---|---|
| `upcoming` 기본값 | `starts_at ASC`, `id ASC` |
| `past` | `coalesce(ends_at, starts_at) DESC`, `starts_at DESC`, `id DESC` |
| `all` | `starts_at DESC`, `id DESC` |

공개 조건을 공통 적용하며 `from`, `to`는 행사 시작 일시 범위 필터다. 목록은 포스터 1건만 Join하고 상세는 포스터와 사진 전체를 반환한다.

### 11.4 관리자 목록과 CRUD

```ts
export type AdminSeminarListParams = SeminarListParams & {
  status?: ContentStatus;
};

async function fetchAdminSeminars(
  params: ResolvedAdminSeminarListParams,
): Promise<PageResult<AdminSeminarListItem>>;

async function fetchAdminSeminarById(
  id: string,
): Promise<AdminSeminarDetail | null>;

export function adminSeminarsQueryOptions(
  params?: AdminSeminarListParams,
): QueryOptions<PageResult<AdminSeminarListItem>>;

export function adminSeminarDetailQueryOptions(
  id: string,
): QueryOptions<AdminSeminarDetail | null>;

export type CreateSeminarInput = {
  title: string;
  introduction?: string;
  content?: string | null;
  startsAt: string;
  endsAt?: string | null;
  location: string;
  selectionMethod: SelectionMethod;
  selectionMethodDetail?: string | null;
  capacity?: number | null;
  registrationDeadline?: string | null;
  applicationUrl?: string | null;
  status?: ContentStatus;
  publishedAt?: string | null;
  files?: Array<{ fileId: string; role: SeminarFileRole }>;
};

export type UpdateSeminarInput = Required<CreateSeminarInput> & {
  id: string;
  expectedUpdatedAt: string;
};

async function createSeminar(
  input: CreateSeminarInput,
): Promise<AdminSeminarDetail>;

async function updateSeminar(
  input: UpdateSeminarInput,
): Promise<AdminSeminarDetail>;

async function deleteSeminar(id: string): Promise<string>;

export function createSeminarMutationOptions(): MutationOptions<
  AdminSeminarDetail,
  Error,
  CreateSeminarInput
>;

export function updateSeminarMutationOptions(): MutationOptions<
  AdminSeminarDetail,
  Error,
  UpdateSeminarInput
>;

export function deleteSeminarMutationOptions(): MutationOptions<
  string,
  Error,
  string
>;
```

| 기능 | Mutation key |
|---|---|
| 생성 | `["seminars", "create"]` |
| 수정 | `["seminars", "update"]` |
| 삭제 | `["seminars", "delete"]` |

행사 종료 후 사진 추가는 세미나 수정이 아니라 파일 업로드와 `seminar_files` 연결 Mutation으로 처리한다. 세미나 삭제 시 관계 행만 CASCADE로 삭제하며 파일을 삭제하지 않는다.

### 11.5 세미나 파일 관계

```ts
export type LinkSeminarFileInput = {
  seminarId: string;
  fileId: string;
  role: SeminarFileRole;
  sortOrder?: number;
};

export type UpdateSeminarFileInput = {
  seminarId: string;
  fileId: string;
  role?: SeminarFileRole;
  sortOrder?: number;
};

export type ReorderSeminarFilesInput = {
  seminarId: string;
  role: SeminarFileRole;
  items: Array<{ fileId: string; sortOrder: number }>;
};

export type UnlinkSeminarFileInput = {
  seminarId: string;
  fileId: string;
};

async function linkSeminarFile(
  input: LinkSeminarFileInput,
): Promise<SeminarFileDto>;

async function updateSeminarFile(
  input: UpdateSeminarFileInput,
): Promise<SeminarFileDto>;

async function reorderSeminarFiles(
  input: ReorderSeminarFilesInput,
): Promise<SeminarFileDto[]>;

async function unlinkSeminarFile(
  input: UnlinkSeminarFileInput,
): Promise<string>;

export function linkSeminarFileMutationOptions(): MutationOptions<
  SeminarFileDto,
  Error,
  LinkSeminarFileInput
>;

export function updateSeminarFileMutationOptions(): MutationOptions<
  SeminarFileDto,
  Error,
  UpdateSeminarFileInput
>;

export function reorderSeminarFilesMutationOptions(): MutationOptions<
  SeminarFileDto[],
  Error,
  ReorderSeminarFilesInput
>;

export function unlinkSeminarFileMutationOptions(): MutationOptions<
  string,
  Error,
  UnlinkSeminarFileInput
>;
```

| 기능 | Mutation key |
|---|---|
| 연결 | `["seminars", "file", "link"]` |
| 역할·순서 수정 | `["seminars", "file", "update"]` |
| 역할별 일괄 재정렬 | `["seminars", "file", "reorder"]` |
| 연결 해제 | `["seminars", "file", "unlink"]` |

---

## 12. 갤러리 API

### 12.1 타입

```ts
export type GalleryListItem = {
  id: string;
  title: string;
  description: string;
  eventDate: string | null;
  coverImage: FileDto | null;
  itemCount: number;
  displayOrder: number;
  publishedAt: string | null;
};

export type GalleryDetail = GalleryListItem & {
  items: GalleryItemDto[];
  status: ContentStatus;
  createdAt: string;
  updatedAt: string;
};

export type AdminGalleryListItem = Omit<
  GalleryListItem,
  "publishedAt"
> & {
  status: ContentStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminGalleryDetail = Omit<
  GalleryDetail,
  "publishedAt"
> & {
  publishedAt: string | null;
};
```

`coverImage`는 별도 파일 속성이 아니다. 정렬된 `gallery_items`의 첫 번째 이미지를 사용한다.

검증:

- `title`: trim 후 1~200자
- `eventDate`: `null` 또는 `YYYY-MM-DD`
- `displayOrder`: 0 이상의 정수
- 갤러리 항목은 `fileKind = image`만 가능
- 항목 `caption`: 최대 500자
- `published` 전환 시 항목이 1개 이상이어야 한다.

### 12.2 Query key

```ts
export const galleryQueryKeys = {
  all: ["galleries"] as const,
  publicLists: () => [...galleryQueryKeys.all, "public", "list"] as const,
  publicList: (params: ResolvedGalleryListParams) =>
    [...galleryQueryKeys.publicLists(), params] as const,
  publicDetail: (id: string) =>
    [...galleryQueryKeys.all, "public", "detail", id] as const,
  adminLists: () => [...galleryQueryKeys.all, "admin", "list"] as const,
  adminList: (params: ResolvedAdminGalleryListParams) =>
    [...galleryQueryKeys.adminLists(), params] as const,
  adminDetail: (id: string) =>
    [...galleryQueryKeys.all, "admin", "detail", id] as const,
};
```

### 12.3 공개 목록과 상세

```ts
export type GalleryListParams = PageParams & {
  from?: string;
  q?: string;
  to?: string;
};

async function fetchGalleries(
  params: ResolvedGalleryListParams,
): Promise<PageResult<GalleryListItem>>;

async function fetchGalleryById(
  id: string,
): Promise<GalleryDetail | null>;

export function galleriesQueryOptions(
  params?: GalleryListParams,
): QueryOptions<PageResult<GalleryListItem>>;

export function galleryDetailQueryOptions(
  id: string,
): QueryOptions<GalleryDetail | null>;
```

| 항목 | 계약 |
|---|---|
| 공개 필터 | 공개 조건 |
| 날짜 필터 | `event_date`의 from/to |
| 검색 | `title`, `description` 부분 일치 |
| 목록 정렬 | `event_date DESC NULLS LAST`, `display_order ASC`, `published_at DESC`, `id DESC` |
| 상세 항목 | 이미지 파일만, 관계 정렬 적용 |
| 상세 미존재 | `null` |

### 12.4 관리자 목록과 CRUD

```ts
export type AdminGalleryListParams = GalleryListParams & {
  status?: ContentStatus;
};

async function fetchAdminGalleries(
  params: ResolvedAdminGalleryListParams,
): Promise<PageResult<AdminGalleryListItem>>;

async function fetchAdminGalleryById(
  id: string,
): Promise<AdminGalleryDetail | null>;

export function adminGalleriesQueryOptions(
  params?: AdminGalleryListParams,
): QueryOptions<PageResult<AdminGalleryListItem>>;

export function adminGalleryDetailQueryOptions(
  id: string,
): QueryOptions<AdminGalleryDetail | null>;

export type CreateGalleryInput = {
  title: string;
  description?: string;
  eventDate?: string | null;
  status?: ContentStatus;
  publishedAt?: string | null;
  displayOrder?: number;
  files?: Array<{ fileId: string; caption?: string }>;
};

export type UpdateGalleryInput = Required<CreateGalleryInput> & {
  id: string;
  expectedUpdatedAt: string;
};

async function createGallery(
  input: CreateGalleryInput,
): Promise<AdminGalleryDetail>;

async function updateGallery(
  input: UpdateGalleryInput,
): Promise<AdminGalleryDetail>;

async function deleteGallery(id: string): Promise<string>;

export function createGalleryMutationOptions(): MutationOptions<
  AdminGalleryDetail,
  Error,
  CreateGalleryInput
>;

export function updateGalleryMutationOptions(): MutationOptions<
  AdminGalleryDetail,
  Error,
  UpdateGalleryInput
>;

export function deleteGalleryMutationOptions(): MutationOptions<
  string,
  Error,
  string
>;
```

| 기능 | Mutation key |
|---|---|
| 생성 | `["galleries", "create"]` |
| 수정 | `["galleries", "update"]` |
| 삭제 | `["galleries", "delete"]` |

`createGallery`와 `updateGallery`는 전체 이미지 배열을 `save_gallery`에 함께 전달한다. 따라서 이미지가 1개 이상이면 생성과 동시에 `published`로 저장할 수 있으며, 부모와 갤러리 항목은 같은 transaction에서 확정된다.

갤러리를 삭제해도 파일은 삭제하지 않는다. 같은 파일이 다른 갤러리나 콘텐츠에서 계속 사용될 수 있다.

### 12.5 갤러리 항목 관계

```ts
export type AddGalleryItemInput = {
  galleryId: string;
  fileId: string;
  caption?: string;
  sortOrder?: number;
};

export type UpdateGalleryItemInput = {
  galleryId: string;
  fileId: string;
  caption?: string;
  sortOrder?: number;
};

export type ReorderGalleryItemsInput = {
  galleryId: string;
  items: Array<{ fileId: string; sortOrder: number }>;
};

export type RemoveGalleryItemInput = {
  galleryId: string;
  fileId: string;
};

async function addGalleryItem(
  input: AddGalleryItemInput,
): Promise<GalleryItemDto>;

async function updateGalleryItem(
  input: UpdateGalleryItemInput,
): Promise<GalleryItemDto>;

async function reorderGalleryItems(
  input: ReorderGalleryItemsInput,
): Promise<GalleryItemDto[]>;

async function removeGalleryItem(
  input: RemoveGalleryItemInput,
): Promise<string>;

export function addGalleryItemMutationOptions(): MutationOptions<
  GalleryItemDto,
  Error,
  AddGalleryItemInput
>;

export function updateGalleryItemMutationOptions(): MutationOptions<
  GalleryItemDto,
  Error,
  UpdateGalleryItemInput
>;

export function reorderGalleryItemsMutationOptions(): MutationOptions<
  GalleryItemDto[],
  Error,
  ReorderGalleryItemsInput
>;

export function removeGalleryItemMutationOptions(): MutationOptions<
  string,
  Error,
  RemoveGalleryItemInput
>;
```

| 기능 | Mutation key |
|---|---|
| 항목 추가 | `["galleries", "item", "add"]` |
| 캡션·순서 수정 | `["galleries", "item", "update"]` |
| 일괄 재정렬 | `["galleries", "item", "reorder"]` |
| 항목 제거 | `["galleries", "item", "remove"]` |

사진은 공개 갤러리의 `gallery_items`에 연결됐을 때만 포토 갤러리 목록에 노출된다. 같은 파일을 소식이나 세미나에서 사용한다는 사실만으로 갤러리에 자동 노출하지 않는다.

---

## 13. 관리자 저장 흐름

### 13.1 일반 콘텐츠

파일이 필요한 콘텐츠는 다음 순서로 저장한다.

```text
1. 콘텐츠를 draft로 생성
2. 중앙 파일을 업로드해 fileId 획득
3. 도메인 관계 테이블에 fileId 연결
4. 필요하면 관계 순서·역할 수정
5. 게시 조건 검증 후 status를 published로 변경
```

API 요청에서 파일 참조 배열을 받는 것은 가능하지만 DB의 한 컬럼에 UUID 배열을 저장하지 않는다. 각 항목은 관계 테이블 행으로 저장한다.

### 13.2 관계 검증

관계 생성·수정 함수는 다음을 모두 확인한다.

- 부모와 파일이 존재한다.
- 동일한 `(부모 ID, fileId)` 관계가 중복되지 않는다.
- `sortOrder`는 0 이상의 정수다.
- 역할에 맞는 `fileKind`다.
- 게시물 cover와 세미나 poster는 부모당 최대 1개다.
- 재정렬 입력의 fileId는 중복되지 않고 모두 해당 부모에 연결돼 있다.

일괄 재정렬은 도중 실패로 일부 순서만 바뀌지 않도록 RPC에서 원자적으로 실행한다.

### 13.3 게시 전 검증

| 도메인 | 추가 게시 조건 |
|---|---|
| 회원기관 소식 | member 타입 기관 연결 |
| 자료 | 파일 1개 이상 |
| 갤러리 | 이미지 항목 1개 이상 |
| 세미나 | 시간·선발 방식 조건 충족 |

관리자 UI 검증만 믿지 않고 Mutation과 DB 제약에서도 동일한 조건을 확인한다.

자료와 갤러리의 게시 전 하위 행 수 검증은 `SELECT` 후 별도 `UPDATE`로 나누지 않는다. 관계 검증과 상태 변경을 관리용 RPC 한 트랜잭션에서 처리해 동시 수정 경쟁을 막는다. 회원기관 소식의 member 기관 검증과 기관 로고·역할별 이미지 종류 검증은 필수 DB trigger가 직접 Data API 호출에도 항상 강제한다. 관리용 RPC는 여러 변경을 원자적으로 조율하지만 trigger를 대체하지 않는다.

---

## 14. 파일 보상 흐름

PostgreSQL 트랜잭션과 Storage 작업은 하나의 원자적 트랜잭션이 될 수 없다. 다음 보상 흐름을 지킨다.

### 14.1 업로드

```text
1. 클라이언트에서 fileId와 Storage 경로 생성
2. Storage 객체 업로드
3. files 행 INSERT
4. INSERT 실패 시 방금 업로드한 Storage 객체 REMOVE
5. REMOVE도 실패하면 STORAGE_CLEANUP_REQUIRED를 던지고 외부 운영 로그에 기록
```

관계 연결 실패 시 파일 업로드 자체는 성공한 상태다. 파일을 즉시 삭제하지 않고 관리자 파일 목록의 `usage = unused`로 표시해 재연결 또는 정리할 수 있게 한다.

### 14.2 파일 삭제

```text
1. `begin_file_delete`가 참조를 검사하고 private 복구 snapshot을 기록
2. 같은 transaction에서 `files` 행 삭제
3. 클라이언트가 Storage 객체 REMOVE
4. 성공하면 `complete_file_delete`로 복구 기록 제거
5. 실패하면 `restore_file_delete`로 원본 파일 행 복원
6. 복원도 실패하면 `STORAGE_CLEANUP_REQUIRED`
```

DB 행을 먼저 삭제하면 동시 연결 경쟁을 FK가 차단한다. snapshot은 API에 노출된 테이블이 아닌 `private.file_delete_operations`에 저장하고 삭제를 시작한 관리자만 완료 또는 복원할 수 있다. 브라우저가 중단되어 작업이 남은 경우에도 복구 근거가 유지된다. 사용자 응답이나 공개 로그에는 내부 Storage 경로를 노출하지 않는다.

### 14.3 콘텐츠 삭제

- 콘텐츠 삭제는 관계 행만 CASCADE로 제거한다.
- 중앙 `files` 행과 Storage 객체는 유지한다.
- 삭제 후 미사용 파일은 관리자 파일 목록에서 별도로 확인하고 명시적으로 삭제한다.
- 관계 해제 Mutation도 동일하게 파일을 삭제하지 않는다.

---

## 15. 캐시 무효화

Mutation 성공 후 최소한 다음 Query를 무효화한다.

| Mutation | 무효화 |
|---|---|
| 파일 업로드·삭제 | `fileQueryKeys.all` |
| 파일 메타데이터 수정 | `fileQueryKeys.all` 및 파일을 포함할 수 있는 모든 도메인 Query |
| 기관 분류 CRUD | `institutionCategoryQueryKeys.all`, `institutionQueryKeys.all` |
| 기관 CRUD | `institutionQueryKeys.all`, `postQueryKeys.all`, `fileQueryKeys.all` |
| 소식 CRUD | `postQueryKeys.all`, `fileQueryKeys.all` |
| 소식 파일 연결·수정·재정렬·해제 | `postQueryKeys.all`, `fileQueryKeys.all` |
| 자료 CRUD | `resourceQueryKeys.all`, `fileQueryKeys.all` |
| 자료 파일 연결·수정·재정렬·해제 | `resourceQueryKeys.all`, `fileQueryKeys.all` |
| 세미나 CRUD | `seminarQueryKeys.all`, `fileQueryKeys.all` |
| 세미나 파일 연결·수정·재정렬·해제 | `seminarQueryKeys.all`, `fileQueryKeys.all` |
| 갤러리 CRUD | `galleryQueryKeys.all`, `fileQueryKeys.all` |
| 갤러리 항목 추가·수정·재정렬·제거 | `galleryQueryKeys.all`, `fileQueryKeys.all` |

생성·삭제 시 목록 전체를 무효화한다. 수정 시 목록과 공개·관리자 상세를 모두 무효화한다. 대표 이미지, 포스터, 첫 갤러리 항목이 바뀌면 목록 썸네일도 달라지므로 상세만 갱신해서는 안 된다.

`fileQueryKeys.all` 무효화에는 관리자 파일 목록뿐 아니라 `adminDetail(fileId)` 사용처 요약도 포함된다. 기관 로고 변경, 콘텐츠 삭제의 관계 CASCADE, 모든 관계 link/unlink는 파일 사용처를 바꿀 수 있으므로 이 규칙을 생략하지 않는다.

Mutation key는 실행 식별용이며 캐시 무효화는 Query key factory를 사용한다. 문자열 배열을 화면에서 직접 조립하지 않는다.

---

## 16. 공개 조회와 RLS

애플리케이션 쿼리는 RLS에만 의존하지 않고 공개 조건을 명시한다.

| 대상 | 애플리케이션 필터 |
|---|---|
| 기관 분류 | `is_active = true` |
| 기관 | 기관과 연결 분류 모두 `is_active = true` |
| 소식·자료·세미나·갤러리 | 공통 공개 조건 |
| 회원기관 소식 | 공통 공개 조건과 함께 연결 기관이 `member`이며 기관·분류 모두 활성 |
| 소식 파일 | 공개 소식에 연결 |
| 자료 파일 | 공개 자료에 연결 |
| 세미나 파일 | 공개 세미나에 연결 |
| 갤러리 항목 | 공개 갤러리에 연결 |
| 기관 로고 | 공개 기관이 참조 |

RLS도 같은 조건을 강제한다. 이중 필터는 관리자가 로그인한 상태에서 공개 화면을 열어도 draft와 hidden 데이터가 공개 Query 결과에 섞이는 일을 방지한다.

`files` 공개 메타데이터 정책은 위 공개 부모 중 하나에서 참조되는 행만 허용한다. 다만 public Storage bucket의 객체 접근성은 DB RLS와 별개라는 점을 구분한다.

---

## 17. 현재 구현과 v2 목표의 차이

이 문서 저장만으로 코드나 DB가 변경되지는 않는다.

| 현재 구현 | v2 목표 |
|---|---|
| `boards` + `posts.board_id`로 모든 메뉴 구분 | 소식은 `posts.category`, 자료·세미나·갤러리는 독립 테이블 |
| `organizations` | `institution_categories` + `institutions` |
| 기관 유형 `member/domestic_partner/international_partner` | `member/partner`와 별도 기관 분류 |
| 로고·썸네일이 Storage path 문자열 | `files` FK와 관계 테이블 |
| `post_files`가 파일 메타데이터까지 소유 | `files`가 메타데이터, `post_files`는 관계만 소유 |
| 자료·갤러리가 일반 게시물 | `resources`, `galleries` 독립 |
| `seminar_events`가 `posts`의 1:1 확장 | `seminars` 독립 |
| `is_published` boolean | `status` + `published_at` |
| 기존 `posts.caption` 목록 문구 | 소식·자료의 `summary`로 의미에 맞게 이관 |
| 게시물 `tags`, 세미나 `topic` 중심 | 합의된 v2 필드로 교체 |
| 게시물별 Storage 경로 | 중앙 파일 라이브러리와 파일 재사용 |
| 갤러리 이미지가 게시물 파일 유형 | `galleries` + `gallery_items` 앨범 구조 |
| 공개 조건이 주로 `is_published` | `published` 상태이면서 게시 시각 도달 |
| 일부 일반 게시물·세미나 CRUD만 구현 | 모든 도메인과 관계 파일 CRUD 목표 |

### 17.1 구현 시 필요한 후속 작업

1. 새 Supabase migration 작성 및 적용
2. Supabase Dashboard와 로컬 `supabase/config.toml`에서 공개 회원가입 비활성화
3. RLS, column grant, Storage 정책, 재정렬 RPC 작성
4. `database.types.ts` 재생성
5. DTO mapper와 Query key factory 구현
6. 신규 entity·feature public API 구성
7. 기존 board 기반 호출을 새 도메인 함수로 교체
8. `caption`을 대상 도메인의 `summary`로 이관
9. 관리자 폼과 파일 라이브러리 연결
10. 데이터 이관과 회귀 테스트

이 후속 작업은 본 문서 교체 범위에 포함되지 않는다.

---

## 18. 검증 체크리스트

### 조회

- 공개 Query가 draft, hidden, 예약 게시를 제외하는가
- 관리자 Query가 모든 상태를 반환하는가
- page/pageSize 경계와 total 계산이 맞는가
- 목록과 상세의 Join 범위가 다른가
- 파일과 갤러리 항목 순서가 안정적인가
- 예정·지난 세미나 경계가 정확한가

### Mutation

- 회원기관 소식에 member 기관이 강제되는가
- 자료·갤러리 게시 전 파일 수를 확인하는가
- 다른 카테고리 소식의 institutionId가 제거되는가
- 포스트 cover와 세미나 poster가 하나로 제한되는가
- 관계 해제가 중앙 파일을 삭제하지 않는가
- 참조 중 파일·기관·분류 삭제가 거부되는가
- 콘텐츠 삭제 시 관계만 CASCADE되고 파일은 남는가

### Storage

- DB INSERT 실패 시 업로드 객체가 보상 삭제되는가
- 파일 삭제의 Storage 실패 시 DB 행 복원 또는 정리 기록이 남는가
- 파일 종류와 bucket 정책이 일치하는가
- 공개 URL이 draft/hidden 응답에 포함되지 않는가

### 캐시

- 공개·관리자 Query key가 분리되는가
- 대표 이미지 변경 후 목록 썸네일이 갱신되는가
- 파일 alt text 변경 후 모든 사용처가 갱신되는가
- 로그아웃 후 관리자 캐시가 제거되는가

---

## 19. 문서 갱신 규칙

다음 변경이 발생하면 DB 명세와 이 문서를 같은 변경에서 갱신한다.

- 테이블, 컬럼, enum, FK, 삭제 정책 변경
- RLS 또는 Storage bucket 정책 변경
- Query·Mutation 함수명이나 key 변경
- 입력 검증, 공개 조건, 정렬, 페이지네이션 변경
- 파일 업로드 경로 또는 보상 흐름 변경
- DTO 필드와 snake_case/camelCase 매핑 변경

구현 완료 전까지 문서 상태를 “목표 설계안 · 미구현”으로 유지한다. 실제 migration, 생성 타입, 데이터 접근 함수, 검증 테스트가 모두 반영된 뒤에만 구현 상태를 변경한다.
