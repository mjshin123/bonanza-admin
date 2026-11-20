import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { awardQueryKeys, awardsQueryOptions, type AwardDto } from "@entities/award";
import { deleteAwardMutationOptions, saveAwardMutationOptions } from "@features/award-manage";
import { Button, Notice } from "@shared/ui";
import { isDemoMode as isGlobalDemoMode } from "@shared/api/content";

import { MutationMessage, SectionTitle, TableShell } from "./AdminCommon";

const DEMO_AWARDS: AwardDto[] = [
  ["demo-award-1", "아기유니콘 육성사업 선정", "중소벤처기업부", "2025-09-01"],
  ["demo-award-2", "벤처창업진흥 유공 중소벤처기업부 장관상", "중소벤처기업부", "2024-12-01"],
  ["demo-award-3", "국제표준인증 ISO9001·14001", "EURO CERT", "2024-11-01"],
].map(([id, title, organization, awardedOn]) => ({ id, title, titleEn: "", organization, organizationEn: "", awardedOn, updatedAt: "demo" }));

function AwardEditor({ item, onClose, demoMode }: { item: AwardDto | null; onClose: () => void; demoMode: boolean }) {
  const client = useQueryClient(); const mutation = useMutation(saveAwardMutationOptions());
  const [title, setTitle] = useState(item?.title ?? ""); const [titleEn, setTitleEn] = useState(item?.titleEn ?? ""); const [organization, setOrganization] = useState(item?.organization ?? ""); const [organizationEn, setOrganizationEn] = useState(item?.organizationEn ?? ""); const [awardedOn, setAwardedOn] = useState(item?.awardedOn ?? new Date().toISOString().slice(0, 10)); const [demoNotice, setDemoNotice] = useState(false);
  useEffect(() => { setTitle(item?.title ?? ""); setTitleEn(item?.titleEn ?? ""); setOrganization(item?.organization ?? ""); setOrganizationEn(item?.organizationEn ?? ""); setAwardedOn(item?.awardedOn ?? new Date().toISOString().slice(0, 10)); }, [item]);
  const submit = async (event: FormEvent) => { event.preventDefault(); if (demoMode) { setDemoNotice(true); return; } try { await mutation.mutateAsync({ id: item?.id, expectedUpdatedAt: item?.updatedAt, title, titleEn, organization, organizationEn, awardedOn }); await client.invalidateQueries({ queryKey: awardQueryKeys.all }); onClose(); } catch {} };
  return <section className="content-admin-section"><SectionTitle title={item ? "인증/수상 수정" : "인증/수상 추가"} description="저장 후 날짜 최신순으로 자동 정렬됩니다." />{demoMode ? <Notice tone="warning" title="데모 모드">입력과 편집 흐름만 확인할 수 있으며 DB 연결 후 실제 저장됩니다.</Notice> : null}<form className="award-form" onSubmit={(event) => void submit(event)}><div className="award-form-field-group"><label>제목<input required maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} /></label><label>영문 제목<input maxLength={160} value={titleEn} onChange={(event) => setTitleEn(event.target.value)} /></label></div><div className="award-form-field-group"><label>인증기관<input required maxLength={160} value={organization} onChange={(event) => setOrganization(event.target.value)} /></label><label>영문 인증기관<input maxLength={160} value={organizationEn} onChange={(event) => setOrganizationEn(event.target.value)} /></label></div><label className="award-form-date">날짜<input required type="date" value={awardedOn} onChange={(event) => setAwardedOn(event.target.value)} /></label>{demoNotice ? <Notice tone="warning" title="저장되지 않았습니다.">DB 연결 후 실제 저장됩니다.</Notice> : null}<MutationMessage error={mutation.error} /><div className="content-admin-form-actions"><Button type="button" variant="ghost" onClick={onClose}>취소</Button><Button disabled={mutation.isPending} type="submit">{mutation.isPending ? "저장 중…" : "저장"}</Button></div></form></section>;
}

export function AwardSection({ onEditorOpenChange }: { onEditorOpenChange?: (isOpen: boolean) => void } = {}) {
  const client = useQueryClient(); const query = useQuery(awardsQueryOptions()); const deletion = useMutation(deleteAwardMutationOptions()); const [editing, setEditing] = useState<AwardDto | null | "new">(null); const demoMode = isGlobalDemoMode || Boolean(query.error); const items = query.data ?? (demoMode ? DEMO_AWARDS : []);
  useEffect(() => onEditorOpenChange?.(Boolean(editing)), [editing, onEditorOpenChange]);
  const remove = async (item: AwardDto) => { if (!window.confirm(`“${item.title}” 항목을 제거할까요?`)) return; if (demoMode) { window.alert("데모 데이터는 DB 연결 전에만 제거할 수 없습니다."); return; } try { await deletion.mutateAsync(item.id); await client.invalidateQueries({ queryKey: awardQueryKeys.all }); } catch {} };
  if (editing) return <AwardEditor demoMode={demoMode} item={editing === "new" ? null : editing} onClose={() => setEditing(null)} />;
  return <section className="content-admin-section"><SectionTitle title="주요 인증/수상" description="날짜 최신순으로 자동 정렬됩니다. 개수 제한 없이 관리할 수 있습니다." action={<Button onClick={() => setEditing("new")}>인증/수상 추가</Button>} />{demoMode ? <Notice tone="warning" title="데모 데이터 표시 중">DB 연결 전이라 기존 웹사이트 항목 일부를 임시로 보여줍니다.</Notice> : null}<MutationMessage error={deletion.error} /><TableShell isLoading={query.isPending} error={demoMode ? null : query.error} isEmpty={!items.length} emptyMessage="등록된 인증/수상 항목이 없습니다."><table><thead><tr><th>날짜</th><th>인증/수상</th><th>인증기관</th><th aria-label="작업" /></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td>{item.awardedOn}</td><td><button className="content-admin-table-title-button" type="button" onClick={() => setEditing(item)}><div className="content-admin-table-title"><strong>{item.title}</strong></div></button></td><td className="content-admin-muted">{item.organization}</td><td><div className="content-admin-table-actions"><Button size="sm" variant="ghost" onClick={() => setEditing(item)}>수정</Button><Button disabled={deletion.isPending || demoMode} size="sm" variant="text" onClick={() => void remove(item)}>제거</Button></div></td></tr>)}</tbody></table></TableShell></section>;
}
