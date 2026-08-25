import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  adminResourceDetailQueryOptions,
  adminResourcesQueryOptions,
  resourceQueryKeys,
  type AdminResourceListItem,
} from "@entities/resource";
import {
  createResourceMutationOptions,
  deleteResourceMutationOptions,
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
  EDIT_STATUS_OPTIONS,
  formatDateTime,
  PAGE_SIZE,
  STATUS_OPTIONS,
  toDateTimeLocal,
  toIsoOrNull,
  useDebouncedValue,
} from "../model/adminContent";
import {
  Checkbox,
  EditorCard,
  Field,
  FileUpload,
  FilterBar,
  FormActions,
  MutationMessage,
  NativeSelect,
  Pager,
  SectionTabs,
  SectionTitle,
  StatusBadge,
  TableShell,
  Textarea,
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
  const [summary, setSummary] = useState("");
  const [referenceYear, setReferenceYear] = useState("");
  const [status, setStatus] = useState<ContentStatus>("draft");
  const [publishedAt, setPublishedAt] = useState("");
  const [files, setFiles] = useState<SelectedResourceFile[]>([]);

  useEffect(() => {
    const item = detailQuery.data;
    if (!item) return;
    setTitle(item.title);
    setSummary(item.summary);
    setReferenceYear(item.referenceYear ? String(item.referenceYear) : "");
    setStatus(item.status);
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
    const input = {
      category,
      title,
      summary,
      referenceYear: referenceYear ? Number(referenceYear) : null,
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
      <Field label="요약" wide>
        <Textarea
          maxLength={500}
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
        />
      </Field>
      <Field label="기준연도">
        <input
          className="content-admin-native-input"
          max={2100}
          min={1900}
          placeholder="예: 2026"
          type="number"
          value={referenceYear}
          onChange={(event) => setReferenceYear(event.target.value)}
        />
      </Field>
      <Field label="게시 상태" required>
        <NativeSelect
          value={status}
          onChange={(event) => setStatus(event.target.value as ContentStatus)}
        >
          {EDIT_STATUS_OPTIONS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </NativeSelect>
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
          {files.map((entry) => (
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
          ))}
        </div>
      </Field>
      <MutationMessage error={mutation.error} />
      <FormActions isPending={mutation.isPending} onCancel={onClose} />
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
  const [year, setYear] = useState("");
  const referenceYear = /^\d{4}$/.test(year) ? Number(year) : undefined;
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const query = useQuery(
    adminResourcesQueryOptions({
      page,
      pageSize: PAGE_SIZE,
      category,
      q: q || undefined,
      status: status ? (status as ContentStatus) : undefined,
      referenceYear,
    }),
  );
  const deleteMutation = useMutation(deleteResourceMutationOptions());
  const remove = async (item: AdminResourceListItem) => {
    if (!window.confirm(`'${item.title}' 자료를 삭제할까요?`)) return;
    try {
      await deleteMutation.mutateAsync(item.id);
      await queryClient.invalidateQueries({ queryKey: resourceQueryKeys.all });
    } catch {
      /* 표시 */
    }
  };
  if (editorOpen)
    return (
      <ResourceEditor
        category={category}
        editingId={editingId}
        onClose={() => {
          setEditorOpen(false);
          setEditingId(null);
        }}
      />
    );
  return (
    <section className="content-admin-section">
      <SectionTitle
        title="자료실 · 결산/공시"
        description="자료 유형과 기준연도, 다운로드 파일을 관리합니다."
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
          placeholder="제목 또는 요약 검색"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        <Input
          aria-label="기준연도"
          max={2100}
          min={1900}
          placeholder="기준연도"
          type="number"
          value={year}
          onChange={(event) => {
            setYear(event.target.value);
            setPage(1);
          }}
        />
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
      </FilterBar>
      <MutationMessage error={deleteMutation.error} />
      <TableShell
        isLoading={query.isPending}
        error={query.error}
        isEmpty={!query.data?.items.length}
        emptyMessage="등록된 자료가 없습니다."
      >
        <table>
          <thead>
            <tr>
              <th>제목</th>
              <th>기준연도</th>
              <th>파일</th>
              <th>상태</th>
              <th>게시일</th>
              <th aria-label="작업" />
            </tr>
          </thead>
          <tbody>
            {query.data?.items.map((item) => (
              <tr key={item.id}>
                <td>
                  <div className="content-admin-table-title">
                    <strong>{item.title}</strong>
                    <span>{item.summary || "요약 없음"}</span>
                  </div>
                </td>
                <td>{item.referenceYear ?? "-"}</td>
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
                    <Button
                      size="sm"
                      variant="text"
                      onClick={() => void remove(item)}
                    >
                      삭제
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
