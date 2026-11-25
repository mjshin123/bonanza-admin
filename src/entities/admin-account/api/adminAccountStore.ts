/**
 * 백엔드 연결 전 로컬 데모용 관리자 계정 저장소입니다.
 * 계정·세션은 이 브라우저의 localStorage/sessionStorage에만 저장되며 비밀번호도 평문입니다.
 * 백엔드 API가 준비되면 이 파일을 HTTP 구현체로 교체합니다.
 */
import {
  AdminAuthError,
  MAX_LOGIN_ATTEMPTS,
} from "../lib/adminAuthError";
import {
  normalizeAdminLoginId,
  validateAdminLoginId,
  validateNewAdminPassword,
} from "../lib/adminCredentialRules";

/** 활성: 정상 사용, 잠금: 비밀번호 연속 오류로 자동 잠김, 정지: 관리자가 직접 정지 */
export type AdminAccountStatus = "active" | "locked" | "suspended";

export type AdminAccountDto = {
  id: string;
  loginId: string;
  mustChangePassword: boolean;
  isLocked: boolean;
  isSuspended: boolean;
  status: AdminAccountStatus;
  createdAt: string;
  createdByLogin: string | null;
  updatedAt: string;
  updatedByLogin: string | null;
};

export type AdminSessionUser = {
  id: string;
  loginId: string;
};

/** 로그인 결과. 초기 비밀번호로 로그인하면 세션을 만들지 않고 비밀번호 변경 단계를 요구한다. */
export type AdminSignInResult =
  | { status: "signed-in"; user: AdminSessionUser }
  | { status: "password-change-required"; loginId: string };

type StoredAccount = AdminAccountDto & { password: string };

const ACCOUNTS_KEY = "bonanza-admin-demo-accounts";
const SESSION_KEY = "bonanza-admin-demo-session";
const ATTEMPTS_KEY = "bonanza-admin-demo-login-attempts";
const INITIAL_PASSWORD_CHARS =
  "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

const SEED_ACCOUNTS: StoredAccount[] = [
  {
    id: "demo-admin",
    loginId: "admin",
    password: "Bonanza2026",
    mustChangePassword: true,
    isLocked: false,
    isSuspended: false,
    status: "active",
    createdAt: "2026-10-01T00:00:00.000Z",
    createdByLogin: null,
    updatedAt: "2026-10-01T00:00:00.000Z",
    updatedByLogin: null,
  },
];

function generateInitialPassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(
    bytes,
    (byte) => INITIAL_PASSWORD_CHARS[byte % INITIAL_PASSWORD_CHARS.length],
  ).join("");
}

const memory = new Map<string, string>();
function read(storage: "local" | "session", key: string): string | null {
  try {
    const target = storage === "local" ? localStorage : sessionStorage;
    return target.getItem(key);
  } catch {
    return memory.get(`${storage}:${key}`) ?? null;
  }
}
function write(storage: "local" | "session", key: string, value: string | null) {
  try {
    const target = storage === "local" ? localStorage : sessionStorage;
    if (value === null) target.removeItem(key);
    else target.setItem(key, value);
  } catch {
    if (value === null) memory.delete(`${storage}:${key}`);
    else memory.set(`${storage}:${key}`, value);
  }
}

function loadAccounts(): StoredAccount[] {
  const raw = read("local", ACCOUNTS_KEY);
  if (!raw) return SEED_ACCOUNTS;
  try {
    const parsed = JSON.parse(raw) as StoredAccount[];
    return Array.isArray(parsed) ? parsed : SEED_ACCOUNTS;
  } catch {
    return SEED_ACCOUNTS;
  }
}
function saveAccounts(accounts: StoredAccount[]) {
  write("local", ACCOUNTS_KEY, JSON.stringify(accounts));
}
/** 변경한 관리자와 시각을 남긴다. 다른 페이지의 작성·수정 기록과 같은 형태다. */
function touchAudit(fallbackLogin: string | null = null) {
  return {
    updatedAt: new Date().toISOString(),
    updatedByLogin: getAdminSessionUser()?.loginId ?? fallbackLogin,
  };
}
function accountStatus(account: {
  isLocked?: boolean;
  isSuspended?: boolean;
}): AdminAccountStatus {
  if (account.isSuspended) return "suspended";
  return account.isLocked ? "locked" : "active";
}
function toDto(account: StoredAccount): AdminAccountDto {
  return {
    id: account.id,
    loginId: account.loginId,
    mustChangePassword: account.mustChangePassword,
    isLocked: Boolean(account.isLocked),
    isSuspended: Boolean(account.isSuspended),
    status: accountStatus(account),
    createdAt: account.createdAt,
    createdByLogin: account.createdByLogin,
    updatedAt: account.updatedAt ?? account.createdAt,
    updatedByLogin: account.updatedByLogin ?? null,
  };
}
function toSessionUser(account: StoredAccount): AdminSessionUser {
  return { id: account.id, loginId: account.loginId };
}

const listeners = new Set<(user: AdminSessionUser | null) => void>();
function emit(user: AdminSessionUser | null) {
  listeners.forEach((listener) => listener(user));
}

export function subscribeAdminSession(
  listener: (user: AdminSessionUser | null) => void,
) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export function getAdminSessionUser(): AdminSessionUser | null {
  const loginId = read("session", SESSION_KEY);
  if (!loginId) return null;
  const account = loadAccounts().find((item) => item.loginId === loginId);
  return account && !account.isSuspended ? toSessionUser(account) : null;
}

export function listAdminAccounts(): AdminAccountDto[] {
  return loadAccounts().map(toDto);
}

type LoginAttempts = Record<string, number>;
function loadAttempts(): LoginAttempts {
  try {
    return JSON.parse(read("local", ATTEMPTS_KEY) ?? "{}") as LoginAttempts;
  } catch {
    return {};
  }
}
function saveAttempts(attempts: LoginAttempts) {
  write("local", ATTEMPTS_KEY, JSON.stringify(attempts));
}
function clearAttempts(key: string) {
  const attempts = loadAttempts();
  if (key in attempts) {
    delete attempts[key];
    saveAttempts(attempts);
  }
}
function lockedError() {
  return new AdminAuthError(
    "locked",
    `비밀번호를 ${MAX_LOGIN_ATTEMPTS}회 잘못 입력해 보안을 위해 계정이 잠겼습니다. 다른 관리자에게 문의해 비밀번호 초기화를 요청해 주세요.`,
  );
}

function findVerifiedAccount(loginId: string, password: string) {
  const key = normalizeAdminLoginId(loginId);
  const attempts = loadAttempts();
  const accounts = loadAccounts();
  const account = accounts.find((item) => item.loginId === key);
  const count = attempts[key] ?? 0;
  // 없는 아이디도 같은 횟수에서 같은 안내를 보여 계정 존재 여부를 알 수 없게 한다.
  if (account?.isLocked || (!account && count >= MAX_LOGIN_ATTEMPTS))
    throw lockedError();

  if (account && account.password === password) {
    clearAttempts(key);
    if (account.isSuspended)
      throw new AdminAuthError(
        "suspended",
        "정지된 계정입니다. 다른 관리자에게 문의해 주세요.",
      );
    return account;
  }

  const nextCount = count + 1;
  saveAttempts({ ...attempts, [key]: nextCount });
  if (nextCount >= MAX_LOGIN_ATTEMPTS) {
    if (account) {
      saveAccounts(
        accounts.map((item) =>
          item.id === account.id ? { ...item, isLocked: true } : item,
        ),
      );
    }
    throw lockedError();
  }
  throw new AdminAuthError(
    "invalid_credentials",
    `아이디 또는 비밀번호를 다시 확인해 주세요. 비밀번호를 ${MAX_LOGIN_ATTEMPTS}회 틀리면 계정이 잠깁니다. (${nextCount}/${MAX_LOGIN_ATTEMPTS}회)`,
  );
}

function startSession(account: StoredAccount): AdminSessionUser {
  write("session", SESSION_KEY, account.loginId);
  const user = toSessionUser(account);
  emit(user);
  return user;
}

export function signInAdminAccount(input: {
  loginId: string;
  password: string;
}): AdminSignInResult {
  const account = findVerifiedAccount(input.loginId, input.password);
  if (account.mustChangePassword)
    return { status: "password-change-required", loginId: account.loginId };
  return { status: "signed-in", user: startSession(account) };
}

/** 데모 계정 데이터를 처음 상태(시드 계정만 초기 비밀번호)로 되돌린다. */
export function resetDemoAdminAccounts() {
  write("local", ACCOUNTS_KEY, null);
  write("local", ATTEMPTS_KEY, null);
  write("session", SESSION_KEY, null);
  emit(null);
}

export const DEMO_SEED_LOGIN_ID = SEED_ACCOUNTS[0]!.loginId;
export const DEMO_SEED_PASSWORD = SEED_ACCOUNTS[0]!.password;

export function signOutAdminAccount() {
  write("session", SESSION_KEY, null);
  emit(null);
}

export function createAdminAccount(input: { loginId: string }): {
  account: AdminAccountDto;
  initialPassword: string;
} {
  const loginId = validateAdminLoginId(input.loginId);
  const accounts = loadAccounts();
  if (accounts.some((item) => item.loginId === loginId)) {
    throw new AdminAuthError(
      "duplicate_login_id",
      "이미 사용 중인 아이디입니다. 다른 아이디를 입력해 주세요.",
    );
  }
  const initialPassword = generateInitialPassword();
  const stored: StoredAccount = {
    id: crypto.randomUUID(),
    loginId,
    password: initialPassword,
    mustChangePassword: true,
    isLocked: false,
    isSuspended: false,
    status: "active",
    createdAt: new Date().toISOString(),
    createdByLogin: getAdminSessionUser()?.loginId ?? null,
    ...touchAudit(),
  };
  saveAccounts([...accounts, stored]);
  return { account: toDto(stored), initialPassword };
}

function assertNotSelf(id: string | undefined, action: string) {
  if (id && getAdminSessionUser()?.id === id)
    throw new AdminAuthError(
      "forbidden_self",
      `본인 계정은 ${action}할 수 없습니다. 다른 관리자에게 요청해 주세요.`,
    );
}

export function suspendAdminAccount(input: {
  id: string;
  suspended: boolean;
}): AdminAccountDto {
  const accounts = loadAccounts();
  const account = accounts.find((item) => item.id === input.id);
  assertNotSelf(account?.id, input.suspended ? "정지" : "정지 해제");
  if (!account)
    throw new AdminAuthError(
      "account_not_found",
      "계정을 찾을 수 없습니다. 목록을 새로고침한 뒤 다시 시도해 주세요.",
    );
  const updated: StoredAccount = {
    ...account,
    isSuspended: input.suspended,
    status: accountStatus({ ...account, isSuspended: input.suspended }),
    ...touchAudit(),
  };
  saveAccounts(accounts.map((item) => (item.id === account.id ? updated : item)));
  return toDto(updated);
}

export function resetAdminPassword(input: { id: string }): {
  account: AdminAccountDto;
  initialPassword: string;
} {
  const accounts = loadAccounts();
  const account = accounts.find((item) => item.id === input.id);
  assertNotSelf(account?.id, "비밀번호를 초기화");
  if (!account) throw new AdminAuthError(
      "account_not_found",
      "계정을 찾을 수 없습니다. 목록을 새로고침한 뒤 다시 시도해 주세요.",
    );
  const initialPassword = generateInitialPassword();
  const updated: StoredAccount = {
    ...account,
    password: initialPassword,
    mustChangePassword: true,
    isLocked: false,
    status: accountStatus({ ...account, isLocked: false }),
    ...touchAudit(),
  };
  saveAccounts(accounts.map((item) => (item === account ? updated : item)));
  clearAttempts(account.loginId);
  return { account: toDto(updated), initialPassword };
}

/** 초기 비밀번호로 로그인한 계정의 새 비밀번호를 정하고 바로 로그인한다. */
export function completeInitialPasswordChange(input: {
  loginId: string;
  initialPassword: string;
  newPassword: string;
}): AdminSessionUser {
  const account = findVerifiedAccount(input.loginId, input.initialPassword);
  if (!account.mustChangePassword)
    throw new AdminAuthError(
      "already_changed",
      "이미 비밀번호를 변경한 계정입니다. 로그인 화면에서 새 비밀번호로 로그인해 주세요.",
    );
  validateNewAdminPassword(input.newPassword, input.initialPassword);
  const accounts = loadAccounts();
  const updated: StoredAccount = {
    ...account,
    password: input.newPassword,
    mustChangePassword: false,
    ...touchAudit(account.loginId),
  };
  saveAccounts(accounts.map((item) => (item.id === account.id ? updated : item)));
  return startSession(updated);
}
