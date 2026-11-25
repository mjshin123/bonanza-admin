import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  adminAccountQueryKeys,
  adminAccountsQueryOptions,
  getAdminSessionUser,
  type AdminAccountDto,
  type AdminAccountStatus,
} from "@entities/admin-account";
import {
  createAdminAccountMutationOptions,
  resetAdminPasswordMutationOptions,
  suspendAdminAccountMutationOptions,
  type CreateAdminAccountResult,
} from "@features/admin-account-manage";
import { lastEditorLogin } from "@shared/lib";
import { Badge, Button, Notice, confirmDialog } from "@shared/ui";

import {
  EditorCard,
  Field,
  MutationMessage,
  SectionTitle,
  TableShell,
} from "./AdminCommon";

type CopyNotice = { tone: "info" | "danger"; title: string; message: string };

function buildCopyText({ loginId, initialPassword }: CreateAdminAccountResult) {
  return `아이디: ${loginId}\n초기 비밀번호: ${initialPassword}`;
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const copied = document.execCommand("copy");
    area.remove();
    return copied;
  }
}

/** 초기 비밀번호는 화면에 표시하지 않고 클립보드로만 전달한다. */
async function copyCredentials(
  result: CreateAdminAccountResult,
  doneTitle: string,
): Promise<CopyNotice> {
  if (await copyText(buildCopyText(result)))
    return {
      tone: "info",
      title: doneTitle,
      message: "아이디 및 초기 비밀번호를 클립보드에 복사했습니다.",
    };
  return {
    tone: "danger",
    title: `${doneTitle} (복사 실패)`,
    message:
      "클립보드에 복사하지 못했습니다. 목록에서 비밀번호 초기화를 눌러 다시 시도해 주세요.",
  };
}

function CreateForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (notice: CopyNotice) => void;
}) {
  const queryClient = useQueryClient();
  const mutation = useMutation(createAdminAccountMutationOptions());
  const [loginId, setLoginId] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const result = await mutation.mutateAsync({ loginId });
      const notice = await copyCredentials(result, "계정 생성 완료");
      await queryClient.invalidateQueries({ queryKey: adminAccountQueryKeys.all });
      onCreated(notice);
    } catch {
      /* MutationMessage에서 오류를 표시한다. */
    }
  };
  return (
    <section className="content-admin-section">
      <EditorCard
        title="관리자 계정 추가"
        description="아이디만 입력하면 초기 비밀번호가 자동으로 만들어져 클립보드에 복사됩니다."
        onSubmit={(event) => void submit(event)}
      >
        <Field
          label="아이디"
          required
          hint="영문 소문자, 숫자, 마침표(.), 밑줄(_), 하이픈(-) 4~20자"
        >
          <input
            required
            autoComplete="off"
            className="content-admin-native-input"
            maxLength={20}
            value={loginId}
            onChange={(event) => setLoginId(event.target.value)}
          />
        </Field>
        <MutationMessage error={mutation.error} />
        <div className="content-admin-form-actions">
          <Button type="button" variant="ghost" onClick={onCancel}>
            취소
          </Button>
          <Button disabled={mutation.isPending} type="submit">
            {mutation.isPending ? "생성 중…" : "계정 생성"}
          </Button>
        </div>
      </EditorCard>
    </section>
  );
}

const STATUS_BADGE: Record<
  AdminAccountStatus,
  { tone: "success" | "warning" | "danger"; label: string }
> = {
  active: { tone: "success", label: "활성" },
  locked: { tone: "warning", label: "잠금" },
  suspended: { tone: "danger", label: "정지" },
};

function AccountStatusBadge({ status }: { status: AdminAccountStatus }) {
  const { tone, label } = STATUS_BADGE[status];
  return <Badge tone={tone}>{label}</Badge>;
}

function AccountDetail({
  item,
  isSelf,
  isPending,
  error,
  onBack,
  onReset,
  onToggleSuspend,
}: {
  item: AdminAccountDto;
  isSelf: boolean;
  isPending: boolean;
  error: Error | null;
  onBack: () => void;
  onReset: () => void;
  onToggleSuspend: () => void;
}) {
  return (
    <section className="content-admin-section">
      <EditorCard
        audit={item}
        title="관리자 계정 상세"
        description="계정 상태를 확인하고 비밀번호 초기화나 계정 정지를 처리합니다."
        onSubmit={(event) => event.preventDefault()}
      >
        <Field label="아이디">
          <output className="content-admin-native-input">{item.loginId}</output>
        </Field>
        <Field
          label="상태"
          hint="잠금은 비밀번호를 10회 틀리면 자동으로 걸리며 비밀번호 초기화로 풀립니다. 정지는 관리자가 직접 처리합니다."
        >
          <div>
            <AccountStatusBadge status={item.status} />
          </div>
        </Field>
        {isSelf ? (
          <Notice tone="info" title="본인 계정입니다.">
            본인 계정은 정지하거나 비밀번호를 초기화할 수 없습니다. 다른 관리자에게 요청해 주세요.
          </Notice>
        ) : null}
        <MutationMessage error={error} />
        <div className="content-admin-form-actions">
          <Button type="button" variant="ghost" onClick={onBack}>
            목록으로
          </Button>
          <Button
            disabled={isSelf || isPending}
            type="button"
            variant="secondary"
            onClick={onReset}
          >
            비밀번호 초기화
          </Button>
          <Button
            disabled={isSelf || isPending}
            type="button"
            variant={item.isSuspended ? "primary" : "danger"}
            onClick={onToggleSuspend}
          >
            {item.isSuspended ? "정지 해제" : "계정 정지"}
          </Button>
        </div>
      </EditorCard>
    </section>
  );
}

export function AdminAccountSection({
  onEditorOpenChange,
}: {
  onEditorOpenChange?: (open: boolean) => void;
} = {}) {
  const queryClient = useQueryClient();
  const query = useQuery(adminAccountsQueryOptions());
  const resetMutation = useMutation(resetAdminPasswordMutationOptions());
  const suspendMutation = useMutation(suspendAdminAccountMutationOptions());
  const [creating, setCreating] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [notice, setNotice] = useState<CopyNotice | null>(null);
  const ownId = getAdminSessionUser()?.id ?? null;
  useEffect(
    () => onEditorOpenChange?.(creating || detailId !== null),
    [creating, detailId, onEditorOpenChange],
  );

  if (creating)
    return (
      <CreateForm
        onCancel={() => setCreating(false)}
        onCreated={(next) => {
          setNotice(next);
          setCreating(false);
        }}
      />
    );

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: adminAccountQueryKeys.all });

  const resetPassword = async ({ id, loginId, isLocked }: AdminAccountDto) => {
    if (
      !(await confirmDialog(
        `'${loginId}' 계정의 비밀번호를 초기화할까요? 새 초기 비밀번호가 클립보드에 복사되며 기존 비밀번호는 사용할 수 없게 됩니다.${isLocked ? " 잠긴 계정은 잠금도 함께 해제됩니다." : ""}`,
        { confirmLabel: "초기화", tone: "danger" },
      ))
    )
      return;
    try {
      const result = await resetMutation.mutateAsync({ id });
      setNotice(await copyCredentials(result, "비밀번호 초기화 완료"));
      await refresh();
    } catch {
      /* MutationMessage에서 오류를 표시한다. */
    }
  };

  const toggleSuspend = async ({ id, loginId, isSuspended }: AdminAccountDto) => {
    const message = isSuspended
      ? `'${loginId}' 계정의 정지를 해제할까요? 해제하면 다시 로그인할 수 있습니다.`
      : `'${loginId}' 계정을 정지할까요? 정지된 계정은 로그인할 수 없습니다.`;
    if (
      !(await confirmDialog(message, {
        confirmLabel: isSuspended ? "정지 해제" : "정지",
        tone: isSuspended ? "primary" : "danger",
      }))
    )
      return;
    try {
      await suspendMutation.mutateAsync({ id, suspended: !isSuspended });
      setNotice({
        tone: "info",
        title: isSuspended ? "정지를 해제했습니다." : "계정을 정지했습니다.",
        message: isSuspended
          ? `'${loginId}' 계정은 다시 로그인할 수 있습니다.`
          : `'${loginId}' 계정은 정지가 해제되기 전까지 로그인할 수 없습니다.`,
      });
      await refresh();
    } catch {
      /* MutationMessage에서 오류를 표시한다. */
    }
  };

  const items = query.data ?? [];
  const detail = detailId ? items.find((item) => item.id === detailId) : null;
  if (detail)
    return (
      <AccountDetail
        item={detail}
        isSelf={detail.id === ownId}
        isPending={resetMutation.isPending || suspendMutation.isPending}
        error={resetMutation.error ?? suspendMutation.error}
        onBack={() => {
          resetMutation.reset();
          suspendMutation.reset();
          setDetailId(null);
        }}
        onReset={() => void resetPassword(detail)}
        onToggleSuspend={() => void toggleSuspend(detail)}
      />
    );

  return (
    <section className="content-admin-section">
      <SectionTitle
        title="관리자 계정"
        description="관리자 페이지에 로그인할 수 있는 계정을 아이디로 관리합니다."
        action={
          <Button
            onClick={() => {
              setNotice(null);
              setCreating(true);
            }}
          >
            계정 추가
          </Button>
        }
      />
      {notice ? (
        <Notice tone={notice.tone} title={notice.title}>
          {notice.message}
        </Notice>
      ) : null}
      <MutationMessage error={resetMutation.error ?? suspendMutation.error} />
      <TableShell
        isLoading={query.isPending}
        error={query.error}
        isEmpty={!items.length}
        emptyMessage="등록된 관리자 계정이 없습니다."
      >
        <table>
          <thead>
            <tr>
              <th>아이디</th>
              <th>상태</th>
              <th>비밀번호</th>
              <th>작성자</th>
              <th aria-label="작업" />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              return (
                <tr key={item.id}>
                  <td>
                    <button
                      className="content-admin-table-title-button"
                      type="button"
                      onClick={() => {
                        setNotice(null);
                        setDetailId(item.id);
                      }}
                    >
                      <div className="content-admin-table-title">
                        <strong>{item.loginId}</strong>
                      </div>
                    </button>
                  </td>
                  <td>
                    <AccountStatusBadge status={item.status} />
                  </td>
                  <td>{item.mustChangePassword ? "초기 비밀번호" : "변경 완료"}</td>
                  <td className="content-admin-author">{lastEditorLogin(item) ?? "-"}</td>
                  <td>
                    <div className="content-admin-table-actions">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setNotice(null);
                          setDetailId(item.id);
                        }}
                      >
                        수정
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableShell>
    </section>
  );
}
