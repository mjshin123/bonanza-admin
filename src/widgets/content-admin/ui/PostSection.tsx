import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { adminInstitutionsQueryOptions } from "@entities/institution";
import {
  adminPostDetailQueryOptions,
  adminPostsQueryOptions,
  contentPostQueryKeys,
  hasMeaningfulPostContent,
  sanitizePostContent,
  type PostFileDto,
} from "@entities/post";
import { PostContentEditor } from "@features/post-content-editor";
import {
  bulkDeleteContentPostsMutationOptions,
  bulkHideContentPostsMutationOptions,
  createContentPostMutationOptions,
  updateContentPostMutationOptions,
} from "@features/post-manage";
import type { ContentStatus, FileDto, PostCategory } from "@shared/api/content";
import { Button, Input } from "@shared/ui";

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
} from "./AdminCommon";

const EMPTY_ID = "00000000-0000-4000-8000-000000000000";
const CATEGORIES: Array<{ value: PostCategory; label: string }> = [
  { value: "notice", label: "공지사항" },
  { value: "association_news", label: "협회소식" },
  { value: "member_news", label: "회원기관 소식" },
];

type SelectedPostFile = {
  file: FileDto;
  showInGallery: boolean;
};
type PostFormState = {
  title: string;
  content: string;
  institutionId: string;
  isPinned: boolean;
  publishedAt: string;
};

function PostEditor({
  category,
  editingId,
  onClose,
}: {
  category: PostCategory;
  editingId: string | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const detailQuery = useQuery({
    ...adminPostDetailQueryOptions(editingId ?? EMPTY_ID),
    enabled: Boolean(editingId),
  });
  const createMutation = useMutation(createContentPostMutationOptions());
  const updateMutation = useMutation(updateContentPostMutationOptions());
  const mutation = editingId ? updateMutation : createMutation;
  const [institutionSearch, setInstitutionSearch] = useState("");
  const debouncedInstitutionSearch = useDebouncedValue(institutionSearch);
  const institutionsQuery = useQuery({
    ...adminInstitutionsQueryOptions({
      pageSize: 50,
      q: debouncedInstitutionSearch || undefined,
      isActive: true,
    }),
    enabled: category === "member_news",
  });
  const [form, setForm] = useState<PostFormState>({
    title: "",
    content: "",
    institutionId: "",
    isPinned: false,
    publishedAt: toDateTimeLocal(new Date().toISOString()),
  });
  const [files, setFiles] = useState<SelectedPostFile[]>([]);
  const [contentError, setContentError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    const item = detailQuery.data;
    if (!item) return;
    setForm({
      title: item.title,
      content: item.content,
      institutionId: item.institution?.id ?? "",
      isPinned: item.isPinned,
      publishedAt: toDateTimeLocal(item.publishedAt),
    });
    setFiles(
      item.files.map((entry: PostFileDto) => ({
        file: entry.file,
        showInGallery: entry.showInGallery,
      })),
    );
  }, [detailQuery.data]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (submittingRef.current) return;

    if (!hasMeaningfulPostContent(form.content)) {
      setContentError("본문을 입력해주세요.");
      return;
    }

    setContentError(null);
    submittingRef.current = true;
    const submitter = (event.nativeEvent as SubmitEvent).submitter as
      | HTMLButtonElement
      | null;
    const status = (submitter?.value as ContentStatus | undefined) ?? "draft";
    const input = {
      category,
      title: form.title,
      content: sanitizePostContent(form.content),
      institutionId: category === "member_news" ? form.institutionId : null,
      status,
      isPinned: form.isPinned,
      publishedAt: toIsoOrNull(form.publishedAt),
      files: files.map((entry, index) => ({
        fileId: entry.file.id,
        role: index === 0 ? ("cover" as const) : ("content" as const),
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
      await queryClient.invalidateQueries({
        queryKey: contentPostQueryKeys.all,
      });
      onClose();
    } catch {
      /* mutation 상태로 표시 */
    } finally {
      submittingRef.current = false;
    }
  };

  if (editingId && detailQuery.isPending)
    return (
      <TableShell isLoading error={null} isEmpty={false} emptyMessage="">
        {null}
      </TableShell>
    );
  if (detailQuery.error) return <MutationMessage error={detailQuery.error} />;
  const categoryLabel =
    CATEGORIES.find((item) => item.value === category)?.label ?? "게시물";
  return (
    <EditorCard
      title={editingId ? `${categoryLabel} 수정` : `${categoryLabel} 등록`}
      description="내용 이미지와 대표 이미지를 함께 저장하고, 사진별로 포토 갤러리 노출 여부를 지정합니다."
      onSubmit={(event) => void submit(event)}
    >
      <Field label="제목" required wide>
        <input
          required
          className="content-admin-native-input"
          maxLength={200}
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
        />
      </Field>
      {category === "member_news" ? (
        <>
          <Field label="회원기관 검색">
            <input
              className="content-admin-native-input"
              placeholder="기관명 검색"
              value={institutionSearch}
              onChange={(event) => setInstitutionSearch(event.target.value)}
            />
          </Field>
          <Field label="활동 주체" required>
            <NativeSelect
              required
              value={form.institutionId}
              onChange={(event) =>
                setForm({ ...form, institutionId: event.target.value })
              }
            >
              <option value="">기관 선택</option>
              {institutionsQuery.data?.items.map((institution) => (
                <option key={institution.id} value={institution.id}>
                  {institution.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </>
      ) : null}
      <Field
        label="게시 일시"
        hint="임시저장은 이 일시를 그대로 저장하고, 게시는 공개 상태로 전환합니다. 미래 일시로 게시하면 예약 발행됩니다."
      >
        <input
          className="content-admin-native-input"
          type="datetime-local"
          value={form.publishedAt}
          onChange={(event) =>
            setForm({ ...form, publishedAt: event.target.value })
          }
        />
      </Field>
      <Field label="상단 고정">
        <Checkbox
          checked={form.isPinned}
          label="목록 상단에 고정"
          onChange={(isPinned) => setForm({ ...form, isPinned })}
        />
      </Field>
      <Field
        label="내용 이미지"
        wide
        hint="첫 번째 이미지가 대표 이미지로 사용됩니다. 갤러리 체크는 해당 사진만 홈페이지 포토 갤러리에 노출합니다."
      >
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
        <div className="content-admin-file-list">
          {files.map((entry, index) => (
            <div className="content-admin-file-row" key={entry.file.id}>
              <img
                alt=""
                className="content-admin-image-thumb"
                src={entry.file.url}
              />
              <div>
                <strong>{entry.file.originalName}</strong>
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
      <div className="content-admin-field is-wide">
        <PostContentEditor
          currentThumbnailPath={null}
          enableImages={false}
          error={contentError ?? undefined}
          label="본문"
          value={form.content}
          onChange={(content) => {
            setContentError(null);
            setForm((current) => ({ ...current, content }));
          }}
          onStateChange={() => {}}
        />
      </div>
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

export function PostSection() {
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<PostCategory>("notice");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const q = useDebouncedValue(search);
  const [status, setStatus] = useState("");
  const [publishedFrom, setPublishedFrom] = useState("");
  const [publishedTo, setPublishedTo] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const closeEditor = useBackNavCloses(editorOpen, () => {
    setEditorOpen(false);
    setEditingId(null);
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const query = useQuery(
    adminPostsQueryOptions({
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
  const hideMutation = useMutation(bulkHideContentPostsMutationOptions());
  const bulkDeleteMutation = useMutation(bulkDeleteContentPostsMutationOptions());
  const bulkHide = async () => {
    if (!window.confirm(`선택한 ${selectedIds.size}건을 숨길까요?`)) return;
    try {
      await hideMutation.mutateAsync(Array.from(selectedIds));
      await queryClient.invalidateQueries({
        queryKey: contentPostQueryKeys.all,
      });
      setSelectedIds(new Set());
    } catch {
      /* 표시 */
    }
  };
  const bulkDelete = async () => {
    if (!window.confirm(`선택한 ${selectedIds.size}건을 삭제할까요?`)) return;
    try {
      await bulkDeleteMutation.mutateAsync(Array.from(selectedIds));
      await queryClient.invalidateQueries({
        queryKey: contentPostQueryKeys.all,
      });
      setSelectedIds(new Set());
    } catch {
      /* 표시 */
    }
  };
  if (editorOpen)
    return (
      <PostEditor
        category={category}
        editingId={editingId}
        onClose={closeEditor}
      />
    );
  return (
    <section className="content-admin-section">
      <SectionTitle
        title="공지 · 협회소식 · 회원기관 소식"
        description="소식 유형별 게시물과 활동 주체, 대표 이미지를 관리합니다."
        action={
          <Button onClick={() => setEditorOpen(true)}>게시물 등록</Button>
        }
      />
      <SectionTabs
        value={category}
        items={CATEGORIES}
        onChange={(value) => {
          setCategory(value as PostCategory);
          setPage(1);
        }}
      />
      <FilterBar>
        <Input
          aria-label="게시물 검색"
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
        emptyMessage="등록된 게시물이 없습니다."
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
              <th>활동 주체</th>
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
                      <strong>
                        {item.isPinned ? "[고정] " : ""}
                        {item.title}
                      </strong>
                    </div>
                  </button>
                </td>
                <td>{item.institution?.name ?? "협회"}</td>
                <td>
                  <StatusBadge
                    status={item.status}
                    publishedAt={item.publishedAt}
                  />
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
