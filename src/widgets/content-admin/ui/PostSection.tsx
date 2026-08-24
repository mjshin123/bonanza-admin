import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { adminInstitutionsQueryOptions } from "@entities/institution";
import {
  adminPostDetailQueryOptions,
  adminPostsQueryOptions,
  contentPostQueryKeys,
  type AdminContentPostListItem,
  type PostFileDto,
} from "@entities/post";
import {
  createContentPostMutationOptions,
  deleteContentPostMutationOptions,
  updateContentPostMutationOptions,
} from "@features/post-manage";
import type { ContentStatus, FileDto, PostCategory } from "@shared/api/content";
import { Button, Input } from "@shared/ui";

import {
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

const EMPTY_ID = "00000000-0000-4000-8000-000000000000";
const CATEGORIES: Array<{ value: PostCategory; label: string }> = [
  { value: "notice", label: "공지사항" },
  { value: "association_news", label: "협회소식" },
  { value: "member_news", label: "회원기관 소식" },
];

type SelectedPostFile = {
  file: FileDto;
  role: "cover" | "content";
  showInGallery: boolean;
};
type PostFormState = {
  title: string;
  summary: string;
  content: string;
  institutionId: string;
  status: ContentStatus;
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
    summary: "",
    content: "",
    institutionId: "",
    status: "draft",
    isPinned: false,
    publishedAt: "",
  });
  const [files, setFiles] = useState<SelectedPostFile[]>([]);

  useEffect(() => {
    const item = detailQuery.data;
    if (!item) return;
    setForm({
      title: item.title,
      summary: item.summary,
      content: item.content,
      institutionId: item.institution?.id ?? "",
      status: item.status,
      isPinned: item.isPinned,
      publishedAt: toDateTimeLocal(item.publishedAt),
    });
    setFiles(
      item.files.map((entry: PostFileDto) => ({
        file: entry.file,
        role: entry.role,
        showInGallery: entry.showInGallery,
      })),
    );
  }, [detailQuery.data]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input = {
      category,
      title: form.title,
      summary: form.summary,
      content: form.content,
      institutionId: category === "member_news" ? form.institutionId : null,
      status: form.status,
      isPinned: form.isPinned,
      publishedAt: toIsoOrNull(form.publishedAt),
      files: files.map((entry) => ({
        fileId: entry.file.id,
        role: entry.role,
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
      <Field label="요약" wide>
        <Textarea
          maxLength={500}
          value={form.summary}
          onChange={(event) =>
            setForm({ ...form, summary: event.target.value })
          }
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
      <Field label="게시 상태" required>
        <NativeSelect
          value={form.status}
          onChange={(event) =>
            setForm({ ...form, status: event.target.value as ContentStatus })
          }
        >
          {EDIT_STATUS_OPTIONS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field
        label="게시 일시"
        hint="게시 상태에서 비워두면 저장 시점으로 설정됩니다."
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
        hint="대표 이미지는 한 장만 지정할 수 있습니다. 갤러리 체크는 해당 사진만 홈페이지 포토 갤러리에 노출합니다."
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
                role: "content" as const,
                showInGallery: false,
              })),
            ])
          }
        />
        <div className="content-admin-file-list">
          {files.map((entry) => (
            <div className="content-admin-file-row" key={entry.file.id}>
              <img
                alt=""
                className="content-admin-image-thumb"
                src={entry.file.url}
              />
              <div>
                <strong>{entry.file.originalName}</strong>
                <span>
                  {entry.role === "cover" ? "대표 이미지" : "내용 이미지"}
                </span>
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
                {entry.role !== "cover" ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setFiles((current) =>
                        current.map((candidate) => ({
                          ...candidate,
                          role:
                            candidate.file.id === entry.file.id
                              ? "cover"
                              : "content",
                        })),
                      )
                    }
                  >
                    대표 지정
                  </Button>
                ) : null}
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
      <Field
        label="본문"
        required
        wide
        hint="현재 v2 본문은 HTML을 저장합니다."
      >
        <Textarea
          required
          className="is-content"
          value={form.content}
          onChange={(event) =>
            setForm({ ...form, content: event.target.value })
          }
        />
      </Field>
      <MutationMessage error={mutation.error} />
      <FormActions isPending={mutation.isPending} onCancel={onClose} />
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const query = useQuery(
    adminPostsQueryOptions({
      page,
      pageSize: PAGE_SIZE,
      category,
      q: q || undefined,
      status: status ? (status as ContentStatus) : undefined,
    }),
  );
  const deleteMutation = useMutation(deleteContentPostMutationOptions());
  const remove = async (item: AdminContentPostListItem) => {
    if (!window.confirm(`'${item.title}' 게시물을 삭제할까요?`)) return;
    try {
      await deleteMutation.mutateAsync(item.id);
      await queryClient.invalidateQueries({
        queryKey: contentPostQueryKeys.all,
      });
    } catch {
      /* 표시 */
    }
  };
  if (editorOpen)
    return (
      <PostEditor
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
          placeholder="제목 또는 요약 검색"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
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
        emptyMessage="등록된 게시물이 없습니다."
      >
        <table>
          <thead>
            <tr>
              <th>제목</th>
              <th>활동 주체</th>
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
                    <strong>
                      {item.isPinned ? "[고정] " : ""}
                      {item.title}
                    </strong>
                    <span>{item.summary || "요약 없음"}</span>
                  </div>
                </td>
                <td>{item.institution?.name ?? "협회"}</td>
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
