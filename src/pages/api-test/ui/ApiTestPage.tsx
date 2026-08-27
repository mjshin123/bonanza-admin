import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";

import {
  adminSignInMutationOptions,
  adminSignOutMutationOptions,
  useAdminSession,
} from "@features/admin-auth";
import kfcpaLogo from "@shared/assets/logo/kfcpa-logo-horizontal.png";
import { getErrorMessage } from "@shared/lib";
import { Button, Card, Input, Notice } from "@shared/ui";
import { AnalyticsDashboard } from "@widgets/analytics-dashboard";
import {
  GallerySection,
  HistorySection,
  InstitutionSection,
  PostSection,
  ResourceSection,
  SeminarSection,
} from "@widgets/content-admin";

import type { AdminSection } from "../model/apiAdminSearch";
import "./ApiTestPage.css";

const NAV_ITEMS: Array<{
  section: AdminSection;
  code: string;
  label: string;
  description: string;
}> = [
  {
    section: "dashboard",
    code: "00",
    label: "대시보드",
    description: "홈페이지 방문 통계",
  },
  {
    section: "institutions",
    code: "A",
    label: "회원 · 협력기관",
    description: "기관 및 분류",
  },
  {
    section: "posts",
    code: "B",
    label: "소식 게시판",
    description: "공지 · 협회 · 회원소식",
  },
  {
    section: "resources",
    code: "C",
    label: "자료실",
    description: "자료 · 결산/공시",
  },
  {
    section: "seminars",
    code: "D",
    label: "세미나",
    description: "예정 · 지난 행사",
  },
  {
    section: "galleries",
    code: "E",
    label: "포토갤러리",
    description: "노출 · 순서 · 숨김",
  },
  {
    section: "history",
    code: "F",
    label: "연혁",
    description: "내용 · 노출 · 순서",
  },
];

function LoginScreen({
  sessionError,
  isSessionLoading,
}: {
  isSessionLoading: boolean;
  sessionError: Error | null;
}) {
  const signInMutation = useMutation(adminSignInMutationOptions());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const handleSignIn = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    signInMutation.mutate(
      { email, password },
      { onSuccess: () => setPassword("") },
    );
  };
  return (
    <main className="api-admin-login-page">
      <div className="api-admin-login-shell">
        <div className="api-admin-login-brand" aria-hidden="true">
          K
        </div>
        <div className="api-admin-login-heading">
          <span>KFCPA CONTENT MANAGEMENT</span>
          <h1>관리자 로그인</h1>
          <p>콘텐츠 등록과 수정을 위해 관리자 계정으로 로그인해주세요.</p>
        </div>
        <Card className="api-admin-login-card" padding="clamp(22px, 5vw, 32px)">
          {isSessionLoading ? (
            <p className="api-admin-loading">
              관리자 세션을 확인하고 있습니다.
            </p>
          ) : (
            <form className="api-admin-login-form" onSubmit={handleSignIn}>
              <Input
                required
                autoComplete="username"
                label="이메일"
                placeholder="admin@kfcpa.or.kr"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <Input
                required
                autoComplete="current-password"
                label="비밀번호"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
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
          {signInMutation.error ? (
            <Notice tone="danger" title="로그인하지 못했습니다.">
              {getErrorMessage(signInMutation.error)}
            </Notice>
          ) : null}
          {sessionError ? (
            <Notice tone="danger" title="세션을 확인하지 못했습니다.">
              {sessionError.message}
            </Notice>
          ) : null}
        </Card>
      </div>
    </main>
  );
}

function Workspace({ section }: { section: AdminSection }) {
  if (section === "dashboard") return <AnalyticsDashboard />;
  if (section === "institutions") return <InstitutionSection />;
  if (section === "posts") return <PostSection />;
  if (section === "resources") return <ResourceSection />;
  if (section === "seminars") return <SeminarSection />;
  if (section === "galleries") return <GallerySection />;
  return <HistorySection />;
}

export function ApiTestPage() {
  const navigate = useNavigate({ from: "/" });
  const search = useSearch({ from: "/" });
  const session = useAdminSession();
  const signOutMutation = useMutation(adminSignOutMutationOptions());
  const section = search.section ?? "dashboard";
  if (!session.user)
    return (
      <LoginScreen
        isSessionLoading={session.isLoading}
        sessionError={session.error}
      />
    );
  return (
    <main className="api-admin-page">
      <header className="api-admin-topbar">
        <div className="api-admin-topbar-inner">
          <div className="api-admin-brand">
            <img src={kfcpaLogo} alt="KFCPA" />
            <strong>Admin</strong>
          </div>
          <div className="api-admin-account">
            <div>
              <span>로그인 계정</span>
              <strong>{session.user.email ?? session.user.id}</strong>
            </div>
            <Button
              disabled={signOutMutation.isPending}
              size="sm"
              variant="ghost"
              onClick={() => signOutMutation.mutate()}
            >
              {signOutMutation.isPending ? "로그아웃 중..." : "로그아웃"}
            </Button>
          </div>
        </div>
      </header>
      <div className="api-admin-layout">
        <aside className="api-admin-sidebar" aria-label="관리자 메뉴">
          <p>ADMIN</p>
          <nav>
            {NAV_ITEMS.map((item) => (
              <button
                key={item.section}
                className={section === item.section ? "is-active" : undefined}
                type="button"
                onClick={() =>
                  void navigate({ search: { section: item.section } })
                }
              >
                <span>{item.code}</span>
                <div>
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </div>
              </button>
            ))}
          </nav>
        </aside>
        <div className="api-admin-content">
          {signOutMutation.error ? (
            <Notice tone="danger" title="로그아웃하지 못했습니다.">
              {getErrorMessage(signOutMutation.error)}
            </Notice>
          ) : null}
          <Workspace section={section} />
        </div>
      </div>
    </main>
  );
}
