import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  adminSeminarEventListQueryOptions,
  seminarEventQueryKeys,
  type SeminarEventListItem,
} from "@entities/seminar-event";
import {
  finalizePostContent,
  getPostContentImagePaths,
  getRemovedPostContentImagePaths,
  postQueryKeys,
} from "@entities/post";
import {
  deletePostContentImageMutationOptions,
  uploadPostContentImageMutationOptions,
} from "@features/post-content-image";
import type { PostContentEditorState } from "@features/post-content-editor";
import {
  deletePostFileMutationOptions,
  uploadPostFileMutationOptions,
  type PendingPostFile,
  type PostFile,
} from "@features/post-file";
import { createSeminarEventMutationOptions } from "@features/seminar-event-create";
import { deleteSeminarEventMutationOptions } from "@features/seminar-event-delete";
import { updateSeminarEventMutationOptions } from "@features/seminar-event-update";
import { getErrorMessage } from "@shared/lib";
import { Button, Card, Modal, Notice } from "@shared/ui";

import {
  EMPTY_SEMINAR_EVENT_FORM,
  seminarEventFormToValues,
  seminarEventToForm,
  type SeminarEventFormState,
} from "../model/seminarEventForm";
import { SeminarEventForm } from "./SeminarEventForm";
import { SeminarEventList } from "./SeminarEventList";
import "./SeminarEventAdmin.css";

type SeminarEventAdminProps = {
  categoryControl: ReactNode;
  editingPostId?: string;
  enabled: boolean;
  onOpenEditor: (postId?: string) => void;
  onReturnToList: () => void;
  view: "list" | "write";
};

export function SeminarEventAdmin({
  categoryControl,
  editingPostId,
  enabled,
  onOpenEditor,
  onReturnToList,
  view,
}: SeminarEventAdminProps) {
  const queryClient = useQueryClient();
  const listQuery = useQuery({
    ...adminSeminarEventListQueryOptions({ pageSize: 100 }),
    enabled,
  });
  const createMutation = useMutation(createSeminarEventMutationOptions());
  const updateMutation = useMutation(updateSeminarEventMutationOptions());
  const deleteMutation = useMutation(deleteSeminarEventMutationOptions());
  const contentImageUploadMutation = useMutation(
    uploadPostContentImageMutationOptions(),
  );
  const contentImageDeleteMutation = useMutation(
    deletePostContentImageMutationOptions(),
  );
  const fileUploadMutation = useMutation(uploadPostFileMutationOptions());
  const fileDeleteMutation = useMutation(deletePostFileMutationOptions());

  const [form, setForm] = useState<SeminarEventFormState>(
    EMPTY_SEMINAR_EVENT_FORM,
  );
  const [editingEvent, setEditingEvent] = useState<SeminarEventListItem | null>(
    null,
  );
  const [deleteTargets, setDeleteTargets] = useState<SeminarEventListItem[]>(
    [],
  );
  const [selectedPostIds, setSelectedPostIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [newFiles, setNewFiles] = useState<PendingPostFile[]>([]);
  const [removedFileIds, setRemovedFileIds] = useState<string[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [cleanupWarning, setCleanupWarning] = useState<string | null>(null);
  const [formResetKey, setFormResetKey] = useState(0);

  useEffect(() => {
    if (view === "write" && editingPostId) {
      return;
    }

    setForm(EMPTY_SEMINAR_EVENT_FORM);
    setEditingEvent(null);
    setNewFiles([]);
    setRemovedFileIds([]);
    setFormResetKey((current) => current + 1);
  }, [editingPostId, view]);

  useEffect(() => {
    if (view !== "write" || !editingPostId) {
      return;
    }

    if (editingEvent?.post_id === editingPostId) {
      return;
    }

    const event = listQuery.data?.items.find(
      (item) => item.post_id === editingPostId,
    );

    if (!event) {
      return;
    }

    setEditingEvent(event);
    setForm(seminarEventToForm(event));
    setNewFiles([]);
    setRemovedFileIds([]);
    setFormResetKey((current) => current + 1);
    setActionError(null);
    setCleanupWarning(null);
  }, [editingEvent?.post_id, editingPostId, listQuery.data, view]);

  useEffect(() => {
    const availableIds = new Set(
      (listQuery.data?.items ?? []).map((event) => event.post_id),
    );
    setSelectedPostIds((currentIds) =>
      currentIds.filter((id) => availableIds.has(id)),
    );
  }, [listQuery.data]);

  const resetForm = () => {
    setForm(EMPTY_SEMINAR_EVENT_FORM);
    setFormResetKey((current) => current + 1);
    setEditingEvent(null);
    setNewFiles([]);
    setRemovedFileIds([]);
  };

  const invalidateSeminarQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: seminarEventQueryKeys.all }),
      queryClient.invalidateQueries({ queryKey: postQueryKeys.all }),
    ]);
  };

  const handleFilesAdd = (files: File[]) => {
    setNewFiles((currentFiles) => [
      ...currentFiles,
      ...files.map((file) => ({
        file,
        fileType: "attachment" as const,
        id: crypto.randomUUID(),
        previewUrl: null,
      })),
    ]);
    setActionError(null);
  };

  const handleNewFileRemove = (fileId: string) => {
    setNewFiles((currentFiles) =>
      currentFiles.filter((file) => file.id !== fileId),
    );
  };

  const handleExistingFileRemove = (fileId: string) => {
    setRemovedFileIds((currentIds) =>
      currentIds.includes(fileId) ? currentIds : [...currentIds, fileId],
    );
  };

  const handleSubmit = async (
    isPublished: boolean,
    editorState: PostContentEditorState,
  ) => {
    setActionError(null);
    setActionSuccess(null);
    setCleanupWarning(null);

    const previousThumbnailPath = editingEvent?.post.thumbnail_path ?? null;
    const submissionForm = { ...form, isPublished };
    let createdPostId: string | null = null;
    const uploadedContentImages = new Map<string, string>();
    const uploadedFilePaths = new Map<string, string>();
    const uploadedFiles: PostFile[] = [];

    try {
      const hasNewAssets = Boolean(
        editorState.pendingImages.length > 0 || newFiles.length > 0,
      );
      const initialContent = finalizePostContent(
        editorState.content,
        new Map(),
      );
      const initialValues = seminarEventFormToValues(
        {
          ...submissionForm,
          content: initialContent,
          isPublished: hasNewAssets ? false : isPublished,
        },
        {
        publishedAt: editingEvent?.post.published_at,
          thumbnailPath: editingEvent ? previousThumbnailPath : null,
        },
      );
      let postId = editingEvent?.post_id ?? null;

      if (!postId) {
        postId = await createMutation.mutateAsync(initialValues);
        createdPostId = postId;
      }

      for (const pendingImage of editorState.pendingImages) {
        const uploadedImage = await contentImageUploadMutation.mutateAsync({
          file: pendingImage.file,
          postId,
        });
        uploadedContentImages.set(pendingImage.id, uploadedImage.storagePath);
      }

      const remainingFiles =
        editingEvent?.post.files.filter(
          (file) =>
            file.file_type === "attachment" &&
            !removedFileIds.includes(file.id),
        ) ?? [];
      const nextSortOrder =
        Math.max(-1, ...remainingFiles.map((file) => file.sort_order)) + 1;

      for (const [index, pendingFile] of newFiles.entries()) {
        const uploadedFile = await fileUploadMutation.mutateAsync({
          file: pendingFile.file,
          fileType: "attachment",
          postId,
          sortOrder: nextSortOrder + index,
        });
        uploadedFiles.push(uploadedFile);
        uploadedFilePaths.set(pendingFile.id, uploadedFile.storage_path);
      }

      const finalContent = finalizePostContent(
        editorState.content,
        uploadedContentImages,
      );
      const finalThumbnailPath = (() => {
        if (!editorState.thumbnail) {
          return null;
        }

        if (editorState.thumbnail.kind === "stored") {
          return editorState.thumbnail.storagePath;
        }

        return editorState.thumbnail.kind === "content-upload"
          ? uploadedContentImages.get(editorState.thumbnail.uploadId) ?? null
          : uploadedFilePaths.get(editorState.thumbnail.uploadId) ?? null;
      })();
      const requiresUpdate = Boolean(editingEvent || hasNewAssets);

      if (requiresUpdate) {
        await updateMutation.mutateAsync({
          ...seminarEventFormToValues(
            { ...submissionForm, content: finalContent },
            {
            publishedAt: editingEvent?.post.published_at,
            thumbnailPath: finalThumbnailPath,
            },
          ),
          postId,
        });
      }

      const cleanupMessages: string[] = [];
      const imagePathsToRemove = new Set(
        getRemovedPostContentImagePaths(
          editingEvent?.post.content ?? "",
          finalContent,
        ),
      );
      const previousThumbnailFile = editingEvent?.post.files.find(
        (file) => file.storage_path === previousThumbnailPath,
      );
      const protectedPaths = new Set([
        ...getPostContentImagePaths(finalContent),
        ...remainingFiles.map((file) => file.storage_path),
        ...uploadedFiles.map((file) => file.storage_path),
      ]);

      if (
        previousThumbnailPath &&
        previousThumbnailPath !== finalThumbnailPath &&
        !previousThumbnailFile &&
        !protectedPaths.has(previousThumbnailPath)
      ) {
        imagePathsToRemove.add(previousThumbnailPath);
      }

      for (const storagePath of imagePathsToRemove) {
        try {
          await contentImageDeleteMutation.mutateAsync({
            postId,
            storagePath,
          });
        } catch (error) {
          cleanupMessages.push(`본문 이미지: ${getErrorMessage(error)}`);
        }
      }

      for (const fileId of removedFileIds) {
        try {
          await fileDeleteMutation.mutateAsync({ fileId, postId });
        } catch (error) {
          cleanupMessages.push(`첨부파일: ${getErrorMessage(error)}`);
        }
      }

      if (cleanupMessages.length > 0) {
        setCleanupWarning(
          `일정은 저장됐지만 일부 파일 정리에 실패했습니다. ${cleanupMessages.join(" / ")}`,
        );
      }

      await invalidateSeminarQueries();
      setActionSuccess(
        isPublished
          ? `세미나 일정이 ${editingEvent ? "수정 후" : "등록 후"} 공개되었습니다.`
          : "세미나 일정이 임시 저장되었습니다.",
      );
      resetForm();
      onReturnToList();
    } catch (error) {
      for (const uploadedFile of uploadedFiles) {
        try {
          await fileDeleteMutation.mutateAsync({
            fileId: uploadedFile.id,
            postId: uploadedFile.post_id,
          });
        } catch {
          // 새 첨부파일 정리 실패는 원래 저장 오류를 우선 표시한다.
        }
      }

      for (const storagePath of uploadedContentImages.values()) {
        try {
          await contentImageDeleteMutation.mutateAsync({
            postId: editingEvent?.post_id ?? createdPostId ?? "",
            storagePath,
          });
        } catch {
          // 새 본문 이미지 정리 실패는 원래 저장 오류를 우선 표시한다.
        }
      }

      if (createdPostId) {
        try {
          await deleteMutation.mutateAsync(createdPostId);
        } catch {
          // 롤백 실패 시 목록 재조회로 실제 저장 상태를 확인한다.
        }
      }

      await invalidateSeminarQueries();
      setActionError(getErrorMessage(error));
    }
  };

  const handleDelete = async () => {
    if (deleteTargets.length === 0) {
      return;
    }

    setActionError(null);
    setActionSuccess(null);
    setIsDeleting(true);

    const failedTargets: SeminarEventListItem[] = [];
    let deletedCount = 0;

    for (const target of deleteTargets) {
      try {
        await deleteMutation.mutateAsync(target.post_id);
        deletedCount += 1;
      } catch {
        failedTargets.push(target);
      }
    }

    setIsDeleting(false);
    setDeleteTargets([]);
    setSelectedPostIds(failedTargets.map((target) => target.post_id));
    await invalidateSeminarQueries();

    if (deletedCount > 0) {
      setActionSuccess(`세미나 일정 ${deletedCount}건을 삭제했습니다.`);
    }

    if (failedTargets.length > 0) {
      setActionError(
        `삭제하지 못한 세미나 ${failedTargets.length}건: ${failedTargets
          .map((target) => target.post.title)
          .join(", ")}`,
      );
    }
  };

  const selectedEvents = (listQuery.data?.items ?? []).filter((event) =>
    selectedPostIds.includes(event.post_id),
  );
  const requestedEditingEvent = listQuery.data?.items.find(
    (event) => event.post_id === editingPostId,
  );
  const isSaving =
    createMutation.isPending ||
    updateMutation.isPending ||
    contentImageUploadMutation.isPending ||
    contentImageDeleteMutation.isPending ||
    fileUploadMutation.isPending ||
    fileDeleteMutation.isPending;
  const visibleExistingFiles =
    editingEvent?.post.files.filter(
      (file) =>
        file.file_type === "attachment" && !removedFileIds.includes(file.id),
    ) ?? [];
  const editingEventMissing =
    view === "write" &&
    Boolean(editingPostId) &&
    !listQuery.isPending &&
    !listQuery.error &&
    !requestedEditingEvent;
  const editingEventLoading =
    view === "write" && Boolean(editingPostId) && !editingEvent;

  return (
    <div className="seminar-admin-manager">
      {actionError ? (
        <Notice tone="danger" title="처리하지 못했습니다.">
          {actionError}
        </Notice>
      ) : null}
      {actionSuccess ? (
        <Notice tone="teal" title="처리가 완료되었습니다.">
          {actionSuccess}
        </Notice>
      ) : null}
      {cleanupWarning ? (
        <Notice tone="warning" title="파일 정리가 필요합니다.">
          {cleanupWarning}
        </Notice>
      ) : null}

      {view === "write" && editingPostId && listQuery.error ? (
        <Notice tone="danger" title="수정할 세미나를 불러오지 못했습니다.">
          {getErrorMessage(listQuery.error)}
        </Notice>
      ) : null}

      {editingEventLoading && !editingEventMissing && !listQuery.error ? (
        <Card className="seminar-admin-empty-card">
          수정할 세미나를 불러오는 중입니다.
        </Card>
      ) : null}

      {view === "write" && !editingEventLoading && !editingEventMissing ? (
        <SeminarEventForm
          key={formResetKey}
          categoryControl={categoryControl}
          currentThumbnailPath={editingEvent?.post.thumbnail_path ?? null}
          disabled={!enabled || Boolean(editingPostId && !editingEvent)}
          existingFiles={visibleExistingFiles}
          form={form}
          isEditing={Boolean(editingEvent)}
          isSubmitting={isSaving}
          newFiles={newFiles}
          onChange={setForm}
          onExistingFileRemove={handleExistingFileRemove}
          onFilesAdd={handleFilesAdd}
          onNewFileRemove={handleNewFileRemove}
          onReturnToList={onReturnToList}
          onSubmit={handleSubmit}
        />
      ) : null}

      {editingEventMissing ? (
        <Notice tone="warning" title="수정할 세미나를 찾을 수 없습니다.">
          삭제되었거나 현재 카테고리에 속하지 않은 일정입니다.
        </Notice>
      ) : null}

      {view === "list" ? (
        <SeminarEventList
          errorMessage={
            listQuery.error ? getErrorMessage(listQuery.error) : null
          }
          isLoading={listQuery.isPending}
          items={listQuery.data?.items ?? []}
          categoryControl={categoryControl}
          selectedPostIds={selectedPostIds}
          total={listQuery.data?.total ?? 0}
          onCreate={() => onOpenEditor()}
          onDelete={(event) => setDeleteTargets([event])}
          onDeleteSelected={() => setDeleteTargets(selectedEvents)}
          onEdit={(event) => onOpenEditor(event.post_id)}
          onSelectedPostIdsChange={setSelectedPostIds}
        />
      ) : null}

      <Modal
        open={deleteTargets.length > 0}
        title={
          deleteTargets.length > 1
            ? `세미나 일정 ${deleteTargets.length}건 삭제`
            : "세미나 일정 삭제"
        }
        onClose={() => setDeleteTargets([])}
      >
        <p className="seminar-admin-delete-copy">
          선택한 일정과 연결된 본문 이미지·대표 이미지·첨부파일을 함께
          삭제합니다. 이 작업은 되돌릴 수 없습니다.
        </p>
        {deleteTargets.length > 1 ? (
          <ul className="seminar-admin-delete-targets">
            {deleteTargets.map((target) => (
              <li key={target.post_id}>{target.post.title}</li>
            ))}
          </ul>
        ) : null}
        <div className="seminar-admin-delete-actions">
          <Button
            disabled={isDeleting}
            variant="ghost"
            onClick={() => setDeleteTargets([])}
          >
            취소
          </Button>
          <Button disabled={isDeleting} onClick={() => void handleDelete()}>
            {isDeleting ? "삭제 중..." : `${deleteTargets.length}건 삭제`}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
