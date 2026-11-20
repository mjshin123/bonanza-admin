# Bonanza Factory Admin API 빠른 가이드

Bonanza Factory v2 콘텐츠 API를 빠르게 연동하기 위한 요약본이다. 전체 DB 정책은 [DB 명세](./BONANZA_DB_명세서_v1.md), 상세 계약은 [API 명세](./bonanza-api-명세.md)를 참고한다.

## 기본 규칙

- 전송 계층: Supabase Data API(PostgREST/RPC)와 Storage
- 환경 변수: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
- `VITE_DEMO_MODE=true`은 Supabase 미연결 상태에서 화면 검토만 위한 로그인 우회 모드다. 배포 데이터는 브라우저의 임시 가라데이터이며 실제 저장·업로드를 제공하지 않는다. 공유용 Vercel 배포에서는 Deployment Protection을 함께 설정한다.
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

Cloudflare GraphQL 요청은 최대 92일 단위로 나누고 시간별 집계를 한국 시간 일별로 합산한다. 따라서 7일, 30일, 3개월은 1회, 6개월은 최대 2회 요청하며 각 구간의 인기 경로, 유입처, 기기 집계도 서버에서 합산한다.

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

| RPC                       | 권한        | 주요 파라미터                                                                | 주요 응답                                            |
| ------------------------- | ----------- | ---------------------------------------------------------------------------- | ---------------------------------------------------- |
| list_content_posts        | 공개        | p_category, p_institution_id, p_q, p_status, p_page, p_page_size, p_admin    | 제목, 기관, 대표 이미지, 고정 여부, 게시일           |
| list_admin_content_posts  | 관리자      | 공개 RPC 인자 + p_published_from, p_published_to                             | 게시일 범위가 적용된 게시글 목록                     |
| list_resources            | 공개        | p_category, p_q, p_reference_year, p_status, 페이징, p_admin                 | 제목, 기준연도, 파일 수, 게시일                      |
| list_admin_resources      | 관리자      | p_category, p_q, p_status, p_published_from, p_published_to, 페이징, p_admin | 제목, 파일 수, 게시일                                |
| list_seminars             | 공개        | p_timing, p_from, p_to(행사일), p_q, p_status, 페이징, p_admin               | 소개, 일시, 장소, 대표 이미지                        |
| list_admin_seminars       | 관리자      | 공개 RPC 인자 + p_published_from, p_published_to                             | 게시일 범위 및 대표 행사 여부가 적용된 세미나 목록   |
| list_galleries            | 공개/관리자 | p_from, p_to, p_q, p_status, 페이징, p_admin                                 | 설명, 행사일, 대표 이미지, 사진 수, 원본 콘텐츠 정보 |
| list_admin_gallery_photos | 관리자      | p_q, 페이징                                                                  | 게시된 갤러리의 이미지별 파일·원본 콘텐츠 정보       |
| list_admin_files          | 관리자      | p_file_kind, p_usage, p_q, 페이징                                            | 파일 메타데이터와 도메인별 사용 횟수                 |
| get_admin_file_detail     | 관리자      | p_file_id                                                                    | 파일 메타데이터와 전체 사용처                        |

상세 조회는 다음 Query option을 사용한다.

- postDetailQueryOptions / adminPostDetailQueryOptions
- resourceDetailQueryOptions / adminResourceDetailQueryOptions
- seminarDetailQueryOptions / adminSeminarDetailQueryOptions
- galleryDetailQueryOptions / adminGalleryDetailQueryOptions

기관 로고는 `institutions` 테이블의 PostgREST API를 사용한다. `institutionType`이 `member`이면 홈페이지 신뢰 네트워크의 금융기관 첫째 줄에, `partner`이면 공공기관/기타 둘째 줄에 표시한다. 등록에는 기관명과 이미지 파일이 필요하며, 기관 설명·홈페이지·등록 예정 상태와 기관 분류는 사용하지 않는다. 공개 Query는 활성 데이터 중 로고가 연결된 행만, 관리자 Query는 인증 세션에서 전체 데이터를 조회한다.

연혁은 `history_entries` 테이블의 PostgREST API를 사용한다. 공개 Query는 `is_visible = true`인 행만 `year DESC, position ASC`로 조회하고, 관리자 Query는 연도와 노출 상태 필터 및 서버 페이징을 적용한다. `content`는 일반 문자열이며 `**문구**` 형식만 굵은 강조로 해석한다. HTML이나 다른 Markdown 문법은 렌더링하지 않는다.

주요 지표는 `achievement_sections`와 하위 `achievement_metrics` 테이블의 PostgREST API를 사용한다. 회사소개는 섹션 `position`, 지표 `position` 순서로 전부 표시한다. 메인화면은 `show_on_home = true`인 지표만 표시하며, 단일 행 `achievement_home_settings`의 `is_auto_sync`가 참이면 회사소개 원본값을 자동 동기화하고, 거짓이면 `metric_overrides`의 수동 입력값을 사용한다. 회사소개 기준은 각 섹션의 `source`/`source_en`, 메인화면 전용 기준은 `achievement_home_settings`의 `source`/`source_en`으로 관리한다. 공개 웹사이트는 세 테이블을 anon 권한으로 읽기만 하고, 관리자는 인증된 세션으로 Entity Query와 Feature Mutation을 통해 수정한다.

뉴스룸은 `notice`, `association_news`, `promotion_video` 카테고리를 사용한다. `promotion_video`는 제목·업로드 날짜·영상 파일을 필수로 하며 소개글은 일반 `content`에 선택 저장한다. 영상 파일은 `files.file_kind = 'video'`로 관리하고 `video/*` MIME 및 50 MiB 제한을 적용한다.

연혁과 개인정보처리방침은 한글·영문을 별도 필드로 저장한다. 연혁은 `title`/`detail`과 `title_en`/`detail_en`, 개인정보처리방침은 `content`과 `content_en`을 사용한다. 운영 언어별 본문을 관리 화면에서 토글로 전환하며, 공통 메타데이터(연혁의 날짜·이미지·주요 성과, 개인정보처리방침의 시행일)는 한글 화면에서 함께 관리한다.

주요 인증/수상은 `awards`의 `title`/`organization`과 선택 영문 필드 `title_en`/`organization_en`을 함께 저장한다. 작성 화면에서는 한글 입력란 바로 아래에 영문 입력란을 배치하고 날짜는 공통으로 관리한다.

주요 성과는 `history_entries`의 `is_featured` 항목으로 연혁과 함께 관리한다. `featured_position`으로 주요 성과 탭의 표시 순서를 관리하며, `move_featured_history_entry` RPC로 인접 항목과 순서를 교환한다.

주요 인증/수상은 `awards` 테이블을 사용한다. 항목은 제목, 인증기관, 날짜로 구성되며 개수 제한이나 수동 순서가 없다. 관리자와 공개 웹사이트는 모두 `awarded_on DESC, created_at DESC`로 조회해 최신 날짜순으로 표시한다. 등록·수정은 `save_award` RPC를 사용한다.

연혁은 `history_entries`를 확장해 제목, 연도, 월, 선택 상세 내용 및 이미지 파일을 관리한다. 제목·연도·월은 필수이며 저장은 `save_history_entry_v2` RPC를 사용한다.

연혁 등록·수정은 `save_history_entry` RPC를 사용한다. 등록 시 해당 연도의 마지막 `position`을 DB가 계산하고, 수정으로 연도가 바뀌면 이동한 연도의 마지막 순서로 배치한다. `move_history_entry`는 같은 연도의 인접한 두 행만 transaction 안에서 교환한다. 따라서 연혁이 1만 건이어도 순서 이동은 전체 재정렬 없이 최대 2행만 갱신한다.

`list_galleries`는 원본 콘텐츠 연결을 위해 `sourceType`, `sourceId`, `sourceCategory`를 반환한다. `sourceType`이 `post`인 공개 포토갤러리 이미지는 `sourceCategory`에 맞는 원본 게시글 상세페이지로 이동한다. 정렬은 항상 `eventDate` 기준이다.

관리자 포토갤러리는 `list_admin_gallery_photos`를 사용한다. 이 RPC는 게시 완료 및 게시 시각 도달, 이미지 숨김 여부를 DB에서 먼저 판정한 뒤 `gallery_items` 한 행당 한 행을 반환한다. 검색·정렬·페이징도 DB에서 수행하며 관리자 화면은 현재 페이지 이미지만 렌더링한다.

관리자 포토갤러리에서 이미지를 클릭하면 공개 사이트가 아니라 어드민 내 원본 콘텐츠 상세(수정) 화면으로 이동한다. `sourceType`이 `post`·`resource`·`seminar`인 이미지만 클릭 가능하며, `sourceId`가 없는 독립 갤러리 이미지는 비클릭 타일로 표시한다.

## 저장 API

저장 RPC는 부모 행과 파일 관계 전체를 하나의 transaction에서 처리한다.

| RPC               | p_input 핵심 필드                                                                                         | p_files 항목                              |
| ----------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| save_content_post | category, title, content, institutionId, status, isPinned, publishedAt, sourceUrl                         | fileId, role, showInGallery               |
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
- `sourceUrl`은 보도자료(`association_news`)에만 선택적으로 지정할 수 있으며 `http` 또는 `https` 기사 원문 주소만 허용한다. 공개 상세 화면은 값이 있을 때만 원문 보기 버튼을 표시한다.
- 소식 목록의 관리자 일괄 작업은 선택한 게시물의 게시·숨김·삭제와 `isPinned` 상단 고정/고정 해제를 지원한다.
- 배열 순서가 sort_order가 되며 최대 1,000개다.
- 같은 fileId를 한 콘텐츠에 중복 연결할 수 없다.
- 소식 이미지, 자료 사진, 세미나 이미지의 showInGallery가 true이면 해당 사진이 포토 갤러리에 노출된다.
- 소식·자료·세미나 저장 시 기존 공개 갤러리 조회용 앨범과 사진 관계가 같은 transaction에서 자동 동기화된다. 별도의 갤러리 등록 요청은 필요하지 않다.
- 관리자 포토갤러리 목록은 `event_date`와 원본 첨부 순서 기준으로 고정 정렬하며 별도의 수동 순서 변경을 제공하지 않는다.
- `set_gallery_item_hidden`은 기존 소프트 숨김 데이터 호환을 위해 DB에 유지하지만 신규 관리자 UI에서는 사용하지 않는다.
- 관리자 UI의 "숨김"은 `remove_gallery_item_from_source`를 호출해 원본 게시글·자료·세미나의 `showInGallery`만 해제한다. 원본 콘텐츠의 파일 관계, 중앙 `files` 행, Storage 객체는 유지된다.
- 수정 시 expectedUpdatedAt이 다르면 CONFLICT로 처리한다.
- 공개 자료는 파일 1개 이상, 공개 갤러리는 사진 1개 이상이어야 한다.
- 삭제 시 관계 행만 cascade되며 중앙 files 행과 Storage 객체는 자동 삭제되지 않는다.

## 파일 처리

## 개인정보처리방침

`privacy_policies`는 시행일과 HTML 본문을 보관합니다. 공개 조회와 인증 관리자가 사용할 수 있으며, 화면에서는 오늘 이전 또는 오늘 시행된 항목 중 시행일이 가장 최근인 버전을 현행으로 표시합니다. 본문은 Tiptap HTML로 저장하며 제목, 목록, 표의 붙여넣기 구조를 유지합니다.

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

| 책임                                 | 위치                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------- |
| Supabase client와 생성 타입          | src/shared/api/supabase/                                                  |
| 공통 DTO·검증·오류                   | src/shared/api/content/                                                   |
| 공개/관리자 조회                     | src/entities/*/api/*Queries.ts                                            |
| 관리자 저장·삭제                     | src/features/*-manage/api/*Mutations.ts                                   |
| 파일 업로드·삭제                     | src/features/file-upload/, src/features/file-delete/                      |
| 조회 RPC migration                   | supabase/migrations/20260824170000_add_content_query_rpcs.sql             |
| 공개 파일 projection                 | supabase/migrations/20260824171000_fix_public_rpc_file_projection.sql     |
| 저장·삭제 보상 RPC                   | supabase/migrations/20260824180000_add_content_command_rpcs.sql           |
| 첨부 사진별 갤러리 노출              | supabase/migrations/20260824200000_source_gallery_visibility.sql          |
| 게시일 범위 필터                     | supabase/migrations/20260825120200_add_published_date_filters.sql         |
| 자료 기준연도 Admin 폐기             | supabase/migrations/20260825120300_deprecate_resource_reference_year.sql  |
| 콘텐츠 요약 필드 제거                | supabase/migrations/20260825140000_remove_content_summaries.sql           |
| 기관 로고 단순화 및 분류 제거        | supabase/migrations/20261119110000_simplify_institution_logos.sql         |
| 포토갤러리 순서·숨김·원문 연결       | supabase/migrations/20260826110000_add_gallery_management.sql             |
| 관리자 이미지 단위 갤러리 조회       | supabase/migrations/20260826130000_add_admin_gallery_photo_list.sql       |
| 연혁 테이블·권한·저장·순서 이동      | supabase/migrations/20260827100000_add_history_entries.sql                |
| 주요 성과 섹션·지표·공개/관리 권한   | supabase/migrations/20261118110000_add_company_achievement_management.sql |
| 메인화면 주요 지표 기준 관리          | supabase/migrations/20261119160000_add_home_achievement_settings.sql      |
| 메인화면 주요 지표 수동 값 관리       | supabase/migrations/20261119161000_add_home_achievement_value_overrides.sql |
| 뉴스룸 홍보·영상 카테고리·영상 파일   | supabase/migrations/20261120100000_add_promotion_video_newsroom.sql       |
| 연혁·개인정보처리방침 영문 콘텐츠     | supabase/migrations/20261120110000_add_multilingual_history_and_privacy.sql |
| 주요 인증/수상 영문 입력 필드         | supabase/migrations/20261120120000_add_award_english_fields.sql           |
| 주요 성과 페이지·최대 10개·순서 이동 | supabase/migrations/20261118120000_add_achievement_highlights.sql         |
| 주요 인증/수상·날짜순 정렬           | supabase/migrations/20261118130000_add_awards.sql                         |
| 연혁 제목·월·상세·이미지             | supabase/migrations/20261118140000_expand_history_entries.sql             |

API 계약을 변경하면 migration, 생성 DB 타입, entity Query, feature Mutation, 이 문서를 함께 갱신한다.
