/** 작성·수정 기록. 아이디는 로그인 이메일의 @ 앞부분이다. */
export type AuditFields = {
  createdAt?: string | null;
  createdByLogin?: string | null;
  updatedAt?: string | null;
  updatedByLogin?: string | null;
};

/** 목록의 '작성자' 열에 보여줄 최근 수정자 아이디 */
export function lastEditorLogin(audit: AuditFields) {
  return audit.updatedByLogin ?? audit.createdByLogin ?? null;
}

export function loginFromEmail(email: string | null | undefined) {
  return email?.split("@")[0] || null;
}

export function formatAuditTime(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
