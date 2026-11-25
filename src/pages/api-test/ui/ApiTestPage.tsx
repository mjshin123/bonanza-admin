import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";

import {
  adminChangeInitialPasswordMutationOptions,
  adminSignInMutationOptions,
  adminSignOutMutationOptions,
  AdminAuthError,
  demoAdminAccount,
  resetDemoAdminAccounts,
  useAdminSession,
  type AdminUser,
} from "@features/admin-auth";
import type { PostCategory } from "@shared/api/content";
import bonanzaFactoryLogo from "@shared/assets/logo/bonanza-factory-logo-horizontal.png";
import { getErrorMessage, useEditorDirty } from "@shared/lib";
import { Button, Card, Input, Notice, UnsavedChangesModal } from "@shared/ui";
import { AnalyticsDashboard } from "@widgets/analytics-dashboard";
import {
  AdminAccountSection,
  NoticePopupSection,
  AchievementHighlightSection,
  AchievementSection,
  AwardSection,
  HistorySection,
  InstitutionSection,
  PostSection,
  PrivacyPolicySection,
} from "@widgets/content-admin";

import type { AdminSection } from "../model/apiAdminSearch";
import "./ApiTestPage.css";

const NAV_ITEMS: Array<{
  section: AdminSection;
  icon:
    | "chart"
    | "users"
    | "document"
    | "history"
    | "trophy"
    | "award"
    | "popup";
  label: string;
  children?: Array<{ label: string; tab: string }>;
}> = [
  {
    section: "dashboard",
    icon: "chart",
    label: "대시보드",
  },
  {
    section: "posts",
    icon: "document",
    label: "뉴스룸",
    children: [
      { label: "보도자료", tab: "association_news" },
      { label: "공지사항", tab: "notice" },
      { label: "홍보·영상", tab: "promotion_video" },
    ],
  },
  {
    section: "history",
    icon: "history",
    label: "연혁",
  },
  {
    section: "highlights",
    icon: "trophy",
    label: "주요 성과",
  },
  {
    section: "notice-popups",
    icon: "popup",
    label: "공지 팝업",
  },
  {
    section: "achievements",
    icon: "trophy",
    label: "주요 지표",
    children: [{ label: "회사소개", tab: "company" }, { label: "메인화면", tab: "home" }],
  },
  {
    section: "awards",
    icon: "award",
    label: "주요 인증/수상",
  },
  {
    section: "institutions",
    icon: "users",
    label: "기관 로고",
    children: [{ label: "금융기관", tab: "member" }, { label: "공공기관/기타", tab: "partner" }],
  },
  {
    section: "privacy-policies",
    icon: "document",
    label: "개인정보처리방침",
  },
  {
    section: "admin-accounts",
    icon: "users",
    label: "관리자 계정",
  },
];

const manualLoginSkipUser: AdminUser = {
  id: "manual-skip-admin",
  loginId: "test-skip",
};

type MenuIconName = (typeof NAV_ITEMS)[number]["icon"];

function MenuIcon({ name }: { name: MenuIconName }) {
  const sharedProps = {
    "aria-hidden": true,
    fill: "none",
    focusable: false,
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
    viewBox: "0 0 24 24",
  };

  if (name === "chart")
    return (
      <svg {...sharedProps}>
        <path d="M4 19V5M4 19h16M8 16v-5M12 16V8M16 16v-8" />
      </svg>
    );
  if (name === "users")
    return (
      <svg {...sharedProps}>
        <path d="M16 20v-1.5a4.5 4.5 0 0 0-4.5-4.5h-3A4.5 4.5 0 0 0 4 18.5V20M10 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM17 10a2.5 2.5 0 0 0 0-5M20 20v-1.5a4.5 4.5 0 0 0-2.5-4" />
      </svg>
    );
  if (name === "document")
    return (
      <svg {...sharedProps}>
        <path d="M7 3h7l4 4v14H7zM14 3v5h5M10 13h5M10 17h5" />
      </svg>
    );
  if (name === "trophy")
    return (
      <svg {...sharedProps}>
        <path d="M8 4h8v4a4 4 0 0 1-8 0zM8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4M12 12v5M8 21h8M9 17h6" />
      </svg>
    );
  if (name === "popup")
    return (
      <svg {...sharedProps}>
        <path d="M4 5h16v14H4zM4 9h16M8 14h8" />
      </svg>
    );
  if (name === "award")
    return (
      <svg {...sharedProps}>
        <circle cx="12" cy="8" r="4" />
        <path d="m9 12-2 9 5-3 5 3-2-9M12 4V2M8.5 5.5 7 4M15.5 5.5 17 4" />
      </svg>
    );
  return (
    <svg {...sharedProps}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2M8 4l-2 2 2 2" />
    </svg>
  );
}

function authErrorMessage(error: unknown) {
  if (error instanceof AdminAuthError || error instanceof RangeError)
    return getErrorMessage(error);
  return "일시적인 문제로 처리하지 못했습니다. 잠시 후 다시 시도해 주세요. 문제가 계속되면 관리자에게 문의해 주세요.";
}

function LoginScreen({
  sessionError,
  isSessionLoading,
  onSkipLogin,
}: {
  isSessionLoading: boolean;
  sessionError: Error | null;
  onSkipLogin: () => void;
}) {
  const signInMutation = useMutation(adminSignInMutationOptions());
  const changeMutation = useMutation(adminChangeInitialPasswordMutationOptions());
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [isChangingPassword, setChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isCapsLockOn, setCapsLockOn] = useState(false);
  const trackCapsLock = (event: KeyboardEvent<HTMLInputElement>) =>
    setCapsLockOn(event.getModifierState("CapsLock"));
  const capsLockHint = isCapsLockOn ? "Caps Lock이 켜져 있습니다." : undefined;
  const clearError = (field: string) =>
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  const handleSignIn = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errors: Record<string, string> = {};
    if (!loginId.trim()) errors.loginId = "아이디를 입력해 주세요.";
    if (!password) errors.password = "비밀번호를 입력해 주세요.";
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    signInMutation.mutate(
      { loginId, password },
      {
        onSuccess: (result) => {
          if (result.status === "password-change-required") {
            setChangingPassword(true);
            return;
          }
          setPassword("");
        },
      },
    );
  };
  const handleChangePassword = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errors: Record<string, string> = {};
    if (!newPassword) errors.newPassword = "변경할 비밀번호를 입력해 주세요.";
    if (!confirmPassword) errors.confirmPassword = "비밀번호를 한 번 더 입력해 주세요.";
    else if (newPassword && newPassword !== confirmPassword)
      errors.confirmPassword = "입력한 두 비밀번호가 서로 다릅니다. 다시 확인해 주세요.";
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    changeMutation.mutate({
      loginId,
      initialPassword: password,
      newPassword,
    });
  };
  const backToSignIn = () => {
    setChangingPassword(false);
    setPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setFieldErrors({});
    signInMutation.reset();
    changeMutation.reset();
  };
  const signInError = signInMutation.error;
  const restrictedCode =
    signInError instanceof AdminAuthError &&
    (signInError.code === "locked" || signInError.code === "suspended")
      ? signInError.code
      : null;
  return (
    <main className="api-admin-login-page">
      <div className="api-admin-login-shell">
        <div className="api-admin-login-brand" aria-hidden="true">
          B
        </div>
        <div className="api-admin-login-heading">
          <span>BONANZA FACTORY CONTENT MANAGEMENT</span>
          <h1>{isChangingPassword ? "비밀번호 변경" : "관리자 로그인"}</h1>
          <p>
            {isChangingPassword
              ? "변경할 비밀번호를 입력해 주세요."
              : "콘텐츠 등록과 수정을 위해 관리자 계정으로 로그인해주세요."}
          </p>
        </div>
        <Card className="api-admin-login-card" padding="clamp(22px, 5vw, 32px)">
          {isChangingPassword ? (
            <form
              noValidate
              className="api-admin-login-form"
              onSubmit={handleChangePassword}
            >
              <Input
                autoComplete="new-password"
                error={fieldErrors.newPassword}
                hint={capsLockHint ?? "영문과 숫자를 포함해 8자 이상 입력해 주세요."}
                label="비밀번호"
                type="password"
                value={newPassword}
                onChange={(event) => {
                  setNewPassword(event.target.value);
                  clearError("newPassword");
                }}
                onKeyDown={trackCapsLock}
                onKeyUp={trackCapsLock}
              />
              <Input
                autoComplete="new-password"
                error={fieldErrors.confirmPassword}
                label="비밀번호 재입력"
                type="password"
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value);
                  clearError("confirmPassword");
                }}
                onKeyDown={trackCapsLock}
                onKeyUp={trackCapsLock}
              />
              <Button
                disabled={changeMutation.isPending}
                fullWidth
                size="lg"
                type="submit"
              >
                {changeMutation.isPending ? "변경 중..." : "비밀번호 변경"}
              </Button>
              <Button fullWidth type="button" variant="ghost" onClick={backToSignIn}>
                로그인으로 돌아가기
              </Button>
            </form>
          ) : isSessionLoading ? (
            <p className="api-admin-loading">
              관리자 세션을 확인하고 있습니다.
            </p>
          ) : (
            <form noValidate className="api-admin-login-form" onSubmit={handleSignIn}>
              <Input
                autoComplete="username"
                error={fieldErrors.loginId}
                label="아이디"
                placeholder="아이디를 입력해 주세요"
                type="text"
                value={loginId}
                onChange={(event) => {
                  setLoginId(event.target.value);
                  clearError("loginId");
                }}
              />
              <Input
                autoComplete="current-password"
                error={fieldErrors.password}
                hint={capsLockHint}
                label="비밀번호"
                type="password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  clearError("password");
                }}
                onKeyDown={trackCapsLock}
                onKeyUp={trackCapsLock}
              />
              <Button
                disabled={signInMutation.isPending}
                fullWidth
                size="lg"
                type="submit"
              >
                {signInMutation.isPending ? "로그인 중..." : "관리자 로그인"}
              </Button>
            </form>
          )}
          {changeMutation.error ? (
            <Notice tone="danger" title="비밀번호를 변경하지 못했습니다.">
              {authErrorMessage(changeMutation.error)}
            </Notice>
          ) : null}
          {signInError ? (
            <Notice
              tone={restrictedCode ? "warning" : "danger"}
              title={
                restrictedCode === "locked"
                  ? "계정이 잠겼습니다."
                  : restrictedCode === "suspended"
                    ? "정지된 계정입니다."
                    : "로그인하지 못했습니다."
              }
            >
              {authErrorMessage(signInError)}
            </Notice>
          ) : null}
          {sessionError ? (
            <Notice tone="danger" title="로그인 상태를 확인하지 못했습니다.">
              페이지를 새로고침한 뒤 다시 시도해 주세요. 문제가 계속되면 관리자에게 문의해 주세요.
            </Notice>
          ) : null}
        </Card>
        <Notice
          tone="warning"
          title="테스트 환경"
          style={{ width: "100%" }}
          action={
            <Button size="sm" variant="secondary" onClick={onSkipLogin}>
              테스트용 로그인 건너뛰기
            </Button>
          }
        >
          실제 계정 없이 운영 화면을 확인하려면 "테스트용 로그인 건너뛰기"로 로그인을
          건너뛸 수 있습니다. 초기 비밀번호 변경을 테스트하려면 아이디{" "}
          <strong>{demoAdminAccount.loginId}</strong>, 비밀번호{" "}
          <strong>{demoAdminAccount.password}</strong>로 로그인하세요. 변경한
          뒤 다시 테스트하려면 "테스트 계정 초기화"를 누르세요.
          <div style={{ marginTop: "8px" }}>
            <Button size="sm" variant="ghost" onClick={resetDemoAdminAccounts}>
              테스트 계정 초기화
            </Button>
          </div>
        </Notice>
      </div>
    </main>
  );
}

function Workspace({
  section,
  openId,
  openCategory,
  tab,
  onOpenIdConsumed,
  onTabChange,
  onDetailOpenChange,
  onOrderDirtyChange,
  confirmLeave,
  postListNavigationId,
}: {
  section: AdminSection;
  openId?: string;
  openCategory?: string;
  tab?: string;
  onOpenIdConsumed: () => void;
  onTabChange: (tab: string) => void;
  onDetailOpenChange: (isOpen: boolean) => void;
  onOrderDirtyChange: (isDirty: boolean) => void;
  confirmLeave: (action: () => void) => void;
  postListNavigationId: number;
}) {
  if (section === "dashboard") return <AnalyticsDashboard />;
  if (section === "achievements") return <AchievementSection initialTab={tab === "home" ? "home" : "company"} onTabChange={onTabChange} />;
  if (section === "admin-accounts") return <AdminAccountSection onEditorOpenChange={onDetailOpenChange} />;
  if (section === "notice-popups") return <NoticePopupSection onEditorOpenChange={onDetailOpenChange} />;
  if (section === "awards") return <AwardSection onEditorOpenChange={onDetailOpenChange} />;
  if (section === "institutions") return <InstitutionSection key={tab} initialTab={tab === "partner" ? "partner" : "member"} onEditorOpenChange={onDetailOpenChange} onTabChange={onTabChange} onOrderDirtyChange={onOrderDirtyChange} confirmLeave={confirmLeave} />;
  if (section === "posts")
    return (
      <PostSection
        initialCategory={(tab ?? openCategory) as PostCategory | undefined}
        initialEditingId={openId}
        onInitialEditingConsumed={onOpenIdConsumed}
        onCategoryChange={onTabChange}
        onEditorOpenChange={onDetailOpenChange}
        listViewRequestId={postListNavigationId}
      />
    );
  if (section === "privacy-policies") return <PrivacyPolicySection onEditorOpenChange={onDetailOpenChange} />;
  if (section === "history") return <HistorySection onEditorOpenChange={onDetailOpenChange} />;
  if (section === "highlights") return <AchievementHighlightSection onOrderDirtyChange={onOrderDirtyChange} />;
  return <AnalyticsDashboard />;
}

export function ApiTestPage() {
  const navigate = useNavigate({ from: "/" });
  const search = useSearch({ from: "/" });
  const session = useAdminSession();
  const signOutMutation = useMutation(adminSignOutMutationOptions());
  const [isLoginSkipped, setLoginSkipped] = useState(false);
  const [, setDetailOpen] = useState(false);
  const [isOrderDirty, setOrderDirty] = useState(false);
  const isEditorDirty = useEditorDirty();
  const hasUnsaved = isOrderDirty || isEditorDirty;
  const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null);
  useEffect(() => {
    if (!hasUnsaved) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsaved]);
  const confirmLeave = (action: () => void) => {
    if (hasUnsaved) setPendingLeave(() => action);
    else action();
  };
  const [postListNavigationId, setPostListNavigationId] = useState(0);
  const section = search.section ?? "dashboard";
  const activeNavItem = NAV_ITEMS.find((item) => item.section === section);
  const clearOpenId = () => {
    void navigate({
      search: (prev) => ({
        ...prev,
        openId: undefined,
        openCategory: undefined,
      }),
      replace: true,
    });
  };
  const syncTab = (tab: string) => void navigate({ search: (prev) => ({ ...prev, tab }) });
  const navigateMenu = (nextSection: AdminSection, nextTab?: string) => confirmLeave(() => {
    setDetailOpen(false);
    setPostListNavigationId((current) => current + 1);
    void navigate({ search: { section: nextSection, tab: nextTab } });
  });
  if (!session.user && !isLoginSkipped)
    return (
      <LoginScreen
        isSessionLoading={session.isLoading}
        sessionError={session.error}
        onSkipLogin={() => setLoginSkipped(true)}
      />
    );
  const currentUser = session.user ?? manualLoginSkipUser;
  const handleSignOut = () => {
    if (isLoginSkipped) {
      setLoginSkipped(false);
      return;
    }
    signOutMutation.mutate();
  };
  return (
    <main className="api-admin-page">
      <div className="api-admin-frame">
        <aside className="api-admin-sidebar" aria-label="관리자 메뉴">
          <div className="api-admin-sidebar-brand">
            <img src={bonanzaFactoryLogo} alt="Bonanza Factory" />
          </div>
          <div className="api-admin-sidebar-navigation">
            <nav>
              {NAV_ITEMS.map((item) => (
                <div className="api-admin-nav-group" key={item.section}>
                  <button className={section === item.section ? "is-active" : undefined} type="button" onClick={() => navigateMenu(item.section, item.children?.[0]?.tab)}>
                    <MenuIcon name={item.icon} /><div><strong>{item.label}</strong></div>
                  </button>
                  {section === item.section && item.children ? <div className="api-admin-subnav">{item.children.map((child) => <button key={child.tab} className={search.tab === child.tab ? "is-active" : undefined} type="button" onClick={() => navigateMenu(item.section, child.tab)}>{child.label}</button>)}</div> : null}
                </div>
              ))}
            </nav>
          </div>
          <div className="api-admin-sidebar-account">
            <span className="api-admin-account-avatar" aria-hidden="true">
              B
            </span>
            <div className="api-admin-account-copy">
              <strong>{currentUser.loginId}</strong>
              <span>관리자 계정</span>
            </div>
            <Button
              disabled={signOutMutation.isPending}
              size="sm"
              style={{ fontSize: "11px" }}
              variant="text"
              onClick={handleSignOut}
            >
              {signOutMutation.isPending ? "처리 중" : "로그아웃"}
            </Button>
          </div>
        </aside>
        <div className="api-admin-workbench">
          <header className="api-admin-topbar">
            <div className="api-admin-topbar-inner">
              <p className="api-admin-breadcrumb" aria-label="현재 위치">
                <span>Bonanza Factory</span>
                <span aria-hidden="true">/</span>
                <strong>{activeNavItem?.label ?? "관리자"}</strong>
              </p>
              <div className="api-admin-mobile-account">
                <span>{currentUser.loginId}</span>
                <Button
                  disabled={signOutMutation.isPending}
                  size="sm"
                  style={{ fontSize: "11px" }}
                  variant="text"
                  onClick={handleSignOut}
                >
                  로그아웃
                </Button>
              </div>
            </div>
          </header>
          <div className="api-admin-content">
            {signOutMutation.error ? (
              <Notice tone="danger" title="로그아웃하지 못했습니다.">
                {getErrorMessage(signOutMutation.error)}
              </Notice>
            ) : null}
            <Workspace
              key={`${section}:${search.tab ?? ""}:${postListNavigationId}`}
              section={section}
              openCategory={search.openCategory}
              tab={search.tab}
              openId={search.openId}
              onOpenIdConsumed={clearOpenId}
              onTabChange={syncTab}
              onDetailOpenChange={setDetailOpen}
              onOrderDirtyChange={setOrderDirty}
              confirmLeave={confirmLeave}
              postListNavigationId={postListNavigationId}
            />
          </div>
        </div>
      </div>
      <UnsavedChangesModal
        open={pendingLeave !== null}
        message={
          isEditorDirty
            ? "작성 중인 내용을 저장하지 않고 이동하면 입력한 내용이 사라집니다. 이동하시겠습니까?"
            : undefined
        }
        onStay={() => setPendingLeave(null)}
        onLeave={() => {
          const action = pendingLeave;
          setPendingLeave(null);
          setOrderDirty(false);
          action?.();
        }}
      />
    </main>
  );
}
