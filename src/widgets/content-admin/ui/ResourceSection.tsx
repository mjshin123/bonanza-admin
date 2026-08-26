import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  adminResourceDetailQueryOptions,
  adminResourcesQueryOptions,
  resourceQueryKeys,
} from "@entities/resource";
import {
  bulkDeleteResourcesMutationOptions,
  bulkHideResourcesMutationOptions,
  createResourceMutationOptions,
  updateResourceMutationOptions,
} from "@features/resource-manage";
import type {
  ContentStatus,
  FileDto,
  ResourceCategory,
} from "@shared/api/content";
import { Button, Input } from "@shared/ui";

import {
  bytesLabel,
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
} from "./AdminCommon";

type SelectedResourceFile = {
  file: FileDto;
  showInGallery: boolean;
};

const EMPTY_ID = "00000000-0000-4000-8000-000000000000";
const CATEGORIES: Array<{ value: ResourceCategory; label: string }> = [
  { value: "seminar_material", label: "세미나 자료" },
  { value: "law_policy", label: "법령·정책 자료" },
  { value: "annual_settlement", label: "연간 결산서류" },
  { value: "business_plan_budget", label: "사업계획 및 예산" },
  { value: "donation_usage", label: "기부금 모집·사용 내역" },
  { value: "annual_report", label: "연차보고서" },
];

function ResourceEditor({
  category,
  editingId,
  onClose,
}: {
  category: ResourceCategory;
  editingId: string | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const detailQuery = useQuery({
    ...adminResourceDetailQueryOptions(editingId ?? EMPTY_ID),
    enabled: Boolean(editingId),
  });
  const createMutation = useMutation(createResourceMutationOptions());
  const updateMutation = useMutation(updateResourceMutationOptions());
  const mutation = editingId ? updateMutation : createMutation;
  const [title, setTitle] = useState("");
  const [publishedAt, setPublishedAt] = useState("");
  const [files, setFiles] = useState<SelectedResourceFile[]>([]);

  useEffect(() => {
    const item = detailQuery.data;
    if (!item) return;
    setTitle(item.title);
    setPublishedAt(toDateTimeLocal(item.publishedAt));
    setFiles(
      item.files.map((entry) => ({
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
      category,
      title,
      status,
      publishedAt: toIsoOrNull(publishedAt),
      files: files.map((entry) => ({
        fileId: entry.file.id,
        showInGallery: entry.showInGallery,
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
      await queryClient.invalidateQueries({ queryKey: resourceQueryKeys.all });
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
  const label =
    CATEGORIES.find((item) => item.value === category)?.label ?? "자료";
  return (
    <EditorCard
      title={editingId ? `${label} 수정` : `${label} 등록`}
      description="자료와 함께 파일·사진을 등록하고, 사진별로 포토 갤러리 노출 여부를 정합니다. 게시 상태에는 파일이 한 개 이상 필요합니다."
      onSubmit={(event) => void submit(event)}
    >
      <Field label="제목" required wide>
        <input
          required
          className="content-admin-native-input"
          maxLength={200}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </Field>
      <Field label="게시 일시">
        <input
          className="content-admin-native-input"
          type="datetime-local"
          value={publishedAt}
          onChange={(event) => setPublishedAt(event.target.value)}
        />
      </Field>
      <Field
        label="첨부파일 · 사진"
        required
        wide
        hint="사진으로 추가한 항목에만 포토 갤러리 노출을 설정할 수 있습니다."
      >
        <div className="content-admin-library-upload">
          <FileUpload
            fileKind="attachment"
            label="파일 추가"
            multiple
            onUploaded={(uploaded) =>
              setFiles((current) => [
                ...current,
                ...uploaded.map((file) => ({
                  file,
                  showInGallery: false,
                })),
              ])
            }
          />
          <FileUpload
            accept="image/*"
            fileKind="image"
            label="사진 추가"
            multiple
            onUploaded={(uploaded) =>
              setFiles((current) => [
                ...current,
                ...uploaded.map((file) => ({
                  file,
                  showInGallery: false,
                })),
              ])
            }
          />
        </div>
        <div className="content-admin-file-list">
          {files.map((entry, index) => (
            <div className="content-admin-file-row" key={entry.file.id}>
              {entry.file.fileKind === "image" ? (
                <img
                  alt=""
                  className="content-admin-image-thumb"
                  src={entry.file.url}
                />
              ) : null}
              <div>
                <strong>{entry.file.originalName}</strong>
                <span>
                  {entry.file.mimeType} · {bytesLabel(entry.file.sizeBytes)}
                </span>
                {entry.file.fileKind === "image" ? (
                  <Checkbox
                    checked={entry.showInGallery}
                    label="포토 갤러리에 노출"
                    onChange={(showInGallery) =>
                      setFiles((current) =>
                        current.map((candidate) =>
                          candidate.file.id === entry.file.id
                            ? { ...candidate, showInGallery }
                            : candidate,
                        ),
                      )
                    }
                  />
                ) : null}
              </div>
              <div className="content-admin-table-actions">
                <Button
                  disabled={index === 0}
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setFiles((current) => {
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
                  disabled={index === files.length - 1}
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setFiles((current) => {
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
                    setFiles((current) =>
                      current.filter(
                        (candidate) => candidate.file.id !== entry.file.id,
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

export function ResourceSection() {
  const queryClient = useQueryClient();
  const [category, setCategory] =
    useState<ResourceCategory>("seminar_material");
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const query = useQuery(
    adminResourcesQueryOptions({
      page,
      pageSize: PAGE_SIZE,
      category,
      q: q || undefined,
      status: status ? (status as ContentStatus) : undefined,
      publishedFrom: startOfDayIso(publishedFrom),
      publishedTo: endOfDayIso(publishedTo),
    }),
  );
  const items = query.data?.items ?? [];
  useEffect(() => {
    setSelectedIds(new Set());
  }, [category, page, q, status, publishedFrom, publishedTo]);
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
  const hideMutation = useMutation(bulkHideResourcesMutationOptions());
  const bulkDeleteMutation = useMutation(bulkDeleteResourcesMutationOptions());
  const bulkHide = async () => {
    if (!window.confirm(`선택한 ${selectedIds.size}건을 숨길까요?`)) return;
    try {
      await hideMutation.mutateAsync(Array.from(selectedIds));
      await queryClient.invalidateQueries({ queryKey: resourceQueryKeys.all });
      setSelectedIds(new Set());
    } catch {
      /* 표시 */
    }
  };
  const bulkDelete = async () => {
    if (!window.confirm(`선택한 ${selectedIds.size}건을 삭제할까요?`)) return;
    try {
      await bulkDeleteMutation.mutateAsync(Array.from(selectedIds));
      await queryClient.invalidateQueries({ queryKey: resourceQueryKeys.all });
      setSelectedIds(new Set());
    } catch {
      /* 표시 */
    }
  };
  if (editorOpen)
    return (
      <ResourceEditor
        category={category}
        editingId={editingId}
        onClose={closeEditor}
      />
    );
  return (
    <section className="content-admin-section">
      <SectionTitle
        title="자료실 · 결산/공시"
        description="자료 유형과 다운로드 파일을 관리합니다."
        action={<Button onClick={() => setEditorOpen(true)}>자료 등록</Button>}
      />
      <SectionTabs
        value={category}
        items={CATEGORIES}
        onChange={(value) => {
          setCategory(value as ResourceCategory);
          setPage(1);
        }}
      />
      <FilterBar>
        <Input
          aria-label="자료 검색"
          placeholder="제목 검색"
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
      <TableShell
        isLoading={query.isPending}
        error={query.error}
        isEmpty={!items.length}
        emptyMessage="등록된 자료가 없습니다."
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
              <th>제목</th>
              <th>파일</th>
              <th>상태</th>
              <th>게시일</th>
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
                    <div className="content-admin-table-title">
                      <strong>{item.title}</strong>
                    </div>
                  </button>
                </td>
                <td>{item.fileCount}개</td>
                <td>
                  <StatusBadge status={item.status} />
                </td>
                <td>{formatDateTime(item.publishedAt)}</td>
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
      {selectedIds.size > 0 ? (
        <FilterBar>
          <span className="content-admin-muted">
            {selectedIds.size}건 선택됨
          </span>
          <div className="content-admin-table-actions">
            <Button
              disabled={hideMutation.isPending || bulkDeleteMutation.isPending}
              size="sm"
              variant="ghost"
              onClick={() => void bulkHide()}
            >
              선택 숨김
            </Button>
            <Button
              disabled={hideMutation.isPending || bulkDeleteMutation.isPending}
              size="sm"
              variant="danger"
              onClick={() => void bulkDelete()}
            >
              선택 삭제
            </Button>
          </div>
        </FilterBar>
      ) : null}
      <Pager
        page={page}
        total={query.data?.total ?? 0}
        totalPages={query.data?.totalPages ?? 0}
        onChange={setPage}
      />
    </section>
  );
}
