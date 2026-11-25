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

## 공지 팝업

- 운영 웹사이트에서 모달로 보여주는 공지다. 필드: `title`(1~100자), `content`(1~2000자), `imageFileId`(선택), `buttonLabel`(최대 20자, 비우면 서버가 기본값 `확인`으로 저장), `startsOn`·`endsOn`(`YYYY-MM-DD`, 시작일·종료일 모두 포함, 종료일 ≥ 시작일), `isVisible`(노출 상태). 작성·수정 기록(`createdAt`, `createdByLogin`, `updatedAt`, `updatedByLogin`)은 다른 콘텐츠와 같다.
- 운영 웹은 `isVisible = true`이고 오늘이 `startsOn`~`endsOn` 안인 팝업만 모달로 보여주며, 모달의 버튼 문구는 `buttonLabel`을 그대로 쓴다.
- 목록 정렬: 노출 상태가 노출인 항목이 위, 같은 상태에서는 `createdAt`(업로드 일시)이 최근인 항목이 위다. 화면은 `sortNoticePopups`로 정렬한다.
- 노출 개수에는 제한을 두지 않는다. 목록에서 선택 노출·선택 숨김·선택 삭제를 지원한다.

## 이미지 자르기 영역 (목록 썸네일)

- 원본 이미지는 그대로 저장하고, 목록 썸네일에 보일 영역만 `crop = { x, y, width, height }`(원본 대비 0~1 비율, 좌상단 기준)로 저장한다. 파일을 서버에서 잘라 새로 만들지 않는다.
- 가로세로 비율은 목록 썸네일 비율(기본 400:250)로 고정이며, 기능마다 크기만 달라질 수 있다. 값이 없으면(`null`) 가운데를 기준으로 가장 크게 채워서 자른다(`object-fit: cover`).
- 상세 페이지는 원본 비율로, 가로를 본문 영역에 맞춰 보여주므로 `crop`을 쓰지 않는다.
- 저장 위치: 뉴스룸·보도자료는 대표 이미지(첫 번째 이미지)의 `post_files.crop`(응답은 목록 `coverCrop`, 상세 파일 `crop`), 연혁은 `imageCrop`, 주요 성과는 `imageCrop`. 같은 파일을 다른 곳에서 쓸 때 영역이 달라질 수 있으므로 파일이 아니라 사용처에 저장한다.
- 운영 웹 적용: 박스를 `overflow: hidden`으로 두고 이미지를 `width: 100/crop.width %`, `height: 100/crop.height %`, `left: -crop.x/crop.width*100 %`, `top: -crop.y/crop.height*100 %`로 배치한다.
- 관리자 화면은 `ImageCropper`(`@shared/ui`)로 모서리를 끌어 크기를, 안쪽을 끌어 위치를 조정하고 목록·상세 미리보기를 확인한다. 기관 로고는 잘리면 안 되므로 적용하지 않는다.

## 작성자·수정자 기록

- 대상 테이블: `posts`, `institutions`, `history_entries`, `awards`, `privacy_policies`, `achievement_highlights`.
- 각 테이블의 `created_by_login`, `updated_by_login`(text, nullable)에 로그인 아이디(관리자 계정의 `loginId`)를 저장한다. 값은 클라이언트가 보내지 않고 `public.set_audit_logins()` BEFORE INSERT/UPDATE trigger가 JWT의 `email`에서 채운다. 작성자는 UPDATE로 바뀌지 않으며, 이메일이 없는 시스템 수정은 기존 수정자를 유지한다. (migration: `20261123100000_add_audit_logins.sql`)
- 기존 행은 값이 `null`이며 화면에는 `-`로 표시한다.
- 프런트 DTO는 `createdAt`, `updatedAt`, `createdByLogin`, `updatedByLogin`(모두 optional)로 받는다. 목록의 '작성자' 열은 `updatedByLogin ?? createdByLogin`을 표시하고, 상세 하단에는 `작성 일시 · 아이디`, `수정 일시 · 아이디`를 표시한다.
- 뉴스룸 목록 RPC(`list_admin_content_posts`)는 아이디를 반환하지 않으므로 `adminPostsQueryOptions`가 목록 결과의 id로 `posts`에서 아이디를 한 번 더 조회해 합친다. 공개 API(`list_content_posts`, 공개 상세)에는 아이디를 포함하지 않는다.

## 관리자 계정·로그인

- 관리자는 이메일 없이 **아이디(`loginId`)와 비밀번호**로 로그인한다. 아이디는 영문 소문자·숫자·`.`·`_`·`-` 4~20자이며 중복될 수 없고 대소문자를 구분하지 않는다.
- 계정 등록은 아이디만 받는다. 서버가 무작위 초기 비밀번호를 만들어 계정을 `mustChangePassword = true`로 저장하고, 등록 응답에서만 `initialPassword`를 한 번 돌려준다. 이후 조회에서는 비밀번호를 반환하지 않는다. 화면은 초기 비밀번호를 표시하지 않고, 등록 직후 `아이디: …` / `초기 비밀번호: …` 두 줄 텍스트를 클립보드에 복사한 뒤 "계정 생성 완료. 아이디 및 초기 비밀번호를 클립보드에 복사했습니다." 안내만 띄운다. 목록에는 비밀번호 초기화 버튼만 두며, 초기화하면 새 초기 비밀번호를 발급해 같은 방식으로 복사하고 `mustChangePassword`를 true로 되돌린다.
초기 비밀번호: …`)로 복사하게 한다.
- 로그인 요청(아이디·비밀번호)이 초기 비밀번호와 일치하면 서버는 세션을 만들지 않고 `password-change-required`를 응답한다. 화면은 같은 로그인 화면에서 "변경할 비밀번호를 입력해 주세요." 단계(비밀번호·비밀번호 재입력)로 넘어가고, 서버는 아이디·초기 비밀번호·새 비밀번호를 다시 검증해 비밀번호를 바꾼 뒤 바로 로그인시킨다. 변경 전에는 관리자 메뉴를 열지 않는다.
- 새 비밀번호는 8~64자에 영문과 숫자를 포함하며 초기 비밀번호와 달라야 한다. 성공하면 `mustChangePassword`를 false로 바꾼다.
- 로그인 실패 응답은 아이디 존재 여부를 알 수 없도록 "아이디 또는 비밀번호를 다시 확인해 주세요."로 통일하고 `(n/10회)`를 함께 안내한다. 같은 아이디로 비밀번호를 연속 10회 틀리면 계정을 잠그고(`isLocked = true`, 오류 코드 `locked`) "다른 관리자에게 문의해 비밀번호 초기화를 요청해 달라"고 안내한다. 잠긴 계정은 올바른 비밀번호로도 로그인할 수 없으며, 다른 관리자가 비밀번호 초기화를 하면 잠금이 풀리고 실패 횟수가 초기화된다. 로그인에 성공하면 실패 횟수를 초기화한다. 오류 코드는 `invalid_credentials`, `locked`, `already_changed`, `login_required`, `duplicate_login_id`, `account_not_found`이며 화면은 서버 메시지를 그대로 보여주고, 알 수 없는 오류는 "일시적인 문제로 처리하지 못했습니다" 안내로 대체한다. 관리자 계정 목록 응답에는 `isLocked`를 포함한다.
- 관리자 계정 상태는 `active`(활성), `locked`(잠금), `suspended`(정지) 셋이며 목록·상세에 태그로 표시한다. 잠금은 비밀번호 10회 오류로 자동 설정되고 비밀번호 초기화로 풀린다. 정지는 관리자가 계정 상세 화면에서 직접 설정·해제하며(`suspended`), 정지된 계정은 올바른 비밀번호로도 로그인할 수 없다(오류 코드 `suspended`, "정지된 계정입니다. 다른 관리자에게 문의해 주세요."). 정지와 잠금이 겹치면 정지로 표시한다. 관리자 위계는 두지 않으며, 본인 계정만 정지·비밀번호 초기화를 할 수 없다(`forbidden_self`).
- 관리자 계정도 다른 콘텐츠와 같은 작성·수정 기록(`createdAt`, `createdByLogin`, `updatedAt`, `updatedByLogin`)을 가진다. 목록의 "작성자" 열은 `updatedByLogin ?? createdByLogin`을 표시하고 상세 하단에 작성·수정 이력을 표시한다. 비밀번호 초기화·정지·정지 해제·초기 비밀번호 변경은 수정 이력에 남긴다.
- 현재는 백엔드가 없어 `src/entities/admin-account/api/adminAccountStore.ts`가 브라우저 localStorage에 계정을 저장하는 데모 구현이다(비밀번호 평문, 시드 계정 `admin` / `Bonanza2026`). 백엔드 연결 시 이 파일을 HTTP 구현체로 교체하고 비밀번호는 서버에서 해시로만 저장한다.
