import type {
  ChangeEvent,
  FormEvent,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { uploadFileMutationOptions } from "@features/file-upload";
import type { FileDto, FileKind } from "@shared/api/content";
import { getErrorMessage } from "@shared/lib";
import { Badge, Button, Card, Notice, Pagination } from "@shared/ui";

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
  onSubmit,
}: {
  title: string;
  description: string;
  children: ReactNode;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Card
      className="content-admin-editor-card"
      padding="clamp(20px, 3vw, 32px)"
    >
      <div className="content-admin-editor-heading">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <form className="content-admin-form" onSubmit={onSubmit}>
        {children}
      </form>
    </Card>
  );
}
