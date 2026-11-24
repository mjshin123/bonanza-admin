# Bonanza Factory Admin API 가이드

현재 관리자는 외부 API 없이 로컬 데모 데이터로 실행됩니다. 저장, 파일 업로드, 실제 로그인, 방문 통계 조회는 브라우저를 벗어나지 않으며 새로고침하면 초기 데이터로 돌아갈 수 있습니다.

## 백엔드 연결 원칙

- 화면 컴포넌트에 데이터베이스 SDK나 SQL 호출을 직접 추가하지 않습니다.
- `src/shared/api`를 데이터 경계로 두고, Entity의 조회와 Feature의 변경 모듈에서만 백엔드 API를 호출합니다.
- 백엔드 개발자는 해당 경계에 WhoIs SQL 기반 HTTP API 구현체를 연결합니다. 화면 컴포넌트의 입력·출력 형태는 유지합니다.
- 인증, 파일 저장, 방문 통계는 백엔드 API가 준비된 뒤에만 실제 동작으로 교체합니다.

## 콘텐츠 계약

- 뉴스룸: `notice`, `association_news`, `promotion_video`. 홍보영상 파일은 한글용 `video_ko`, 영문용 `video_en` 역할로 구분하며, 둘 중 하나만 등록할 수 있습니다.
- 보도자료는 `affiliate`가 필수이며 보난자팩토리, 트라버스, 보난자랩, 플러그앤엑스 중 하나입니다.
- 공지사항과 홍보·영상에는 활동 주체를 저장하거나 표시하지 않습니다.
- 목록 응답은 `items`, `page`, `pageSize`, `total`, `totalPages`를 사용합니다.
- 파일 업로드와 삭제 API는 백엔드 도입 시 별도 엔드포인트로 제공합니다.

## 작성자·수정자 기록

- 대상 테이블: `posts`, `institutions`, `history_entries`, `awards`, `privacy_policies`, `achievement_highlights`.
- 각 테이블의 `created_by_login`, `updated_by_login`(text, nullable)에 로그인 이메일의 `@` 앞부분을 아이디로 저장한다. 값은 클라이언트가 보내지 않고 `public.set_audit_logins()` BEFORE INSERT/UPDATE trigger가 JWT의 `email`에서 채운다. 작성자는 UPDATE로 바뀌지 않으며, 이메일이 없는 시스템 수정은 기존 수정자를 유지한다. (migration: `20261123100000_add_audit_logins.sql`)
- 기존 행은 값이 `null`이며 화면에는 `-`로 표시한다.
- 프런트 DTO는 `createdAt`, `updatedAt`, `createdByLogin`, `updatedByLogin`(모두 optional)로 받는다. 목록의 '작성자' 열은 `updatedByLogin ?? createdByLogin`을 표시하고, 상세 하단에는 `작성 일시 · 아이디`, `수정 일시 · 아이디`를 표시한다.
- 뉴스룸 목록 RPC(`list_admin_content_posts`)는 아이디를 반환하지 않으므로 `adminPostsQueryOptions`가 목록 결과의 id로 `posts`에서 아이디를 한 번 더 조회해 합친다. 공개 API(`list_content_posts`, 공개 상세)에는 아이디를 포함하지 않는다.
