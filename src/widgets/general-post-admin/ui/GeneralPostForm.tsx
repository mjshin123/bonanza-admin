import { useCallback, useMemo, useState, type ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import type { Organization } from "@entities/organization";
import { PostTagSelector, type LegacyAdminPostListItem } from "@entities/post";
import {
  PostContentEditor,
  type PostContentEditorState,
} from "@features/post-content-editor";
import { PostFileField, type PendingPostFile } from "@features/post-file";
import { Button, Input } from "@shared/ui";

import type {
  GeneralPostFormState,
  GeneralPostMode,
} from "../model/generalPostForm";
import { createGeneralPostFormSchema } from "../model/generalPostFormSchema";

type GeneralPostFormProps = {
  boardCode: string;
  boardName: string;
  categoryControl: ReactNode;
  currentThumbnailPath: string | null;
  disabled?: boolean;
  existingAttachments: LegacyAdminPostListItem["files"];
  existingGalleryImages: LegacyAdminPostListItem["files"];
  form: GeneralPostFormState;
  isEditing: boolean;
  isSubmitting: boolean;
  mode: GeneralPostMode;
  newAttachments: PendingPostFile[];
  newGalleryImages: PendingPostFile[];
  onChange: (nextForm: GeneralPostFormState) => void;
  onExistingFileRemove: (fileId: string) => void;
  onFilesAdd: (files: File[], fileType: "attachment" | "gallery_image") => void;
  onNewFileRemove: (fileId: string) => void;
  onReturnToList: () => void;
  onSubmit: (
    isPublished: boolean,
    editorState: PostContentEditorState,
  ) => Promise<void> | void;
  organizations: Organization[];
  organizationsLoading: boolean;
};

export function GeneralPostForm({
  boardCode,
  boardName,
  categoryControl,
  currentThumbnailPath,
  disabled = false,
  existingAttachments,
  existingGalleryImages,
  form,
  isEditing,
  isSubmitting,
  mode,
  newAttachments,
  newGalleryImages,
  onChange,
  onExistingFileRemove,
  onFilesAdd,
  onNewFileRemove,
  onReturnToList,
  onSubmit,
  organizations,
  organizationsLoading,
}: GeneralPostFormProps) {
  const schema = useMemo(() => createGeneralPostFormSchema(mode), [mode]);
  const [editorState, setEditorState] = useState<PostContentEditorState>({
    content: mode === "gallery" ? "" : form.content,
    pendingImages: [],
    thumbnail:
      mode !== "gallery" && currentThumbnailPath
        ? { kind: "stored", storagePath: currentThumbnailPath }
        : null,
  });
  const [galleryError, setGalleryError] = useState<string | null>(null);
  const [resourceFileError, setResourceFileError] = useState<string | null>(
    null,
  );
  const {
    formState: { errors, isSubmitting: isFormSubmitting },
    handleSubmit,
    register,
    setValue,
  } = useForm<GeneralPostFormState>({
    defaultValues: form,
    mode: "onBlur",
    reValidateMode: "onChange",
    resolver: zodResolver(schema),
    shouldFocusError: true,
  });

  const updateField = <Key extends keyof GeneralPostFormState>(
    key: Key,
    value: GeneralPostFormState[Key],
  ) => onChange({ ...form, [key]: value });
  const titleField = register("title", {
    onChange: (event) => updateField("title", event.target.value),
  });
  const captionField = register("caption", {
    onChange: (event) => updateField("caption", event.target.value),
  });
  const organizationField = register("organizationId", {
    onChange: (event) => updateField("organizationId", event.target.value),
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
  const handleDraftSubmit = handleSubmit(() => {
    setGalleryError(null);
    setResourceFileError(null);
    return onSubmit(false, editorState);
  });
  const handlePublishSubmit = handleSubmit(() => {
    if (
      mode === "gallery" &&
      existingGalleryImages.length + newGalleryImages.length === 0
    ) {
      setGalleryError("공개하려면 사진을 1장 이상 등록해주세요.");
      return;
    }

    if (
      mode === "resource" &&
      existingAttachments.length + newAttachments.length === 0
    ) {
      setResourceFileError("공개하려면 첨부파일을 1개 이상 등록해주세요.");
      return;
    }

    setGalleryError(null);
    setResourceFileError(null);
    return onSubmit(true, editorState);
  });

  return (
    <section className="general-post-form-page">
      <div className="general-post-form-heading">
        <h1>{isEditing ? "게시물 수정" : "게시물 등록"}</h1>
        <Button size="sm" variant="secondary" onClick={onReturnToList}>
          뒤로가기
        </Button>
      </div>

      <form
        noValidate
        className="general-post-form"
        onSubmit={handlePublishSubmit}
      >
        <input
          {...register("isPublished")}
          checked={form.isPublished}
          hidden
          readOnly
          type="checkbox"
        />

        <div className="general-post-form-toolbar">
          <div className="general-post-form-category">{categoryControl}</div>
          {mode !== "gallery" && mode !== "resource" ? (
            <label className="general-post-pinned-field">
              <input
                {...pinnedField}
                checked={form.isPinned}
                disabled={disabled}
                type="checkbox"
              />
              <span>상단 고정</span>
            </label>
          ) : null}
        </div>

        <Input
          {...titleField}
          aria-invalid={Boolean(errors.title)}
          disabled={disabled}
          error={errors.title?.message}
          label="제목"
          maxLength={200}
          placeholder={`${boardName} 제목을 입력하세요`}
          value={form.title}
        />

        {mode !== "resource" ? (
          <div className="general-post-textarea-field">
            <label htmlFor={`general-post-caption-${boardCode}`}>캡션</label>
            <textarea
              {...captionField}
              aria-invalid={Boolean(errors.caption)}
              disabled={disabled}
              id={`general-post-caption-${boardCode}`}
              maxLength={200}
              placeholder="목록에서 제목 아래에 표시할 요약을 입력하세요"
              rows={3}
              value={form.caption}
            />
            {errors.caption ? (
              <span className="general-post-field-error">
                {errors.caption.message}
              </span>
            ) : null}
          </div>
        ) : null}

        {mode === "member-news" ? (
          <div className="general-post-select-field">
            <label htmlFor={`general-post-organization-${boardCode}`}>
              회원사
            </label>
            <select
              {...organizationField}
              aria-invalid={Boolean(errors.organizationId)}
              disabled={disabled || organizationsLoading}
              id={`general-post-organization-${boardCode}`}
              value={form.organizationId}
            >
              <option value="">
                {organizationsLoading
                  ? "회원사 불러오는 중..."
                  : "회원사를 선택하세요"}
              </option>
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </select>
            {errors.organizationId ? (
              <span className="general-post-field-error">
                {errors.organizationId.message}
              </span>
            ) : null}
          </div>
        ) : null}

        {mode !== "resource" ? (
          <>
            <PostTagSelector
              disabled={disabled}
              selectedTags={form.tags}
              onChange={handleTagsChange}
            />
            {errors.tags ? (
              <span className="general-post-field-error">
                {errors.tags.message}
              </span>
            ) : null}
          </>
        ) : null}

        {mode !== "gallery" && mode !== "resource" ? (
          <>
            <input {...contentField} type="hidden" value={form.content} />
            <PostContentEditor
              currentThumbnailPath={currentThumbnailPath}
              disabled={disabled}
              error={errors.content?.message}
              value={form.content}
              onChange={handleContentChange}
              onStateChange={handleEditorStateChange}
            />
          </>
        ) : null}

        {mode === "gallery" ? (
          <PostFileField
            disabled={disabled}
            existingFiles={existingGalleryImages}
            inputId={`general-post-gallery-${boardCode}`}
            mode="gallery"
            newFiles={newGalleryImages}
            onExistingFileRemove={onExistingFileRemove}
            onFilesAdd={(files) => {
              setGalleryError(null);
              onFilesAdd(files, "gallery_image");
            }}
            onNewFileRemove={onNewFileRemove}
          />
        ) : null}
        {galleryError ? (
          <span className="general-post-field-error">{galleryError}</span>
        ) : null}

        {mode !== "gallery" ? (
          <PostFileField
            disabled={disabled}
            existingFiles={existingAttachments}
            inputId={`general-post-attachments-${boardCode}`}
            newFiles={newAttachments}
            onExistingFileRemove={onExistingFileRemove}
            onFilesAdd={(files) => {
              setResourceFileError(null);
              onFilesAdd(files, "attachment");
            }}
            onNewFileRemove={onNewFileRemove}
          />
        ) : null}
        {resourceFileError ? (
          <span className="general-post-field-error">{resourceFileError}</span>
        ) : null}

        <div className="general-post-form-actions">
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
