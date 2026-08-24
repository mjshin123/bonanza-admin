import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";

import {
  adminSignInMutationOptions,
  adminSignOutMutationOptions,
  useAdminSession,
} from "@features/admin-auth";
import { boardsQueryOptions, type Board } from "@entities/board";
import kfcpaLogo from "@shared/assets/logo/kfcpa-logo-horizontal.png";
import { getErrorMessage } from "@shared/lib";
import { Button, Card, Input, Notice } from "@shared/ui";
import { GeneralPostAdmin } from "@widgets/general-post-admin";

import "./ApiTestPage.css";

const ADMIN_CATEGORY_OPTIONS = [
  { code: "association_news", label: "협회소식" },
  { code: "notice", label: "공지사항" },
  { code: "gallery", label: "포토갤러리" },
  { code: "resource", label: "자료실" },
] as const;

const RESOURCE_BOARD_OPTIONS = [
  { code: "seminar_resource", label: "세미나 자료" },
  { code: "policy_resource", label: "법령·정책 자료" },
] as const;

const DEFAULT_BOARD_CODE = "association_news";
const RESOURCE_BOARD_CODES = new Set<string>(
  RESOURCE_BOARD_OPTIONS.map((option) => option.code),
);
const ADMIN_BOARD_CODES = new Set<string>([
  DEFAULT_BOARD_CODE,
  "notice",
  "gallery",
  ...RESOURCE_BOARD_OPTIONS.map((option) => option.code),
]);

function getDefaultBoardCode(boards: Board[]) {
  if (boards.some((board) => board.code === DEFAULT_BOARD_CODE)) {
    return DEFAULT_BOARD_CODE;
  }

  return boards.find((board) => ADMIN_BOARD_CODES.has(board.code))?.code;
}

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

function CategorySelector({
  boards,
  selectedCode,
  onSelect,
}: {
  boards: Board[];
  onSelect: (code: string) => void;
  selectedCode: string;
}) {
  const availableBoardCodes = new Set(boards.map((board) => board.code));
  const selectedCategoryCode = RESOURCE_BOARD_CODES.has(selectedCode)
    ? "resource"
    : selectedCode;
  const availableResourceOptions = RESOURCE_BOARD_OPTIONS.filter((option) =>
    availableBoardCodes.has(option.code),
  );

  const handleCategorySelect = (categoryCode: string) => {
    if (categoryCode !== "resource") {
      onSelect(categoryCode);
      return;
    }

    const nextResourceBoardCode = RESOURCE_BOARD_CODES.has(selectedCode)
      ? selectedCode
      : availableResourceOptions[0]?.code;

    if (nextResourceBoardCode) {
      onSelect(nextResourceBoardCode);
    }
  };

  return (
    <div className="api-admin-category-controls">
      <div className="api-admin-category-select">
        <label htmlFor="api-admin-board">카테고리</label>
        <select
          id="api-admin-board"
          value={selectedCategoryCode}
          onChange={(event) => handleCategorySelect(event.target.value)}
        >
          {ADMIN_CATEGORY_OPTIONS.filter((option) =>
            option.code === "resource"
              ? availableResourceOptions.length > 0
              : availableBoardCodes.has(option.code),
          ).map((option) => (
            <option key={option.code} value={option.code}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {selectedCategoryCode === "resource" ? (
        <div className="api-admin-category-select">
          <label htmlFor="api-admin-resource-board">자료 구분</label>
          <select
            id="api-admin-resource-board"
            value={selectedCode}
            onChange={(event) => onSelect(event.target.value)}
          >
            {availableResourceOptions.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </div>
  );
}

export function ApiTestPage() {
  const navigate = useNavigate({ from: "/" });
  const search = useSearch({ from: "/" });
  const session = useAdminSession();
  const signOutMutation = useMutation(adminSignOutMutationOptions());
  const boardsQuery = useQuery({
    ...boardsQueryOptions(),
    enabled: Boolean(session.user),
  });
  const selectedBoardCode = search.board ?? DEFAULT_BOARD_CODE;
  const workspaceView = search.view === "write" ? "write" : "list";

  useEffect(() => {
    if (!boardsQuery.data?.length) {
      return;
    }

    const selectedBoardExists =
      ADMIN_BOARD_CODES.has(selectedBoardCode) &&
      boardsQuery.data.some((board) => board.code === selectedBoardCode);

    if (!selectedBoardExists) {
      const defaultBoardCode = getDefaultBoardCode(boardsQuery.data);

      if (!defaultBoardCode) {
        return;
      }

      void navigate({
        replace: true,
        search: { board: defaultBoardCode },
      });
    }
  }, [boardsQuery.data, navigate, selectedBoardCode]);

  const handleBoardSelect = (board: string) => {
    void navigate({ search: { board } });
  };

  const handleOpenEditor = (postId?: string) => {
    void navigate({
      search: {
        board: selectedBoardCode,
        postId,
        view: "write",
      },
    });
  };

  const handleReturnToList = () => {
    void navigate({ search: { board: selectedBoardCode } });
  };

  if (!session.user) {
    return (
      <LoginScreen
        isSessionLoading={session.isLoading}
        sessionError={session.error}
      />
    );
  }

  const selectedBoard = boardsQuery.data?.find(
    (board) =>
      board.code === selectedBoardCode &&
      ADMIN_BOARD_CODES.has(board.code),
  );
  const categorySelector = boardsQuery.data?.some((board) =>
    ADMIN_BOARD_CODES.has(board.code),
  ) ? (
    <CategorySelector
      boards={boardsQuery.data}
      selectedCode={selectedBoardCode}
      onSelect={handleBoardSelect}
    />
  ) : null;

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

      <section className="api-admin-section">
        <div className="api-admin-shell">
          {signOutMutation.error ? (
            <Notice tone="danger" title="로그아웃하지 못했습니다.">
              {getErrorMessage(signOutMutation.error)}
            </Notice>
          ) : null}

          {boardsQuery.error ? (
            <Notice tone="danger" title="카테고리를 불러오지 못했습니다.">
              {getErrorMessage(boardsQuery.error)}
            </Notice>
          ) : null}

          {boardsQuery.isPending ? (
            <Card className="api-admin-category-loading">
              게시물 카테고리를 불러오는 중입니다.
            </Card>
          ) : null}

          {selectedBoard ? (
            <section className="api-admin-workspace" aria-live="polite">
              <GeneralPostAdmin
                key={selectedBoard.code}
                board={selectedBoard}
                editingPostId={search.postId}
                enabled
                categoryControl={categorySelector}
                view={workspaceView}
                onOpenEditor={handleOpenEditor}
                onReturnToList={handleReturnToList}
              />
            </section>
          ) : null}
        </div>
      </section>
    </main>
  );
}
