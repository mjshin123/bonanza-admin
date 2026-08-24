import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  adminSeminarDetailQueryOptions,
  adminSeminarsQueryOptions,
  seminarQueryKeys,
  type AdminSeminarListItem,
  type SeminarFileDto,
} from "@entities/seminar";
import {
  createSeminarMutationOptions,
  deleteSeminarMutationOptions,
  updateSeminarMutationOptions,
} from "@features/seminar-manage";
import type {
  ContentStatus,
  FileDto,
  SelectionMethod,
  SeminarTiming,
} from "@shared/api/content";
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
type SelectedSeminarPhoto = { file: FileDto; showInGallery: boolean };
type SeminarForm = {
  title: string;
  introduction: string;
  resultSummary: string;
  content: string;
  startsAt: string;
  endsAt: string;
  location: string;
  selectionMethod: SelectionMethod;
  selectionMethodDetail: string;
  capacity: string;
  registrationDeadline: string;
  applicationUrl: string;
  status: ContentStatus;
  publishedAt: string;
};
const EMPTY_FORM: SeminarForm = {
  title: "",
  introduction: "",
  resultSummary: "",
  content: "",
  startsAt: "",
  endsAt: "",
  location: "",
  selectionMethod: "first_come",
  selectionMethodDetail: "",
  capacity: "",
  registrationDeadline: "",
  applicationUrl: "",
  status: "draft",
  publishedAt: "",
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
  const [poster, setPoster] = useState<FileDto | null>(null);
  const [photos, setPhotos] = useState<SelectedSeminarPhoto[]>([]);

  useEffect(() => {
    const item = detailQuery.data;
    if (!item) return;
    setForm({
      title: item.title,
      introduction: item.introduction,
      resultSummary: item.resultSummary,
      content: item.content ?? "",
      startsAt: toDateTimeLocal(item.startsAt),
      endsAt: toDateTimeLocal(item.endsAt),
      location: item.location,
      selectionMethod: item.selectionMethod,
      selectionMethodDetail: item.selectionMethodDetail ?? "",
      capacity: item.capacity ? String(item.capacity) : "",
      registrationDeadline: toDateTimeLocal(item.registrationDeadline),
      applicationUrl: item.applicationUrl ?? "",
      status: item.status,
      publishedAt: toDateTimeLocal(item.publishedAt),
    });
    setPoster(item.poster);
    setPhotos(
      item.photos.map((entry: SeminarFileDto) => ({
        file: entry.file,
        showInGallery: entry.showInGallery,
      })),
    );
  }, [detailQuery.data]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input = {
      title: form.title,
      introduction: form.introduction,
      resultSummary: form.resultSummary,
      content: form.content || null,
      startsAt: new Date(form.startsAt).toISOString(),
      endsAt: toIsoOrNull(form.endsAt),
      location: form.location,
      selectionMethod: form.selectionMethod,
      selectionMethodDetail:
        form.selectionMethod === "other" ? form.selectionMethodDetail : null,
      capacity: form.capacity ? Number(form.capacity) : null,
      registrationDeadline: toIsoOrNull(form.registrationDeadline),
      applicationUrl: form.applicationUrl || null,
      status: form.status,
      publishedAt: toIsoOrNull(form.publishedAt),
      files: [
        ...(poster ? [{ fileId: poster.id, role: "poster" as const }] : []),
        ...photos.map((photo) => ({
          fileId: photo.file.id,
          role: "photo" as const,
          showInGallery: photo.showInGallery,
        })),
      ],
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
      description="예정 행사에는 소개를, 종료 행사에는 결과 요약과 현장 사진을 노출합니다. 첨부 사진별로 포토 갤러리 노출 여부를 지정합니다."
      onSubmit={(event) => void submit(event)}
    >
      <Field label="세미나명" required wide>
        <input
          required
          className="content-admin-native-input"
          maxLength={200}
          value={form.title}
          onChange={(event) => set("title", event.target.value)}
        />
      </Field>
      <Field label="세미나 소개" wide>
        <Textarea
          value={form.introduction}
          onChange={(event) => set("introduction", event.target.value)}
        />
      </Field>
      <Field label="지난 행사 요약" wide>
        <Textarea
          value={form.resultSummary}
          onChange={(event) => set("resultSummary", event.target.value)}
        />
      </Field>
      <Field label="시작 일시" required>
        <input
          required
          className="content-admin-native-input"
          type="datetime-local"
          value={form.startsAt}
          onChange={(event) => set("startsAt", event.target.value)}
        />
      </Field>
      <Field label="종료 일시">
        <input
          className="content-admin-native-input"
          type="datetime-local"
          value={form.endsAt}
          onChange={(event) => set("endsAt", event.target.value)}
        />
      </Field>
      <Field label="장소" required wide>
        <input
          required
          className="content-admin-native-input"
          maxLength={300}
          value={form.location}
          onChange={(event) => set("location", event.target.value)}
        />
      </Field>
      <Field label="선발 방식" required>
        <NativeSelect
          value={form.selectionMethod}
          onChange={(event) =>
            set("selectionMethod", event.target.value as SelectionMethod)
          }
        >
          <option value="first_come">선착순</option>
          <option value="lottery">추첨</option>
          <option value="other">기타</option>
        </NativeSelect>
      </Field>
      {form.selectionMethod === "other" ? (
        <Field label="선발 방식 설명" required>
          <input
            required
            className="content-admin-native-input"
            value={form.selectionMethodDetail}
            onChange={(event) =>
              set("selectionMethodDetail", event.target.value)
            }
          />
        </Field>
      ) : null}
      <Field label="선발 인원">
        <input
          className="content-admin-native-input"
          min={1}
          type="number"
          value={form.capacity}
          onChange={(event) => set("capacity", event.target.value)}
        />
      </Field>
      <Field label="접수 마감일">
        <input
          className="content-admin-native-input"
          type="datetime-local"
          value={form.registrationDeadline}
          onChange={(event) => set("registrationDeadline", event.target.value)}
        />
      </Field>
      <Field label="신청 링크">
        <input
          className="content-admin-native-input"
          placeholder="https://"
          type="url"
          value={form.applicationUrl}
          onChange={(event) => set("applicationUrl", event.target.value)}
        />
      </Field>
      <Field label="게시 상태">
        <NativeSelect
          value={form.status}
          onChange={(event) =>
            set("status", event.target.value as ContentStatus)
          }
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
          value={form.publishedAt}
          onChange={(event) => set("publishedAt", event.target.value)}
        />
      </Field>
      <Field label="포스터" wide>
        <div className="content-admin-inline">
          {poster ? (
            <img
              alt="세미나 포스터"
              className="content-admin-image-thumb"
              src={poster.url}
            />
          ) : null}
          <FileUpload
            accept="image/*"
            fileKind="image"
            label="포스터 업로드"
            onUploaded={(uploaded) => setPoster(uploaded[0] ?? null)}
          />
          {poster ? (
            <Button size="sm" variant="text" onClick={() => setPoster(null)}>
              제외
            </Button>
          ) : null}
        </div>
      </Field>
      <Field
        label="종료 후 첨부 사진"
        wide
        hint="사진은 세미나 상세에 표시되며, 체크한 사진만 홈페이지 포토 갤러리에도 노출됩니다."
      >
        <FileUpload
          accept="image/*"
          fileKind="image"
          label="사진 추가"
          multiple
          onUploaded={(uploaded) =>
            setPhotos((current) => [
              ...current,
              ...uploaded.map((file) => ({
                file,
                showInGallery: false,
              })),
            ])
          }
        />
        <div className="content-admin-file-list">
          {photos.map((photo) => (
            <div className="content-admin-file-row" key={photo.file.id}>
              <img
                alt=""
                className="content-admin-image-thumb"
                src={photo.file.url}
              />
              <div>
                <strong>{photo.file.originalName}</strong>
                <span>세미나 사진</span>
                <Checkbox
                  checked={photo.showInGallery}
                  label="포토 갤러리에 노출"
                  onChange={(showInGallery) =>
                    setPhotos((current) =>
                      current.map((candidate) =>
                        candidate.file.id === photo.file.id
                          ? { ...candidate, showInGallery }
                          : candidate,
                      ),
                    )
                  }
                />
              </div>
              <Button
                size="sm"
                variant="text"
                onClick={() =>
                  setPhotos((current) =>
                    current.filter(
                      (candidate) => candidate.file.id !== photo.file.id,
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
      <Field label="상세 내용" wide>
        <Textarea
          className="is-content"
          value={form.content}
          onChange={(event) => set("content", event.target.value)}
        />
      </Field>
      <MutationMessage error={mutation.error} />
      <FormActions isPending={mutation.isPending} onCancel={onClose} />
    </EditorCard>
  );
}

export function SeminarSection() {
  const queryClient = useQueryClient();
  const [timing, setTiming] = useState<SeminarTiming>("all");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const q = useDebouncedValue(search);
  const [status, setStatus] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const query = useQuery(
    adminSeminarsQueryOptions({
      page,
      pageSize: PAGE_SIZE,
      q: q || undefined,
      timing,
      status: status ? (status as ContentStatus) : undefined,
    }),
  );
  const deleteMutation = useMutation(deleteSeminarMutationOptions());
  const remove = async (item: AdminSeminarListItem) => {
    if (!window.confirm(`'${item.title}' 세미나를 삭제할까요?`)) return;
    try {
      await deleteMutation.mutateAsync(item.id);
      await queryClient.invalidateQueries({ queryKey: seminarQueryKeys.all });
    } catch {
      /* 표시 */
    }
  };
  if (editorOpen)
    return (
      <SeminarEditor
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
        title="세미나"
        description="예정·지난 행사 정보와 포스터, 행사 사진을 관리합니다."
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
        emptyMessage="등록된 세미나가 없습니다."
      >
        <table>
          <thead>
            <tr>
              <th>세미나</th>
              <th>일시</th>
              <th>장소</th>
              <th>상태</th>
              <th aria-label="작업" />
            </tr>
          </thead>
          <tbody>
            {query.data?.items.map((item) => (
              <tr key={item.id}>
                <td>
                  <div className="content-admin-inline">
                    {item.poster ? (
                      <img
                        alt=""
                        className="content-admin-image-thumb"
                        src={item.poster.url}
                      />
                    ) : null}
                    <div className="content-admin-table-title">
                      <strong>{item.title}</strong>
                      <span>
                        {item.introduction || item.resultSummary || "소개 없음"}
                      </span>
                    </div>
                  </div>
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
