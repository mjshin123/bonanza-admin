import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { Board } from "@entities/board";
import { organizationsQueryOptions } from "@entities/organization";
import {
  adminPostListQueryOptions,
  finalizePostContent,
  getPostContentImagePaths,
  getRemovedPostContentImagePaths,
  postQueryKeys,
  type LegacyAdminPostListItem,
} from "@entities/post";
import {
  deletePostContentImageMutationOptions,
  uploadPostContentImageMutationOptions,
} from "@features/post-content-image";
import type { PostContentEditorState } from "@features/post-content-editor";
import { createPostMutationOptions } from "@features/post-create";
import { deletePostMutationOptions } from "@features/post-delete";
import {
  deletePostFileMutationOptions,
  uploadPostFileMutationOptions,
  type PendingPostFile,
  type PostFile,
  type PostFileType,
} from "@features/post-file";
import { updatePostMutationOptions } from "@features/post-update";
import { getErrorMessage } from "@shared/lib";
import { Button, Card, Modal, Notice } from "@shared/ui";

import {
  EMPTY_GENERAL_POST_FORM,
  postToGeneralForm,
  resolveGeneralPostMode,
  type GeneralPostFormState,
} from "../model/generalPostForm";
import { GeneralPostForm } from "./GeneralPostForm";
import { GeneralPostList } from "./GeneralPostList";
import "./GeneralPostAdmin.css";

type GeneralPostAdminProps = {
  board: Board;
  categoryControl: ReactNode;
  editingPostId?: string;
  enabled: boolean;
  onOpenEditor: (postId?: string) => void;
  onReturnToList: () => void;
  view: "list" | "write";
};

export function GeneralPostAdmin({
  board,
  categoryControl,
  editingPostId,
  enabled,
  onOpenEditor,
  onReturnToList,
  view,
}: GeneralPostAdminProps) {
  const queryClient = useQueryClient();
  const mode = resolveGeneralPostMode(board.code);
  const listQuery = useQuery({
    ...adminPostListQueryOptions(board.code),
    enabled,
  });
  const organizationsQuery = useQuery({
    ...organizationsQueryOptions({ type: "member" }),
    enabled: enabled && mode === "member-news",
  });
  const createMutation = useMutation(createPostMutationOptions());
  const updateMutation = useMutation(updatePostMutationOptions());
  const deleteMutation = useMutation(deletePostMutationOptions());
  const contentImageUploadMutation = useMutation(
    uploadPostContentImageMutationOptions(),
  );
  const contentImageDeleteMutation = useMutation(
    deletePostContentImageMutationOptions(),
  );
  const fileUploadMutation = useMutation(uploadPostFileMutationOptions());
  const fileDeleteMutation = useMutation(deletePostFileMutationOptions());

  const [form, setForm] = useState<GeneralPostFormState>(
    EMPTY_GENERAL_POST_FORM,
  );
  const [editingPost, setEditingPost] =
    useState<LegacyAdminPostListItem | null>(null);
  const [deleteTargets, setDeleteTargets] = useState<LegacyAdminPostListItem[]>(
    [],
  );
  const [selectedPostIds, setSelectedPostIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [newFiles, setNewFiles] = useState<PendingPostFile[]>([]);
  const newFilesRef = useRef<PendingPostFile[]>([]);
  const [removedFileIds, setRemovedFileIds] = useState<string[]>([]);
  const [formResetKey, setFormResetKey] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [cleanupWarning, setCleanupWarning] = useState<string | null>(null);

  useEffect(() => {
    newFilesRef.current = newFiles;
  }, [newFiles]);

  useEffect(
    () => () => {
      for (const file of newFilesRef.current) {
        if (file.previewUrl) {
          URL.revokeObjectURL(file.previewUrl);
        }
      }
    },
    [],
  );

  const clearNewFiles = () => {
    for (const file of newFilesRef.current) {
      if (file.previewUrl) {
        URL.revokeObjectURL(file.previewUrl);
      }
    }

    newFilesRef.current = [];
    setNewFiles([]);
  };

  useEffect(() => {
    if (view === "write" && editingPostId) {
      return;
    }

    setForm(EMPTY_GENERAL_POST_FORM);
    setEditingPost(null);
    clearNewFiles();
    setRemovedFileIds([]);
    setFormResetKey((currentKey) => currentKey + 1);
  }, [editingPostId, view]);

  useEffect(() => {
    if (view !== "write" || !editingPostId) {
      return;
    }

    if (editingPost?.id === editingPostId) {
      return;
    }

    const post = listQuery.data?.items.find(
      (item) => item.id === editingPostId,
    );

    if (!post) {
      return;
    }

    setEditingPost(post);
    setForm(postToGeneralForm(post));
    clearNewFiles();
    setRemovedFileIds([]);
    setFormResetKey((currentKey) => currentKey + 1);
    setActionError(null);
    setCleanupWarning(null);
  }, [editingPost?.id, editingPostId, listQuery.data, view]);

  useEffect(() => {
    const availableIds = new Set(
      (listQuery.data?.items ?? []).map((post) => post.id),
    );
    setSelectedPostIds((currentIds) =>
      currentIds.filter((id) => availableIds.has(id)),
    );
  }, [listQuery.data]);

  const resetForm = () => {
    setForm(EMPTY_GENERAL_POST_FORM);
    setEditingPost(null);
    clearNewFiles();
    setRemovedFileIds([]);
    setFormResetKey((currentKey) => currentKey + 1);
  };

  const invalidatePostQueries = async () => {
    await queryClient.invalidateQueries({ queryKey: postQueryKeys.all });
  };

  const handleFilesAdd = (files: File[], fileType: PostFileType) => {
    const pendingFiles = files.map((file) => ({
      file,
      fileType,
      id: crypto.randomUUID(),
      previewUrl:
        fileType === "gallery_image" ? URL.createObjectURL(file) : null,
    }));
    setNewFiles((currentFiles) => [...currentFiles, ...pendingFiles]);
    setActionError(null);
  };

  const handleNewFileRemove = (fileId: string) => {
    setNewFiles((currentFiles) => {
      const removedFile = currentFiles.find((file) => file.id === fileId);

      if (removedFile?.previewUrl) {
        URL.revokeObjectURL(removedFile.previewUrl);
      }

      return currentFiles.filter((file) => file.id !== fileId);
    });
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

    const previousThumbnailPath = editingPost?.thumbnail_path ?? null;
    let createdPostId: string | null = null;
    const uploadedContentImages = new Map<string, string>();
    const uploadedFilePaths = new Map<string, string>();
    const uploadedFiles: PostFile[] = [];

    try {
      let postId = editingPost?.id ?? null;
      const hasNewAssets = Boolean(
        (mode !== "gallery" && editorState.pendingImages.length > 0) ||
        newFiles.length > 0,
      );
      const initialContent =
        mode === "gallery"
          ? ""
          : finalizePostContent(editorState.content, new Map());

      if (!postId) {
        const createdPost = await createMutation.mutateAsync({
          boardId: board.id,
          content: initialContent,
          isPinned: mode === "gallery" ? false : form.isPinned,
          isPublished: hasNewAssets ? false : isPublished,
          organizationId: mode === "member-news" ? form.organizationId : null,
          tags: form.tags,
          thumbnailPath: null,
          title: form.title,
        });
        postId = createdPost.id;
        createdPostId = createdPost.id;
      }

      if (mode !== "gallery") {
        for (const pendingImage of editorState.pendingImages) {
          const uploadedImage = await contentImageUploadMutation.mutateAsync({
            file: pendingImage.file,
            postId,
          });
          uploadedContentImages.set(pendingImage.id, uploadedImage.storagePath);
        }
      }

      const remainingFiles =
        editingPost?.files.filter(
          (file) => !removedFileIds.includes(file.id),
        ) ?? [];
      const nextSortOrderByType: Record<PostFileType, number> = {
        attachment:
          Math.max(
            -1,
            ...remainingFiles
              .filter((file) => file.file_type === "attachment")
              .map((file) => file.sort_order),
          ) + 1,
        gallery_image:
          Math.max(
            -1,
            ...remainingFiles
              .filter((file) => file.file_type === "gallery_image")
              .map((file) => file.sort_order),
          ) + 1,
      };

      for (const pendingFile of newFiles) {
        const uploadedFile = await fileUploadMutation.mutateAsync({
          file: pendingFile.file,
          fileType: pendingFile.fileType,
          postId,
          sortOrder: nextSortOrderByType[pendingFile.fileType]++,
        });
        uploadedFiles.push(uploadedFile);
        uploadedFilePaths.set(pendingFile.id, uploadedFile.storage_path);
      }

      const finalContent =
        mode === "gallery"
          ? ""
          : finalizePostContent(editorState.content, uploadedContentImages);
      const finalThumbnailPath = (() => {
        if (mode === "gallery") {
          return null;
        }

        if (!editorState.thumbnail) {
          return null;
        }

        if (editorState.thumbnail.kind === "stored") {
          return editorState.thumbnail.storagePath;
        }

        return editorState.thumbnail.kind === "content-upload"
          ? (uploadedContentImages.get(editorState.thumbnail.uploadId) ?? null)
          : (uploadedFilePaths.get(editorState.thumbnail.uploadId) ?? null);
      })();

      if (editingPost || hasNewAssets) {
        await updateMutation.mutateAsync({
          content: finalContent,
          id: postId,
          isPinned: mode === "gallery" ? false : form.isPinned,
          isPublished,
          organizationId: mode === "member-news" ? form.organizationId : null,
          publishedAt: editingPost?.published_at,
          tags: form.tags,
          thumbnailPath: finalThumbnailPath,
          title: form.title,
        });
      }

      const cleanupMessages: string[] = [];
      const imagePathsToRemove = new Set(
        mode === "gallery"
          ? []
          : getRemovedPostContentImagePaths(
              editingPost?.content ?? "",
              finalContent,
            ),
      );
      const previousThumbnailFile = editingPost?.files.find(
        (file) => file.storage_path === previousThumbnailPath,
      );
      const protectedPaths = new Set([
        ...getPostContentImagePaths(finalContent),
        ...remainingFiles.map((file) => file.storage_path),
        ...uploadedFiles.map((file) => file.storage_path),
      ]);

      if (
        mode !== "gallery" &&
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
          `게시물은 저장됐지만 일부 파일 정리에 실패했습니다. ${cleanupMessages.join(" / ")}`,
        );
      }

      await invalidatePostQueries();
      setActionSuccess(
        isPublished
          ? `${board.name} 게시물이 ${editingPost ? "수정 후" : "등록 후"} 공개되었습니다.`
          : `${board.name} 게시물이 임시 저장되었습니다.`,
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
            postId: editingPost?.id ?? createdPostId ?? "",
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

      await invalidatePostQueries();
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

    const failedTargets: LegacyAdminPostListItem[] = [];
    let deletedCount = 0;

    for (const target of deleteTargets) {
      try {
        await deleteMutation.mutateAsync(target.id);
        deletedCount += 1;
      } catch {
        failedTargets.push(target);
      }
    }

    setIsDeleting(false);
    setDeleteTargets([]);
    setSelectedPostIds(failedTargets.map((target) => target.id));
    await invalidatePostQueries();

    if (deletedCount > 0) {
      setActionSuccess(
        `${board.name} 게시물 ${deletedCount}건을 삭제했습니다.`,
      );
    }

    if (failedTargets.length > 0) {
      setActionError(
        `삭제하지 못한 게시물 ${failedTargets.length}건: ${failedTargets
          .map((target) => target.title)
          .join(", ")}`,
      );
    }
  };

  const selectedPosts = (listQuery.data?.items ?? []).filter((post) =>
    selectedPostIds.includes(post.id),
  );
  const requestedEditingPost = listQuery.data?.items.find(
    (post) => post.id === editingPostId,
  );
  const isSaving =
    createMutation.isPending ||
    updateMutation.isPending ||
    contentImageUploadMutation.isPending ||
    contentImageDeleteMutation.isPending ||
    fileUploadMutation.isPending ||
    fileDeleteMutation.isPending;
  const visibleExistingAttachments =
    editingPost?.files.filter(
      (file) =>
        file.file_type === "attachment" && !removedFileIds.includes(file.id),
    ) ?? [];
  const visibleExistingGalleryImages =
    editingPost?.files.filter(
      (file) =>
        file.file_type === "gallery_image" && !removedFileIds.includes(file.id),
    ) ?? [];
  const editingPostMissing =
    view === "write" &&
    Boolean(editingPostId) &&
    !listQuery.isPending &&
    !listQuery.error &&
    !requestedEditingPost;
  const editingPostLoading =
    view === "write" && Boolean(editingPostId) && !editingPost;

  return (
    <div className="general-post-manager">
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
      {organizationsQuery.error ? (
        <Notice tone="danger" title="회원사 목록을 불러오지 못했습니다.">
          {getErrorMessage(organizationsQuery.error)}
        </Notice>
      ) : null}

      {view === "write" && editingPostId && listQuery.error ? (
        <Notice tone="danger" title="수정할 게시물을 불러오지 못했습니다.">
          {getErrorMessage(listQuery.error)}
        </Notice>
      ) : null}

      {editingPostLoading && !editingPostMissing && !listQuery.error ? (
        <Card className="general-post-empty-card">
          수정할 게시물을 불러오는 중입니다.
        </Card>
      ) : null}

      {view === "write" && !editingPostLoading && !editingPostMissing ? (
        <GeneralPostForm
          key={formResetKey}
          boardCode={board.code}
          boardName={board.name}
          categoryControl={categoryControl}
          currentThumbnailPath={editingPost?.thumbnail_path ?? null}
          disabled={!enabled || Boolean(editingPostId && !editingPost)}
          existingAttachments={visibleExistingAttachments}
          existingGalleryImages={visibleExistingGalleryImages}
          form={form}
          isEditing={Boolean(editingPost)}
          isSubmitting={isSaving}
          mode={mode}
          newAttachments={newFiles.filter(
            (file) => file.fileType === "attachment",
          )}
          newGalleryImages={newFiles.filter(
            (file) => file.fileType === "gallery_image",
          )}
          onChange={setForm}
          onExistingFileRemove={handleExistingFileRemove}
          onFilesAdd={handleFilesAdd}
          onNewFileRemove={handleNewFileRemove}
          onReturnToList={onReturnToList}
          onSubmit={handleSubmit}
          organizations={organizationsQuery.data ?? []}
          organizationsLoading={
            organizationsQuery.isPending && mode === "member-news"
          }
        />
      ) : null}

      {editingPostMissing ? (
        <Notice tone="warning" title="수정할 게시물을 찾을 수 없습니다.">
          삭제되었거나 현재 카테고리에 속하지 않은 게시물입니다.
        </Notice>
      ) : null}

      {view === "list" ? (
        <GeneralPostList
          boardCode={board.code}
          boardName={board.name}
          errorMessage={
            listQuery.error ? getErrorMessage(listQuery.error) : null
          }
          isLoading={listQuery.isPending}
          items={listQuery.data?.items ?? []}
          categoryControl={categoryControl}
          selectedPostIds={selectedPostIds}
          total={listQuery.data?.total ?? 0}
          onCreate={() => onOpenEditor()}
          onDelete={(post) => setDeleteTargets([post])}
          onDeleteSelected={() => setDeleteTargets(selectedPosts)}
          onEdit={(post) => onOpenEditor(post.id)}
          onSelectedPostIdsChange={setSelectedPostIds}
        />
      ) : null}

      <Modal
        open={deleteTargets.length > 0}
        title={
          deleteTargets.length > 1
            ? `${board.name} ${deleteTargets.length}건 삭제`
            : `${board.name} 삭제`
        }
        onClose={() => setDeleteTargets([])}
      >
        <p className="general-post-delete-copy">
          선택한 게시물과 연결된 본문 이미지·대표 이미지·첨부파일을 함께
          삭제합니다. 이 작업은 되돌릴 수 없습니다.
        </p>
        {deleteTargets.length > 1 ? (
          <ul className="general-post-delete-targets">
            {deleteTargets.map((target) => (
              <li key={target.id}>{target.title}</li>
            ))}
          </ul>
        ) : null}
        <div className="general-post-delete-actions">
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
