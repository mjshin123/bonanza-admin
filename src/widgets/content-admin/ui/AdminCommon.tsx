import type {
  CSSProperties,
  ChangeEvent,
  FormEvent,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { uploadFileMutationOptions } from "@features/file-upload";
import type { FileDto, FileKind } from "@shared/api/content";
import {
  formatAuditTime,
  getErrorMessage,
  useEditorDirtyTracker,
  type AuditFields,
  type ImageCrop,
} from "@shared/lib";
import { Badge, Button, Card, CroppedImage, Notice, Pagination } from "@shared/ui";

import {
  resolveDisplayStatus,
  statusLabel,
  statusTone,
} from "../model/adminContent";

export function SectionTitle({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="content-admin-section-title">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}

export function SectionTabs({
  value,
  items,
  onChange,
}: {
  value: string;
  items: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="content-admin-tabs" role="tablist">
      {items.map((item) => (
        <button
          key={item.value}
          aria-selected={value === item.value}
          className={value === item.value ? "is-active" : undefined}
          role="tab"
          type="button"
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

/** 데모 데이터를 보여주는 모든 화면에서 같은 형식으로 쓰는 안내 */
export function DemoNotice() {
  return (
    <Notice tone="warning" title="데모 데이터 표시 중">
      화면 확인용 예시 데이터입니다. 저장·삭제한 내용은 서버에 반영되지 않으며 새로고침하면 사라집니다.
    </Notice>
  );
}

/** 목록 최상단에서 이 메뉴가 운영 웹사이트의 어디에 쓰이는지 알려주는 안내 */
export function PageGuide({ children }: { children: ReactNode }) {
  return (
    <div className="content-admin-page-guide">
      <strong>운영 웹사이트</strong>
      <p>{children}</p>
    </div>
  );
}

/** 상세 화면 하단에 표시하는 작성·수정 기록 */
export function AuditInfo({ audit }: { audit?: AuditFields | null }) {
  if (!audit) return null;
  const created = formatAuditTime(audit.createdAt);
  const updated = formatAuditTime(audit.updatedAt);
  if (!created && !audit.createdByLogin && !updated && !audit.updatedByLogin)
    return null;
  return (
    <dl className="content-admin-audit-info">
      <div>
        <dt>작성</dt>
        <dd>
          {created ?? "-"} · {audit.createdByLogin ?? "-"}
        </dd>
      </div>
      <div>
        <dt>수정</dt>
        <dd>
          {updated ?? "-"} · {audit.updatedByLogin ?? audit.createdByLogin ?? "-"}
        </dd>
      </div>
    </dl>
  );
}

export function FilterBar({ children }: { children: ReactNode }) {
  return <Card className="content-admin-filter-bar">{children}</Card>;
}

export function TableShell({
  children,
  isLoading,
  error,
  isEmpty,
  emptyMessage,
  className,
}: {
  children: ReactNode;
  headerAction?: ReactNode;
  isLoading: boolean;
  error: Error | null;
  isEmpty: boolean;
  emptyMessage: string;
  className?: string;
}) {
  if (isLoading)
    return <Card className="content-admin-state">불러오는 중입니다.</Card>;
  if (error)
    return (
      <Notice tone="danger" title="데이터를 불러오지 못했습니다.">
        {getErrorMessage(error)}
      </Notice>
    );
  if (isEmpty)
    return <Card className="content-admin-state">{emptyMessage}</Card>;
  return (
    <div
      className={`content-admin-table-shell${className ? ` ${className}` : ""}`}
    >
      {children}
    </div>
  );
}

export function Pager({
  page,
  totalPages,
  total,
  onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onChange: (page: number) => void;
}) {
  return (
    <div className="content-admin-pager">
      <span>총 {total.toLocaleString()}건</span>
      {totalPages > 1 ? (
        <Pagination page={page} pageCount={totalPages} onChange={onChange} />
      ) : null}
    </div>
  );
}

export function StatusBadge({
  status,
  publishedAt,
}: {
  status: "draft" | "published" | "hidden";
  publishedAt?: string | null;
}) {
  const displayStatus = resolveDisplayStatus(status, publishedAt);
  return <Badge tone={statusTone(displayStatus)}>{statusLabel(displayStatus)}</Badge>;
}

export function Field({
  label,
  required,
  hint,
  children,
  wide,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={`content-admin-field${wide ? " is-wide" : ""}`}>
      <span>
        {label}
        {required ? <em>필수</em> : null}
      </span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`content-admin-textarea ${className ?? ""}`}
      {...props}
    />
  );
}

export function NativeSelect({
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className="content-admin-select" {...props}>
      {children}
    </select>
  );
}

export function Checkbox({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="content-admin-checkbox">
      <input
        checked={checked}
        disabled={disabled}
        type="checkbox"
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

export function FormActions({
  isPending,
  submitLabel = "저장",
  onCancel,
}: {
  isPending: boolean;
  submitLabel?: string;
  onCancel: () => void;
}) {
  return (
    <div className="content-admin-form-actions">
      <Button disabled={isPending} variant="ghost" onClick={onCancel}>
        취소
      </Button>
      <Button disabled={isPending} type="submit">
        {isPending ? "저장 중..." : submitLabel}
      </Button>
    </div>
  );
}

export function MutationMessage({
  error,
  success,
}: {
  error: Error | null;
  success?: string | null;
}) {
  if (error)
    return (
      <Notice tone="danger" title="요청을 처리하지 못했습니다.">
        {getErrorMessage(error)}
      </Notice>
    );
  if (success)
    return (
      <Notice tone="teal" title="처리했습니다.">
        {success}
      </Notice>
    );
  return null;
}

export function FileUpload({
  accept,
  fileKind,
  label,
  multiple = false,
  onUploaded,
}: {
  accept?: string;
  fileKind: FileKind;
  label: string;
  multiple?: boolean;
  onUploaded: (files: FileDto[]) => void;
}) {
  const queryClient = useQueryClient();
  const uploadMutation = useMutation(uploadFileMutationOptions());
  const handleChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;
    const uploaded: FileDto[] = [];
    for (let index = 0; index < files.length; index += 4) {
      const batch = files.slice(index, index + 4);
      const results = await Promise.allSettled(
        batch.map((file) => uploadMutation.mutateAsync({ file, fileKind })),
      );
      uploaded.push(
        ...results.flatMap((result) =>
          result.status === "fulfilled" ? [result.value] : [],
        ),
      );
      if (results.some((result) => result.status === "rejected")) break;
    }
    if (uploaded.length > 0) {
      await queryClient.invalidateQueries({ queryKey: ["files"] });
      onUploaded(uploaded);
    }
  };
  return (
    <div className="content-admin-upload">
      <label className="content-admin-upload-button">
        {uploadMutation.isPending ? "업로드 중..." : label}
        <input
          accept={accept}
          disabled={uploadMutation.isPending}
          multiple={multiple}
          type="file"
          onChange={(event) => void handleChange(event)}
        />
      </label>
      {uploadMutation.error ? (
        <span>{getErrorMessage(uploadMutation.error)}</span>
      ) : null}
    </div>
  );
}

export function EditorCard({
  title,
  description,
  children,
  headerAction,
  audit,
  onSubmit,
}: {
  title: string;
  description: string;
  children: ReactNode;
  headerAction?: ReactNode;
  audit?: AuditFields | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const markDirty = useEditorDirtyTracker();
  return (
    <Card
      className="content-admin-editor-card"
      padding="var(--editor-pad)"
      style={{ "--editor-pad": "clamp(20px, 3vw, 32px)" } as CSSProperties}
    >
      <div className="content-admin-editor-heading">
        <div><h2>{title}</h2><p>{description}</p></div>
        {headerAction}
      </div>
      <form
        className="content-admin-form"
        onChange={markDirty}
        onInput={markDirty}
        onSubmit={onSubmit}
      >
        {children}
        <AuditInfo audit={audit} />
      </form>
    </Card>
  );
}

/** 목록 표의 이미지 열 머리글. 체크박스 열 바로 다음에 둔다. */
export function ThumbHeader() {
  return <th aria-label="이미지" className="content-admin-thumb-col" />;
}

/** 목록 표의 이미지 열. 이미지가 없으면 칸을 비워 두되 열 폭은 유지해 제목 위치를 맞춘다. */
export function ThumbCell({
  url,
  crop,
  fit = "cover",
}: {
  url?: string | null;
  /** 목록에 보일 자르기 영역. 없으면 가운데 기준 */
  crop?: ImageCrop | null;
  /** 로고처럼 잘리면 안 되는 이미지는 contain */
  fit?: "cover" | "contain";
}) {
  return (
    <td className="content-admin-thumb-col">
      {url && fit === "contain" ? (
        <img alt="" className="content-admin-table-thumb is-contain" src={url} />
      ) : url ? (
        <CroppedImage className="content-admin-table-thumb" crop={crop} src={url} />
      ) : null}
    </td>
  );
}
