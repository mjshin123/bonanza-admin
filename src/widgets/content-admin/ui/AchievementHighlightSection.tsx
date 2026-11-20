import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  achievementHighlightQueryKeys,
  achievementHighlightsQueryOptions,
  type AchievementHighlightDto,
} from "@entities/achievement-highlight";
import {
  deleteAchievementHighlightMutationOptions,
  moveAchievementHighlightMutationOptions,
  saveAchievementHighlightMutationOptions,
} from "@features/achievement-highlight-manage";
import { isDemoMode as isGlobalDemoMode } from "@shared/api/content";
import { Button, Notice } from "@shared/ui";

import {
  FileUpload,
  MutationMessage,
  SectionTitle,
  Textarea,
} from "./AdminCommon";

const demoHighlights: AchievementHighlightDto[] = [
  {
    id: "demo-highlight-1",
    title: "원화 입출금 검증 시장 점유율 업계 1위",
    content:
      "TranSafer를 통해 원화 입출금 검증 시장에서 업계 선도 성과를 이어가고 있습니다.",
    occurredOn: "2026-10-01",
    imageFileId: null,
    imageUrl: null,
    position: 0,
    updatedAt: "demo",
  },
  {
    id: "demo-highlight-2",
    title: "자체 구축 소버린 KYT 솔루션",
    content:
      "위험 주소 데이터 수집부터 분석 기술까지 자체 구축한 KYT 검증 역량을 제공합니다.",
    occurredOn: "2026-10-01",
    imageFileId: null,
    imageUrl: null,
    position: 1,
    updatedAt: "demo",
  },
  {
    id: "demo-highlight-3",
    title: "수사기관-거래소 공조 네트워크",
    content:
      "TranSight의 공조 요청 중계 기능으로 수사기관과 거래소의 응답 시간을 단축합니다.",
    occurredOn: "2026-10-01",
    imageFileId: null,
    imageUrl: null,
    position: 2,
    updatedAt: "demo",
  },
];

function HighlightEditor({
  item,
  onClose,
}: {
  item: AchievementHighlightDto | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const saveMutation = useMutation(saveAchievementHighlightMutationOptions());
  const [title, setTitle] = useState(item?.title ?? "");
  const [content, setContent] = useState(item?.content ?? "");
  const [occurredOn, setOccurredOn] = useState(
    item?.occurredOn ?? new Date().toISOString().slice(0, 10),
  );
  const [imageFileId, setImageFileId] = useState<string | null>(
    item?.imageFileId ?? null,
  );
  const [imageUrl, setImageUrl] = useState(item?.imageUrl ?? null);

  useEffect(() => {
    setTitle(item?.title ?? "");
    setContent(item?.content ?? "");
    setOccurredOn(item?.occurredOn ?? new Date().toISOString().slice(0, 10));
    setImageFileId(item?.imageFileId ?? null);
    setImageUrl(item?.imageUrl ?? null);
  }, [item]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await saveMutation.mutateAsync({
        id: item?.id,
        expectedUpdatedAt: item?.updatedAt,
        title,
        content,
        occurredOn,
        imageFileId,
      });
      await queryClient.invalidateQueries({
        queryKey: achievementHighlightQueryKeys.all,
      });
      onClose();
    } catch {
      /* MutationMessage에서 오류를 표시한다. */
    }
  };

  return (
    <section className="content-admin-section achievement-highlight-editor">
      <SectionTitle
        title={item ? "주요 성과 수정" : "주요 성과 추가"}
        description="제목, 내용, 이미지와 일자를 입력합니다."
      />
      <form
        className="achievement-highlight-form"
        onSubmit={(event) => void submit(event)}
      >
        <label>
          제목
          <input
            required
            maxLength={160}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label>
          일자
          <input
            required
            type="date"
            value={occurredOn}
            onChange={(event) => setOccurredOn(event.target.value)}
          />
        </label>
        <label className="is-wide">
          내용
          <Textarea
            required
            maxLength={2000}
            rows={8}
            value={content}
            onChange={(event) => setContent(event.target.value)}
          />
        </label>
        <div className="is-wide achievement-highlight-image-field">
          <strong>이미지 첨부</strong>
          {imageUrl ? (
            <img src={imageUrl} alt="첨부 미리보기" />
          ) : (
            <p>첨부된 이미지가 없습니다.</p>
          )}
          <FileUpload
            accept="image/*"
            fileKind="image"
            label="이미지 업로드"
            onUploaded={(files) => {
              const file = files[0];
              if (file) {
                setImageFileId(file.id);
                setImageUrl(file.url);
              }
            }}
          />
          {imageFileId ? (
            <Button
              size="sm"
              type="button"
              variant="ghost"
              onClick={() => {
                setImageFileId(null);
                setImageUrl(null);
              }}
            >
              이미지 제거
            </Button>
          ) : null}
        </div>
        <MutationMessage error={saveMutation.error} />
        <div className="content-admin-form-actions">
          <Button type="button" variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button disabled={saveMutation.isPending} type="submit">
            {saveMutation.isPending ? "저장 중…" : "저장"}
          </Button>
        </div>
      </form>
    </section>
  );
}

export function AchievementHighlightSection() {
  const queryClient = useQueryClient();
  const query = useQuery(achievementHighlightsQueryOptions());
  const moveMutation = useMutation(moveAchievementHighlightMutationOptions());
  const deleteMutation = useMutation(
    deleteAchievementHighlightMutationOptions(),
  );
  const [editing, setEditing] = useState<
    AchievementHighlightDto | null | "new"
  >(null);
  const demoMode = isGlobalDemoMode || Boolean(query.error);
  const highlights = query.data ?? (demoMode ? demoHighlights : []);
  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: achievementHighlightQueryKeys.all,
    });

  if (editing)
    return (
      <HighlightEditor
        item={editing === "new" ? null : editing}
        onClose={() => setEditing(null)}
      />
    );

  const move = async (item: AchievementHighlightDto, direction: -1 | 1) => {
    try {
      await moveMutation.mutateAsync({ id: item.id, direction });
      await refresh();
    } catch {
      /* MutationMessage에서 오류를 표시한다. */
    }
  };
  const remove = async (item: AchievementHighlightDto) => {
    if (!window.confirm(`‘${item.title}’ 항목을 제거할까요?`)) return;
    try {
      await deleteMutation.mutateAsync(item.id);
      await refresh();
    } catch {
      /* MutationMessage에서 오류를 표시한다. */
    }
  };

  return (
    <section className="content-admin-section">
      <SectionTitle
        title="주요 성과 레이어"
        description="웹사이트 주요 성과 페이지에 노출되는 항목입니다. 최대 10개까지 관리할 수 있습니다."
        action={
          <Button
            disabled={demoMode || highlights.length >= 10}
            onClick={() => setEditing("new")}
          >
            성과 추가 ({highlights.length}/10)
          </Button>
        }
      />
      {demoMode ? (
        <Notice tone="warning" title="데모 데이터 표시 중">
          Supabase API에 연결할 수 없어 운영 웹사이트의 주요 성과를 임시로
          표시합니다. DB 연결 후 수정할 수 있습니다.
        </Notice>
      ) : null}
      <MutationMessage error={moveMutation.error ?? deleteMutation.error} />
      {query.isPending ? <p>주요 성과를 불러오는 중입니다.</p> : null}
      <div className="achievement-highlight-list">
        {highlights.map((item, index) => (
          <article key={item.id} className="achievement-highlight-item">
            <span>{index + 1}</span>
            <div>
              {item.imageUrl ? <img src={item.imageUrl} alt="" /> : null}
              <strong>{item.title}</strong>
              <p>{item.occurredOn}</p>
              <p>{item.content}</p>
            </div>
            <div>
              <Button
                aria-label="위로 이동"
                disabled={demoMode || index === 0 || moveMutation.isPending}
                size="sm"
                variant="ghost"
                onClick={() => void move(item, -1)}
              >
                위
              </Button>
              <Button
                aria-label="아래로 이동"
                disabled={
                  demoMode ||
                  index === highlights.length - 1 ||
                  moveMutation.isPending
                }
                size="sm"
                variant="ghost"
                onClick={() => void move(item, 1)}
              >
                아래
              </Button>
              <Button
                disabled={demoMode}
                size="sm"
                variant="ghost"
                onClick={() => setEditing(item)}
              >
                수정
              </Button>
              <Button
                disabled={demoMode || deleteMutation.isPending}
                size="sm"
                variant="text"
                onClick={() => void remove(item)}
              >
                제거
              </Button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
