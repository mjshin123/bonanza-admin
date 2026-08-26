import { Fragment, useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  adminInstitutionCategoriesQueryOptions,
  institutionCategoryQueryKeys,
  type InstitutionCategoryDto,
} from "@entities/institution-category";
import {
  adminInstitutionsQueryOptions,
  institutionQueryKeys,
  type InstitutionDto,
} from "@entities/institution";
import {
  createInstitutionCategoryMutationOptions,
  deleteInstitutionCategoryMutationOptions,
  swapInstitutionCategoryOrderMutationOptions,
  updateInstitutionCategoryMutationOptions,
} from "@features/institution-category-manage";
import {
  createInstitutionMutationOptions,
  deleteInstitutionMutationOptions,
  swapInstitutionOrderMutationOptions,
  updateInstitutionMutationOptions,
} from "@features/institution-manage";
import { Button, Input } from "@shared/ui";

import { useDebouncedValue } from "../model/adminContent";
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
  TableShell,
  Textarea,
} from "./AdminCommon";

// 기관 분류별로 묶어서 보여주기 위해 페이지네이션 없이 한 번에 불러온다.
const INSTITUTION_LIST_PAGE_SIZE = 100;

type InstitutionFormState = {
  institutionType: "member" | "partner";
  categoryId: string;
  name: string;
  description: string;
  homepageUrl: string;
  isPending: boolean;
  logoFileId: string | null;
  logoUrl: string | null;
};

const EMPTY_INSTITUTION: InstitutionFormState = {
  institutionType: "member",
  categoryId: "",
  name: "",
  description: "",
  homepageUrl: "",
  isPending: false,
  logoFileId: null,
  logoUrl: null,
};

function InstitutionEditor({
  item,
  categories,
  defaultInstitutionType,
  onClose,
}: {
  item: InstitutionDto | null;
  categories: InstitutionCategoryDto[];
  defaultInstitutionType: "member" | "partner";
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const createMutation = useMutation(createInstitutionMutationOptions());
  const updateMutation = useMutation(updateInstitutionMutationOptions());
  const [form, setForm] = useState<InstitutionFormState>(EMPTY_INSTITUTION);
  const mutation = item ? updateMutation : createMutation;

  useEffect(() => {
    setForm(
      item
        ? {
            institutionType: item.institutionType,
            categoryId: item.category.id,
            name: item.name,
            description: item.description,
            homepageUrl: item.homepageUrl ?? "",
            isPending: item.isPending,
            logoFileId: item.logo?.id ?? null,
            logoUrl: item.logo?.url ?? null,
          }
        : {
            ...EMPTY_INSTITUTION,
            institutionType: defaultInstitutionType,
            categoryId:
              categories.find(
                (category) =>
                  category.institutionType === defaultInstitutionType,
              )?.id ?? "",
          },
    );
  }, [categories, defaultInstitutionType, item]);

  const availableCategories = categories.filter(
    (category) => category.institutionType === form.institutionType,
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input = {
      institutionType: form.institutionType,
      categoryId: form.categoryId,
      name: form.name,
      description: form.description,
      homepageUrl: form.homepageUrl || null,
      isPending: form.isPending,
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
      title={item ? "기관 수정" : "기관 등록"}
      description="회원기관과 협력기관의 기본 정보 및 로고를 관리합니다."
      onSubmit={(event) => void handleSubmit(event)}
    >
      <Field label="기관 타입" required>
        <NativeSelect
          value={form.institutionType}
          onChange={(event) => {
            const institutionType = event.target.value as "member" | "partner";
            setForm({
              ...form,
              institutionType,
              categoryId:
                categories.find(
                  (category) => category.institutionType === institutionType,
                )?.id ?? "",
            });
          }}
        >
          <option value="member">회원기관</option>
          <option value="partner">협력기관</option>
        </NativeSelect>
      </Field>
      <Field label="기관 분류" required>
        <NativeSelect
          required
          value={form.categoryId}
          onChange={(event) =>
            setForm({ ...form, categoryId: event.target.value })
          }
        >
          {availableCategories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
              {category.isActive ? "" : " (비활성)"}
            </option>
          ))}
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
      <Field label="등록 상태">
        <Checkbox
          checked={form.isPending}
          label="등록 예정으로 표시"
          onChange={(isPending) => setForm({ ...form, isPending })}
        />
      </Field>
      <Field label="홈페이지" wide>
        <input
          className="content-admin-native-input"
          placeholder="https://"
          type="url"
          value={form.homepageUrl}
          onChange={(event) =>
            setForm({ ...form, homepageUrl: event.target.value })
          }
        />
      </Field>
      <Field label="기관 설명" wide>
        <Textarea
          maxLength={2000}
          value={form.description}
          onChange={(event) =>
            setForm({ ...form, description: event.target.value })
          }
        />
      </Field>
      <Field label="기관 로고" wide hint="이미지 파일만 업로드할 수 있습니다.">
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
      <MutationMessage error={mutation.error} />
      <FormActions isPending={mutation.isPending} onCancel={onClose} />
    </EditorCard>
  );
}

function CategoryManager({
  categories,
}: {
  categories: InstitutionCategoryDto[];
}) {
  const queryClient = useQueryClient();
  const createMutation = useMutation(
    createInstitutionCategoryMutationOptions(),
  );
  const updateMutation = useMutation(
    updateInstitutionCategoryMutationOptions(),
  );
  const deleteMutation = useMutation(
    deleteInstitutionCategoryMutationOptions(),
  );
  const orderMutation = useMutation(
    swapInstitutionCategoryOrderMutationOptions(),
  );
  const [editing, setEditing] = useState<InstitutionCategoryDto | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [institutionType, setInstitutionType] = useState<"member" | "partner">(
    "member",
  );
  const [isActive, setIsActive] = useState(true);

  const reset = () => {
    setEditing(null);
    setCode("");
    setName("");
    setIsActive(true);
  };
  const edit = (category: InstitutionCategoryDto) => {
    setEditing(category);
    setCode(category.code);
    setName(category.name);
    setInstitutionType(category.institutionType);
    setIsActive(category.isActive);
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const input = { code, name, institutionType, isActive };
      if (editing)
        await updateMutation.mutateAsync({ id: editing.id, ...input });
      else await createMutation.mutateAsync(input);
      await queryClient.invalidateQueries({
        queryKey: institutionCategoryQueryKeys.all,
      });
      reset();
    } catch {
      /* mutation 상태로 표시 */
    }
  };
  const remove = async (category: InstitutionCategoryDto) => {
    if (!window.confirm(`'${category.name}' 분류를 삭제할까요?`)) return;
    try {
      await deleteMutation.mutateAsync(category.id);
      await queryClient.invalidateQueries({
        queryKey: institutionCategoryQueryKeys.all,
      });
    } catch {
      /* 표시 */
    }
  };
  const moveCategory = async (
    category: InstitutionCategoryDto,
    direction: -1 | 1,
  ) => {
    const group = categories.filter(
      (candidate) => candidate.institutionType === institutionType,
    );
    const index = group.findIndex((candidate) => candidate.id === category.id);
    const target = group[index + direction];
    if (!target) return;
    try {
      await orderMutation.mutateAsync({
        first: { id: category.id, displayOrder: category.displayOrder },
        second: { id: target.id, displayOrder: target.displayOrder },
      });
      await queryClient.invalidateQueries({
        queryKey: institutionCategoryQueryKeys.all,
      });
    } catch {
      /* 표시 */
    }
  };

  const mutationError =
    createMutation.error ??
    updateMutation.error ??
    deleteMutation.error ??
    orderMutation.error;
  const visibleCategories = categories.filter(
    (category) => category.institutionType === institutionType,
  );
  return (
    <>
      <SectionTabs
        value={institutionType}
        items={[
          { value: "member", label: "회원기관용 분류" },
          { value: "partner", label: "협력기관용 분류" },
        ]}
        onChange={(value) => {
          setInstitutionType(value as "member" | "partner");
          setEditing(null);
          setCode("");
          setName("");
          setIsActive(true);
        }}
      />
      <div className="content-admin-category-layout">
        <EditorCard
          title={editing ? "기관 분류 수정" : "기관 분류 추가"}
          description="은행·증권 등 기관 분류와 표시 순서를 관리합니다."
          onSubmit={(event) => void submit(event)}
        >
          <Field label="분류 용도" required>
            <NativeSelect disabled value={institutionType}>
              <option value="member">회원기관용</option>
              <option value="partner">협력기관용</option>
            </NativeSelect>
          </Field>
          <Field label="분류 코드" required>
            <input
              required
              className="content-admin-native-input"
              pattern="[a-z0-9_]+"
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </Field>
          <Field label="분류명" required>
            <input
              required
              className="content-admin-native-input"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Field label="활성 여부">
            <Checkbox
              checked={isActive}
              label="기관 등록 및 공개 필터에 사용"
              onChange={setIsActive}
            />
          </Field>
          <MutationMessage error={mutationError} />
          <FormActions
            isPending={createMutation.isPending || updateMutation.isPending}
            submitLabel={editing ? "분류 수정" : "분류 추가"}
            onCancel={reset}
          />
        </EditorCard>
        <div className="content-admin-table-shell">
          <table>
            <thead>
              <tr>
                <th>분류</th>
                <th>코드</th>
                <th>순서</th>
                <th>상태</th>
                <th aria-label="작업" />
              </tr>
            </thead>
            <tbody>
              {visibleCategories.map((category, index) => (
                <tr key={category.id}>
                  <td>
                    <strong>{category.name}</strong>
                  </td>
                  <td>{category.code}</td>
                  <td>
                    <div className="content-admin-inline">
                      <span>{category.displayOrder}</span>
                      <Button
                        disabled={index === 0 || orderMutation.isPending}
                        size="sm"
                        variant="ghost"
                        onClick={() => void moveCategory(category, -1)}
                      >
                        ▲
                      </Button>
                      <Button
                        disabled={
                          index === visibleCategories.length - 1 ||
                          orderMutation.isPending
                        }
                        size="sm"
                        variant="ghost"
                        onClick={() => void moveCategory(category, 1)}
                      >
                        ▼
                      </Button>
                    </div>
                  </td>
                  <td>{category.isActive ? "활성" : "비활성"}</td>
                  <td>
                    <div className="content-admin-table-actions">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => edit(category)}
                      >
                        수정
                      </Button>
                      <Button
                        size="sm"
                        variant="text"
                        onClick={() => void remove(category)}
                      >
                        삭제
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

export function InstitutionSection() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"member" | "partner" | "categories">("member");
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q);
  const [active, setActive] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<InstitutionDto | null>(null);
  const categoriesQuery = useQuery(adminInstitutionCategoriesQueryOptions());
  const categories = categoriesQuery.data ?? [];
  const institutionsQuery = useQuery({
    ...adminInstitutionsQueryOptions({
      page,
      pageSize: INSTITUTION_LIST_PAGE_SIZE,
      q: debouncedQ || undefined,
      institutionType: tab === "categories" ? undefined : tab,
      isActive: active === "" ? undefined : active === "true",
    }),
    enabled: tab !== "categories",
  });
  const items = institutionsQuery.data?.items ?? [];
  const visibleCategories = categories.filter(
    (category) => tab !== "categories" && category.institutionType === tab,
  );
  const groups = visibleCategories
    .map((category) => ({
      category,
      institutions: items.filter((item) => item.category.id === category.id),
    }))
    .filter((group) => group.institutions.length > 0);
  const deleteMutation = useMutation(deleteInstitutionMutationOptions());
  const activeMutation = useMutation(updateInstitutionMutationOptions());
  const orderMutation = useMutation(swapInstitutionOrderMutationOptions());
  const categoryOrderMutation = useMutation(
    swapInstitutionCategoryOrderMutationOptions(),
  );
  const remove = async (item: InstitutionDto) => {
    if (!window.confirm(`'${item.name}' 기관을 삭제할까요?`)) return;
    try {
      await deleteMutation.mutateAsync(item.id);
      await queryClient.invalidateQueries({
        queryKey: institutionQueryKeys.all,
      });
    } catch {
      /* 표시 */
    }
  };
  const toggleActive = async (item: InstitutionDto) => {
    try {
      await activeMutation.mutateAsync({
        id: item.id,
        isActive: !item.isActive,
      });
      await queryClient.invalidateQueries({
        queryKey: institutionQueryKeys.all,
      });
    } catch {
      /* 표시 */
    }
  };
  const moveInstitution = async (
    item: InstitutionDto,
    groupInstitutions: InstitutionDto[],
    direction: -1 | 1,
  ) => {
    const index = groupInstitutions.findIndex(
      (candidate) => candidate.id === item.id,
    );
    const target = groupInstitutions[index + direction];
    if (!target) return;
    try {
      await orderMutation.mutateAsync({
        first: { id: item.id, displayOrder: item.displayOrder },
        second: { id: target.id, displayOrder: target.displayOrder },
      });
      await queryClient.invalidateQueries({
        queryKey: institutionQueryKeys.all,
      });
    } catch {
      /* 표시 */
    }
  };
  const moveCategory = async (
    category: InstitutionCategoryDto,
    direction: -1 | 1,
  ) => {
    const index = visibleCategories.findIndex(
      (candidate) => candidate.id === category.id,
    );
    const target = visibleCategories[index + direction];
    if (!target) return;
    try {
      await categoryOrderMutation.mutateAsync({
        first: { id: category.id, displayOrder: category.displayOrder },
        second: { id: target.id, displayOrder: target.displayOrder },
      });
      await queryClient.invalidateQueries({
        queryKey: institutionCategoryQueryKeys.all,
      });
    } catch {
      /* 표시 */
    }
  };

  if (editorOpen)
    return (
      <InstitutionEditor
        item={editing}
        categories={categories}
        defaultInstitutionType={tab === "partner" ? "partner" : "member"}
        onClose={() => {
          setEditorOpen(false);
          setEditing(null);
        }}
      />
    );
  return (
    <section className="content-admin-section">
      <SectionTitle
        title={
          tab === "member"
            ? "회원기관"
            : tab === "partner"
              ? "협력기관"
              : "기관 분류"
        }
        description={
          tab === "categories"
            ? "회원기관용과 협력기관용 분류를 각각 관리합니다."
            : "기관 기본 정보, 분류, 로고와 홈페이지 노출 상태를 관리합니다."
        }
        action={
          tab !== "categories" ? (
            <Button onClick={() => setEditorOpen(true)}>기관 등록</Button>
          ) : undefined
        }
      />
      <SectionTabs
        value={tab}
        items={[
          { value: "member", label: "회원기관" },
          { value: "partner", label: "협력기관" },
          { value: "categories", label: "기관 분류" },
        ]}
        onChange={(value) => {
          setTab(value as "member" | "partner" | "categories");
          setPage(1);
        }}
      />
      {tab === "categories" ? (
        categoriesQuery.error ? (
          <MutationMessage error={categoriesQuery.error} />
        ) : (
          <CategoryManager categories={categoriesQuery.data ?? []} />
        )
      ) : (
        <>
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
                <option value="false">미노출</option>
              </NativeSelect>
            </div>
          </FilterBar>
          <MutationMessage
            error={
              deleteMutation.error ??
              activeMutation.error ??
              orderMutation.error ??
              categoryOrderMutation.error
            }
          />
          <TableShell
            isLoading={institutionsQuery.isPending}
            error={institutionsQuery.error}
            isEmpty={!items.length}
            emptyMessage="등록된 기관이 없습니다."
          >
            <table>
              <thead>
                <tr>
                  <th>기관</th>
                  <th>노출</th>
                  <th>등록 상태</th>
                  <th>순서</th>
                  <th aria-label="작업" />
                </tr>
              </thead>
              <tbody>
                {groups.map((group, groupIndex) => (
                  <Fragment key={group.category.id}>
                    <tr className="content-admin-group-row">
                      <td colSpan={5}>
                        <div className="content-admin-inline">
                          <strong>{group.category.name}</strong>
                          <Button
                            disabled={
                              groupIndex === 0 ||
                              categoryOrderMutation.isPending
                            }
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              void moveCategory(group.category, -1)
                            }
                          >
                            ▲
                          </Button>
                          <Button
                            disabled={
                              groupIndex === groups.length - 1 ||
                              categoryOrderMutation.isPending
                            }
                            size="sm"
                            variant="ghost"
                            onClick={() => void moveCategory(group.category, 1)}
                          >
                            ▼
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {group.institutions.map((item, index) => (
                      <tr key={item.id}>
                        <td>
                          <div className="content-admin-inline">
                            {item.logo ? (
                              <img
                                alt=""
                                className="content-admin-image-thumb"
                                src={item.logo.url}
                              />
                            ) : null}
                            <div className="content-admin-table-title">
                              <strong>{item.name}</strong>
                              <span>
                                {item.homepageUrl ??
                                  (item.description || "설명 없음")}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td>{item.isActive ? "노출" : "미노출"}</td>
                        <td>{item.isPending ? "등록 예정" : "등록 완료"}</td>
                        <td>
                          <div className="content-admin-inline">
                            <span>{item.displayOrder}</span>
                            <Button
                              disabled={index === 0 || orderMutation.isPending}
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                void moveInstitution(
                                  item,
                                  group.institutions,
                                  -1,
                                )
                              }
                            >
                              ▲
                            </Button>
                            <Button
                              disabled={
                                index === group.institutions.length - 1 ||
                                orderMutation.isPending
                              }
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                void moveInstitution(
                                  item,
                                  group.institutions,
                                  1,
                                )
                              }
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
                              disabled={activeMutation.isPending}
                              size="sm"
                              variant="ghost"
                              onClick={() => void toggleActive(item)}
                            >
                              {item.isActive ? "숨김" : "공개"}
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
                  </Fragment>
                ))}
              </tbody>
            </table>
          </TableShell>
          <Pager
            page={page}
            total={institutionsQuery.data?.total ?? 0}
            totalPages={institutionsQuery.data?.totalPages ?? 0}
            onChange={setPage}
          />
        </>
      )}
    </section>
  );
}
