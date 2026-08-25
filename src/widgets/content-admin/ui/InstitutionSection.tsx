import { useEffect, useState, type FormEvent } from "react";
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
  updateInstitutionCategoryMutationOptions,
} from "@features/institution-category-manage";
import {
  createInstitutionMutationOptions,
  deleteInstitutionMutationOptions,
  updateInstitutionMutationOptions,
} from "@features/institution-manage";
import { Button, Input } from "@shared/ui";

import { PAGE_SIZE, useDebouncedValue } from "../model/adminContent";
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

type InstitutionFormState = {
  institutionType: "member" | "partner";
  categoryId: string;
  name: string;
  description: string;
  homepageUrl: string;
  displayOrder: string;
  isActive: boolean;
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
  displayOrder: "0",
  isActive: true,
  isPending: false,
  logoFileId: null,
  logoUrl: null,
};

function InstitutionEditor({
  item,
  categories,
  onClose,
}: {
  item: InstitutionDto | null;
  categories: InstitutionCategoryDto[];
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
            displayOrder: String(item.displayOrder),
            isActive: item.isActive,
            isPending: item.isPending,
            logoFileId: item.logo?.id ?? null,
            logoUrl: item.logo?.url ?? null,
          }
        : { ...EMPTY_INSTITUTION, categoryId: categories[0]?.id ?? "" },
    );
  }, [categories, item]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input = {
      institutionType: form.institutionType,
      categoryId: form.categoryId,
      name: form.name,
      description: form.description,
      homepageUrl: form.homepageUrl || null,
      displayOrder: Number(form.displayOrder),
      isActive: form.isActive,
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
      <Field label="기관명" required>
        <input
          required
          className="content-admin-native-input"
          maxLength={200}
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
        />
      </Field>
      <Field label="기관 타입" required>
        <NativeSelect
          value={form.institutionType}
          onChange={(event) =>
            setForm({
              ...form,
              institutionType: event.target.value as "member" | "partner",
            })
          }
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
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
              {category.isActive ? "" : " (비활성)"}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="노출 순서" required>
        <input
          required
          className="content-admin-native-input"
          min={0}
          type="number"
          value={form.displayOrder}
          onChange={(event) =>
            setForm({ ...form, displayOrder: event.target.value })
          }
        />
      </Field>
      <Field label="홈페이지">
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
      <Field label="공개 여부">
        <Checkbox
          checked={form.isActive}
          label="홈페이지에 기관 노출"
          onChange={(isActive) => setForm({ ...form, isActive })}
        />
      </Field>
      <Field label="등록 상태">
        <Checkbox
          checked={form.isPending}
          label="등록 예정으로 표시"
          onChange={(isPending) => setForm({ ...form, isPending })}
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
  const [editing, setEditing] = useState<InstitutionCategoryDto | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [displayOrder, setDisplayOrder] = useState("0");
  const [isActive, setIsActive] = useState(true);

  const reset = () => {
    setEditing(null);
    setCode("");
    setName("");
    setDisplayOrder("0");
    setIsActive(true);
  };
  const edit = (category: InstitutionCategoryDto) => {
    setEditing(category);
    setCode(category.code);
    setName(category.name);
    setDisplayOrder(String(category.displayOrder));
    setIsActive(category.isActive);
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const input = {
        code,
        name,
        displayOrder: Number(displayOrder),
        isActive,
      };
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

  const mutationError =
    createMutation.error ?? updateMutation.error ?? deleteMutation.error;
  return (
    <div className="content-admin-category-layout">
      <EditorCard
        title={editing ? "기관 분류 수정" : "기관 분류 추가"}
        description="은행·증권 등 기관 분류와 표시 순서를 관리합니다."
        onSubmit={(event) => void submit(event)}
      >
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
        <Field label="노출 순서" required>
          <input
            required
            className="content-admin-native-input"
            min={0}
            type="number"
            value={displayOrder}
            onChange={(event) => setDisplayOrder(event.target.value)}
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
            {categories.map((category) => (
              <tr key={category.id}>
                <td>
                  <strong>{category.name}</strong>
                </td>
                <td>{category.code}</td>
                <td>{category.displayOrder}</td>
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
  );
}

export function InstitutionSection() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("institutions");
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q);
  const [type, setType] = useState("");
  const [active, setActive] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<InstitutionDto | null>(null);
  const categoriesQuery = useQuery(adminInstitutionCategoriesQueryOptions());
  const institutionsQuery = useQuery(
    adminInstitutionsQueryOptions({
      page,
      pageSize: PAGE_SIZE,
      q: debouncedQ || undefined,
      institutionType: type ? (type as "member" | "partner") : undefined,
      isActive: active === "" ? undefined : active === "true",
    }),
  );
  const deleteMutation = useMutation(deleteInstitutionMutationOptions());
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

  if (editorOpen)
    return (
      <InstitutionEditor
        item={editing}
        categories={categoriesQuery.data ?? []}
        onClose={() => {
          setEditorOpen(false);
          setEditing(null);
        }}
      />
    );
  return (
    <section className="content-admin-section">
      <SectionTitle
        title="회원기관 · 협력기관"
        description="기관 기본 정보, 분류, 로고와 홈페이지 노출 상태를 관리합니다."
        action={
          tab === "institutions" ? (
            <Button onClick={() => setEditorOpen(true)}>기관 등록</Button>
          ) : undefined
        }
      />
      <SectionTabs
        value={tab}
        items={[
          { value: "institutions", label: "기관 목록" },
          { value: "categories", label: "기관 분류" },
        ]}
        onChange={setTab}
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
            <NativeSelect
              aria-label="기관 타입"
              value={type}
              onChange={(event) => {
                setType(event.target.value);
                setPage(1);
              }}
            >
              <option value="">전체 타입</option>
              <option value="member">회원기관</option>
              <option value="partner">협력기관</option>
            </NativeSelect>
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
          </FilterBar>
          <MutationMessage error={deleteMutation.error} />
          <TableShell
            isLoading={institutionsQuery.isPending}
            error={institutionsQuery.error}
            isEmpty={!institutionsQuery.data?.items.length}
            emptyMessage="등록된 기관이 없습니다."
          >
            <table>
              <thead>
                <tr>
                  <th>기관</th>
                  <th>타입</th>
                  <th>분류</th>
                  <th>노출</th>
                  <th>등록 상태</th>
                  <th>순서</th>
                  <th aria-label="작업" />
                </tr>
              </thead>
              <tbody>
                {institutionsQuery.data?.items.map((item) => (
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
                    <td>
                      {item.institutionType === "member"
                        ? "회원기관"
                        : "협력기관"}
                    </td>
                    <td>{item.category.name}</td>
                    <td>{item.isActive ? "노출" : "미노출"}</td>
                    <td>{item.isPending ? "등록 예정" : "등록 완료"}</td>
                    <td>{item.displayOrder}</td>
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
            total={institutionsQuery.data?.total ?? 0}
            totalPages={institutionsQuery.data?.totalPages ?? 0}
            onChange={setPage}
          />
        </>
      )}
    </section>
  );
}
