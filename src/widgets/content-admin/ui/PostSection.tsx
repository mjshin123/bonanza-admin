import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  adminPostDetailQueryOptions,
  adminPostsQueryOptions,
  contentPostQueryKeys,
  hasMeaningfulPostContent,
  sanitizePostContent,
  type AdminContentPostListItem,
  type PostFileDto,
} from "@entities/post";
import { PostContentEditor } from "@features/post-content-editor";
import {
  bulkDeleteContentPostsMutationOptions,
  bulkHideContentPostsMutationOptions,
  bulkPublishContentPostsMutationOptions,
  bulkSetContentPostPinnedMutationOptions,
  createContentPostMutationOptions,
  updateContentPostMutationOptions,
} from "@features/post-manage";
import { isDemoMode as isGlobalDemoMode, type ContentStatus, type FileDto, type PostCategory, type PostFileRole } from "@shared/api/content";
import { lastEditorLogin } from "@shared/lib";
import { BulkActionBar, Button, Input, confirmDialog, alertDialog } from "@shared/ui";

import {
  endOfDayIso,
  formatDateTime,
  PAGE_SIZE,
  startOfDayIso,
  STATUS_OPTIONS,
  toDateTimeLocal,
  toIsoOrNull,
  useBackNavCloses,
  useDebouncedValue,
} from "../model/adminContent";
import { PageGuide, Checkbox, EditorCard, Field, FileUpload, FilterBar, MutationMessage, NativeSelect, Pager, SectionTabs, SectionTitle, StatusBadge, TableShell, DemoNotice } from "./AdminCommon";

const EMPTY_ID = "00000000-0000-4000-8000-000000000000";
const CATEGORIES: Array<{ value: PostCategory; label: string }> = [
  { value: "association_news", label: "보도자료" },
  { value: "notice", label: "공지사항" },
  { value: "promotion_video", label: "홍보·영상" },
];
const AFFILIATES = ["보난자팩토리", "트라버스", "보난자랩", "플러그앤엑스"];

type SelectedPostFile = {
  file: FileDto;
  role: PostFileRole;
  showInGallery: boolean;
};
type PostFormState = {
  title: string;
  content: string;
  institutionId: string;
  isPinned: boolean;
  publishedAt: string;
  sourceUrl: string;
  titleEn: string;
  contentEn: string;
  affiliate: string;
};

const demoPosts: AdminContentPostListItem[] = [
  {
    id: "demo-notice-privacy",
    affiliate: null,
    category: "notice",
    title: "개인정보처리방침 개정 안내 (시행 2026.07.15)",
    institution: null,
    cover: null,
    isPinned: true,
    publishedAt: "2026-06-30T00:00:00.000Z",
    status: "published",
    createdAt: "2026-10-10T01:20:00.000Z",
    updatedAt: "2026-11-10T05:40:00.000Z",
    createdByLogin: "admin",
    updatedByLogin: "admin",
  },
  {
    id: "demo-notice-service",
    affiliate: null,
    category: "notice",
    title: "서비스 정기 점검에 따른 일시 중단 안내",
    institution: null,
    cover: null,
    isPinned: false,
    publishedAt: "2026-06-10T00:00:00.000Z",
    status: "published",
    createdAt: "2026-10-11T01:20:00.000Z",
    updatedAt: "2026-11-11T05:40:00.000Z",
    createdByLogin: "mjshin",
    updatedByLogin: "admin",
  },
  {
    id: "demo-notice-recruit",
    affiliate: null,
    category: "notice",
    title: "2026년 상반기 채용 공고 안내",
    institution: null,
    cover: null,
    isPinned: false,
    publishedAt: "2026-05-20T00:00:00.000Z",
    status: "published",
    createdAt: "2026-10-12T01:20:00.000Z",
    updatedAt: "2026-11-12T05:40:00.000Z",
    createdByLogin: "admin",
    updatedByLogin: "admin",
  },
  {
    id: "demo-press-series-a",
    affiliate: "보난자팩토리",
    category: "association_news",
    title: "보난자팩토리, 시리즈A 투자 유치로 컴플라이언스 사업 확대",
    institution: null,
    cover: null,
    isPinned: true,
    publishedAt: "2026-06-24T00:00:00.000Z",
    status: "published",
    createdAt: "2026-10-13T01:20:00.000Z",
    updatedAt: "2026-11-13T05:40:00.000Z",
    createdByLogin: "admin",
    updatedByLogin: "mjshin",
  },
  {
    id: "demo-press-unicorn",
    affiliate: "보난자랩",
    category: "association_news",
    title: "아기유니콘 200 기업 선정, 기술 경쟁력 인정받아",
    institution: null,
    cover: null,
    isPinned: false,
    publishedAt: "2026-05-12T00:00:00.000Z",
    status: "published",
    createdAt: "2026-10-14T01:20:00.000Z",
    updatedAt: "2026-11-14T05:40:00.000Z",
    createdByLogin: "admin",
    updatedByLogin: "admin",
  },
  {
    id: "demo-press-partnership",
    affiliate: "트라버스",
    category: "association_news",
    title: "국내 주요 거래소와 이상거래 탐지 협력 체결",
    institution: null,
    cover: null,
    isPinned: false,
    publishedAt: "2026-04-03T00:00:00.000Z",
    status: "published",
    createdAt: "2026-10-15T01:20:00.000Z",
    updatedAt: "2026-11-15T05:40:00.000Z",
    createdByLogin: "mjshin",
    updatedByLogin: "mjshin",
  },
  {
    id: "demo-promotion-video-intro",
    affiliate: null,
    category: "promotion_video",
    title: "보난자팩토리 브랜드 필름",
    institution: null,
    cover: null,
    isPinned: false,
    publishedAt: "2026-06-18T00:00:00.000Z",
    status: "published",
    createdAt: "2026-10-16T01:20:00.000Z",
    updatedAt: "2026-11-16T05:40:00.000Z",
    createdByLogin: "admin",
    updatedByLogin: "admin",
  },
];

function PinnedIcon() {
  return (
    <svg
      aria-label="상단 고정"
      fill="none"
      height="16"
      role="img"
      viewBox="0 0 24 24"
      width="16"
    >
      <path
        d="M15 4.5l-4 4l-4 1.5l-1.5 1.5l7 7l1.5 -1.5l1.5 -4l4 -4M9 15l-4.5 4.5M14.5 4l5.5 5.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

const POST_GUIDES: Partial<Record<PostCategory, string>> = {
  association_news:
    "뉴스룸 > 보도자료(/press) 목록과 상세 페이지, 그리고 메인 화면 하단 뉴스 영역에 노출됩니다.",
  notice:
    "뉴스룸 > 공지사항(/notice) 목록과 상세 페이지, 그리고 메인 화면 하단 뉴스 영역에 노출됩니다.",
  promotion_video:
    "뉴스룸 > 홍보·영상(/promotion-video) 목록과 영상 상세 페이지에 노출됩니다.",
};

function PostEditor({
  category,
  editingId,
  demoItem,
  onClose,
}: {
  category: PostCategory;
  editingId: string | null;
  demoItem?: AdminContentPostListItem | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const detailQuery = useQuery({
    ...adminPostDetailQueryOptions(demoItem ? EMPTY_ID : (editingId ?? EMPTY_ID)),
    enabled: Boolean(editingId) && !demoItem,
  });
  const effectiveCategory =
    editingId && detailQuery.data
      ? detailQuery.data.category
      : demoItem?.category ?? category;
  const isPromotionVideo = effectiveCategory === "promotion_video";
  const createMutation = useMutation(createContentPostMutationOptions());
  const updateMutation = useMutation(updateContentPostMutationOptions());
  const mutation = editingId ? updateMutation : createMutation;
  const [form, setForm] = useState<PostFormState>({
    title: "",
    content: "",
    institutionId: "",
    isPinned: false,
    publishedAt: toDateTimeLocal(new Date().toISOString()),
    sourceUrl: "",
    titleEn: "",
    contentEn: "",
    affiliate: "",
  });
  const [files, setFiles] = useState<SelectedPostFile[]>([]);
  const [locale, setLocale] = useState<"ko" | "en">("ko");
  const [visitedLocales, setVisitedLocales] = useState<Set<"ko" | "en">>(
    () => new Set(["ko"]),
  );
  const [contentError, setContentError] = useState<string | null>(null);
  const [affiliateError, setAffiliateError] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const hasKoreanPost = isPromotionVideo
    ? Boolean(form.title.trim())
    : Boolean(form.title.trim()) && hasMeaningfulPostContent(form.content);
  const hasEnglishPost = isPromotionVideo
    ? Boolean(form.titleEn.trim())
    : Boolean(form.titleEn.trim()) && hasMeaningfulPostContent(form.contentEn);
  const hasAnyPost = isPromotionVideo
    ? files.some(
        (entry) => entry.role === "video_ko" || entry.role === "video_en",
      ) && (hasKoreanPost || hasEnglishPost)
    : hasKoreanPost || hasEnglishPost;
  const changeLocale = (nextLocale: "ko" | "en") => {
    setLocale(nextLocale);
    setVisitedLocales((current) => new Set([...current, nextLocale]));
  };

  useEffect(() => {
    if (!demoItem) return;
    setForm((current) => ({
      ...current,
      title: demoItem.title,
      isPinned: demoItem.isPinned,
      publishedAt: toDateTimeLocal(demoItem.publishedAt ?? new Date().toISOString()),
      affiliate: demoItem.affiliate ?? "",
    }));
  }, [demoItem]);

  useEffect(() => {
    const item = detailQuery.data;
    if (!item) return;
    setForm({
      title: item.title,
      content: item.content,
      institutionId: item.institution?.id ?? "",
      isPinned: item.isPinned,
      publishedAt: toDateTimeLocal(item.publishedAt),
      sourceUrl: item.sourceUrl ?? "",
      titleEn: "",
      contentEn: "",
      affiliate: item.affiliate ?? "",
    });
    setFiles(
      item.files.map((entry: PostFileDto) => ({
        file: entry.file,
        role: entry.role,
        showInGallery: entry.showInGallery,
      })),
    );
  }, [detailQuery.data]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (submittingRef.current) return;
    if (demoItem) {
      void alertDialog("데모 데이터는 저장되지 않습니다. 화면 확인용으로만 열람할 수 있습니다.");
      return;
    }

    if (!hasAnyPost) {
      setContentError(
        isPromotionVideo
          ? "제목과 동영상을 입력해주세요."
          : "한글 또는 영문 제목과 본문을 입력해주세요.",
      );
      return;
    }
    if (effectiveCategory === "association_news" && !form.affiliate) {
      setLocale("ko");
      setAffiliateError("계열사는 필수 입력입니다.");
      return;
    }

    setContentError(null);
    setAffiliateError(null);
    submittingRef.current = true;
    const submitter = (event.nativeEvent as SubmitEvent).submitter as
      | HTMLButtonElement
      | null;
    const status = (submitter?.value as ContentStatus | undefined) ?? "draft";
    if (
      status === "published" &&
      !hasEnglishPost &&
      !(await confirmDialog(
        "영문 내용을 작성하지 않으면 홈페이지에서 언어를 변경해도 영문 콘텐츠가 적용되지 않습니다. 그래도 게시할까요?",
        { confirmLabel: "게시" },
      ))
    ) {
      submittingRef.current = false;
      return;
    }
    const input = {
      affiliate:
        effectiveCategory === "association_news" ? form.affiliate : null,
      category: effectiveCategory,
      title: form.title.trim() || form.titleEn.trim(),
      content: isPromotionVideo
        ? sanitizePostContent(form.content || form.contentEn)
        : sanitizePostContent(form.content || form.contentEn),
      institutionId: null,
      status,
      isPinned: form.isPinned,
      publishedAt: toIsoOrNull(form.publishedAt),
      sourceUrl:
        effectiveCategory === "association_news" ? form.sourceUrl : null,
      titleEn: isPromotionVideo ? null : form.titleEn,
      contentEn: isPromotionVideo ? null : sanitizePostContent(form.contentEn),
      files: files.map((entry, index) => ({
        fileId: entry.file.id,
        role: isPromotionVideo
          ? entry.role
          : index === 0
            ? ("cover" as const)
            : ("content" as const),
        showInGallery: entry.showInGallery,
      })),
    };
    try {
      if (editingId && detailQuery.data)
        await updateMutation.mutateAsync({
          ...input,
          id: editingId,
          expectedUpdatedAt: detailQuery.data.updatedAt,
        });
      else await createMutation.mutateAsync(input);
      await queryClient.invalidateQueries({
        queryKey: contentPostQueryKeys.all,
      });
      onClose();
    } catch {
      /* mutation 상태로 표시 */
    } finally {
      submittingRef.current = false;
    }
  };

  if (editingId && !demoItem && detailQuery.isPending)
    return (
      <TableShell isLoading error={null} isEmpty={false} emptyMessage="">
        {null}
      </TableShell>
    );
  if (detailQuery.error) return <MutationMessage error={detailQuery.error} />;
  const categoryLabel =
    CATEGORIES.find((item) => item.value === effectiveCategory)?.label ??
    "게시물";
  return (
    <EditorCard
      title={editingId ? `${categoryLabel} 수정` : `${categoryLabel} 등록`}
      description={isPromotionVideo ? "한글과 영문 제목, 영상을 각각 작성할 수 있습니다. 영상은 한 언어만 등록해도 됩니다." : "한글과 영문 콘텐츠를 각각 작성할 수 있습니다. 영문은 선택 사항입니다."}
      audit={detailQuery.data ?? demoItem}
      headerAction={<SectionTabs value={locale} items={[{ value: "ko", label: "한글" }, { value: "en", label: "영문" }]} onChange={(value) => changeLocale(value as "ko" | "en")} />}
      onSubmit={(event) => void submit(event)}
    >
      <Field label={locale === "ko" ? "한글 제목" : "영문 제목"} required={isPromotionVideo && locale === "ko"} wide>
        <input
          className="content-admin-native-input"
          maxLength={200}
          value={locale === "ko" ? form.title : form.titleEn}
          onChange={(event) => setForm({ ...form, [locale === "ko" ? "title" : "titleEn"]: event.target.value })}
        />
      </Field>
      {isPromotionVideo ? <>
      <Field label={locale === "ko" ? "한글용 동영상" : "영문용 동영상"} wide hint="선택 사항입니다. 다른 언어 영상만 등록해도 됩니다. 최대 50 MiB까지 등록할 수 있습니다.">
        <FileUpload
          accept="video/*"
          fileKind="video"
          label={files.some((entry) => entry.role === (locale === "ko" ? "video_ko" : "video_en")) ? "동영상 변경" : "동영상 업로드"}
          onUploaded={(uploaded) => {
            const video = uploaded[0];
            if (!video) return;
            setContentError(null);
            const role = locale === "ko" ? "video_ko" : "video_en";
            setFiles((current) => [
              ...current.filter((entry) => entry.role !== role),
              { file: video, role, showInGallery: false },
            ]);
          }}
        />
        {files.filter((entry) => entry.role === (locale === "ko" ? "video_ko" : "video_en")).map((entry) => <div className="content-admin-file-list" key={entry.file.id}><div className="content-admin-file-row"><video className="content-admin-video-preview" controls src={entry.file.url} /><div><strong>{entry.file.originalName}</strong><small>{Math.ceil(entry.file.sizeBytes / 1024 / 1024)} MiB</small></div><Button size="sm" type="button" variant="text" onClick={() => setFiles((current) => current.filter((candidate) => candidate.role !== entry.role))}>제외</Button></div></div>)}
      </Field>
      {contentError ? <small className="content-admin-field-error">{contentError}</small> : null}
      <div className="content-admin-common-fields">
      <Field
        label="업로드 날짜"
        required
        hint="운영 홈페이지 홍보·영상 목록에 표시됩니다."
      >
        <input
          className="content-admin-native-input"
          required
          type="datetime-local"
          value={form.publishedAt}
          onChange={(event) => setForm({ ...form, publishedAt: event.target.value })}
        />
      </Field>
      </div>
      </> : <>
      {locale === "ko" ? <>
      <div className="content-admin-field is-wide">
        <PostContentEditor
          currentThumbnailPath={null}
          enableImages={false}
          error={contentError ?? undefined}
          label="한글 본문"
          value={form.content}
          onChange={(content) => {
            setContentError(null);
            setForm((current) => ({ ...current, content }));
          }}
          onStateChange={() => {}}
        />
      </div>
      </> : <div className="content-admin-field is-wide"><PostContentEditor currentThumbnailPath={null} enableImages={false} label="영문 본문" placeholder="영문 웹사이트에 표시할 본문을 직접 작성하세요" value={form.contentEn} onChange={(contentEn) => setForm((current) => ({ ...current, contentEn }))} onStateChange={() => {}} /></div>}
      <div className="content-admin-common-fields">
      {effectiveCategory === "association_news" ? (
        <Field label="계열사" required wide hint="보도자료를 발행한 계열사를 선택하세요.">
          <select
            required
            className="content-admin-native-input"
            value={form.affiliate}
            onChange={(event) => {
              setAffiliateError(null);
              setForm({ ...form, affiliate: event.target.value });
            }}
          >
            <option value="">계열사를 선택하세요</option>
            {AFFILIATES.map((affiliate) => <option key={affiliate} value={affiliate}>{affiliate}</option>)}
          </select>
          {affiliateError ? <small className="content-admin-field-error">{affiliateError}</small> : null}
        </Field>
      ) : null}
      {effectiveCategory === "association_news" ? (
        <Field
          label="기사 원문 링크"
          wide
          hint="선택 사항입니다. 입력하면 웹사이트 보도자료 상세에 원문 보기 버튼이 표시됩니다."
        >
          <input
            className="content-admin-native-input"
            type="url"
            inputMode="url"
            placeholder="https://example.com/article"
            value={form.sourceUrl}
            onChange={(event) =>
              setForm({ ...form, sourceUrl: event.target.value })
            }
          />
        </Field>
      ) : null}
      <Field
        label="게시 일시"
        hint="임시저장은 이 일시를 그대로 저장하고, 게시는 공개 상태로 전환합니다. 미래 일시로 게시하면 예약 발행됩니다."
      >
        <input
          className="content-admin-native-input"
          type="datetime-local"
          value={form.publishedAt}
          onChange={(event) =>
            setForm({ ...form, publishedAt: event.target.value })
          }
        />
      </Field>
      <Field label="상단 고정">
        <Checkbox
          checked={form.isPinned}
          label="목록 상단에 고정"
          onChange={(isPinned) => setForm({ ...form, isPinned })}
        />
      </Field>
      <Field
        label="내용 이미지"
        wide
        hint="첫 번째 이미지가 대표 이미지로 사용됩니다. 갤러리 체크는 해당 사진만 홈페이지 포토 갤러리에 노출합니다."
      >
        <FileUpload
          accept="image/*"
          fileKind="image"
          label="사진 추가"
          multiple
          onUploaded={(uploaded) =>
            setFiles((current) => [
              ...current,
              ...uploaded.map((file) => ({
                file,
                role: "content" as const,
                showInGallery: false,
              })),
            ])
          }
        />
        <div className="content-admin-file-list">
          {files.map((entry, index) => (
            <div className="content-admin-file-row" key={entry.file.id}>
              <img
                alt=""
                className="content-admin-image-thumb"
                src={entry.file.url}
              />
              <div>
                <strong>{entry.file.originalName}</strong>
                <Checkbox
                  checked={entry.showInGallery}
                  label="포토 갤러리에 노출"
                  onChange={(showInGallery) =>
                    setFiles((current) =>
                      current.map((candidate) =>
                        candidate.file.id === entry.file.id
                          ? { ...candidate, showInGallery }
                          : candidate,
                      ),
                    )
                  }
                />
              </div>
              <div className="content-admin-table-actions">
                <Button
                  disabled={index === 0}
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setFiles((current) => {
                      const next = [...current];
                      [next[index - 1], next[index]] = [
                        next[index],
                        next[index - 1],
                      ];
                      return next;
                    })
                  }
                >
                  ▲
                </Button>
                <Button
                  disabled={index === files.length - 1}
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setFiles((current) => {
                      const next = [...current];
                      [next[index], next[index + 1]] = [
                        next[index + 1],
                        next[index],
                      ];
                      return next;
                    })
                  }
                >
                  ▼
                </Button>
                <Button
                  size="sm"
                  variant="text"
                  onClick={() =>
                    setFiles((current) =>
                      current.filter(
                        (candidate) => candidate.file.id !== entry.file.id,
                      ),
                    )
                  }
                >
                  제외
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Field>
      </div>
      </>}
      <MutationMessage error={mutation.error} />
      <div className="content-admin-form-actions">
        <Button
          disabled={mutation.isPending}
          type="button"
          variant="ghost"
          onClick={onClose}
        >
          취소
        </Button>
        <Button
          disabled={mutation.isPending}
          name="action"
          type="submit"
          value="draft"
          variant="ghost"
        >
          {mutation.isPending ? "저장 중..." : "임시저장"}
        </Button>
        {locale === "ko" || visitedLocales.size < 2 ? (
          <Button
            disabled={mutation.isPending}
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              changeLocale(locale === "ko" ? "en" : "ko");
            }}
          >
            다음
          </Button>
        ) : (
          <Button
            disabled={mutation.isPending}
            name="action"
            type="submit"
            value="published"
          >
            {mutation.isPending ? "저장 중..." : "게시"}
          </Button>
        )}
      </div>
    </EditorCard>
  );
}

export function PostSection({
  initialEditingId,
  initialCategory,
  onInitialEditingConsumed,
  onCategoryChange,
  onEditorOpenChange,
  listViewRequestId,
}: {
  initialEditingId?: string | null;
  initialCategory?: PostCategory;
  onInitialEditingConsumed?: () => void;
  onCategoryChange?: (category: PostCategory) => void;
  onEditorOpenChange?: (isOpen: boolean) => void;
  listViewRequestId?: number;
} = {}) {
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<PostCategory>("association_news");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const q = useDebouncedValue(search);
  const [status, setStatus] = useState("");
  const [publishedFrom, setPublishedFrom] = useState("");
  const [publishedTo, setPublishedTo] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  useEffect(() => onEditorOpenChange?.(editorOpen), [editorOpen, onEditorOpenChange]);
  const closeEditor = useBackNavCloses(editorOpen, () => {
    setEditorOpen(false);
    setEditingId(null);
  });
  useEffect(() => {
    if (initialCategory) setCategory(initialCategory);
  }, [initialCategory]);
  useEffect(() => {
    if (!listViewRequestId) return;
    setEditorOpen(false);
    setEditingId(null);
  }, [listViewRequestId]);
  useEffect(() => {
    if (!initialEditingId) return;
    if (initialCategory) setCategory(initialCategory);
    setEditingId(initialEditingId);
    setEditorOpen(true);
    onInitialEditingConsumed?.();
  }, [initialEditingId]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [demoItems, setDemoItems] = useState(demoPosts);
  const query = useQuery(
    adminPostsQueryOptions({
      page,
      pageSize: PAGE_SIZE,
      category,
      q: q || undefined,
      status: status ? (status as ContentStatus) : undefined,
      publishedFrom: startOfDayIso(publishedFrom),
      publishedTo: endOfDayIso(publishedTo),
    }),
  );
  const isDemoMode = isGlobalDemoMode || Boolean(query.error);
  const items = (isDemoMode ? demoItems : query.data?.items ?? []).filter(
    (item) =>
      item.category === category &&
      (!q || item.title.toLowerCase().includes(q.toLowerCase())) &&
      (!status || item.status === status),
  );
  useEffect(() => {
    setSelectedIds(new Set());
  }, [category, page, q, status, publishedFrom, publishedTo]);
  const canHide = items.some(
    (item) => selectedIds.has(item.id) && item.status !== "hidden",
  );
  const canShow = items.some(
    (item) => selectedIds.has(item.id) && item.status !== "published",
  );
  const canPin = items.some(
    (item) => selectedIds.has(item.id) && !item.isPinned,
  );
  const canUnpin = items.some(
    (item) => selectedIds.has(item.id) && item.isPinned,
  );
  const toggleSelected = (id: string, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };
  const toggleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(items.map((item) => item.id)) : new Set());
  };
  const hideMutation = useMutation(bulkHideContentPostsMutationOptions());
  const showMutation = useMutation(bulkPublishContentPostsMutationOptions());
  const bulkDeleteMutation = useMutation(bulkDeleteContentPostsMutationOptions());
  const pinMutation = useMutation(bulkSetContentPostPinnedMutationOptions());
  const bulkHide = async () => {
    if (!(await confirmDialog(`선택한 ${selectedIds.size}건을 숨길까요?`, { confirmLabel: "숨김" }))) return;
    if (isDemoMode) {
      setDemoItems((current) =>
        current.map((item) =>
          selectedIds.has(item.id) ? { ...item, status: "hidden" } : item,
        ),
      );
      setSelectedIds(new Set());
      return;
    }
    try {
      await hideMutation.mutateAsync(Array.from(selectedIds));
      await queryClient.invalidateQueries({
        queryKey: contentPostQueryKeys.all,
      });
      setSelectedIds(new Set());
    } catch {
      /* 표시 */
    }
  };
  const bulkShow = async () => {
    if (isDemoMode) {
      setDemoItems((current) =>
        current.map((item) =>
          selectedIds.has(item.id) ? { ...item, status: "published" } : item,
        ),
      );
      setSelectedIds(new Set());
      return;
    }
    try {
      await showMutation.mutateAsync(Array.from(selectedIds));
      await queryClient.invalidateQueries({
        queryKey: contentPostQueryKeys.all,
      });
      setSelectedIds(new Set());
    } catch {
      /* 표시 */
    }
  };
  const bulkDelete = async () => {
    if (!(await confirmDialog(`선택한 ${selectedIds.size}건을 삭제할까요?`, { confirmLabel: "삭제", tone: "danger" }))) return;
    if (isDemoMode) {
      setDemoItems((current) =>
        current.filter((item) => !selectedIds.has(item.id)),
      );
      setSelectedIds(new Set());
      return;
    }
    try {
      await bulkDeleteMutation.mutateAsync(Array.from(selectedIds));
      await queryClient.invalidateQueries({
        queryKey: contentPostQueryKeys.all,
      });
      setSelectedIds(new Set());
    } catch {
      /* 표시 */
    }
  };
  const bulkSetPinned = async (isPinned: boolean) => {
    if (isDemoMode) {
      setDemoItems((current) =>
        current.map((item) =>
          selectedIds.has(item.id) ? { ...item, isPinned } : item,
        ),
      );
      setSelectedIds(new Set());
      return;
    }
    try {
      await pinMutation.mutateAsync({
        ids: Array.from(selectedIds),
        isPinned,
      });
      await queryClient.invalidateQueries({
        queryKey: contentPostQueryKeys.all,
      });
      setSelectedIds(new Set());
    } catch {
      /* mutation 상태로 표시 */
    }
  };
  if (editorOpen)
    return (
      <PostEditor
        category={category}
        editingId={editingId}
        demoItem={
          isDemoMode && editingId
            ? demoItems.find((item) => item.id === editingId) ?? null
            : null
        }
        onClose={closeEditor}
      />
    );
  return (
    <section className="content-admin-section">
      {POST_GUIDES[category] ? <PageGuide>{POST_GUIDES[category]}</PageGuide> : null}
      <SectionTitle
        title="뉴스룸"
        description="소식 유형별 게시물과 대표 이미지를 관리합니다."
        action={
          <Button onClick={() => setEditorOpen(true)}>
            게시물 등록
          </Button>
        }
      />
      <SectionTabs
        value={category}
        items={CATEGORIES}
        onChange={(value) => {
          setCategory(value as PostCategory);
          onCategoryChange?.(value as PostCategory);
          setPage(1);
        }}
      />
      <FilterBar>
        <Input
          aria-label="게시물 검색"
          placeholder="제목 검색"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        <div className="content-admin-filter-extra">
          <NativeSelect
            aria-label="게시 상태"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            {STATUS_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </NativeSelect>
          <div className="content-admin-date-range">
            <input
              aria-label="게시일 시작"
              className="content-admin-native-input"
              type="date"
              value={publishedFrom}
              onChange={(event) => {
                setPublishedFrom(event.target.value);
                setPage(1);
              }}
            />
            <span>~</span>
            <input
              aria-label="게시일 종료"
              className="content-admin-native-input"
              type="date"
              value={publishedTo}
              onChange={(event) => {
                setPublishedTo(event.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
      </FilterBar>
      <MutationMessage error={bulkDeleteMutation.error} />
      <MutationMessage error={hideMutation.error} />
      <MutationMessage error={showMutation.error} />
      <MutationMessage error={pinMutation.error} />
      <BulkActionBar
        selectedCount={selectedIds.size}
        emptyHint="게시글을 숨기거나 삭제하려면 원하는 게시글을 선택해 주세요."
      >
          {canShow ? (
            <Button
              disabled={
                hideMutation.isPending ||
                showMutation.isPending ||
                bulkDeleteMutation.isPending
              }
              size="sm"
              variant="ghost"
              onClick={() => void bulkShow()}
            >
              선택 게시
            </Button>
          ) : null}
          {canHide ? (
            <Button
              disabled={
                hideMutation.isPending ||
                showMutation.isPending ||
                bulkDeleteMutation.isPending
              }
              size="sm"
              variant="ghost"
              onClick={() => void bulkHide()}
            >
              선택 숨김
            </Button>
          ) : null}
          {canPin ? (
            <Button
              disabled={
                hideMutation.isPending ||
                showMutation.isPending ||
                bulkDeleteMutation.isPending ||
                pinMutation.isPending
              }
              size="sm"
              variant="ghost"
              onClick={() => void bulkSetPinned(true)}
            >
              상단 고정
            </Button>
          ) : null}
          {canUnpin ? (
            <Button
              disabled={
                hideMutation.isPending ||
                showMutation.isPending ||
                bulkDeleteMutation.isPending ||
                pinMutation.isPending
              }
              size="sm"
              variant="ghost"
              onClick={() => void bulkSetPinned(false)}
            >
              고정 해제
            </Button>
          ) : null}
          <Button
            disabled={
              hideMutation.isPending ||
              showMutation.isPending ||
              bulkDeleteMutation.isPending ||
              pinMutation.isPending
            }
            size="sm"
            variant="danger"
            onClick={() => void bulkDelete()}
          >
            선택 삭제
          </Button>
      </BulkActionBar>
      <TableShell
        isLoading={!isDemoMode && query.isPending}
        error={isDemoMode ? null : query.error}
        isEmpty={!items.length}
        emptyMessage="등록된 게시물이 없습니다."
      >
        <table>
          <thead>
            <tr>
              <th aria-label="선택">
                <input
                  aria-label="전체 선택"
                  checked={items.length > 0 && selectedIds.size === items.length}
                  className="content-admin-row-checkbox"
                  type="checkbox"
                  onChange={(event) => toggleSelectAll(event.target.checked)}
                />
              </th>
              <th>제목</th>
              {category === "association_news" ? <th>계열사</th> : null}
              <th>상태</th>
              <th>게시일</th>
              <th>작성자</th>
              <th aria-label="작업" />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <input
                    aria-label={`${item.title} 선택`}
                    checked={selectedIds.has(item.id)}
                    className="content-admin-row-checkbox"
                    type="checkbox"
                    onChange={(event) =>
                      toggleSelected(item.id, event.target.checked)
                    }
                  />
                </td>
                <td>
                  <button
                    className="content-admin-table-title-button"
                    type="button"
                    onClick={() => {
                      setEditingId(item.id);
                      setEditorOpen(true);
                    }}
                  >
                    <div className="content-admin-table-title">
                      <strong>
                        {item.isPinned ? (
                          <span
                            aria-hidden="true"
                            className="content-admin-pinned-icon"
                          >
                            <PinnedIcon />
                          </span>
                        ) : null}
                        {item.title}
                      </strong>
                    </div>
                  </button>
                </td>
                {category === "association_news" ? <td>{item.affiliate ?? "-"}</td> : null}
                <td>
                  <StatusBadge
                    status={item.status}
                    publishedAt={item.publishedAt}
                  />
                </td>
                <td>{formatDateTime(item.publishedAt)}</td>
                <td className="content-admin-author">{lastEditorLogin(item) ?? "-"}</td>
                <td>
                  <div className="content-admin-table-actions">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingId(item.id);
                        setEditorOpen(true);
                      }}
                    >
                      수정
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>
      <Pager
        page={page}
        total={isDemoMode ? items.length : query.data?.total ?? 0}
        totalPages={isDemoMode ? 1 : query.data?.totalPages ?? 0}
        onChange={setPage}
      />
      {isDemoMode ? <DemoNotice /> : null}
    </section>
  );
}
