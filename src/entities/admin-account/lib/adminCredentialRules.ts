export const ADMIN_LOGIN_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{3,19}$/;

export function normalizeAdminLoginId(value: string): string {
  return value.trim().toLowerCase();
}

export function validateAdminLoginId(value: string): string {
  const loginId = normalizeAdminLoginId(value);
  if (!ADMIN_LOGIN_ID_PATTERN.test(loginId)) {
    throw new RangeError(
      "아이디는 영문 소문자, 숫자, 마침표(.), 밑줄(_), 하이픈(-)을 사용해 4~20자로 입력해 주세요.",
    );
  }
  return loginId;
}

export function validateNewAdminPassword(
  password: string,
  currentPassword: string,
): string {
  if (password.length < 8 || password.length > 64) {
    throw new RangeError("비밀번호는 8자 이상 64자 이하로 입력해 주세요.");
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new RangeError("비밀번호에 영문과 숫자를 모두 포함해 주세요.");
  }
  if (password === currentPassword) {
    throw new RangeError("초기 비밀번호와 다른 비밀번호를 사용해 주세요.");
  }
  return password;
}
