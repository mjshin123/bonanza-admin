# KFCPA Admin API 빠른 가이드

KFCPA v2 콘텐츠 API를 빠르게 연동하기 위한 요약본이다. 전체 DB 정책은 [DB 명세](./KFCPA_DB_명세서_v1.md), 상세 계약은 [API 명세](./kfcpa-api-명세.md)를 참고한다.

## 기본 규칙

- 전송 계층: Supabase Data API(PostgREST/RPC)와 Storage
- 환경 변수: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
- 공개 조회: anon 세션에서 호출 가능
- 관리자 조회·저장·삭제: authenticated 세션 필요
- 시간: ISO 8601, ID: UUID
- 페이징: page 1 이상, pageSize 1~100
- 목록 응답: items, page, pageSize, total, totalPages
- 공개 조건: status가 published이고 publishedAt이 현재 시각 이하

애플리케이션에서는 원시 RPC보다 src/entities의 Query option과 src/features의 Mutation option을 우선 사용한다.

## 방문 통계 Edge Function

관리자 랜딩 대시보드는 `admin-web-analytics` Supabase Edge Function을 호출한다. 이 함수는 Supabase access token을 검증한 뒤 서버 secret으로 Cloudflare GraphQL Analytics API를 조회하며, 방문 원본 로그나 집계 결과를 DB에 저장하지 않는다.

| 항목            | 값                                                                                      |
| --------------- | --------------------------------------------------------------------------------------- |
| 메서드          | `POST`                                                                                  |
| 권한            | `authenticated`                                                                         |
| 요청 body       | `{ "from": "YYYY-MM-DD", "to": "YYYY-MM-DD" }`                                          |
| Query key       | `["web-analytics", "admin", { from, to }]`                                              |
| 응답            | 오늘 방문·페이지뷰, 전일 동시간 비교, 선택 기간 일별 추이, 인기 경로, 유입처, 기기 비율 |
| 클라이언트 캐시 | 10분                                                                                    |

기간 조회의 종료일은 한국 시간 기준 어제까지이며, 시작일은 어제로부터 최대 6개월 전까지 허용한다. 기존 배포본과의 무중단 호환을 위해 `{ "range": "7d" | "30d" }` 요청도 계속 지원한다. 오늘 방문 수와 오늘 페이지뷰는 선택 기간과 무관하게 항상 한국 시간 오늘 00:00부터 현재 시각까지 집계한다.

Cloudflare GraphQL 요청은 일별 필드를 최대 31일 단위로 묶는다. 따라서 7일과 30일은 1회, 3개월은 최대 3회, 6개월은 최대 6회 요청하며 선택 일수만큼 HTTP 요청을 반복하지 않는다.

Cloudflare API Token, Account Tag, Site Tag는 Edge Function secret으로만 관리한다. 프론트 `VITE_` 환경변수에는 Cloudflare API Token을 넣지 않는다.

## 공통 값

| 항목             | 값                                    |
| ---------------- | ------------------------------------- |
| 공개 상태        | draft, published, hidden              |
| 게시물 분류      | notice, association_news, member_news |
| 자료 분류        | resource, financial_disclosure        |
| 기관 타입        | member, partner                       |
| 파일 타입        | image, attachment                     |
| 게시물 파일 역할 | cover, content                        |

member_news는 활성 member 기관 연결이 필수다. 다른 게시물 분류에는 기관을 연결할 수 없다.

## 조회 API

모든 목록 RPC의 응답 행에는 total_count가 포함된다. p_admin 기본값은 false이며 anon 사용자가 true로 호출하면 권한 오류가 발생한다.

| RPC                      | 권한        | 주요 파라미터                                                                | 주요 응답                                            |
| ------------------------ | ----------- | ---------------------------------------------------------------------------- | ---------------------------------------------------- |
| list_content_posts       | 공개        | p_category, p_institution_id, p_q, p_status, p_page, p_page_size, p_admin    | 제목, 기관, 대표 이미지, 고정 여부, 게시일           |
| list_admin_content_posts | 관리자      | 공개 RPC 인자 + p_published_from, p_published_to                             | 게시일 범위가 적용된 게시글 목록                     |
| list_resources           | 공개        | p_category, p_q, p_reference_year, p_status, 페이징, p_admin                 | 제목, 기준연도, 파일 수, 게시일                      |
| list_admin_resources     | 관리자      | p_category, p_q, p_status, p_published_from, p_published_to, 페이징, p_admin | 제목, 파일 수, 게시일                                |
| list_seminars            | 공개        | p_timing, p_from, p_to(행사일), p_q, p_status, 페이징, p_admin               | 소개, 일시, 장소, 대표 이미지                        |
| list_admin_seminars      | 관리자      | 공개 RPC 인자 + p_published_from, p_published_to                             | 게시일 범위 및 대표 행사 여부가 적용된 세미나 목록   |
| list_galleries           | 공개/관리자 | p_from, p_to, p_q, p_status, 페이징, p_admin                                 | 설명, 행사일, 대표 이미지, 사진 수, 원본 콘텐츠 정보 |
| list_admin_files         | 관리자      | p_file_kind, p_usage, p_q, 페이징                                            | 파일 메타데이터와 도메인별 사용 횟수                 |
| get_admin_file_detail    | 관리자      | p_file_id                                                                    | 파일 메타데이터와 전체 사용처                        |

상세 조회는 다음 Query option을 사용한다.

- postDetailQueryOptions / adminPostDetailQueryOptions
- resourceDetailQueryOptions / adminResourceDetailQueryOptions
- seminarDetailQueryOptions / adminSeminarDetailQueryOptions
- galleryDetailQueryOptions / adminGalleryDetailQueryOptions

기관과 기관 분류는 institutions, institution_categories 테이블의 PostgREST API를 사용한다. 기관 분류에는 `institutionType`(`member` 또는 `partner`)이 포함되며 회원기관용·협력기관용 목록을 독립적으로 관리한다. 기관의 `institutionType`과 선택한 분류의 타입이 다르면 DB 제약조건으로 저장이 거부된다. 공개 Query는 활성 데이터만, 관리자 Query는 인증 세션에서 전체 데이터를 조회한다.

`list_galleries`는 원본 콘텐츠 연결을 위해 `sourceType`, `sourceId`, `sourceCategory`를 반환한다. `sourceType`이 `post`인 공개 포토갤러리 이미지는 `sourceCategory`에 맞는 원본 게시글 상세페이지로 이동한다. 정렬은 `displayOrder`가 1순위이고 `eventDate`는 같은 순서일 때의 보조 기준이다 — 관리자가 수동으로 정렬하기 전까지는 모든 갤러리의 displayOrder가 동일(0)하므로 사실상 eventDate 순으로 보인다.

## 저장 API

저장 RPC는 부모 행과 파일 관계 전체를 하나의 transaction에서 처리한다.

| RPC               | p_input 핵심 필드                                                                                         | p_files 항목                              |
| ----------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| save_content_post | category, title, content, institutionId, status, isPinned, publishedAt                                    | fileId, role, showInGallery               |
| save_resource     | category, title, status, publishedAt                                                                      | fileId, showInGallery                     |
| save_seminar      | title, introduction, content, startsAt, endsAt, location, applicationUrl, status, publishedAt, isFeatured | fileId, showInGallery                     |
| save_gallery      | title, description, eventDate, status, publishedAt, displayOrder                                          | fileId, caption (기존 독립 갤러리 호환용) |

공통 RPC 인자는 다음과 같다.

| 인자                  | 생성 |      수정 | 설명                             |
| --------------------- | ---: | --------: | -------------------------------- |
| p_input               | 필수 |      필수 | camelCase JSON 명령              |
| p_files               | 선택 | 필수 권장 | 저장 후 남아야 할 전체 파일 관계 |
| p_id                  | 생략 |      필수 | 수정 대상 UUID                   |
| p_expected_updated_at | 생략 |      필수 | 상세 응답의 updatedAt            |

중요 규칙:

- p_files는 추가분이 아니라 정렬된 전체 스냅샷이다.
- 배열 순서가 sort_order가 되며 최대 1,000개다.
- 같은 fileId를 한 콘텐츠에 중복 연결할 수 없다.
- 소식 이미지, 자료 사진, 세미나 이미지의 showInGallery가 true이면 해당 사진이 포토 갤러리에 노출된다.
- 소식·자료·세미나 저장 시 기존 공개 갤러리 조회용 앨범과 사진 관계가 같은 transaction에서 자동 동기화된다. 별도의 갤러리 등록 요청은 필요하지 않다.
- 관리자 포토갤러리에서 이미지 순서를 변경하면 `reorder_content_files` RPC가 한 번의 요청으로 전체 순서를 반영한다.
- 관리자 포토갤러리 목록(갤러리 단위) 순서는 `reorder_galleries` RPC로 변경한다. 화면에 보이는 전체 갤러리 id를 원하는 순서대로 배열로 전달하면 각 갤러리의 displayOrder를 0부터 순서대로 재기록한다.
- `set_gallery_item_hidden`은 원본 연결을 유지한 채 해당 이미지만 공개 포토갤러리에서 숨기거나 다시 노출한다.
- `remove_gallery_item_from_source`는 원본 게시글·자료·세미나의 `showInGallery`만 해제한다. 원본 콘텐츠의 파일 관계, 중앙 `files` 행, Storage 객체는 유지된다.
- 수정 시 expectedUpdatedAt이 다르면 CONFLICT로 처리한다.
- 공개 자료는 파일 1개 이상, 공개 갤러리는 사진 1개 이상이어야 한다.
- 삭제 시 관계 행만 cascade되며 중앙 files 행과 Storage 객체는 자동 삭제되지 않는다.

## 파일 처리

업로드:

1. public-assets Storage bucket에 객체 업로드
2. files 테이블에 메타데이터 등록
3. 콘텐츠 저장 RPC의 p_files에 fileId 연결
4. DB 등록 실패 시 업로드한 Storage 객체 제거

제한:

- 이미지 10 MiB 이하, image MIME 필수
- 일반 첨부 50 MiB 이하
- 파일명 1~255자
- altText 최대 500자

물리 삭제:

1. begin_file_delete(fileId)
2. Storage 객체 삭제
3. 성공하면 complete_file_delete(operationId)
4. 실패하면 restore_file_delete(operationId)

참조 중인 파일은 IN_USE로 거부된다. Storage 삭제와 DB 복원이 모두 실패하면 STORAGE_CLEANUP_REQUIRED이므로 운영 확인이 필요하다.

## 오류 코드

| 코드                     | 의미                           | 처리                        |
| ------------------------ | ------------------------------ | --------------------------- |
| NOT_FOUND                | 대상 없음                      | 목록 이동 또는 새로고침     |
| IN_USE                   | 다른 데이터가 참조 중          | 참조 관계 먼저 해제         |
| CONFLICT                 | 중복 또는 optimistic lock 충돌 | 최신 상세 재조회 후 재시도  |
| INVALID_STATE            | 필드·상태·게시 조건 위반       | 입력값과 연결 파일 확인     |
| STORAGE_CLEANUP_REQUIRED | Storage/DB 보상 실패           | 운영 로그 확인 및 수동 정리 |

원시 PostgREST 오류를 화면에서 직접 해석하지 말고 throwContentError가 변환한 ContentApiError를 사용한다.

## 구현 위치

| 책임                           | 위치                                                                        |
| ------------------------------ | --------------------------------------------------------------------------- |
| Supabase client와 생성 타입    | src/shared/api/supabase/                                                    |
| 공통 DTO·검증·오류             | src/shared/api/content/                                                     |
| 공개/관리자 조회               | src/entities/*/api/*Queries.ts                                              |
| 관리자 저장·삭제               | src/features/*-manage/api/*Mutations.ts                                     |
| 파일 업로드·삭제               | src/features/file-upload/, src/features/file-delete/                        |
| 조회 RPC migration             | supabase/migrations/20260824170000_add_content_query_rpcs.sql               |
| 공개 파일 projection           | supabase/migrations/20260824171000_fix_public_rpc_file_projection.sql       |
| 저장·삭제 보상 RPC             | supabase/migrations/20260824180000_add_content_command_rpcs.sql             |
| 첨부 사진별 갤러리 노출        | supabase/migrations/20260824200000_source_gallery_visibility.sql            |
| 게시일 범위 필터               | supabase/migrations/20260825120200_add_published_date_filters.sql           |
| 자료 기준연도 Admin 폐기       | supabase/migrations/20260825120300_deprecate_resource_reference_year.sql    |
| 콘텐츠 요약 필드 제거          | supabase/migrations/20260825140000_remove_content_summaries.sql             |
| 기관 타입별 분류 분리          | supabase/migrations/20260826100000_split_institution_categories_by_type.sql |
| 포토갤러리 순서·숨김·원문 연결 | supabase/migrations/20260826110000_add_gallery_management.sql               |
| 포토갤러리 목록 수동 정렬      | supabase/migrations/20260826120000_gallery_manual_order.sql                 |

API 계약을 변경하면 migration, 생성 DB 타입, entity Query, feature Mutation, 이 문서를 함께 갱신한다.
