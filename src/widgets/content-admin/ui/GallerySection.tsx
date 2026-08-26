import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  adminGalleriesQueryOptions,
  adminGalleryDetailQueryOptions,
  galleryQueryKeys,
  type AdminGalleryListItem,
  type GalleryItemDto,
} from "@entities/gallery";
import {
  removeGalleryItemMutationOptions,
  reorderGalleryItemsMutationOptions,
  setGalleryItemHiddenMutationOptions,
} from "@features/gallery-manage";
import type { ContentStatus } from "@shared/api/content";
import { Button, Input } from "@shared/ui";

import { useDebouncedValue } from "../model/adminContent";
import {
  FilterBar,
  MutationMessage,
  NativeSelect,
  Pager,
  SectionTitle,
  StatusBadge,
  TableShell,
} from "./AdminCommon";

// 이미지 나열형 화면이라 페이지네이션 없이 한 번에 훑어볼 수 있도록
// 페이지 크기를 넉넉하게 잡는다(RPC 허용 최대치). 정렬은 항상 게시일 기준.
const GALLERY_PAGE_SIZE = 100;

function sourceLabel(item: AdminGalleryListItem): string {
  if (item.sourceType === "post") return "게시글";
  if (item.sourceType === "resource") return "자료실";
  if (item.sourceType === "seminar") return "세미나";
  return "독립 갤러리";
}

function GalleryItemManager({
  galleryId,
  onClose,
}: {
  galleryId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const detailQuery = useQuery(adminGalleryDetailQueryOptions(galleryId));
  const reorderMutation = useMutation(reorderGalleryItemsMutationOptions());
  const hiddenMutation = useMutation(setGalleryItemHiddenMutationOptions());
  const removeMutation = useMutation(removeGalleryItemMutationOptions());
  const gallery = detailQuery.data;

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: galleryQueryKeys.all });
  };

  const move = async (item: GalleryItemDto, direction: -1 | 1) => {
    if (!gallery) return;
    const currentIndex = gallery.items.findIndex(
      (candidate) => candidate.file.id === item.file.id,
    );
    const targetIndex = currentIndex + direction;
    if (
      currentIndex < 0 ||
      targetIndex < 0 ||
      targetIndex >= gallery.items.length
    )
      return;
    const reordered = [...gallery.items];
    [reordered[currentIndex], reordered[targetIndex]] = [
      reordered[targetIndex],
      reordered[currentIndex],
    ];
    try {
      await reorderMutation.mutateAsync({
        galleryId,
        items: reordered.map((candidate, index) => ({
          fileId: candidate.file.id,
          sortOrder: index,
        })),
      });
      await refresh();
    } catch {
      /* mutation 상태로 표시 */
    }
  };

  const toggleHidden = async (item: GalleryItemDto) => {
    try {
      await hiddenMutation.mutateAsync({
        galleryId,
        fileId: item.file.id,
        isHidden: !item.isHidden,
      });
      await refresh();
    } catch {
      /* mutation 상태로 표시 */
    }
  };

  const remove = async (item: GalleryItemDto) => {
    if (
      !window.confirm(
        `'${item.file.originalName}' 이미지를 포토갤러리에서 삭제할까요?\n원본 게시글과 업로드 파일은 유지됩니다.`,
      )
    )
      return;
    try {
      await removeMutation.mutateAsync({
        galleryId,
        fileId: item.file.id,
      });
      if (gallery?.items.length === 1) onClose();
      await refresh();
    } catch {
      /* mutation 상태로 표시 */
    }
  };

  const mutationError =
    reorderMutation.error ?? hiddenMutation.error ?? removeMutation.error;

  return (
    <section className="content-admin-section">
      <SectionTitle
        title={gallery?.title ?? "포토갤러리 이미지 관리"}
        description="홈페이지 노출 순서와 이미지별 숨김 상태를 관리합니다."
        action={
          <Button variant="ghost" onClick={onClose}>
            목록으로
          </Button>
        }
      />
      <MutationMessage error={mutationError} />
      <TableShell
        isLoading={detailQuery.isPending}
        error={detailQuery.error}
        isEmpty={detailQuery.isSuccess && !gallery}
        emptyMessage="갤러리를 찾을 수 없습니다."
      >
        <table>
          <thead>
            <tr>
              <th>이미지</th>
              <th>노출 상태</th>
              <th>순서</th>
              <th aria-label="작업" />
            </tr>
          </thead>
          <tbody>
            {(gallery?.items ?? []).map((item, index, items) => (
              <tr key={item.file.id}>
                <td>
                  <div className="content-admin-inline">
                    <img
                      alt=""
                      className="content-admin-image-thumb"
                      src={item.file.url}
                    />
                    <div className="content-admin-table-title">
                      <strong>{item.file.originalName}</strong>
                      <span>{item.caption || gallery?.title}</span>
                    </div>
                  </div>
                </td>
                <td>{item.isHidden ? "숨김" : "노출"}</td>
                <td>
                  <div className="content-admin-inline">
                    <span>{index + 1}</span>
                    <Button
                      disabled={index === 0 || reorderMutation.isPending}
                      size="sm"
                      variant="ghost"
                      onClick={() => void move(item, -1)}
                    >
                      ▲
                    </Button>
                    <Button
                      disabled={
                        index === items.length - 1 || reorderMutation.isPending
                      }
                      size="sm"
                      variant="ghost"
                      onClick={() => void move(item, 1)}
                    >
                      ▼
                    </Button>
                  </div>
                </td>
                <td>
                  <div className="content-admin-table-actions">
                    <Button
                      disabled={hiddenMutation.isPending}
                      size="sm"
                      variant="ghost"
                      onClick={() => void toggleHidden(item)}
                    >
                      {item.isHidden ? "다시 노출" : "숨김"}
                    </Button>
                    <Button
                      disabled={removeMutation.isPending}
                      size="sm"
                      variant="danger"
                      onClick={() => void remove(item)}
                    >
                      삭제
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>
    </section>
  );
}

export function GallerySection() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [selectedGalleryId, setSelectedGalleryId] = useState<string | null>(
    null,
  );
  const debouncedQ = useDebouncedValue(q);
  const galleriesQuery = useQuery(
    adminGalleriesQueryOptions({
      page,
      pageSize: GALLERY_PAGE_SIZE,
      q: debouncedQ || undefined,
      status: status ? (status as ContentStatus) : undefined,
    }),
  );

  if (selectedGalleryId)
    return (
      <GalleryItemManager
        galleryId={selectedGalleryId}
        onClose={() => setSelectedGalleryId(null)}
      />
    );

  const items = galleriesQuery.data?.items ?? [];

  return (
    <section className="content-admin-section">
      <SectionTitle
        title="포토갤러리 관리"
        description="게시일 순으로 정렬됩니다. 클릭하면 이미지 관리 화면으로 이동합니다."
      />
      <FilterBar>
        <Input
          aria-label="갤러리 검색"
          placeholder="제목 검색"
          value={q}
          onChange={(event) => {
            setQ(event.target.value);
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
            <option value="">전체 상태</option>
            <option value="published">게시</option>
            <option value="draft">임시저장</option>
            <option value="hidden">숨김</option>
          </NativeSelect>
        </div>
      </FilterBar>
      <TableShell
        isLoading={galleriesQuery.isPending}
        error={galleriesQuery.error}
        isEmpty={items.length === 0}
        emptyMessage="포토갤러리에 노출할 이미지가 없습니다."
      >
        <div className="content-admin-gallery-grid">
          {items.map((item) => (
            <div
              key={item.id}
              className="content-admin-gallery-card"
              role="button"
              tabIndex={0}
              onClick={() => setSelectedGalleryId(item.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelectedGalleryId(item.id);
                }
              }}
            >
              <div className="content-admin-gallery-card-image">
                {item.coverImage ? (
                  <img alt="" src={item.coverImage.url} />
                ) : (
                  <span className="content-admin-gallery-card-empty">
                    이미지 없음
                  </span>
                )}
                <span className="content-admin-gallery-card-count">
                  {item.itemCount.toLocaleString()}장
                </span>
              </div>
              <div className="content-admin-gallery-card-body">
                <strong>{item.title}</strong>
                <div className="content-admin-inline">
                  <span className="content-admin-muted">
                    {sourceLabel(item)}
                  </span>
                  <StatusBadge
                    status={item.status}
                    publishedAt={item.publishedAt}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </TableShell>
      <Pager
        page={page}
        total={galleriesQuery.data?.total ?? 0}
        totalPages={galleriesQuery.data?.totalPages ?? 0}
        onChange={setPage}
      />
    </section>
  );
}
