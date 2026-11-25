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
import { isDemoMode as isGlobalDemoMode } from "@shared/api/content";
import { useOrderDraft, lastEditorLogin } from "@shared/lib";
import { Badge, BulkActionBar, Button, Input, OrderSaveBar, confirmDialog, alertDialog } from "@shared/ui";

import { useDebouncedValue } from "../model/adminContent";
import { PageGuide, EditorCard, Field, FileUpload, FilterBar, FormActions, MutationMessage, NativeSelect, Pager, SectionTabs, SectionTitle, TableShell, ThumbCell, ThumbHeader, DemoNotice } from "./AdminCommon";

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
    logo: { id: "demo-file-logo", fileKind: "image", originalName: "logo.svg", mimeType: "image/svg+xml", sizeBytes: 1024, widthPx: 640, heightPx: 400, altText: null, url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='640' height='400'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='#0ea5e9'/%3E%3Cstop offset='1' stop-color='#1d4ed8'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='640' height='400' fill='url(#g)'/%3E%3Ctext x='320' y='215' font-size='56' font-family='sans-serif' font-weight='700' fill='white' text-anchor='middle'%3ELOGO%3C/text%3E%3C/svg%3E", createdAt: "2026-10-10T01:20:00.000Z", updatedAt: "2026-10-10T01:20:00.000Z" },
    displayOrder: 0,
    isActive: true,
    createdAt: "2026-09-05T02:00:00.000Z",
    updatedAt: "2026-11-05T06:10:00.000Z",
    createdByLogin: "admin",
    updatedByLogin: "admin",
  },
  {
    id: "demo-finance-2",
    institutionType: "member",
    name: "두나무",
    logo: null,
    displayOrder: 1,
    isActive: true,
    createdAt: "2026-09-06T02:00:00.000Z",
    updatedAt: "2026-11-06T06:10:00.000Z",
    createdByLogin: "mjshin",
    updatedByLogin: "admin",
  },
  {
    id: "demo-finance-3",
    institutionType: "member",
    name: "신한은행",
    logo: null,
    displayOrder: 2,
    isActive: true,
    createdAt: "2026-09-07T02:00:00.000Z",
    updatedAt: "2026-11-07T06:10:00.000Z",
    createdByLogin: "admin",
    updatedByLogin: "mjshin",
  },
  {
    id: "demo-public-1",
    institutionType: "partner",
    name: "LG CNS",
    logo: null,
    displayOrder: 0,
    isActive: true,
    createdAt: "2026-09-08T02:00:00.000Z",
    updatedAt: "2026-11-08T06:10:00.000Z",
    createdByLogin: "admin",
    updatedByLogin: "mjshin",
  },
  {
    id: "demo-public-2",
    institutionType: "partner",
    name: "국세청",
    logo: null,
    displayOrder: 1,
    isActive: true,
    createdAt: "2026-09-09T02:00:00.000Z",
    updatedAt: "2026-11-09T06:10:00.000Z",
    createdByLogin: "admin",
    updatedByLogin: "admin",
  },
  {
    id: "demo-public-3",
    institutionType: "partner",
    name: "대한민국 국방부",
    logo: null,
    displayOrder: 2,
    isActive: true,
    createdAt: "2026-09-10T02:00:00.000Z",
    updatedAt: "2026-11-10T06:10:00.000Z",
    createdByLogin: "mjshin",
    updatedByLogin: "admin",
  },
];

function InstitutionEditor({
  item,
  defaultInstitutionType,
  demoMode = false,
  onClose,
}: {
  item: InstitutionDto | null;
  demoMode?: boolean;
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
    if (demoMode) {
      void alertDialog("데모 데이터는 저장되지 않습니다. 화면 확인용으로만 열람할 수 있습니다.");
      return;
    }
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
      audit={item}
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

export function InstitutionSection({
  initialTab = "member",
  onEditorOpenChange,
  onTabChange,
  onOrderDirtyChange,
  confirmLeave,
}: {
  initialTab?: InstitutionType;
  onOrderDirtyChange?: (isDirty: boolean) => void;
  confirmLeave?: (action: () => void) => void;
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
  const demoMode = isGlobalDemoMode || Boolean(institutionsQuery.error);
  const [demoItems, setDemoItems] = useState(demoInstitutions);
  const sourceItems = demoMode
    ? demoItems
    : (institutionsQuery.data?.items ?? []);
  const filteredItems = sourceItems.filter(
    (item) =>
      item.institutionType === tab &&
      (active === "" || String(item.isActive) === active) &&
      (!debouncedQ ||
        item.name.toLocaleLowerCase().includes(debouncedQ.toLocaleLowerCase())),
  );
  const order = useOrderDraft(
    demoMode
      ? [...filteredItems].sort((a, b) => a.displayOrder - b.displayOrder)
      : filteredItems,
  );
  const items = order.items;
  useEffect(() => {
    onOrderDirtyChange?.(order.isDirty);
    return () => onOrderDirtyChange?.(false);
  }, [order.isDirty, onOrderDirtyChange]);
  const guard = (action: () => void) => {
    const run = () => {
      order.reset();
      action();
    };
    if (order.isDirty && confirmLeave) confirmLeave(run);
    else run();
  };
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
    if (!(await confirmDialog(`선택한 ${selectedIds.size}건을 숨길까요?`, { confirmLabel: "숨김" }))) return;
    if (demoMode) {
      setDemoItems((current) =>
        current.map((item) =>
          selectedIds.has(item.id) ? { ...item, isActive: false } : item,
        ),
      );
      setSelectedIds(new Set());
      return;
    }
    try {
      await hideMutation.mutateAsync(Array.from(selectedIds));
      await invalidate();
      setSelectedIds(new Set());
    } catch {
      /* 표시 */
    }
  };
  const bulkShow = async () => {
    if (demoMode) {
      setDemoItems((current) =>
        current.map((item) =>
          selectedIds.has(item.id) ? { ...item, isActive: true } : item,
        ),
      );
      setSelectedIds(new Set());
      return;
    }
    try {
      await showMutation.mutateAsync(Array.from(selectedIds));
      await invalidate();
      setSelectedIds(new Set());
    } catch {
      /* 표시 */
    }
  };
  const bulkDelete = async () => {
    if (!(await confirmDialog(`선택한 ${selectedIds.size}건을 삭제할까요?`, { confirmLabel: "삭제", tone: "danger" }))) return;
    if (demoMode) {
      setDemoItems((current) =>
        current.filter((item) => !selectedIds.has(item.id)),
      );
      setSelectedIds(new Set());
      return;
    }
    try {
      await deleteMutation.mutateAsync(Array.from(selectedIds));
      await invalidate();
      setSelectedIds(new Set());
    } catch {
      /* 표시 */
    }
  };
  const saveOrder = async () => {
    const sim = (
      demoMode
        ? [...filteredItems].sort((x, y) => x.displayOrder - y.displayOrder)
        : [...filteredItems]
    ).map((item) => ({ id: item.id, displayOrder: item.displayOrder }));
    try {
      for (const { id, direction } of order.moves) {
        const index = sim.findIndex((candidate) => candidate.id === id);
        const target = index + direction;
        const first = sim[index];
        const second = sim[target];
        if (!first || !second) continue;
        if (!demoMode) {
          await orderMutation.mutateAsync({
            first: { id: first.id, displayOrder: first.displayOrder },
            second: { id: second.id, displayOrder: second.displayOrder },
          });
        }
        [first.displayOrder, second.displayOrder] = [
          second.displayOrder,
          first.displayOrder,
        ];
        [sim[index], sim[target]] = [second, first];
      }
      if (demoMode) {
        const orders = new Map(sim.map((item) => [item.id, item.displayOrder]));
        setDemoItems((current) =>
          current.map((item) => ({
            ...item,
            displayOrder: orders.get(item.id) ?? item.displayOrder,
          })),
        );
      } else {
        await invalidate();
      }
      order.reset();
    } catch {
      /* 표시 */
    }
  };

  if (editorOpen) {
    return (
      <InstitutionEditor
        item={editing}
        demoMode={demoMode}
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
      <PageGuide>
        메인 화면의 신뢰 네트워크 영역에서 좌우로 흐르는 기관 로고 배너에 노출됩니다. 금융기관은 첫째 줄, 공공기관/기타는 둘째 줄입니다.
      </PageGuide>
      <SectionTitle
        title="기관 로고"
        description={`${tab === "member" ? "첫째" : "둘째"} 줄에 표시할 홈페이지 기관 로고를 관리합니다.`}
        action={
          <Button onClick={() => setEditorOpen(true)}>
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
          guard(() => {
            setTab(value as InstitutionType);
            onTabChange?.(value as InstitutionType);
            setPage(1);
          });
        }}
      />
      <FilterBar>
        <Input
          aria-label="기관 검색"
          placeholder="기관명 검색"
          value={q}
          onChange={(event) => {
            const value = event.target.value;
            guard(() => {
              setQ(value);
              setPage(1);
            });
          }}
        />
        <div className="content-admin-filter-extra">
          <NativeSelect
            aria-label="노출 상태"
            value={active}
            onChange={(event) => {
              const value = event.target.value;
              guard(() => {
                setActive(value);
                setPage(1);
              });
            }}
          >
            <option value="">전체 상태</option>
            <option value="true">노출</option>
            <option value="false">숨김</option>
          </NativeSelect>
        </div>
      </FilterBar>
      <MutationMessage
        error={
          hideMutation.error ??
          showMutation.error ??
          deleteMutation.error ??
          orderMutation.error
        }
      />
      <OrderSaveBar
        isDirty={order.isDirty}
        isPending={orderMutation.isPending}
        onSave={() => void saveOrder()}
        onCancel={order.reset}
      />
      <BulkActionBar
        selectedCount={selectedIds.size}
        emptyHint="기관 로고를 숨기거나 삭제하려면 원하는 기관 로고를 선택해 주세요."
      >
        {canShow ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void bulkShow()}
          >
            선택 노출
          </Button>
        ) : null}
        {canHide ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void bulkHide()}
          >
            선택 숨김
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="danger"
          onClick={() => void bulkDelete()}
        >
          선택 삭제
        </Button>
      </BulkActionBar>
      <TableShell
        isLoading={!demoMode && institutionsQuery.isPending}
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
              <ThumbHeader />
              <th>기관 로고</th>
              <th>노출 상태</th>
              <th>순서</th>
              <th>작성자</th>
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
                <ThumbCell fit="contain" url={item.logo?.url} />
                <td>
                  <button
                    className="content-admin-table-title-button"
                    type="button"
                    onClick={() => {
                      setEditing(item);
                      setEditorOpen(true);
                    }}
                  >
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
                    <span>{filteredItems[index]?.displayOrder ?? item.displayOrder}</span>
                    <Button
                      disabled={index === 0 || orderMutation.isPending}
                      size="sm"
                      variant="ghost"
                      onClick={() => order.move(item.id, -1)}
                    >
                      ▲
                    </Button>
                    <Button
                      disabled={
                        index === items.length - 1 ||
                        orderMutation.isPending
                      }
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
        onChange={(nextPage) => guard(() => setPage(nextPage))}
      />
      {demoMode ? <DemoNotice /> : null}
    </section>
  );
}
