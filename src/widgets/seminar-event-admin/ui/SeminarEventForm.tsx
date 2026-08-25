import { useCallback, useState, type ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { PostTagSelector } from "@entities/post";
import {
  PostContentEditor,
  type PostContentEditorState,
} from "@features/post-content-editor";
import {
  PostFileField,
  type PendingPostFile,
  type PostFile,
} from "@features/post-file";
import { Button, Input } from "@shared/ui";

import type { SeminarEventFormState } from "../model/seminarEventForm";
import { seminarEventFormSchema } from "../model/seminarEventFormSchema";

type SeminarEventFormProps = {
  categoryControl: ReactNode;
  currentThumbnailPath: string | null;
  disabled?: boolean;
  existingFiles: PostFile[];
  form: SeminarEventFormState;
  isEditing: boolean;
  isSubmitting: boolean;
  newFiles: PendingPostFile[];
  onChange: (nextForm: SeminarEventFormState) => void;
  onExistingFileRemove: (fileId: string) => void;
  onFilesAdd: (files: File[]) => void;
  onNewFileRemove: (fileId: string) => void;
  onReturnToList: () => void;
  onSubmit: (
    isPublished: boolean,
    editorState: PostContentEditorState,
  ) => Promise<void> | void;
};

export function SeminarEventForm({
  categoryControl,
  currentThumbnailPath,
  disabled = false,
  existingFiles,
  form,
  isEditing,
  isSubmitting,
  newFiles,
  onChange,
  onExistingFileRemove,
  onFilesAdd,
  onNewFileRemove,
  onReturnToList,
  onSubmit,
}: SeminarEventFormProps) {
  const [editorState, setEditorState] = useState<PostContentEditorState>({
    content: form.content,
    pendingImages: [],
    thumbnail: currentThumbnailPath
      ? { kind: "stored", storagePath: currentThumbnailPath }
      : null,
  });
  const {
    formState: { errors, isSubmitting: isFormSubmitting },
    handleSubmit,
    register,
    setValue,
  } = useForm<SeminarEventFormState>({
    defaultValues: form,
    mode: "onBlur",
    reValidateMode: "onChange",
    resolver: zodResolver(seminarEventFormSchema),
    shouldFocusError: true,
  });
  const updateField = <Key extends keyof SeminarEventFormState>(
    key: Key,
    value: SeminarEventFormState[Key],
  ) => {
    onChange({ ...form, [key]: value });
  };
  const titleField = register("title", {
    onChange: (event) => updateField("title", event.target.value),
  });
  const topicField = register("topic", {
    onChange: (event) => updateField("topic", event.target.value),
  });
  const startsAtField = register("startsAt", {
    onChange: (event) => updateField("startsAt", event.target.value),
  });
  const endsAtField = register("endsAt", {
    onChange: (event) => updateField("endsAt", event.target.value),
  });
  const registrationDeadlineField = register("registrationDeadline", {
    onChange: (event) =>
      updateField("registrationDeadline", event.target.value),
  });
  const locationField = register("location", {
    onChange: (event) => updateField("location", event.target.value),
  });
  const capacityField = register("capacity", {
    onChange: (event) => updateField("capacity", event.target.value),
  });
  const applicationMethodField = register("applicationMethod", {
    onChange: (event) => updateField("applicationMethod", event.target.value),
  });
  const applicationUrlField = register("applicationUrl", {
    onChange: (event) => updateField("applicationUrl", event.target.value),
  });
  const contentField = register("content");
  const pinnedField = register("isPinned", {
    onChange: (event) => updateField("isPinned", event.target.checked),
  });

  const handleTagsChange = (tags: string[]) => {
    setValue("tags", tags, {
      shouldDirty: true,
      shouldValidate: true,
    });
    updateField("tags", tags);
  };

  const handleContentChange = (content: string) => {
    setValue("content", content, {
      shouldDirty: true,
      shouldValidate: true,
    });
    updateField("content", content);
  };

  const handleEditorStateChange = useCallback(
    (nextState: PostContentEditorState) => setEditorState(nextState),
    [],
  );

  const submitting = isSubmitting || isFormSubmitting;
  const handleDraftSubmit = handleSubmit(() => onSubmit(false, editorState));
  const handlePublishSubmit = handleSubmit(() => onSubmit(true, editorState));

  return (
    <section className="seminar-admin-form-page">
      <div className="seminar-admin-form-heading">
        <h1>{isEditing ? "게시물 수정" : "게시물 등록"}</h1>
        <Button size="sm" variant="secondary" onClick={onReturnToList}>
          뒤로가기
        </Button>
      </div>

      <form
        noValidate
        className="seminar-admin-form"
        onSubmit={handlePublishSubmit}
      >
        <input
          {...register("isPublished")}
          checked={form.isPublished}
          hidden
          readOnly
          type="checkbox"
        />

        <div className="seminar-admin-form-toolbar">
          <div className="seminar-admin-form-category">{categoryControl}</div>
          <label className="seminar-admin-pinned-field">
            <input
              {...pinnedField}
              checked={form.isPinned}
              disabled={disabled}
              type="checkbox"
            />
            <span>상단 고정</span>
          </label>
        </div>

        <div className="seminar-admin-form-grid seminar-admin-form-grid--wide">
          <Input
            {...titleField}
            aria-invalid={Boolean(errors.title)}
            disabled={disabled}
            error={errors.title?.message}
            label="행사명"
            maxLength={200}
            placeholder="예: 제13회 금융범죄 예방 세미나"
            value={form.title}
          />
          <Input
            {...topicField}
            aria-invalid={Boolean(errors.topic)}
            disabled={disabled}
            error={errors.topic?.message}
            label="주제"
            maxLength={200}
            placeholder="행사의 핵심 주제를 입력하세요"
            value={form.topic}
          />
        </div>

        <PostTagSelector
          disabled={disabled}
          selectedTags={form.tags}
          onChange={handleTagsChange}
        />
        {errors.tags ? (
          <span className="seminar-admin-field-error">
            {errors.tags.message}
          </span>
        ) : null}

        <div className="seminar-admin-form-grid">
          <Input
            {...startsAtField}
            aria-invalid={Boolean(errors.startsAt)}
            disabled={disabled}
            error={errors.startsAt?.message}
            label="시작 일시"
            type="datetime-local"
            value={form.startsAt}
          />
          <Input
            {...endsAtField}
            aria-invalid={Boolean(errors.endsAt)}
            disabled={disabled}
            error={errors.endsAt?.message}
            label="종료 일시"
            type="datetime-local"
            value={form.endsAt}
          />
          <Input
            {...registrationDeadlineField}
            aria-invalid={Boolean(errors.registrationDeadline)}
            disabled={disabled}
            error={errors.registrationDeadline?.message}
            label="접수 마감일"
            type="datetime-local"
            value={form.registrationDeadline}
          />
        </div>

        <div className="seminar-admin-form-grid seminar-admin-form-grid--location">
          <Input
            {...locationField}
            aria-invalid={Boolean(errors.location)}
            disabled={disabled}
            error={errors.location?.message}
            label="장소"
            maxLength={300}
            placeholder="행사 장소 또는 온라인 진행 정보를 입력하세요"
            value={form.location}
          />
          <Input
            {...capacityField}
            aria-invalid={Boolean(errors.capacity)}
            disabled={disabled}
            error={errors.capacity?.message}
            label="신청 인원"
            min={1}
            placeholder="제한 없음"
            type="number"
            value={form.capacity}
          />
        </div>

        <div className="seminar-admin-form-grid seminar-admin-form-grid--wide">
          <Input
            {...applicationMethodField}
            disabled={disabled}
            label="신청 방법"
            placeholder="예: 온라인 신청서 작성"
            value={form.applicationMethod}
          />
          <Input
            {...applicationUrlField}
            aria-invalid={Boolean(errors.applicationUrl)}
            disabled={disabled}
            error={errors.applicationUrl?.message}
            label="신청 링크"
            placeholder="https://"
            type="url"
            value={form.applicationUrl}
          />
        </div>

        <input {...contentField} type="hidden" value={form.content} />
        <PostContentEditor
          currentThumbnailPath={currentThumbnailPath}
          disabled={disabled}
          error={errors.content?.message}
          label="상세 설명"
          placeholder="행사 소개와 주요 내용을 입력하세요"
          value={form.content}
          onChange={handleContentChange}
          onStateChange={handleEditorStateChange}
        />

        <PostFileField
          disabled={disabled}
          existingFiles={existingFiles}
          inputId="seminar-attachments"
          newFiles={newFiles}
          onExistingFileRemove={onExistingFileRemove}
          onFilesAdd={onFilesAdd}
          onNewFileRemove={onNewFileRemove}
        />

        <div className="seminar-admin-form-actions">
          <Button
            disabled={disabled || submitting}
            size="lg"
            type="button"
            variant="secondary"
            onClick={() => void handleDraftSubmit()}
          >
            {submitting ? "저장 중..." : "임시저장"}
          </Button>
          <Button disabled={disabled || submitting} size="lg" type="submit">
            {submitting ? "저장 중..." : isEditing ? "수정" : "등록"}
          </Button>
        </div>
      </form>
    </section>
  );
}
