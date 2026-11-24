import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { hasMeaningfulPostContent, sanitizePostContent } from "@entities/post";
import {
  adminSeminarDetailQueryOptions,
  adminSeminarsQueryOptions,
  seminarQueryKeys,
  type SeminarFileDto,
} from "@entities/seminar";
import {
  bulkDeleteSeminarsMutationOptions,
  bulkHideSeminarsMutationOptions,
  bulkPublishSeminarsMutationOptions,
  createSeminarMutationOptions,
  updateSeminarMutationOptions,
} from "@features/seminar-manage";
import type { ContentStatus, FileDto, SeminarTiming } from "@shared/api/content";
import { BulkActionBar, Button, Input, confirmDialog } from "@shared/ui";

import {
  endOfDayIso,
  formatDateTime,
  PAGE_SIZE,
  startOfDayIso,
  STATUS_OPTIONS,
  toDateTimeLocal,
  toIsoOrNull,
  useBackNavCloses,
  useDebouncedValue,
} from "../model/adminContent";
import {
  Checkbox,
  EditorCard,
  Field,
  FileUpload,
  FilterBar,
  MutationMessage,
  NativeSelect,
  Pager,
  SectionTabs,
  SectionTitle,
  StatusBadge,
  TableShell,
  Textarea,
} from "./AdminCommon";

const EMPTY_ID = "00000000-0000-4000-8000-000000000000";
type SelectedSeminarImage = { file: FileDto; showInGallery: boolean };
type SeminarForm = {
  title: string;
  introduction: string;
  content: string;
  startsAt: string;
  endsAt: string;
  location: string;
  applicationUrl: string;
  publishedAt: string;
  isFeatured: boolean;
};
const EMPTY_FORM: SeminarForm = {
  title: "",
  introduction: "",
  content: "",
  startsAt: "",
  endsAt: "",
  location: "",
  applicationUrl: "",
  publishedAt: "",
  isFeatured: false,
};

function SeminarEditor({
  editingId,
  onClose,
}: {
  editingId: string | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const detailQuery = useQuery({
    ...adminSeminarDetailQueryOptions(editingId ?? EMPTY_ID),
    enabled: Boolean(editingId),
  });
  const createMutation = useMutation(createSeminarMutationOptions());
  const updateMutation = useMutation(updateSeminarMutationOptions());
  const mutation = editingId ? updateMutation : createMutation;
  const [form, setForm] = useState<SeminarForm>(EMPTY_FORM);
  const [images, setImages] = useState<SelectedSeminarImage[]>([]);
  const [isRange, setIsRange] = useState(false);

  useEffect(() => {
    const item = detailQuery.data;
    if (!item) return;
    setForm({
      title: item.title,
      introduction: item.introduction,
      content: item.content ?? "",
      startsAt: toDateTimeLocal(item.startsAt),
      endsAt: toDateTimeLocal(item.endsAt),
      location: item.location ?? "",
      applicationUrl: item.applicationUrl ?? "",
      publishedAt: toDateTimeLocal(item.publishedAt),
      isFeatured: item.isFeatured,
    });
    setIsRange(Boolean(item.endsAt));
    setImages(
      item.images.map((entry: SeminarFileDto) => ({
        file: entry.file,
        showInGallery: entry.showInGallery,
      })),
    );
  }, [detailQuery.data]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as
      | HTMLButtonElement
      | null;
    const status = (submitter?.value as ContentStatus | undefined) ?? "draft";
    const input = {
      title: form.title,
      introduction: form.introduction,
      content: hasMeaningfulPostContent(form.content)
        ? sanitizePostContent(form.content)
        : null,
      startsAt: new Date(form.startsAt).toISOString(),
      endsAt: isRange ? toIsoOrNull(form.endsAt) : null,
      location: form.location.trim() || null,
      applicationUrl: form.applicationUrl || null,
      status,
      publishedAt: toIsoOrNull(form.publishedAt),
      isFeatured: form.isFeatured,
      files: images.map((image) => ({
        fileId: image.file.id,
        showInGallery: image.showInGallery,
      })),
    };
    try {
      if (editingId && detailQuery.data)
        await updateMutation.mutateAsync({
          ...input,
          id: editingId,
          expectedUpdatedAt: detailQuery.data.updatedAt,
        });
      else await createMutation.mutateAsync(input);
      await queryClient.invalidateQueries({ queryKey: seminarQueryKeys.all });
      onClose();
    } catch {
      /* 표시 */
    }
  };
  if (editingId && detailQuery.isPending)
    return (
      <TableShell isLoading error={null} isEmpty={false} emptyMessage="">
        {null}
      </TableShell>
    );
  if (detailQuery.error) return <MutationMessage error={detailQuery.error} />;
  const set = <K extends keyof SeminarForm>(key: K, value: SeminarForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  return (
    <EditorCard
      title={editingId ? "세미나 수정" : "세미나 등록"}
      description="행사 소개와 현장 사진을 노출합니다. 첨부 사진별로 포토 갤러리 노출 여부를 지정합니다."
      onSubmit={(event) => void submit(event)}
    >
      <Field label="세미나명" required>
        <input
          required
          className="content-admin-native-input"
          maxLength={200}
          value={form.title}
          onChange={(event) => set("title", event.target.value)}
        />
      </Field>
      <Field label="예정된 행사">
        <Checkbox
          checked={form.isFeatured}
          label="홈페이지 상단에 예정된 행사로 노출"
          onChange={(isFeatured) => set("isFeatured", isFeatured)}
        />
      </Field>
      <Field label="세미나 소개" wide>
        <Textarea
          value={form.introduction}
          onChange={(event) => set("introduction", event.target.value)}
        />
      </Field>
      {isRange ? (
        <>
          <Field label="개최 시작일시" required>
            <input
              required
              className="content-admin-native-input"
              type="datetime-local"
              value={form.startsAt}
              onChange={(event) => set("startsAt", event.target.value)}
            />
          </Field>
          <Field label="일정">
            <Checkbox
              checked={isRange}
              label="기간으로 등록 (개최 시작일시 · 종료일시)"
              onChange={(checked) => {
                setIsRange(checked);
                if (!checked) set("endsAt", "");
              }}
            />
          </Field>
          <Field label="개최 종료일시">
            <input
              className="content-admin-native-input"
              type="datetime-local"
              value={form.endsAt}
              onChange={(event) => set("endsAt", event.target.value)}
            />
          </Field>
        </>
      ) : (
        <>
          <Field
            label="개최일시"
            required
            hint="세미나가 열리는 날짜와 시간입니다. 미래 일시를 입력해도 게시 시 바로 공개됩니다."
          >
            <input
              required
              className="content-admin-native-input"
              type="datetime-local"
              value={form.startsAt}
              onChange={(event) => set("startsAt", event.target.value)}
            />
          </Field>
          <Field label="일정">
            <Checkbox
              checked={isRange}
              label="기간으로 등록 (개최 시작일시 · 종료일시)"
              onChange={(checked) => {
                setIsRange(checked);
                if (!checked) set("endsAt", "");
              }}
            />
          </Field>
        </>
      )}
      <Field label="장소" wide>
        <input
          className="content-admin-native-input"
          maxLength={300}
          value={form.location}
          onChange={(event) => set("location", event.target.value)}
        />
      </Field>
      <Field
        label="상세/신청 링크"
        hint="입력하면 홈페이지에 버튼으로 노출됩니다."
      >
        <input
          className="content-admin-native-input"
          placeholder="https://"
          type="url"
          value={form.applicationUrl}
          onChange={(event) => set("applicationUrl", event.target.value)}
        />
      </Field>
      <Field
        label="이미지"
        wide
        hint="첫 번째 이미지가 목록의 대표 이미지로 사용됩니다. 체크한 이미지만 홈페이지 포토 갤러리에도 노출됩니다."
      >
        <FileUpload
          accept="image/*"
          fileKind="image"
          label="이미지 추가"
          multiple
          onUploaded={(uploaded) =>
            setImages((current) => [
              ...current,
              ...uploaded.map((file) => ({
                file,
                showInGallery: false,
              })),
            ])
          }
        />
        <div className="content-admin-file-list">
          {images.map((image, index) => (
            <div className="content-admin-file-row" key={image.file.id}>
              <img
                alt=""
                className="content-admin-image-thumb"
                src={image.file.url}
              />
              <div>
                <strong>{image.file.originalName}</strong>
                <Checkbox
                  checked={image.showInGallery}
                  label="홈페이지 포토갤러리에 노출"
                  onChange={(showInGallery) =>
                    setImages((current) =>
                      current.map((candidate) =>
                        candidate.file.id === image.file.id
                          ? { ...candidate, showInGallery }
                          : candidate,
                      ),
                    )
                  }
                />
              </div>
              <div className="content-admin-table-actions">
                <Button
                  disabled={index === 0}
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setImages((current) => {
                      const next = [...current];
                      [next[index - 1], next[index]] = [
                        next[index],
                        next[index - 1],
                      ];
                      return next;
                    })
                  }
                >
                  ▲
                </Button>
                <Button
                  disabled={index === images.length - 1}
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setImages((current) => {
                      const next = [...current];
                      [next[index], next[index + 1]] = [
                        next[index + 1],
                        next[index],
                      ];
                      return next;
                    })
                  }
                >
                  ▼
                </Button>
                <Button
                  size="sm"
                  variant="text"
                  onClick={() =>
                    setImages((current) =>
                      current.filter(
                        (candidate) => candidate.file.id !== image.file.id,
                      ),
                    )
                  }
                >
                  제외
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Field>
      <MutationMessage error={mutation.error} />
      <div className="content-admin-form-actions">
        <Button
          disabled={mutation.isPending}
          type="button"
          variant="ghost"
          onClick={onClose}
        >
          취소
        </Button>
        <Button
          disabled={mutation.isPending}
          name="action"
          type="submit"
          value="draft"
          variant="ghost"
        >
          {mutation.isPending ? "저장 중..." : "임시저장"}
        </Button>
        <Button
          disabled={mutation.isPending}
          name="action"
          type="submit"
          value="published"
        >
          {mutation.isPending ? "저장 중..." : "게시"}
        </Button>
      </div>
    </EditorCard>
  );
}

export function SeminarSection({
  initialEditingId,
  onInitialEditingConsumed,
}: {
  initialEditingId?: string | null;
  onInitialEditingConsumed?: () => void;
} = {}) {
  const queryClient = useQueryClient();
  const [timing, setTiming] = useState<SeminarTiming>("all");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const q = useDebouncedValue(search);
  const [status, setStatus] = useState("");
  const [publishedFrom, setPublishedFrom] = useState("");
  const [publishedTo, setPublishedTo] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const closeEditor = useBackNavCloses(editorOpen, () => {
    setEditorOpen(false);
    setEditingId(null);
  });
  useEffect(() => {
    if (!initialEditingId) return;
    setEditingId(initialEditingId);
    setEditorOpen(true);
    onInitialEditingConsumed?.();
  }, [initialEditingId]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const query = useQuery(
    adminSeminarsQueryOptions({
      page,
      pageSize: PAGE_SIZE,
      q: q || undefined,
      timing,
      status: status ? (status as ContentStatus) : undefined,
      publishedFrom: startOfDayIso(publishedFrom),
      publishedTo: endOfDayIso(publishedTo),
    }),
  );
  const items = query.data?.items ?? [];
  useEffect(() => {
    setSelectedIds(new Set());
  }, [timing, page, q, status, publishedFrom, publishedTo]);
  const canHide = items.some(
    (item) => selectedIds.has(item.id) && item.status !== "hidden",
  );
  const canShow = items.some(
    (item) => selectedIds.has(item.id) && item.status !== "published",
  );
  const toggleSelected = (id: string, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };
  const toggleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(items.map((item) => item.id)) : new Set());
  };
  const hideMutation = useMutation(bulkHideSeminarsMutationOptions());
  const showMutation = useMutation(bulkPublishSeminarsMutationOptions());
  const bulkDeleteMutation = useMutation(bulkDeleteSeminarsMutationOptions());
  const bulkHide = async () => {
    if (!(await confirmDialog(`선택한 ${selectedIds.size}건을 숨길까요?`, { confirmLabel: "숨김" }))) return;
    try {
      await hideMutation.mutateAsync(Array.from(selectedIds));
      await queryClient.invalidateQueries({ queryKey: seminarQueryKeys.all });
      setSelectedIds(new Set());
    } catch {
      /* 표시 */
    }
  };
  const bulkShow = async () => {
    try {
      await showMutation.mutateAsync(Array.from(selectedIds));
      await queryClient.invalidateQueries({ queryKey: seminarQueryKeys.all });
      setSelectedIds(new Set());
    } catch {
      /* 표시 */
    }
  };
  const bulkDelete = async () => {
    if (!(await confirmDialog(`선택한 ${selectedIds.size}건을 삭제할까요?`, { confirmLabel: "삭제", tone: "danger" }))) return;
    try {
      await bulkDeleteMutation.mutateAsync(Array.from(selectedIds));
      await queryClient.invalidateQueries({ queryKey: seminarQueryKeys.all });
      setSelectedIds(new Set());
    } catch {
      /* 표시 */
    }
  };
  if (editorOpen)
    return (
      <SeminarEditor editingId={editingId} onClose={closeEditor} />
    );
  return (
    <section className="content-admin-section">
      <SectionTitle
        title="세미나"
        description="예정·지난 행사 정보와 이미지를 관리합니다."
        action={
          <Button onClick={() => setEditorOpen(true)}>세미나 등록</Button>
        }
      />
      <SectionTabs
        value={timing}
        items={[
          { value: "all", label: "전체" },
          { value: "upcoming", label: "예정 행사" },
          { value: "past", label: "지난 행사" },
        ]}
        onChange={(value) => {
          setTiming(value as SeminarTiming);
          setPage(1);
        }}
      />
      <FilterBar>
        <Input
          aria-label="세미나 검색"
          placeholder="세미나명 또는 장소 검색"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        <div className="content-admin-filter-extra">
          <NativeSelect
            aria-label="게시 상태"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            {STATUS_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </NativeSelect>
          <div className="content-admin-date-range">
            <input
              aria-label="게시일 시작"
              className="content-admin-native-input"
              type="date"
              value={publishedFrom}
              onChange={(event) => {
                setPublishedFrom(event.target.value);
                setPage(1);
              }}
            />
            <span>~</span>
            <input
              aria-label="게시일 종료"
              className="content-admin-native-input"
              type="date"
              value={publishedTo}
              onChange={(event) => {
                setPublishedTo(event.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
      </FilterBar>
      <MutationMessage error={bulkDeleteMutation.error} />
      <MutationMessage error={hideMutation.error} />
      <MutationMessage error={showMutation.error} />
      <BulkActionBar
        selectedCount={selectedIds.size}
        emptyHint="게시글을 숨기거나 삭제하려면 원하는 게시글을 선택해 주세요."
      >
          {canShow ? (
            <Button
              disabled={
                hideMutation.isPending ||
                showMutation.isPending ||
                bulkDeleteMutation.isPending
              }
              size="sm"
              variant="ghost"
              onClick={() => void bulkShow()}
            >
              선택 게시
            </Button>
          ) : null}
          {canHide ? (
            <Button
              disabled={
                hideMutation.isPending ||
                showMutation.isPending ||
                bulkDeleteMutation.isPending
              }
              size="sm"
              variant="ghost"
              onClick={() => void bulkHide()}
            >
              선택 숨김
            </Button>
          ) : null}
          <Button
            disabled={
              hideMutation.isPending ||
              showMutation.isPending ||
              bulkDeleteMutation.isPending
            }
            size="sm"
            variant="danger"
            onClick={() => void bulkDelete()}
          >
            선택 삭제
          </Button>
      </BulkActionBar>
      <TableShell
        isLoading={query.isPending}
        error={query.error}
        isEmpty={!items.length}
        emptyMessage="등록된 세미나가 없습니다."
      >
        <table>
          <thead>
            <tr>
              <th aria-label="선택">
                <input
                  aria-label="전체 선택"
                  checked={items.length > 0 && selectedIds.size === items.length}
                  className="content-admin-row-checkbox"
                  type="checkbox"
                  onChange={(event) => toggleSelectAll(event.target.checked)}
                />
              </th>
              <th>세미나</th>
              <th>개최일시</th>
              <th>장소</th>
              <th>상태</th>
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
                    onChange={(event) =>
                      toggleSelected(item.id, event.target.checked)
                    }
                  />
                </td>
                <td>
                  <button
                    className="content-admin-table-title-button"
                    type="button"
                    onClick={() => {
                      setEditingId(item.id);
                      setEditorOpen(true);
                    }}
                  >
                    {item.poster ? (
                      <img
                        alt=""
                        className="content-admin-image-thumb"
                        src={item.poster.url}
                      />
                    ) : null}
                    <div className="content-admin-table-title">
                      <strong>{item.title}</strong>
                      <span>{item.introduction || "소개 없음"}</span>
                    </div>
                  </button>
                </td>
                <td>{formatDateTime(item.startsAt)}</td>
                <td>{item.location}</td>
                <td>
                  <StatusBadge status={item.status} />
                </td>
                <td>
                  <div className="content-admin-table-actions">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingId(item.id);
                        setEditorOpen(true);
                      }}
                    >
                      수정
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>
      <Pager
        page={page}
        total={query.data?.total ?? 0}
        totalPages={query.data?.totalPages ?? 0}
        onChange={setPage}
      />
    </section>
  );
}
