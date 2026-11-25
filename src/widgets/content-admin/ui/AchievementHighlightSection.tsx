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
  setAchievementHighlightsVisibilityMutationOptions,
} from "@features/achievement-highlight-manage";
import { isDemoMode as isGlobalDemoMode } from "@shared/api/content";
import { lastEditorLogin, useOrderDraft, type ImageCrop } from "@shared/lib";
import { Badge, BulkActionBar, Button, ImageCropper, OrderSaveBar, alertDialog, confirmDialog } from "@shared/ui";

import { Checkbox, DemoNotice, EditorCard, Field, FileUpload, MutationMessage, PageGuide, SectionTitle, TableShell, Textarea, ThumbCell, ThumbHeader } from "./AdminCommon";

const demoHighlights: AchievementHighlightDto[] = [
  {
    id: "demo-highlight-1",
    title: "원화 입출금 검증 시장 점유율 업계 1위",
    content:
      "TranSafer를 통해 원화 입출금 검증 시장에서 업계 선도 성과를 이어가고 있습니다.",
    occurredOn: "2026-10-01",
    imageFileId: null,
    imageUrl: "/demo/test-image-1.jpg",
    imageCrop: { x: 0, y: 0.12, width: 1, height: 0.35 },
    isVisible: true,
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
    imageUrl: "/demo/test-image-3.jpg",
    isVisible: true,
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
    imageUrl: "/demo/test-image-2.png",
    imageCrop: { x: 0.1, y: 0, width: 0.802, height: 1 },
    isVisible: true,
    position: 2,
    updatedAt: "2026-11-10T04:30:00.000Z",
    createdAt: "2026-10-10T04:30:00.000Z",
    createdByLogin: "admin",
    updatedByLogin: "mjshin",
  },
];

const MAX_VISIBLE = 10;

function HighlightEditor({
  item,
  visibleCount,
  demoMode = false,
  onClose,
}: {
  item: AchievementHighlightDto | null;
  visibleCount: number;
  demoMode?: boolean;
  onClose: () => void;
}) {
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
  const [imageCrop, setImageCrop] = useState<ImageCrop | null>(
    item?.imageCrop ?? null,
  );
  const visibleLimitReached = !item?.isVisible && visibleCount >= MAX_VISIBLE;
  const [isVisible, setVisible] = useState(
    item ? item.isVisible : visibleCount < MAX_VISIBLE,
  );

  useEffect(() => {
    setTitle(item?.title ?? "");
    setContent(item?.content ?? "");
    setOccurredOn(item?.occurredOn ?? new Date().toISOString().slice(0, 10));
    setImageFileId(item?.imageFileId ?? null);
    setImageUrl(item?.imageUrl ?? null);
    setImageCrop(item?.imageCrop ?? null);
    setVisible(item ? item.isVisible : visibleCount < MAX_VISIBLE);
  }, [item, visibleCount]);

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
        imageCrop,
        isVisible,
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
    <section className="content-admin-section">
      <EditorCard
        audit={item}
        title={item ? "주요 성과 수정" : "주요 성과 추가"}
        description="제목, 내용, 이미지와 일자를 입력합니다."
        onSubmit={(event) => void submit(event)}
      >
        <Field label="제목" required>
          <input
            required
            className="content-admin-native-input"
            maxLength={160}
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
          <Field label="일자" required>
            <input
              required
              className="content-admin-native-input"
              type="date"
              value={occurredOn}
              onChange={(event) => setOccurredOn(event.target.value)}
            />
          </Field>
          <Field
            label="노출 여부"
            hint={`노출은 최대 ${MAX_VISIBLE}개까지 가능합니다. 숨김 항목은 개수 제한 없이 등록할 수 있습니다.`}
          >
            <Checkbox
              checked={isVisible}
              disabled={visibleLimitReached}
              label="웹사이트에 노출"
              onChange={setVisible}
            />
          </Field>
          <Field label="이미지" wide hint="선택 사항입니다.">
            <div className="history-v2-image">
              {imageUrl ? (
                <ImageCropper
                  src={imageUrl}
                  value={imageCrop}
                  onChange={setImageCrop}
                />
              ) : null}
              <FileUpload
                accept="image/*"
                fileKind="image"
                label={imageUrl ? "이미지 변경" : "이미지 첨부"}
                onUploaded={(files) => {
                  const file = files[0];
                  if (file) {
                    setImageFileId(file.id);
                    setImageUrl(file.url);
                    setImageCrop(null);
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
                    setImageCrop(null);
                  }}
                >
                  이미지 제거
                </Button>
              ) : null}
            </div>
          </Field>
        </div>
        <MutationMessage error={saveMutation.error} />
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

export function AchievementHighlightSection({
  onOrderDirtyChange,
}: {
  onOrderDirtyChange?: (isDirty: boolean) => void;
} = {}) {
  const queryClient = useQueryClient();
  const query = useQuery(achievementHighlightsQueryOptions());
  const moveMutation = useMutation(moveAchievementHighlightMutationOptions());
  const visibilityMutation = useMutation(
    setAchievementHighlightsVisibilityMutationOptions(),
  );
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
  const visibleCount = highlights.filter((x) => x.isVisible).length;
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
        visibleCount={visibleCount}
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
  const selectedItems = highlights.filter((item) => selectedIds.has(item.id));
  const hiddenSelected = selectedItems.filter((item) => !item.isVisible);
  const canHide = selectedItems.some((item) => item.isVisible);
  const canShow = hiddenSelected.length > 0;
  const setVisibility = async (isVisible: boolean) => {
    const targets = selectedItems.filter((item) => item.isVisible !== isVisible);
    if (isVisible && visibleCount + targets.length > MAX_VISIBLE) {
      void alertDialog(`노출은 최대 ${MAX_VISIBLE}개까지 가능합니다. 현재 ${visibleCount}개가 노출 중입니다.`);
      return;
    }
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
      order.reset();
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
      <PageGuide>주요 성과 영역에는 노출 항목이 최대 10개까지 표시됩니다. 숨김 항목은 개수 제한 없이 등록할 수 있습니다.</PageGuide>
      <SectionTitle
        title="주요 성과"
        description="연혁과 별도로 주요 성과를 게시합니다."
        action={
          <Button onClick={() => setEditing("new")}>
            성과 추가 (노출 {visibleCount}/{MAX_VISIBLE})
          </Button>
        }
      />
      <MutationMessage error={moveMutation.error ?? visibilityMutation.error ?? deleteMutation.error} />
      <OrderSaveBar
        isDirty={order.isDirty}
        isPending={isSavingOrder}
        onSave={() => void saveOrder()}
        onCancel={order.reset}
      />
      <BulkActionBar
        selectedCount={selectedIds.size}
        emptyHint="성과를 숨기거나 삭제하려면 원하는 성과를 선택해 주세요."
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
        isEmpty={!highlights.length}
        emptyMessage="등록된 주요 성과가 없습니다."
      >
        <table>
          <thead>
            <tr>
              <th aria-label="선택">
                <input
                  aria-label="전체 선택"
                  checked={highlights.length > 0 && highlights.every((x) => selectedIds.has(x.id))}
                  className="content-admin-row-checkbox"
                  type="checkbox"
                  onChange={(event) =>
                    setSelectedIds(event.target.checked ? new Set(highlights.map((x) => x.id)) : new Set())
                  }
                />
              </th>
              <ThumbHeader />
              <th>제목</th>
              <th>노출 상태</th>
              <th>일자</th>
              <th>순서</th>
              <th>작성자</th>
              <th aria-label="작업" />
            </tr>
          </thead>
          <tbody>
            {highlights.map((item, index) => (
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
                <ThumbCell crop={item.imageCrop} url={item.imageUrl} />
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
                <td>{item.occurredOn}</td>
                <td>
                  <div className="content-admin-inline">
                    <span>{index + 1}</span>
                    <Button
                      aria-label="위로 이동"
                      disabled={index === 0 || isSavingOrder}
                      size="sm"
                      variant="ghost"
                      onClick={() => order.move(item.id, -1)}
                    >
                      ▲
                    </Button>
                    <Button
                      aria-label="아래로 이동"
                      disabled={index === highlights.length - 1 || isSavingOrder}
                      size="sm"
                      variant="ghost"
                      onClick={() => order.move(item.id, 1)}
                    >
                      ▼
                    </Button>
                  </div>
                </td>
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
