import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  achievementHighlightQueryKeys,
  achievementHighlightsQueryOptions,
  type AchievementHighlightDto,
} from "@entities/achievement-highlight";
import {
  deleteAchievementHighlightMutationOptions,
  moveAchievementHighlightMutationOptions,
  saveAchievementHighlightMutationOptions,
} from "@features/achievement-highlight-manage";
import { isDemoMode as isGlobalDemoMode } from "@shared/api/content";
import { lastEditorLogin, useEditorDirtyTracker, useOrderDraft } from "@shared/lib";
import { BulkActionBar, Button, OrderSaveBar, alertDialog, confirmDialog } from "@shared/ui";

import { AuditInfo, FileUpload, MutationMessage, SectionTitle, Textarea, DemoNotice } from "./AdminCommon";

const demoHighlights: AchievementHighlightDto[] = [
  {
    id: "demo-highlight-1",
    title: "원화 입출금 검증 시장 점유율 업계 1위",
    content:
      "TranSafer를 통해 원화 입출금 검증 시장에서 업계 선도 성과를 이어가고 있습니다.",
    occurredOn: "2026-10-01",
    imageFileId: null,
    imageUrl: null,
    position: 0,
    updatedAt: "2026-11-08T04:30:00.000Z",
    createdAt: "2026-10-08T04:30:00.000Z",
    createdByLogin: "admin",
    updatedByLogin: "admin",
  },
  {
    id: "demo-highlight-2",
    title: "자체 구축 소버린 KYT 솔루션",
    content:
      "위험 주소 데이터 수집부터 분석 기술까지 자체 구축한 KYT 검증 역량을 제공합니다.",
    occurredOn: "2026-10-01",
    imageFileId: null,
    imageUrl: null,
    position: 1,
    updatedAt: "2026-11-09T04:30:00.000Z",
    createdAt: "2026-10-09T04:30:00.000Z",
    createdByLogin: "mjshin",
    updatedByLogin: "admin",
  },
  {
    id: "demo-highlight-3",
    title: "수사기관-거래소 공조 네트워크",
    content:
      "TranSight의 공조 요청 중계 기능으로 수사기관과 거래소의 응답 시간을 단축합니다.",
    occurredOn: "2026-10-01",
    imageFileId: null,
    imageUrl: null,
    position: 2,
    updatedAt: "2026-11-10T04:30:00.000Z",
    createdAt: "2026-10-10T04:30:00.000Z",
    createdByLogin: "admin",
    updatedByLogin: "mjshin",
  },
];

function HighlightEditor({
  item,
  demoMode = false,
  onClose,
}: {
  item: AchievementHighlightDto | null;
  demoMode?: boolean;
  onClose: () => void;
}) {
  const markDirty = useEditorDirtyTracker();
  const queryClient = useQueryClient();
  const saveMutation = useMutation(saveAchievementHighlightMutationOptions());
  const [title, setTitle] = useState(item?.title ?? "");
  const [content, setContent] = useState(item?.content ?? "");
  const [occurredOn, setOccurredOn] = useState(
    item?.occurredOn ?? new Date().toISOString().slice(0, 10),
  );
  const [imageFileId, setImageFileId] = useState<string | null>(
    item?.imageFileId ?? null,
  );
  const [imageUrl, setImageUrl] = useState(item?.imageUrl ?? null);

  useEffect(() => {
    setTitle(item?.title ?? "");
    setContent(item?.content ?? "");
    setOccurredOn(item?.occurredOn ?? new Date().toISOString().slice(0, 10));
    setImageFileId(item?.imageFileId ?? null);
    setImageUrl(item?.imageUrl ?? null);
  }, [item]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (demoMode) {
      void alertDialog("데모 데이터는 저장되지 않습니다. 화면 확인용으로만 열람할 수 있습니다.");
      return;
    }
    try {
      await saveMutation.mutateAsync({
        id: item?.id,
        expectedUpdatedAt: item?.updatedAt,
        title,
        content,
        occurredOn,
        imageFileId,
      });
      await queryClient.invalidateQueries({
        queryKey: achievementHighlightQueryKeys.all,
      });
      onClose();
    } catch {
      /* MutationMessage에서 오류를 표시한다. */
    }
  };

  return (
    <section className="content-admin-section achievement-highlight-editor">
      <SectionTitle
        title={item ? "주요 성과 수정" : "주요 성과 추가"}
        description="제목, 내용, 이미지와 일자를 입력합니다."
      />
      <form
        className="achievement-highlight-form"
        onChange={markDirty}
        onInput={markDirty}
        onSubmit={(event) => void submit(event)}
      >
        <label>
          제목
          <input
            required
            maxLength={160}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label>
          일자
          <input
            required
            type="date"
            value={occurredOn}
            onChange={(event) => setOccurredOn(event.target.value)}
          />
        </label>
        <label className="is-wide">
          내용
          <Textarea
            required
            maxLength={2000}
            rows={8}
            value={content}
            onChange={(event) => setContent(event.target.value)}
          />
        </label>
        <div className="is-wide achievement-highlight-image-field">
          <strong>이미지 첨부</strong>
          {imageUrl ? (
            <img src={imageUrl} alt="첨부 미리보기" />
          ) : (
            <p>첨부된 이미지가 없습니다.</p>
          )}
          <FileUpload
            accept="image/*"
            fileKind="image"
            label="이미지 업로드"
            onUploaded={(files) => {
              const file = files[0];
              if (file) {
                setImageFileId(file.id);
                setImageUrl(file.url);
              }
            }}
          />
          {imageFileId ? (
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
        <AuditInfo audit={item} />
        <MutationMessage error={saveMutation.error} />
        <div className="content-admin-form-actions">
          <Button type="button" variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button disabled={saveMutation.isPending} type="submit">
            {saveMutation.isPending ? "저장 중…" : "저장"}
          </Button>
        </div>
      </form>
    </section>
  );
}

export function AchievementHighlightSection({
  onOrderDirtyChange,
}: {
  onOrderDirtyChange?: (isDirty: boolean) => void;
} = {}) {
  const queryClient = useQueryClient();
  const query = useQuery(achievementHighlightsQueryOptions());
  const moveMutation = useMutation(moveAchievementHighlightMutationOptions());
  const deleteMutation = useMutation(
    deleteAchievementHighlightMutationOptions(),
  );
  const [editing, setEditing] = useState<
    AchievementHighlightDto | null | "new"
  >(null);
  const [demoItems, setDemoItems] = useState(demoHighlights);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSavingOrder, setSavingOrder] = useState(false);
  const demoMode = isGlobalDemoMode || Boolean(query.error);
  const serverHighlights = query.data ?? (demoMode ? demoItems : []);
  const order = useOrderDraft(serverHighlights);
  const highlights = order.items;
  useEffect(() => {
    onOrderDirtyChange?.(order.isDirty);
    return () => onOrderDirtyChange?.(false);
  }, [order.isDirty, onOrderDirtyChange]);
  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: achievementHighlightQueryKeys.all,
    });

  if (editing)
    return (
      <HighlightEditor
        item={editing === "new" ? null : editing}
        demoMode={demoMode}
        onClose={() => setEditing(null)}
      />
    );

  const toggleSelected = (id: string, checked: boolean) =>
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  const saveOrder = async () => {
    setSavingOrder(true);
    try {
      if (demoMode) {
        setDemoItems(order.items);
      } else {
        for (const { id, direction } of order.moves)
          await moveMutation.mutateAsync({ id, direction });
        await refresh();
      }
      order.reset();
    } catch {
      /* MutationMessage에서 오류를 표시한다. */
    } finally {
      setSavingOrder(false);
    }
  };
  const bulkDelete = async () => {
    if (!(await confirmDialog(`선택한 ${selectedIds.size}건을 삭제할까요?`, { confirmLabel: "삭제", tone: "danger" }))) return;
    if (demoMode) {
      setDemoItems((current) =>
        current.filter((item) => !selectedIds.has(item.id)),
      );
      setSelectedIds(new Set());
      order.reset();
      return;
    }
    try {
      for (const id of selectedIds) await deleteMutation.mutateAsync(id);
      await refresh();
      setSelectedIds(new Set());
      order.reset();
    } catch {
      /* MutationMessage에서 오류를 표시한다. */
    }
  };

  return (
    <section className="content-admin-section">
      <SectionTitle
        title="주요 성과 레이어"
        description="웹사이트 주요 성과 페이지에 노출되는 항목입니다. 최대 10개까지 관리할 수 있습니다."
        action={
          <Button
            disabled={highlights.length >= 10}
            onClick={() => setEditing("new")}
          >
            성과 추가 ({highlights.length}/10)
          </Button>
        }
      />
      <MutationMessage error={moveMutation.error ?? deleteMutation.error} />
      <OrderSaveBar
        isDirty={order.isDirty}
        isPending={isSavingOrder}
        onSave={() => void saveOrder()}
        onCancel={order.reset}
      />
      <BulkActionBar
        selectedCount={selectedIds.size}
        emptyHint="성과를 삭제하려면 원하는 성과를 선택해 주세요."
      >
        <Button
          disabled={deleteMutation.isPending}
          size="sm"
          variant="danger"
          onClick={() => void bulkDelete()}
        >
          선택 삭제
        </Button>
      </BulkActionBar>
      {query.isPending && !demoMode ? <p>주요 성과를 불러오는 중입니다.</p> : null}
      <div className="achievement-highlight-list">
        {highlights.map((item, index) => (
          <article key={item.id} className="achievement-highlight-item">
            <input
              aria-label={`${item.title} 선택`}
              checked={selectedIds.has(item.id)}
              className="content-admin-row-checkbox"
              type="checkbox"
              onChange={(event) => toggleSelected(item.id, event.target.checked)}
            />
            <span>{index + 1}</span>
            <div>
              {item.imageUrl ? <img src={item.imageUrl} alt="" /> : null}
              <strong>{item.title}</strong>
              <p>{item.occurredOn}</p>
              <p>{item.content}</p>
              <p className="content-admin-author">작성자 {lastEditorLogin(item) ?? "-"}</p>
            </div>
            <div>
              <Button
                aria-label="위로 이동"
                disabled={index === 0 || isSavingOrder}
                size="sm"
                variant="ghost"
                onClick={() => order.move(item.id, -1)}
              >
                위
              </Button>
              <Button
                aria-label="아래로 이동"
                disabled={index === highlights.length - 1 || isSavingOrder}
                size="sm"
                variant="ghost"
                onClick={() => order.move(item.id, 1)}
              >
                아래
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditing(item)}
              >
                수정
              </Button>
            </div>
          </article>
        ))}
      </div>
      {demoMode ? <DemoNotice /> : null}
    </section>
  );
}
