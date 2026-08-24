import { useState, type ChangeEvent } from "react";

import { getPublicAssetUrl } from "@shared/api/supabase";
import { Button } from "@shared/ui";

import type { PendingPostFile, PostFile } from "../api/postFile";
import "./PostFileField.css";

type PostFileFieldProps = {
  disabled?: boolean;
  existingFiles: PostFile[];
  inputId: string;
  mode?: "attachment" | "gallery";
  newFiles: PendingPostFile[];
  onExistingFileRemove: (fileId: string) => void;
  onFilesAdd: (files: File[]) => void;
  onNewFileRemove: (fileId: string) => void;
};

const BODY_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function formatFileSize(size: number | null) {
  if (size === null) {
    return "용량 정보 없음";
  }

  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))}KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)}MB`;
}

export function PostFileField({
  disabled = false,
  existingFiles,
  inputId,
  mode = "attachment",
  newFiles,
  onExistingFileRemove,
  onFilesAdd,
  onNewFileRemove,
}: PostFileFieldProps) {
  const [fileError, setFileError] = useState<string | null>(null);
  const isGallery = mode === "gallery";

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (!isGallery && files.some((file) => BODY_IMAGE_TYPES.has(file.type))) {
      setFileError(
        "JPG, PNG, WebP 이미지는 첨부파일이 아니라 본문 이미지 추가를 이용해주세요.",
      );
      return;
    }

    setFileError(null);
    onFilesAdd(files);
  };

  return (
    <div className={`post-file-field post-file-field--${mode}`}>
      <div className="post-file-heading">
        <div>
          <span className="post-file-label">
            {isGallery ? "갤러리 사진" : "첨부파일"}
          </span>
          <p>
            {isGallery
              ? "JPG, PNG, WebP 사진을 여러 장 등록할 수 있습니다. 사진당 최대 10MB입니다."
              : "PDF, 문서, 압축파일 등 다운로드할 자료만 등록합니다. 이미지는 본문에 추가해주세요."}
          </p>
        </div>
        <label className="post-file-button" htmlFor={inputId}>
          {isGallery ? "사진 추가" : "파일 추가"}
        </label>
        <input
          multiple
          accept={isGallery ? "image/jpeg,image/png,image/webp" : undefined}
          disabled={disabled}
          id={inputId}
          type="file"
          onChange={handleFileChange}
        />
      </div>

      {fileError ? <span className="post-file-error">{fileError}</span> : null}

      {existingFiles.length === 0 && newFiles.length === 0 ? (
        <div className="post-file-empty">
          {isGallery
            ? "등록된 갤러리 사진이 없습니다."
            : "등록된 첨부파일이 없습니다."}
        </div>
      ) : null}

      {isGallery && existingFiles.length > 0 ? (
        <div className="post-file-gallery-grid">
          {existingFiles.map((file) => (
            <div key={file.id} className="post-file-gallery-item">
              <img
                src={getPublicAssetUrl(file.storage_path) ?? ""}
                alt={file.original_name}
              />
              <div>
                <span title={file.original_name}>{file.original_name}</span>
                <Button
                  disabled={disabled}
                  size="sm"
                  type="button"
                  variant="text"
                  onClick={() => onExistingFileRemove(file.id)}
                >
                  제거
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {!isGallery && existingFiles.length > 0 ? (
        <ul className="post-file-attachment-list">
          {existingFiles.map((file) => (
            <li key={file.id}>
              <a
                href={getPublicAssetUrl(file.storage_path) ?? undefined}
                rel="noreferrer"
                target="_blank"
              >
                {file.original_name}
              </a>
              <span>{formatFileSize(file.size_bytes)}</span>
              <Button
                disabled={disabled}
                size="sm"
                type="button"
                variant="text"
                onClick={() => onExistingFileRemove(file.id)}
              >
                제거
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {newFiles.length > 0 ? (
        <div className="post-file-new-files">
          <strong>새로 추가할 {isGallery ? "사진" : "파일"}</strong>
          <ul>
            {newFiles.map((pendingFile) => (
              <li key={pendingFile.id}>
                {isGallery && pendingFile.previewUrl ? (
                  <img src={pendingFile.previewUrl} alt="" />
                ) : null}
                <span>{pendingFile.file.name}</span>
                <small>{formatFileSize(pendingFile.file.size)}</small>
                <Button
                  disabled={disabled}
                  size="sm"
                  type="button"
                  variant="text"
                  onClick={() => onNewFileRemove(pendingFile.id)}
                >
                  제외
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
