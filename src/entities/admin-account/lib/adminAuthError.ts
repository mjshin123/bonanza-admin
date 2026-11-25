export type AdminAuthErrorCode =
  | "invalid_credentials"
  | "locked"
  | "suspended"
  | "forbidden_self"
  | "already_changed"
  | "login_required"
  | "duplicate_login_id"
  | "account_not_found";

/** 화면에 그대로 보여줄 수 있는 한국어 메시지를 담은 관리자 인증 오류 */
export class AdminAuthError extends Error {
  readonly code: AdminAuthErrorCode;

  constructor(code: AdminAuthErrorCode, message: string) {
    super(message);
    this.name = "AdminAuthError";
    this.code = code;
  }
}

/** 비밀번호를 이 횟수만큼 틀리면 계정을 잠그고 다른 관리자의 초기화가 있어야 풀린다. */
export const MAX_LOGIN_ATTEMPTS = 10;
