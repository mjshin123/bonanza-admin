import { Fragment, useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  adminHistoryEntriesQueryOptions,
  historyEntryQueryKeys,
  parseHistoryContent,
  validateHistoryContent,
  type HistoryEntryDto,
} from "@entities/history-entry";
import {
  createHistoryEntryMutationOptions,
  deleteHistoryEntryMutationOptions,
  moveHistoryEntryMutationOptions,
  updateHistoryEntryMutationOptions,
} from "@features/history-entry-manage";
import { Button, Input } from "@shared/ui";

import { PAGE_SIZE, useBackNavCloses } from "../model/adminContent";
import {
  Checkbox,
  EditorCard,
  Field,
  FilterBar,
  FormActions,
  MutationMessage,
  NativeSelect,
  Pager,
  SectionTitle,
  TableShell,
  Textarea,
} from "./AdminCommon";

function HistoryEntryText({ content }: { content: string }) {
  return parseHistoryContent(content).map((part, index) =>
    part.emphasized ? (
      <strong key={`${index}-${part.text}`}>{part.text}</strong>
    ) : (
      <Fragment key={`${index}-${part.text}`}>{part.text}</Fragment>
    ),
  );
}

function HistoryEditor({
  item,
  defaultYear,
  onClose,
}: {
  item: HistoryEntryDto | null;
  defaultYear: number;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const createMutation = useMutation(createHistoryEntryMutationOptions());
  const updateMutation = useMutation(updateHistoryEntryMutationOptions());
  const [year, setYear] = useState(String(defaultYear));
  const [content, setContent] = useState("");
  const [isVisible, setIsVisible] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const mutation = item ? updateMutation : createMutation;
  const contentError = content ? validateHistoryContent(content) : null;

  useEffect(() => {
    setYear(String(item?.year ?? defaultYear));
    setContent(item?.content ?? "");
    setIsVisible(item?.isVisible ?? true);
    setFormError(null);
  }, [defaultYear, item]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedYear = Number(year);
    const validationError = validateHistoryContent(content);
    if (
      !Number.isInteger(normalizedYear) ||
      normalizedYear < 1900 ||
      normalizedYear > 2999
    ) {
      setFormError("연도는 1900 이상 2999 이하로 입력해주세요.");
      return;
    }
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setFormError(null);
    try {
      if (item) {
        await updateMutation.mutateAsync({
          id: item.id,
          expectedUpdatedAt: item.updatedAt,
          year: normalizedYear,
          content,
          isVisible,
        });
      } else {
        await createMutation.mutateAsync({
          year: normalizedYear,
          content,
          isVisible,
        });
      }
      await queryClient.invalidateQueries({
        queryKey: historyEntryQueryKeys.all,
      });
      onClose();
    } catch {
      /* mutation 상태로 표시 */
    }
  };

  return (
    <EditorCard
      title={item ? "연혁 수정" : "연혁 등록"}
      description="연도를 변경하면 해당 연도의 마지막 순서로 자동 이동합니다."
      onSubmit={(event) => void submit(event)}
    >
      <Field label="연도" required>
        <input
          required
          className="content-admin-native-input"
          max={2999}
          min={1900}
          type="number"
          value={year}
          onChange={(event) => setYear(event.target.value)}
        />
      </Field>
      <Field label="노출 상태">
        <Checkbox
          checked={isVisible}
          label="홈페이지에 노출"
          onChange={setIsVisible}
        />
      </Field>
      <Field
        label="내용"
        required
        wide
        hint="굵게 표시할 문구는 **문구**처럼 입력합니다."
      >
        <Textarea
          maxLength={500}
          placeholder="예: 재정경제부 **공익법인 지정** (3월)"
          rows={5}
          value={content}
          onChange={(event) => {
            setContent(event.target.value);
            setFormError(null);
          }}
        />
        {contentError ? (
          <span className="content-admin-field-error" role="alert">
            {contentError}
          </span>
        ) : null}
      </Field>
      <Field label="미리보기" wide>
        <div className="content-admin-history-preview">
          {content && !contentError ? (
            <HistoryEntryText content={content} />
          ) : (
            <span>연혁 내용이 여기에 표시됩니다.</span>
          )}
        </div>
      </Field>
      {formError ? (
        <span className="content-admin-form-error" role="alert">
          {formError}
        </span>
      ) : null}
      <MutationMessage error={mutation.error} />
      <FormActions isPending={mutation.isPending} onCancel={onClose} />
    </EditorCard>
  );
}

export function HistorySection() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [yearFilter, setYearFilter] = useState("");
  const [visibility, setVisibility] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<HistoryEntryDto | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const filteredYear = /^\d{4}$/.test(yearFilter)
    ? Number(yearFilter)
    : undefined;
  const entriesQuery = useQuery(
    adminHistoryEntriesQueryOptions({
      page,
      pageSize: PAGE_SIZE,
      year: filteredYear,
      isVisible: visibility === "" ? undefined : visibility === "visible",
    }),
  );
  const updateMutation = useMutation(updateHistoryEntryMutationOptions());
  const deleteMutation = useMutation(deleteHistoryEntryMutationOptions());
  const moveMutation = useMutation(moveHistoryEntryMutationOptions());
  const items = entriesQuery.data?.items ?? [];
  const groups = items.reduce<
    Array<{ year: number; items: HistoryEntryDto[] }>
  >((result, item) => {
    const last = result.at(-1);
    if (last?.year === item.year) last.items.push(item);
    else result.push({ year: item.year, items: [item] });
    return result;
  }, []);
  const closeEditor = useBackNavCloses(editorOpen, () => {
    setEditorOpen(false);
    setEditing(null);
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: historyEntryQueryKeys.all });

  const toggleVisible = async (item: HistoryEntryDto) => {
    setSuccess(null);
    try {
      await updateMutation.mutateAsync({
        id: item.id,
        expectedUpdatedAt: item.updatedAt,
        year: item.year,
        content: item.content,
        isVisible: !item.isVisible,
      });
      await invalidate();
      setSuccess(
        item.isVisible ? "연혁을 숨겼습니다." : "연혁을 노출했습니다.",
      );
    } catch {
      /* mutation 상태로 표시 */
    }
  };

  const remove = async (item: HistoryEntryDto) => {
    if (!window.confirm(`'${item.content}' 연혁을 삭제할까요?`)) return;
    setSuccess(null);
    try {
      await deleteMutation.mutateAsync(item.id);
      if (items.length === 1 && page > 1) setPage(page - 1);
      await invalidate();
      setSuccess("연혁을 삭제했습니다.");
    } catch {
      /* mutation 상태로 표시 */
    }
  };

  const move = async (item: HistoryEntryDto, direction: -1 | 1) => {
    setSuccess(null);
    try {
      await moveMutation.mutateAsync({ id: item.id, direction });
      await invalidate();
    } catch {
      /* mutation 상태로 표시 */
    }
  };

  if (editorOpen) {
    return (
      <HistoryEditor
        item={editing}
        defaultYear={items[0]?.year ?? new Date().getFullYear()}
        onClose={closeEditor}
      />
    );
  }

  const mutationError =
    updateMutation.error ?? deleteMutation.error ?? moveMutation.error;

  return (
    <section className="content-admin-section">
      <SectionTitle
        title="연혁 관리"
        description="협회 연혁의 내용, 홈페이지 노출 상태와 연도별 순서를 관리합니다."
        action={
          <Button
            onClick={() => {
              setEditing(null);
              setEditorOpen(true);
            }}
          >
            연혁 등록
          </Button>
        }
      />
      <FilterBar>
        <Input
          aria-label="연도 필터"
          max={2999}
          min={1900}
          placeholder="연도 전체"
          type="number"
          value={yearFilter}
          onChange={(event) => {
            setYearFilter(event.target.value);
            setPage(1);
          }}
        />
        <div className="content-admin-filter-extra">
          <NativeSelect
            aria-label="노출 상태"
            value={visibility}
            onChange={(event) => {
              setVisibility(event.target.value);
              setPage(1);
            }}
          >
            <option value="">전체 상태</option>
            <option value="visible">노출</option>
            <option value="hidden">숨김</option>
          </NativeSelect>
        </div>
      </FilterBar>
      <MutationMessage error={mutationError} success={success} />
      <TableShell
        isLoading={entriesQuery.isPending}
        error={entriesQuery.error}
        isEmpty={items.length === 0}
        emptyMessage="등록된 연혁이 없습니다."
      >
        <table>
          <thead>
            <tr>
              <th>내용</th>
              <th>노출</th>
              <th>순서</th>
              <th aria-label="작업" />
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <Fragment key={group.year}>
                <tr className="content-admin-group-row">
                  <td colSpan={4}>{group.year}</td>
                </tr>
                {group.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <span className="content-admin-history-content">
                        <HistoryEntryText content={item.content} />
                      </span>
                    </td>
                    <td>{item.isVisible ? "노출" : "숨김"}</td>
                    <td>
                      <div className="content-admin-inline">
                        <Button
                          aria-label={`'${item.content}' 순서를 위로 이동`}
                          disabled={
                            item.position === 0 || moveMutation.isPending
                          }
                          size="sm"
                          variant="ghost"
                          onClick={() => void move(item, -1)}
                        >
                          ▲
                        </Button>
                        <Button
                          aria-label={`'${item.content}' 순서를 아래로 이동`}
                          disabled={moveMutation.isPending}
                          size="sm"
                          variant="ghost"
                          onClick={() => void move(item, 1)}
                        >
                          ▼
                        </Button>
                      </div>
                    </td>
                    <td>
                      <div className="content-admin-table-actions">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditing(item);
                            setEditorOpen(true);
                          }}
                        >
                          수정
                        </Button>
                        <Button
                          disabled={updateMutation.isPending}
                          size="sm"
                          variant="ghost"
                          onClick={() => void toggleVisible(item)}
                        >
                          {item.isVisible ? "숨김" : "노출"}
                        </Button>
                        <Button
                          disabled={deleteMutation.isPending}
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
              </Fragment>
            ))}
          </tbody>
        </table>
      </TableShell>
      <Pager
        page={page}
        total={entriesQuery.data?.total ?? 0}
        totalPages={entriesQuery.data?.totalPages ?? 0}
        onChange={setPage}
      />
    </section>
  );
}
