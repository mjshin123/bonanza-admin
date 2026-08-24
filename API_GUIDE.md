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

## 공통 값

| 항목 | 값 |
|---|---|
| 공개 상태 | draft, published, hidden |
| 게시물 분류 | notice, association_news, member_news |
| 자료 분류 | resource, financial_disclosure |
| 기관 타입 | member, partner |
| 파일 타입 | image, attachment |
| 게시물 파일 역할 | cover, content |
| 세미나 파일 역할 | poster, photo |
| 선발 방식 | first_come, lottery, other |

member_news는 활성 member 기관 연결이 필수다. 다른 게시물 분류에는 기관을 연결할 수 없다.

## 조회 API

모든 목록 RPC의 응답 행에는 total_count가 포함된다. p_admin 기본값은 false이며 anon 사용자가 true로 호출하면 권한 오류가 발생한다.

| RPC | 권한 | 주요 파라미터 | 주요 응답 |
|---|---|---|---|
| list_content_posts | 공개/관리자 | p_category, p_institution_id, p_q, p_status, p_page, p_page_size, p_admin | 제목, 요약, 기관, 대표 이미지, 고정 여부, 게시일 |
| list_resources | 공개/관리자 | p_category, p_reference_year, p_q, p_status, 페이징, p_admin | 제목, 요약, 기준연도, 파일 수, 게시일 |
| list_seminars | 공개/관리자 | p_timing, p_from, p_to, p_q, p_status, 페이징, p_admin | 소개, 결과 요약, 일시, 장소, 포스터 |
| list_galleries | 공개/관리자 | p_from, p_to, p_q, p_status, 페이징, p_admin | 설명, 행사일, 대표 이미지, 사진 수 |
| list_admin_files | 관리자 | p_file_kind, p_usage, p_q, 페이징 | 파일 메타데이터와 도메인별 사용 횟수 |
| get_admin_file_detail | 관리자 | p_file_id | 파일 메타데이터와 전체 사용처 |

상세 조회는 다음 Query option을 사용한다.

- postDetailQueryOptions / adminPostDetailQueryOptions
- resourceDetailQueryOptions / adminResourceDetailQueryOptions
- seminarDetailQueryOptions / adminSeminarDetailQueryOptions
- galleryDetailQueryOptions / adminGalleryDetailQueryOptions

기관과 기관 분류는 institutions, institution_categories 테이블의 PostgREST API를 사용한다. 공개 Query는 활성 데이터만, 관리자 Query는 인증 세션에서 전체 데이터를 조회한다.

## 저장 API

저장 RPC는 부모 행과 파일 관계 전체를 하나의 transaction에서 처리한다.

| RPC | p_input 핵심 필드 | p_files 항목 |
|---|---|---|
| save_content_post | category, title, summary, content, institutionId, status, isPinned, publishedAt | fileId, role |
| save_resource | category, title, summary, referenceYear, status, publishedAt | fileId |
| save_seminar | title, introduction, resultSummary, content, startsAt, endsAt, location, selectionMethod, selectionMethodDetail, capacity, registrationDeadline, applicationUrl, status, publishedAt | fileId, role |
| save_gallery | title, description, eventDate, status, publishedAt, displayOrder | fileId, caption |

공통 RPC 인자는 다음과 같다.

| 인자 | 생성 | 수정 | 설명 |
|---|---:|---:|---|
| p_input | 필수 | 필수 | camelCase JSON 명령 |
| p_files | 선택 | 필수 권장 | 저장 후 남아야 할 전체 파일 관계 |
| p_id | 생략 | 필수 | 수정 대상 UUID |
| p_expected_updated_at | 생략 | 필수 | 상세 응답의 updatedAt |

중요 규칙:

- p_files는 추가분이 아니라 정렬된 전체 스냅샷이다.
- 배열 순서가 sort_order가 되며 최대 1,000개다.
- 같은 fileId를 한 콘텐츠에 중복 연결할 수 없다.
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

| 코드 | 의미 | 처리 |
|---|---|---|
| NOT_FOUND | 대상 없음 | 목록 이동 또는 새로고침 |
| IN_USE | 다른 데이터가 참조 중 | 참조 관계 먼저 해제 |
| CONFLICT | 중복 또는 optimistic lock 충돌 | 최신 상세 재조회 후 재시도 |
| INVALID_STATE | 필드·상태·게시 조건 위반 | 입력값과 연결 파일 확인 |
| STORAGE_CLEANUP_REQUIRED | Storage/DB 보상 실패 | 운영 로그 확인 및 수동 정리 |

원시 PostgREST 오류를 화면에서 직접 해석하지 말고 throwContentError가 변환한 ContentApiError를 사용한다.

## 구현 위치

| 책임 | 위치 |
|---|---|
| Supabase client와 생성 타입 | src/shared/api/supabase/ |
| 공통 DTO·검증·오류 | src/shared/api/content/ |
| 공개/관리자 조회 | src/entities/*/api/*Queries.ts |
| 관리자 저장·삭제 | src/features/*-manage/api/*Mutations.ts |
| 파일 업로드·삭제 | src/features/file-upload/, src/features/file-delete/ |
| 조회 RPC migration | supabase/migrations/20260824170000_add_content_query_rpcs.sql |
| 공개 파일 projection | supabase/migrations/20260824171000_fix_public_rpc_file_projection.sql |
| 저장·삭제 보상 RPC | supabase/migrations/20260824180000_add_content_command_rpcs.sql |

API 계약을 변경하면 migration, 생성 DB 타입, entity Query, feature Mutation, 이 문서를 함께 갱신한다.
