import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getAdminSessionUser } from "@entities/admin-account";
import {
  DEFAULT_NOTICE_POPUP_BUTTON_LABEL,
  noticePopupQueryKeys,
  noticePopupsQueryOptions,
  sortNoticePopups,
  type NoticePopupDto,
} from "@entities/notice-popup";
import {
  deleteNoticePopupsMutationOptions,
  normalizeNoticePopupInput,
  saveNoticePopupMutationOptions,
  setNoticePopupsVisibilityMutationOptions,
} from "@features/notice-popup-manage";
import { isDemoMode as isGlobalDemoMode } from "@shared/api/content";
import { formatAuditTime, lastEditorLogin } from "@shared/lib";
import { Badge, BulkActionBar, Button, confirmDialog } from "@shared/ui";

import {
  Checkbox,
  DemoNotice,
  EditorCard,
  Field,
  FileUpload,
  MutationMessage,
  SectionTitle,
  TableShell,
  Textarea,
  ThumbCell,
  ThumbHeader,
} from "./AdminCommon";

const demoNoticePopups: NoticePopupDto[] = [
  {
    id: "demo-popup-1",
    title: "개인정보처리방침 개정 안내",
    content: "2026년 7월 15일부터 개정된 개인정보처리방침이 시행됩니다.",
    imageFileId: null,
    imageUrl: "/demo/test-image-3.jpg",
    buttonLabel: "자세히 보기",
    startsOn: "2026-11-01",
    endsOn: "2026-12-31",
    isVisible: true,
    createdAt: "2026-11-10T01:00:00.000Z",
    updatedAt: "2026-11-10T01:00:00.000Z",
    createdByLogin: "admin",
    updatedByLogin: "admin",
  },
  {
    id: "demo-popup-2",
    title: "연말 서비스 점검 안내",
    content: "12월 28일 새벽 2시부터 4시까지 서비스 점검이 진행됩니다.",
    imageFileId: null,
    imageUrl: null,
    buttonLabel: DEFAULT_NOTICE_POPUP_BUTTON_LABEL,
    startsOn: "2026-12-20",
    endsOn: "2026-12-28",
    isVisible: true,
    createdAt: "2026-11-20T01:00:00.000Z",
    updatedAt: "2026-11-20T01:00:00.000Z",
    createdByLogin: "admin",
    updatedByLogin: "admin",
  },
  {
    id: "demo-popup-3",
    title: "신규 서비스 오픈 이벤트",
    content: "신규 서비스 오픈을 기념하는 이벤트를 진행합니다.",
    imageFileId: null,
    imageUrl: "/demo/test-image-5.png",
    buttonLabel: "이벤트 보기",
    startsOn: "2026-09-01",
    endsOn: "2026-09-30",
    isVisible: false,
    createdAt: "2026-08-25T01:00:00.000Z",
    updatedAt: "2026-10-01T01:00:00.000Z",
    createdByLogin: "mjshin",
    updatedByLogin: "admin",
  },
];

const todayString = () => new Date().toISOString().slice(0, 10);
const daysFromToday = (days: number) =>
  new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

function NoticePopupEditor({
  item,
  demoMode,
  onDemoSave,
  onClose,
}: {
  item: NoticePopupDto | null;
  demoMode: boolean;
  onDemoSave: (saved: NoticePopupDto) => void;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const saveMutation = useMutation(saveNoticePopupMutationOptions());
  const [title, setTitle] = useState(item?.title ?? "");
  const [content, setContent] = useState(item?.content ?? "");
  const [imageFileId, setImageFileId] = useState<string | null>(item?.imageFileId ?? null);
  const [imageUrl, setImageUrl] = useState<string | null>(item?.imageUrl ?? null);
  const [buttonLabel, setButtonLabel] = useState(
    item?.buttonLabel ?? DEFAULT_NOTICE_POPUP_BUTTON_LABEL,
  );
  const [startsOn, setStartsOn] = useState(item?.startsOn ?? todayString());
  const [endsOn, setEndsOn] = useState(item?.endsOn ?? daysFromToday(14));
  const [isVisible, setVisible] = useState(item?.isVisible ?? true);
  const [demoError, setDemoError] = useState<Error | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const input = {
      id: item?.id,
      expectedUpdatedAt: item?.updatedAt,
      title,
      content,
      imageFileId,
      buttonLabel,
      startsOn,
      endsOn,
      isVisible,
    };
    if (demoMode) {
      try {
        const normalized = normalizeNoticePopupInput(input);
        const now = new Date().toISOString();
        const login = getAdminSessionUser()?.loginId ?? "admin";
        onDemoSave({
          id: item?.id ?? crypto.randomUUID(),
          title: normalized.title,
          content: normalized.content,
          imageFileId,
          imageUrl,
          buttonLabel: normalized.buttonLabel,
          startsOn,
          endsOn,
          isVisible,
          createdAt: item?.createdAt ?? now,
          updatedAt: now,
          createdByLogin: item?.createdByLogin ?? login,
          updatedByLogin: login,
        });
        onClose();
      } catch (error) {
        setDemoError(error instanceof Error ? error : new Error("저장하지 못했습니다."));
      }
      return;
    }
    try {
      await saveMutation.mutateAsync(input);
      await queryClient.invalidateQueries({ queryKey: noticePopupQueryKeys.all });
      onClose();
    } catch {
      /* MutationMessage에서 오류를 표시한다. */
    }
  };

  return (
    <section className="content-admin-section">
      <EditorCard
        audit={item}
        title={item ? "공지 팝업 수정" : "공지 팝업 추가"}
        description="운영 웹사이트에서 모달로 보여줄 공지를 작성합니다."
        onSubmit={(event) => void submit(event)}
      >
        <Field label="제목" required>
          <input
            required
            className="content-admin-native-input"
            maxLength={100}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </Field>
        <Field label="내용" required wide>
          <Textarea
            required
            maxLength={2000}
            rows={6}
            value={content}
            onChange={(event) => setContent(event.target.value)}
          />
        </Field>
        <div className="content-admin-common-fields">
          <Field
            label="버튼 명칭"
            hint={`모달의 버튼에 표시됩니다. 비워 두면 '${DEFAULT_NOTICE_POPUP_BUTTON_LABEL}'으로 표시됩니다.`}
          >
            <input
              className="content-admin-native-input"
              maxLength={20}
              placeholder={DEFAULT_NOTICE_POPUP_BUTTON_LABEL}
              value={buttonLabel}
              onChange={(event) => setButtonLabel(event.target.value)}
            />
          </Field>
          <Field label="보여줄 기간" required hint="시작일과 종료일을 포함합니다.">
            <div className="content-admin-inline">
              <input
                required
                className="content-admin-native-input"
                type="date"
                value={startsOn}
                onChange={(event) => setStartsOn(event.target.value)}
              />
              <span>~</span>
              <input
                required
                className="content-admin-native-input"
                min={startsOn}
                type="date"
                value={endsOn}
                onChange={(event) => setEndsOn(event.target.value)}
              />
            </div>
          </Field>
          <Field label="노출 상태">
            <Checkbox checked={isVisible} label="웹사이트에 노출" onChange={setVisible} />
          </Field>
          <Field label="이미지" wide hint="선택 사항입니다.">
            <div className="history-v2-image">
              {imageUrl ? <img src={imageUrl} alt="" /> : null}
              <FileUpload
                accept="image/*"
                fileKind="image"
                label={imageUrl ? "이미지 변경" : "이미지 첨부"}
                onUploaded={(files) => {
                  const file = files[0];
                  if (file) {
                    setImageFileId(file.id);
                    setImageUrl(file.url);
                  }
                }}
              />
              {imageUrl ? (
                <Button
                  size="sm"
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setImageFileId(null);
                    setImageUrl(null);
                  }}
                >
                  이미지 제거
                </Button>
              ) : null}
            </div>
          </Field>
        </div>
        <MutationMessage error={demoError ?? saveMutation.error} />
        <div className="content-admin-form-actions">
          <Button type="button" variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button disabled={saveMutation.isPending} type="submit">
            {saveMutation.isPending ? "저장 중…" : "게시"}
          </Button>
        </div>
      </EditorCard>
    </section>
  );
}

export function NoticePopupSection({
  onEditorOpenChange,
}: {
  onEditorOpenChange?: (open: boolean) => void;
} = {}) {
  const queryClient = useQueryClient();
  const query = useQuery(noticePopupsQueryOptions());
  const visibilityMutation = useMutation(setNoticePopupsVisibilityMutationOptions());
  const deleteMutation = useMutation(deleteNoticePopupsMutationOptions());
  const [editing, setEditingState] = useState<NoticePopupDto | null | "new">(null);
  const [demoItems, setDemoItems] = useState(demoNoticePopups);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const demoMode = isGlobalDemoMode || Boolean(query.error);
  const items = sortNoticePopups(query.data ?? (demoMode ? demoItems : []));
  const setEditing = (next: NoticePopupDto | null | "new") => {
    setEditingState(next);
    onEditorOpenChange?.(next !== null);
  };
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: noticePopupQueryKeys.all });

  if (editing)
    return (
      <NoticePopupEditor
        item={editing === "new" ? null : editing}
        demoMode={demoMode}
        onClose={() => setEditing(null)}
        onDemoSave={(saved) =>
          setDemoItems((current) =>
            current.some((entry) => entry.id === saved.id)
              ? current.map((entry) => (entry.id === saved.id ? saved : entry))
              : [saved, ...current],
          )
        }
      />
    );

  const selectedItems = items.filter((item) => selectedIds.has(item.id));
  const canShow = selectedItems.some((item) => !item.isVisible);
  const canHide = selectedItems.some((item) => item.isVisible);
  const toggleSelected = (id: string, checked: boolean) =>
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });

  const setVisibility = async (isVisible: boolean) => {
    const targets = selectedItems.filter((item) => item.isVisible !== isVisible);
    if (
      !isVisible &&
      !(await confirmDialog(`선택한 ${targets.length}건을 숨길까요?`, { confirmLabel: "숨김" }))
    )
      return;
    const ids = targets.map((item) => item.id);
    if (demoMode) {
      setDemoItems((current) =>
        current.map((item) => (ids.includes(item.id) ? { ...item, isVisible } : item)),
      );
      setSelectedIds(new Set());
      return;
    }
    try {
      await visibilityMutation.mutateAsync({ ids, isVisible });
      await refresh();
      setSelectedIds(new Set());
    } catch {
      /* MutationMessage에서 오류를 표시한다. */
    }
  };
  const bulkDelete = async () => {
    if (!(await confirmDialog(`선택한 ${selectedIds.size}건을 삭제할까요?`, { confirmLabel: "삭제", tone: "danger" }))) return;
    if (demoMode) {
      setDemoItems((current) => current.filter((item) => !selectedIds.has(item.id)));
      setSelectedIds(new Set());
      return;
    }
    try {
      await deleteMutation.mutateAsync(Array.from(selectedIds));
      await refresh();
      setSelectedIds(new Set());
    } catch {
      /* MutationMessage에서 오류를 표시한다. */
    }
  };

  return (
    <section className="content-admin-section">
      <SectionTitle
        title="공지 팝업"
        description="운영 웹사이트 접속 시 모달로 보여줄 공지입니다. 노출 상태가 노출인 항목이 위에, 같은 상태에서는 최근에 올린 항목이 위에 표시됩니다."
        action={<Button onClick={() => setEditing("new")}>팝업 추가</Button>}
      />
      <MutationMessage error={visibilityMutation.error ?? deleteMutation.error} />
      <BulkActionBar
        selectedCount={selectedIds.size}
        emptyHint="공지 팝업을 숨기거나 삭제하려면 원하는 팝업을 선택해 주세요."
      >
        {canShow ? (
          <Button
            disabled={visibilityMutation.isPending}
            size="sm"
            variant="ghost"
            onClick={() => void setVisibility(true)}
          >
            선택 노출
          </Button>
        ) : null}
        {canHide ? (
          <Button
            disabled={visibilityMutation.isPending}
            size="sm"
            variant="ghost"
            onClick={() => void setVisibility(false)}
          >
            선택 숨김
          </Button>
        ) : null}
        <Button
          disabled={deleteMutation.isPending}
          size="sm"
          variant="danger"
          onClick={() => void bulkDelete()}
        >
          선택 삭제
        </Button>
      </BulkActionBar>
      <TableShell
        isLoading={!demoMode && query.isPending}
        error={demoMode ? null : query.error}
        isEmpty={!items.length}
        emptyMessage="등록된 공지 팝업이 없습니다."
      >
        <table>
          <thead>
            <tr>
              <th aria-label="선택">
                <input
                  aria-label="전체 선택"
                  checked={items.length > 0 && items.every((item) => selectedIds.has(item.id))}
                  className="content-admin-row-checkbox"
                  type="checkbox"
                  onChange={(event) =>
                    setSelectedIds(
                      event.target.checked ? new Set(items.map((item) => item.id)) : new Set(),
                    )
                  }
                />
              </th>
              <ThumbHeader />
              <th>제목</th>
              <th>노출 상태</th>
              <th>보여줄 기간</th>
              <th>업로드 일시</th>
              <th>작성자</th>
              <th aria-label="작업" />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <input
                    aria-label={`${item.title} 선택`}
                    checked={selectedIds.has(item.id)}
                    className="content-admin-row-checkbox"
                    type="checkbox"
                    onChange={(event) => toggleSelected(item.id, event.target.checked)}
                  />
                </td>
                <ThumbCell url={item.imageUrl} />
                <td>
                  <button
                    className="content-admin-table-title-button"
                    type="button"
                    onClick={() => setEditing(item)}
                  >
                    <div className="content-admin-table-title">
                      <strong>{item.title}</strong>
                    </div>
                  </button>
                </td>
                <td>
                  <Badge tone={item.isVisible ? "success" : "warning"}>
                    {item.isVisible ? "노출" : "숨김"}
                  </Badge>
                </td>
                <td>
                  {item.startsOn} ~ {item.endsOn}
                </td>
                <td>{formatAuditTime(item.createdAt) ?? "-"}</td>
                <td className="content-admin-author">{lastEditorLogin(item) ?? "-"}</td>
                <td>
                  <div className="content-admin-table-actions">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(item)}>
                      수정
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>
      {demoMode ? <DemoNotice /> : null}
    </section>
  );
}

