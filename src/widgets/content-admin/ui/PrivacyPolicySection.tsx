import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { PostContentEditor } from "@features/post-content-editor";
import { supabase } from "@shared/api/supabase";
import { isDemoMode as isGlobalDemoMode } from "@shared/api/content";
import { Button, Notice } from "@shared/ui";

import { EditorCard, Field, MutationMessage, SectionTabs, SectionTitle, TableShell } from "./AdminCommon";

type PrivacyPolicy = {
  content: string;
  content_en?: string | null;
  created_at: string;
  effective_date: string;
  id: string;
  updated_at: string;
};

const key = ["privacy-policies"] as const;

const demoPolicies: PrivacyPolicy[] = [
  {
    id: "demo-privacy-policy",
    effective_date: "2026-07-15",
    content:
      "<h2>총칙</h2><p>주식회사 보난자팩토리는 개인정보 보호법에 따라 정보주체의 개인정보를 보호하고 관련 고충을 신속하고 원활하게 처리합니다.</p><h2>제1조 (개인정보의 처리 목적, 처리 항목 및 보유 기간)</h2><table><thead><tr><th>구분</th><th>처리 목적</th><th>처리 항목</th><th>보유·이용 기간</th></tr></thead><tbody><tr><td>사업 문의</td><td>문의 접수 및 회신</td><td>이메일, 성명, 문의 내용</td><td>문의 처리 완료 후 1년</td></tr></tbody></table>",
    created_at: "2026-07-15T00:00:00+09:00",
    updated_at: "2026-07-15T00:00:00+09:00",
  },
];

function formatDate(value: string) {
  return value.replaceAll("-", ".");
}

function PolicyEditor({
  item,
  onClose,
  demoMode,
  onDemoSave,
}: {
  item: PrivacyPolicy | null;
  onClose: () => void;
  demoMode: boolean;
  onDemoSave: (policy: PrivacyPolicy) => void;
}) {
  const client = useQueryClient();
  const [effectiveDate, setEffectiveDate] = useState(
    item?.effective_date ?? new Date().toISOString().slice(0, 10),
  );
  const [content, setContent] = useState(item?.content ?? "");
  const [contentEn, setContentEn] = useState(item?.content_en ?? "");
  const [locale, setLocale] = useState<"ko" | "en">("ko");
  const [visitedLocales, setVisitedLocales] = useState<Set<"ko" | "en">>(() => new Set(["ko"]));
  const changeLocale = (next: "ko" | "en") => {
    setLocale(next);
    setVisitedLocales((current) => new Set([...current, next]));
  };
  const localPolicy = (): PrivacyPolicy => ({
    id: item?.id ?? `demo-privacy-${Date.now()}`,
    effective_date: effectiveDate,
    content: content.trim() || contentEn.trim(),
    content_en: contentEn.trim() || null,
    created_at: item?.created_at ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  const save = useMutation({
    mutationFn: async () => {
      if (!content.trim() && !contentEn.trim()) throw new Error("한글 또는 영문 본문을 입력해주세요.");
      const payload = { content: content.trim() || contentEn.trim(), content_en: contentEn.trim() || null, effective_date: effectiveDate };
      try {
        const request = item
          ? supabase.from("privacy_policies").update(payload).eq("id", item.id)
          : supabase.from("privacy_policies").insert(payload);
        const { error } = await request;
        if (error) throw error;
        return false;
      } catch (error) {
        if (error instanceof TypeError && error.message.includes("Failed to fetch")) return true;
        throw error;
      }
    },
    onSuccess: async (storedLocally) => {
      if (storedLocally) onDemoSave(localPolicy());
      else await client.invalidateQueries({ queryKey: key });
      onClose();
    },
  });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!contentEn.trim() && !window.confirm("영문 내용을 작성하지 않으면 홈페이지에서 언어를 변경해도 영문 개인정보처리방침이 적용되지 않습니다. 그래도 게시할까요?")) return;
    if (demoMode) {
      if (!content.trim() && !contentEn.trim()) return;
      onDemoSave(localPolicy());
      onClose();
      return;
    }
    save.mutate();
  };
  return (
    <section className="content-admin-section">
      <EditorCard
        title={item ? "개인정보처리방침 수정" : "개인정보처리방침 등록"}
        description="한글과 영문 문서를 각각 작성할 수 있습니다. 영문은 선택 사항입니다."
        headerAction={<SectionTabs value={locale} items={[{ value: "ko", label: "한글" }, { value: "en", label: "영문" }]} onChange={(value) => changeLocale(value as "ko" | "en")} />}
        onSubmit={submit}
      >
        {locale === "ko" ? <Field label="시행일" required wide>
          <input
            className="content-admin-native-input"
            required
            type="date"
            value={effectiveDate}
            onChange={(event) => setEffectiveDate(event.target.value)}
          />
        </Field> : null}
        <div className="content-admin-field is-wide privacy-policy-editor">
          <PostContentEditor
            key={`privacy-policy-${locale}`}
            currentThumbnailPath={null}
            enableImages={false}
            label={locale === "ko" ? "한글 본문" : "영문 본문"}
            placeholder="개인정보처리방침 본문을 붙여넣거나 작성하세요"
            value={locale === "ko" ? content : contentEn}
            onChange={locale === "ko" ? setContent : setContentEn}
            onStateChange={() => undefined}
          />
        </div>
        <MutationMessage error={save.error} />
        <div className="content-admin-form-actions">
          <Button type="button" variant="ghost" onClick={onClose}>취소</Button>
          {locale === "ko" || visitedLocales.size < 2 ? <Button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); changeLocale(locale === "ko" ? "en" : "ko"); }}>다음</Button> : <Button disabled={save.isPending} type="submit">{save.isPending ? "저장 중…" : "게시"}</Button>}
        </div>
      </EditorCard>
    </section>
  );
}

export function PrivacyPolicySection({ onEditorOpenChange }: { onEditorOpenChange?: (isOpen: boolean) => void } = {}) {
  const client = useQueryClient();
  const [editing, setEditing] = useState<PrivacyPolicy | "new" | null>(null);
  const [demoItems, setDemoItems] = useState<PrivacyPolicy[]>(demoPolicies);
  useEffect(() => onEditorOpenChange?.(Boolean(editing)), [editing, onEditorOpenChange]);
  const query = useQuery({
    queryKey: key,
    enabled: !isGlobalDemoMode,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("privacy_policies")
        .select("*")
        .order("effective_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("privacy_policies").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: key }),
  });
  const { items, isDemoMode } = useMemo(() => ({
    items: query.data ?? (query.error || isGlobalDemoMode ? demoItems : []),
    isDemoMode: isGlobalDemoMode || Boolean(query.error),
  }), [query.data, query.error, demoItems]);

  const saveDemo = (policy: PrivacyPolicy) => setDemoItems((current) => {
    const exists = current.some((candidate) => candidate.id === policy.id);
    return (exists ? current.map((candidate) => candidate.id === policy.id ? policy : candidate) : [policy, ...current]).sort((first, second) => second.effective_date.localeCompare(first.effective_date));
  });
  if (editing) return <PolicyEditor demoMode={isDemoMode} item={editing === "new" ? null : editing} onClose={() => setEditing(null)} onDemoSave={saveDemo} />;
  const currentId = items.find((item) => item.effective_date <= new Date().toISOString().slice(0, 10))?.id;
  return (
    <section className="content-admin-section">
      <SectionTitle
        title="개인정보처리방침"
        description="시행일 기준으로 버전을 관리하며 가장 최근 시행 버전을 현행으로 표시합니다."
        action={<Button onClick={() => setEditing("new")}>처리방침 등록</Button>}
      />
      {isDemoMode ? <Notice tone="warning" title="데모 데이터 표시 중">등록·수정 내용은 현재 브라우저 화면에서만 확인할 수 있습니다.</Notice> : null}
      <MutationMessage error={remove.error} />
      <TableShell
        isLoading={query.isPending}
        error={isDemoMode ? null : query.error}
        isEmpty={!items.length}
        emptyMessage="등록된 개인정보처리방침이 없습니다."
      >
        <table>
          <thead>
            <tr>
              <th>시행일</th>
              <th>상태</th>
              <th aria-label="작업" />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{formatDate(item.effective_date)} 시행</td>
                <td>{item.id === currentId ? "현행" : "이전 버전"}</td>
                <td>
                  <div className="content-admin-table-actions">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(item)}>수정</Button>
                    <Button disabled={remove.isPending || isDemoMode} size="sm" variant="text" onClick={() => remove.mutate(item.id)}>삭제</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>
    </section>
  );
}
