import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { Color, FontSize, TextStyle } from "@tiptap/extension-text-style";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

import {
  getPostContentImages,
  preparePostContentForEditor,
} from "@entities/post";
import { getPublicAssetUrl } from "@shared/api/supabase";

import type {
  PendingPostContentImage,
  PostContentEditorState,
  PostThumbnailCandidate,
  PostThumbnailReference,
} from "../model/postContentEditor";
import "./PostContentEditor.css";

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const IMAGE_MIME_TYPE_BY_EXTENSION = {
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
} as const;
const FONT_SIZE_OPTIONS = [
  { label: "기본 16px", value: "" },
  { label: "14px", value: "14px" },
  { label: "16px", value: "16px" },
  { label: "18px", value: "18px" },
  { label: "20px", value: "20px" },
  { label: "24px", value: "24px" },
  { label: "32px", value: "32px" },
] as const;
const TEXT_COLOR_OPTIONS = [
  { label: "기본색", value: "" },
  { label: "검정", value: "#1A1D24" },
  { label: "회색", value: "#5C5857" },
  { label: "네이비", value: "#1A304C" },
  { label: "청록", value: "#2B5B60" },
  { label: "빨강", value: "#C6392E" },
] as const;

const PostImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      storagePath: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-storage-path"),
        renderHTML: (attributes) =>
          attributes.storagePath
            ? { "data-storage-path": attributes.storagePath }
            : {},
      },
      uploadId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-upload-id"),
        renderHTML: (attributes) =>
          attributes.uploadId ? { "data-upload-id": attributes.uploadId } : {},
      },
    };
  },
});

type PostContentEditorProps = {
  currentThumbnailPath: string | null;
  disabled?: boolean;
  error?: string;
  extraThumbnailCandidates?: PostThumbnailCandidate[];
  label?: string;
  onChange: (content: string) => void;
  onStateChange: (state: PostContentEditorState) => void;
  placeholder?: string;
  value: string;
};

function referencesMatch(
  left: PostThumbnailReference,
  right: PostThumbnailReference,
) {
  if (left === null || right === null) {
    return left === right;
  }

  if (left.kind !== right.kind) {
    return false;
  }

  if (left.kind === "stored" && right.kind === "stored") {
    return left.storagePath === right.storagePath;
  }

  if (left.kind === "content-upload" && right.kind === "content-upload") {
    return left.uploadId === right.uploadId;
  }

  return (
    left.kind === "file-upload" &&
    right.kind === "file-upload" &&
    left.uploadId === right.uploadId
  );
}

function ToolbarButton({
  active = false,
  children,
  disabled,
  onClick,
  title,
}: {
  active?: boolean;
  children: string;
  disabled: boolean;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      aria-pressed={active}
      className={active ? "is-active" : undefined}
      disabled={disabled}
      title={title}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function normalizeImageFile(file: File) {
  if (file.size <= 0 || file.size > MAX_IMAGE_SIZE_BYTES) {
    return null;
  }

  if (SUPPORTED_IMAGE_TYPES.has(file.type)) {
    return file;
  }

  const extension = file.name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  const mimeType = extension
    ? IMAGE_MIME_TYPE_BY_EXTENSION[
        extension as keyof typeof IMAGE_MIME_TYPE_BY_EXTENSION
      ]
    : undefined;

  if (!mimeType) {
    return null;
  }

  return new File([file], file.name, {
    lastModified: file.lastModified,
    type: mimeType,
  });
}

export function PostContentEditor({
  currentThumbnailPath,
  disabled = false,
  error,
  extraThumbnailCandidates = [],
  label = "본문",
  onChange,
  onStateChange,
  placeholder = "게시물 본문을 입력하세요",
  value,
}: PostContentEditorProps) {
  const [initialContent] = useState(() => preparePostContentForEditor(value));
  const imageInputRef = useRef<HTMLInputElement>(null);
  const previewUrlsRef = useRef(new Map<string, string>());
  const [editorHtml, setEditorHtml] = useState(initialContent);
  const [pendingImages, setPendingImages] = useState<
    PendingPostContentImage[]
  >([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const [thumbnail, setThumbnail] = useState<PostThumbnailReference>(
    currentThumbnailPath
      ? { kind: "stored", storagePath: currentThumbnailPath }
      : null,
  );
  const [hasThumbnailChoice, setHasThumbnailChoice] = useState(
    Boolean(currentThumbnailPath),
  );

  const editor = useEditor({
    content: initialContent,
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      PostImage.configure({
        HTMLAttributes: { class: "post-content-editor-image" },
      }),
      Placeholder.configure({ placeholder }),
      TextStyle,
      Color,
      FontSize,
    ],
    onUpdate: ({ editor: currentEditor }) => {
      const nextContent = currentEditor.getHTML();
      setEditorHtml(nextContent);
      onChange(nextContent);
    },
  });

  const toolbarState = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => {
      const textStyle = currentEditor?.getAttributes("textStyle");

      return {
        blockquote: currentEditor?.isActive("blockquote") ?? false,
        bold: currentEditor?.isActive("bold") ?? false,
        bulletList: currentEditor?.isActive("bulletList") ?? false,
        color: typeof textStyle?.color === "string" ? textStyle.color : "",
        fontSize:
          typeof textStyle?.fontSize === "string" ? textStyle.fontSize : "",
        heading2: currentEditor?.isActive("heading", { level: 2 }) ?? false,
        italic: currentEditor?.isActive("italic") ?? false,
        orderedList: currentEditor?.isActive("orderedList") ?? false,
      };
    },
  });

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  useEffect(
    () => () => {
      for (const previewUrl of previewUrlsRef.current.values()) {
        URL.revokeObjectURL(previewUrl);
      }
    },
    [],
  );

  const bodyImageCandidates = useMemo<PostThumbnailCandidate[]>(() => {
    const pendingById = new Map(pendingImages.map((image) => [image.id, image]));

    return getPostContentImages(editorHtml).flatMap<PostThumbnailCandidate>(
      (image, index) => {
      if (image.storagePath) {
        return [
          {
            key: `stored:${image.storagePath}`,
            label: image.alt || `본문 이미지 ${index + 1}`,
            previewUrl: image.src || getPublicAssetUrl(image.storagePath) || "",
            reference: {
              kind: "stored" as const,
              storagePath: image.storagePath,
            },
          },
        ];
      }

      if (!image.uploadId || !pendingById.has(image.uploadId)) {
        return [];
      }

      return [
        {
          key: `content-upload:${image.uploadId}`,
          label: image.alt || `새 본문 이미지 ${index + 1}`,
          previewUrl:
            previewUrlsRef.current.get(image.uploadId) ?? image.src,
          reference: {
            kind: "content-upload" as const,
            uploadId: image.uploadId,
          },
        },
      ];
      },
    );
  }, [editorHtml, pendingImages]);

  const thumbnailCandidates = useMemo(() => {
    const candidates = [...bodyImageCandidates, ...extraThumbnailCandidates];
    const hasCurrentThumbnail = currentThumbnailPath
      ? candidates.some(
          (candidate) =>
            candidate.reference.kind === "stored" &&
            candidate.reference.storagePath === currentThumbnailPath,
        )
      : true;

    if (currentThumbnailPath && !hasCurrentThumbnail) {
      candidates.push({
        key: `stored:${currentThumbnailPath}`,
        label: "기존 대표 이미지",
        previewUrl: getPublicAssetUrl(currentThumbnailPath) ?? "",
        reference: { kind: "stored", storagePath: currentThumbnailPath },
      });
    }

    return candidates.filter(
      (candidate, index, items) =>
        items.findIndex((item) => item.key === candidate.key) === index,
    );
  }, [bodyImageCandidates, currentThumbnailPath, extraThumbnailCandidates]);

  useEffect(() => {
    if (!hasThumbnailChoice && thumbnailCandidates.length > 0) {
      setThumbnail(thumbnailCandidates[0].reference);
      setHasThumbnailChoice(true);
      return;
    }

    if (
      thumbnail &&
      !thumbnailCandidates.some((candidate) =>
        referencesMatch(candidate.reference, thumbnail),
      )
    ) {
      setThumbnail(null);
      setHasThumbnailChoice(true);
    }
  }, [hasThumbnailChoice, thumbnail, thumbnailCandidates]);

  useEffect(() => {
    const activeUploadIds = new Set(
      getPostContentImages(editorHtml)
        .map((image) => image.uploadId)
        .filter((id): id is string => Boolean(id)),
    );

    onStateChange({
      content: editorHtml,
      pendingImages: pendingImages.filter((image) =>
        activeUploadIds.has(image.id),
      ),
      thumbnail,
    });
  }, [editorHtml, onStateChange, pendingImages, thumbnail]);

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (files.length === 0) {
      return;
    }

    if (!editor || editor.isDestroyed) {
      setImageError(
        "본문 편집기를 준비하는 중입니다. 잠시 후 이미지를 다시 선택해주세요.",
      );
      return;
    }

    const normalizedFiles = files.map(normalizeImageFile);

    if (normalizedFiles.some((file) => file === null)) {
      setImageError("본문 이미지는 JPG, PNG, WebP 형식이며 파일당 10MB 이하여야 합니다.");
      return;
    }

    setImageError(null);
    const nextImages: PendingPostContentImage[] = [];

    for (const normalizedFile of normalizedFiles) {
      if (!normalizedFile) {
        continue;
      }

      const id = crypto.randomUUID();
      const previewUrl = URL.createObjectURL(normalizedFile);
      previewUrlsRef.current.set(id, previewUrl);
      nextImages.push({ file: normalizedFile, id });
    }

    const inserted = editor
      .chain()
      .focus()
      .insertContent([
        ...nextImages.map((image) => ({
          type: "image",
          attrs: {
            alt: image.file.name,
            src: previewUrlsRef.current.get(image.id),
            uploadId: image.id,
          },
        })),
        { type: "paragraph" },
      ])
      .run();

    if (!inserted) {
      for (const image of nextImages) {
        const previewUrl = previewUrlsRef.current.get(image.id);

        previewUrlsRef.current.delete(image.id);

        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
        }
      }

      setImageError(
        "이미지를 본문에 삽입하지 못했습니다. 본문 영역을 클릭한 뒤 다시 시도해주세요.",
      );
      return;
    }

    setPendingImages((current) => [...current, ...nextImages]);
  };

  const editorAvailable = Boolean(editor && !editor.isDestroyed);
  const toolbarDisabled = disabled || !editorAvailable;

  return (
    <div className="post-content-editor-field">
      <span className="post-content-editor-label">{label}</span>
      <div
        className={`post-content-editor-shell${error ? " has-error" : ""}`}
      >
        <div className="post-content-editor-toolbar" aria-label="본문 서식 도구">
          <ToolbarButton
            active={toolbarState?.heading2}
            disabled={toolbarDisabled}
            title="중간 제목"
            onClick={() =>
              editor?.chain().focus().toggleHeading({ level: 2 }).run()
            }
          >
            제목
          </ToolbarButton>
          <select
            aria-label="글자 크기"
            disabled={toolbarDisabled}
            title="글자 크기"
            value={toolbarState?.fontSize ?? ""}
            onChange={(event) => {
              const fontSize = event.target.value;
              const chain = editor?.chain().focus();

              if (fontSize) {
                chain?.setFontSize(fontSize).run();
                return;
              }

              chain?.unsetFontSize().removeEmptyTextStyle().run();
            }}
          >
            {FONT_SIZE_OPTIONS.map((option) => (
              <option key={option.label} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            aria-label="글자색"
            disabled={toolbarDisabled}
            title="글자색"
            value={toolbarState?.color ?? ""}
            onChange={(event) => {
              const color = event.target.value;
              const chain = editor?.chain().focus();

              if (color) {
                chain?.setColor(color).run();
                return;
              }

              chain?.unsetColor().removeEmptyTextStyle().run();
            }}
          >
            {TEXT_COLOR_OPTIONS.map((option) => (
              <option key={option.label} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ToolbarButton
            active={toolbarState?.bold}
            disabled={toolbarDisabled}
            title="굵게"
            onClick={() => editor?.chain().focus().toggleBold().run()}
          >
            굵게
          </ToolbarButton>
          <ToolbarButton
            active={toolbarState?.italic}
            disabled={toolbarDisabled}
            title="기울임"
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          >
            기울임
          </ToolbarButton>
          <ToolbarButton
            active={toolbarState?.bulletList}
            disabled={toolbarDisabled}
            title="글머리 목록"
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
          >
            목록
          </ToolbarButton>
          <ToolbarButton
            active={toolbarState?.orderedList}
            disabled={toolbarDisabled}
            title="번호 목록"
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          >
            번호
          </ToolbarButton>
          <ToolbarButton
            active={toolbarState?.blockquote}
            disabled={toolbarDisabled}
            title="인용문"
            onClick={() => editor?.chain().focus().toggleBlockquote().run()}
          >
            인용
          </ToolbarButton>
          <span className="post-content-editor-toolbar-separator" />
          <button
            className="post-content-editor-image-button"
            disabled={disabled || !editorAvailable}
            type="button"
            onClick={() => imageInputRef.current?.click()}
          >
            이미지 추가
          </button>
          <input
            ref={imageInputRef}
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
          disabled={disabled || !editorAvailable}
            multiple
            type="file"
            onChange={handleImageChange}
          />
        </div>
        <EditorContent editor={editor} />
      </div>
      {error ? <span className="post-content-editor-error">{error}</span> : null}
      {imageError ? (
        <span className="post-content-editor-error">{imageError}</span>
      ) : null}

      <div className="post-thumbnail-selector">
        <div className="post-thumbnail-selector-copy">
          <strong>대표 이미지</strong>
          <span>본문 또는 갤러리 이미지 중 목록에 표시할 썸네일을 선택합니다.</span>
        </div>
        <div className="post-thumbnail-selector-grid">
          <label className={!thumbnail ? "is-selected" : undefined}>
            <input
              checked={!thumbnail}
              disabled={disabled}
              name="post-thumbnail"
              type="radio"
              onChange={() => {
                setThumbnail(null);
                setHasThumbnailChoice(true);
              }}
            />
            <span className="post-thumbnail-none">대표 없음</span>
          </label>
          {thumbnailCandidates.map((candidate) => {
            const selected = referencesMatch(candidate.reference, thumbnail);

            return (
              <label
                key={candidate.key}
                className={selected ? "is-selected" : undefined}
              >
                <input
                  checked={selected}
                  disabled={disabled}
                  name="post-thumbnail"
                  type="radio"
                  onChange={() => {
                    setThumbnail(candidate.reference);
                    setHasThumbnailChoice(true);
                  }}
                />
                <img src={candidate.previewUrl} alt="" />
                <span title={candidate.label}>{candidate.label}</span>
              </label>
            );
          })}
        </div>
        {thumbnailCandidates.length === 0 ? (
          <p className="post-thumbnail-selector-empty">
            본문에 이미지를 추가하면 대표 이미지로 선택할 수 있습니다.
          </p>
        ) : null}
      </div>
    </div>
  );
}
