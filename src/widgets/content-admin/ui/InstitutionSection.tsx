import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  adminInstitutionsQueryOptions,
  institutionQueryKeys,
  type InstitutionDto,
} from "@entities/institution";
import {
  bulkDeleteInstitutionsMutationOptions,
  bulkHideInstitutionsMutationOptions,
  bulkShowInstitutionsMutationOptions,
  createInstitutionMutationOptions,
  swapInstitutionOrderMutationOptions,
  updateInstitutionMutationOptions,
} from "@features/institution-manage";
import { Badge, Button, Input, Notice } from "@shared/ui";

import { useDebouncedValue } from "../model/adminContent";
import {
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
  TableShell,
} from "./AdminCommon";

const pageSize = 100;
type InstitutionType = "member" | "partner";

type FormState = {
  institutionType: InstitutionType;
  name: string;
  logoFileId: string | null;
  logoUrl: string | null;
};
const emptyForm: FormState = {
  institutionType: "member",
  name: "",
  logoFileId: null,
  logoUrl: null,
};

const demoInstitutions: InstitutionDto[] = [
  {
    id: "demo-finance-1",
    institutionType: "member",
    name: "KB국민은행",
    logo: null,
    displayOrder: 0,
    isActive: true,
    createdAt: "demo",
    updatedAt: "demo",
  },
  {
    id: "demo-finance-2",
    institutionType: "member",
    name: "두나무",
    logo: null,
    displayOrder: 1,
    isActive: true,
    createdAt: "demo",
    updatedAt: "demo",
  },
  {
    id: "demo-finance-3",
    institutionType: "member",
    name: "신한은행",
    logo: null,
    displayOrder: 2,
    isActive: true,
    createdAt: "demo",
    updatedAt: "demo",
  },
  {
    id: "demo-public-1",
    institutionType: "partner",
    name: "LG CNS",
    logo: null,
    displayOrder: 0,
    isActive: true,
    createdAt: "demo",
    updatedAt: "demo",
  },
  {
    id: "demo-public-2",
    institutionType: "partner",
    name: "국세청",
    logo: null,
    displayOrder: 1,
    isActive: true,
    createdAt: "demo",
    updatedAt: "demo",
  },
  {
    id: "demo-public-3",
    institutionType: "partner",
    name: "대한민국 국방부",
    logo: null,
    displayOrder: 2,
    isActive: true,
    createdAt: "demo",
    updatedAt: "demo",
  },
];

function InstitutionEditor({
  item,
  defaultInstitutionType,
  onClose,
}: {
  item: InstitutionDto | null;
  defaultInstitutionType: InstitutionType;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const createMutation = useMutation(createInstitutionMutationOptions());
  const updateMutation = useMutation(updateInstitutionMutationOptions());
  const [form, setForm] = useState<FormState>(emptyForm);
  const mutation = item ? updateMutation : createMutation;

  useEffect(() => {
    setForm(
      item
        ? {
            institutionType: item.institutionType,
            name: item.name,
            logoFileId: item.logo?.id ?? null,
            logoUrl: item.logo?.url ?? null,
          }
        : { ...emptyForm, institutionType: defaultInstitutionType },
    );
  }, [defaultInstitutionType, item]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.logoFileId) return;
    const input = {
      institutionType: form.institutionType,
      name: form.name,
      logoFileId: form.logoFileId,
    };
    try {
      if (item) await updateMutation.mutateAsync({ id: item.id, ...input });
      else await createMutation.mutateAsync(input);
      await queryClient.invalidateQueries({
        queryKey: institutionQueryKeys.all,
      });
      onClose();
    } catch {
      /* mutation 상태로 표시 */
    }
  };

  return (
    <EditorCard
      title={item ? "기관 로고 수정" : "기관 로고 등록"}
      description="홈페이지 신뢰 네트워크에 노출할 로고를 관리합니다."
      onSubmit={(event) => void submit(event)}
    >
      <Field label="노출 줄" required>
        <NativeSelect
          value={form.institutionType}
          onChange={(event) =>
            setForm({
              ...form,
              institutionType: event.target.value as InstitutionType,
            })
          }
        >
          <option value="member">금융기관 · 첫째 줄</option>
          <option value="partner">공공기관/기타 · 둘째 줄</option>
        </NativeSelect>
      </Field>
      <Field label="기관명" required>
        <input
          required
          className="content-admin-native-input"
          maxLength={200}
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
        />
      </Field>
      <Field
        label="기관 로고"
        wide
        required
        hint="이미지 파일만 업로드할 수 있습니다."
      >
        <div className="content-admin-inline">
          {form.logoUrl ? (
            <img
              alt="현재 기관 로고"
              className="content-admin-image-thumb"
              src={form.logoUrl}
            />
          ) : null}
          <FileUpload
            accept="image/*"
            fileKind="image"
            label="로고 업로드"
            onUploaded={(files) =>
              setForm({
                ...form,
                logoFileId: files[0]?.id ?? null,
                logoUrl: files[0]?.url ?? null,
              })
            }
          />
          {form.logoFileId ? (
            <Button
              size="sm"
              type="button"
              variant="text"
              onClick={() =>
                setForm({ ...form, logoFileId: null, logoUrl: null })
              }
            >
              로고 제거
            </Button>
          ) : null}
        </div>
      </Field>
      {!form.logoFileId ? (
        <p className="content-admin-field-hint">로고 이미지를 등록해주세요.</p>
      ) : null}
      <MutationMessage error={mutation.error} />
      <FormActions isPending={mutation.isPending} onCancel={onClose} />
    </EditorCard>
  );
}

function InstitutionLogo({ item }: { item: InstitutionDto }) {
  if (item.logo) {
    return (
      <img
        alt={`${item.name} 로고`}
        className="content-admin-logo-thumb"
        src={item.logo.url}
      />
    );
  }

  return (
    <span
      aria-label={`${item.name} 로고 이미지 없음`}
      className="content-admin-logo-thumb content-admin-logo-placeholder"
    >
      이미지 없음
    </span>
  );
}

export function InstitutionSection({
  initialTab = "member",
  onEditorOpenChange,
  onTabChange,
}: {
  initialTab?: InstitutionType;
  onEditorOpenChange?: (isOpen: boolean) => void;
  onTabChange?: (tab: InstitutionType) => void;
}) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<InstitutionType>(initialTab);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q);
  const [active, setActive] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  useEffect(() => onEditorOpenChange?.(editorOpen), [editorOpen, onEditorOpenChange]);
  const [editing, setEditing] = useState<InstitutionDto | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const institutionsQuery = useQuery(
    adminInstitutionsQueryOptions({
      page,
      pageSize,
      q: debouncedQ || undefined,
      institutionType: tab,
      isActive: active === "" ? undefined : active === "true",
    }),
  );
  const demoMode = Boolean(institutionsQuery.error);
  const sourceItems = demoMode
    ? demoInstitutions
    : (institutionsQuery.data?.items ?? []);
  const items = sourceItems.filter(
    (item) =>
      item.institutionType === tab &&
      (active === "" || String(item.isActive) === active) &&
      (!debouncedQ ||
        item.name.toLocaleLowerCase().includes(debouncedQ.toLocaleLowerCase())),
  );
  const orderMutation = useMutation(swapInstitutionOrderMutationOptions());
  const hideMutation = useMutation(bulkHideInstitutionsMutationOptions());
  const showMutation = useMutation(bulkShowInstitutionsMutationOptions());
  const deleteMutation = useMutation(bulkDeleteInstitutionsMutationOptions());

  useEffect(() => setSelectedIds(new Set()), [tab, page, debouncedQ, active]);

  const selectedItems = items.filter((item) => selectedIds.has(item.id));
  const canShow = selectedItems.some((item) => !item.isActive);
  const canHide = selectedItems.some((item) => item.isActive);
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: institutionQueryKeys.all });
  const toggleSelected = (id: string, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };
  const bulkHide = async () => {
    if (!window.confirm(`선택한 ${selectedIds.size}건을 숨길까요?`)) return;
    try {
      await hideMutation.mutateAsync(Array.from(selectedIds));
      await invalidate();
      setSelectedIds(new Set());
    } catch {
      /* 표시 */
    }
  };
  const bulkShow = async () => {
    try {
      await showMutation.mutateAsync(Array.from(selectedIds));
      await invalidate();
      setSelectedIds(new Set());
    } catch {
      /* 표시 */
    }
  };
  const bulkDelete = async () => {
    if (!window.confirm(`선택한 ${selectedIds.size}건을 삭제할까요?`)) return;
    try {
      await deleteMutation.mutateAsync(Array.from(selectedIds));
      await invalidate();
      setSelectedIds(new Set());
    } catch {
      /* 표시 */
    }
  };
  const moveInstitution = async (item: InstitutionDto, direction: -1 | 1) => {
    const index = items.findIndex((candidate) => candidate.id === item.id);
    const target = items[index + direction];
    if (!target) return;
    try {
      await orderMutation.mutateAsync({
        first: { id: item.id, displayOrder: item.displayOrder },
        second: { id: target.id, displayOrder: target.displayOrder },
      });
      await invalidate();
    } catch {
      /* 표시 */
    }
  };

  if (editorOpen) {
    return (
      <InstitutionEditor
        item={editing}
        defaultInstitutionType={tab}
        onClose={() => {
          setEditorOpen(false);
          setEditing(null);
        }}
      />
    );
  }

  return (
    <section className="content-admin-section">
      <SectionTitle
        title="기관 로고"
        description={`${tab === "member" ? "첫째" : "둘째"} 줄에 표시할 홈페이지 기관 로고를 관리합니다.`}
        action={
          <Button disabled={demoMode} onClick={() => setEditorOpen(true)}>
            로고 등록
          </Button>
        }
      />
      <SectionTabs
        value={tab}
        items={[
          { value: "member", label: "금융기관 · 첫째 줄" },
          { value: "partner", label: "공공기관/기타 · 둘째 줄" },
        ]}
        onChange={(value) => {
          setTab(value as InstitutionType);
          onTabChange?.(value as InstitutionType);
          setPage(1);
        }}
      />
      <FilterBar>
        <Input
          aria-label="기관 검색"
          placeholder="기관명 검색"
          value={q}
          onChange={(event) => {
            setQ(event.target.value);
            setPage(1);
          }}
        />
        <div className="content-admin-filter-extra">
          <NativeSelect
            aria-label="노출 상태"
            value={active}
            onChange={(event) => {
              setActive(event.target.value);
              setPage(1);
            }}
          >
            <option value="">전체 상태</option>
            <option value="true">노출</option>
            <option value="false">숨김</option>
          </NativeSelect>
        </div>
      </FilterBar>
      {demoMode ? (
        <Notice tone="warning" title="데모 데이터 표시 중">
          Supabase API에 연결할 수 없어 임시 기관 목록을 표시합니다. 로고 등록과
          수정은 DB 연결 후 사용할 수 있습니다.
        </Notice>
      ) : null}
      <MutationMessage
        error={
          hideMutation.error ??
          showMutation.error ??
          deleteMutation.error ??
          orderMutation.error
        }
      />
      <TableShell
        isLoading={institutionsQuery.isPending}
        error={demoMode ? null : institutionsQuery.error}
        isEmpty={!items.length}
        emptyMessage="등록된 기관 로고가 없습니다."
      >
        <table>
          <thead>
            <tr>
              <th aria-label="선택">
                <input
                  aria-label="전체 선택"
                  checked={
                    items.length > 0 && selectedIds.size === items.length
                  }
                  className="content-admin-row-checkbox"
                  type="checkbox"
                  onChange={(event) =>
                    setSelectedIds(
                      event.target.checked
                        ? new Set(items.map((item) => item.id))
                        : new Set(),
                    )
                  }
                />
              </th>
              <th>기관 로고</th>
              <th>노출 상태</th>
              <th>순서</th>
              <th aria-label="작업" />
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={item.id}>
                <td>
                  <input
                    aria-label={`${item.name} 선택`}
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
                      if (demoMode) return;
                      setEditing(item);
                      setEditorOpen(true);
                    }}
                  >
                    <InstitutionLogo item={item} />
                    <div className="content-admin-table-title">
                      <strong>{item.name}</strong>
                    </div>
                  </button>
                </td>
                <td>
                  <Badge tone={item.isActive ? "success" : "warning"}>
                    {item.isActive ? "노출" : "숨김"}
                  </Badge>
                </td>
                <td>
                  <div className="content-admin-inline">
                    <span>{item.displayOrder}</span>
                    <Button
                      disabled={
                        demoMode || index === 0 || orderMutation.isPending
                      }
                      size="sm"
                      variant="ghost"
                      onClick={() => void moveInstitution(item, -1)}
                    >
                      ▲
                    </Button>
                    <Button
                      disabled={
                        demoMode ||
                        index === items.length - 1 ||
                        orderMutation.isPending
                      }
                      size="sm"
                      variant="ghost"
                      onClick={() => void moveInstitution(item, 1)}
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
                      disabled={demoMode}
                      onClick={() => {
                        setEditing(item);
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
        total={demoMode ? items.length : (institutionsQuery.data?.total ?? 0)}
        totalPages={demoMode ? 1 : (institutionsQuery.data?.totalPages ?? 0)}
        onChange={setPage}
      />
      {selectedIds.size ? (
        <div className="content-admin-bulk-actions">
          <span>{selectedIds.size}건 선택됨</span>
          {canShow ? (
            <Button
              size="sm"
              variant="secondary"
              disabled={demoMode}
              onClick={() => void bulkShow()}
            >
              노출
            </Button>
          ) : null}
          {canHide ? (
            <Button
              size="sm"
              variant="secondary"
              disabled={demoMode}
              onClick={() => void bulkHide()}
            >
              숨김
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="text"
            disabled={demoMode}
            onClick={() => void bulkDelete()}
          >
            삭제
          </Button>
        </div>
      ) : null}
    </section>
  );
}
