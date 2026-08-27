import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  adminGalleryPhotosQueryOptions,
  galleryQueryKeys,
  getGallerySourceLabel,
  getGallerySourceUrl,
  type AdminGalleryPhotoListItem,
} from "@entities/gallery";
import { removeGalleryItemMutationOptions } from "@features/gallery-manage";
import { Button, Input } from "@shared/ui";

import { useDebouncedValue } from "../model/adminContent";
import {
  FilterBar,
  MutationMessage,
  Pager,
  SectionTitle,
  TableShell,
} from "./AdminCommon";

const GALLERY_PAGE_SIZE = 24;

function GalleryPhotoTile({
  item,
  isHiding,
  onHide,
}: {
  item: AdminGalleryPhotoListItem;
  isHiding: boolean;
  onHide: (item: AdminGalleryPhotoListItem) => void;
}) {
  const sourceLabel = getGallerySourceLabel(item);
  const sourceUrl = getGallerySourceUrl(item);
  const image = (
    <img
      alt={item.photo.altText || item.title}
      className="content-admin-gallery-image"
      src={item.photo.url}
    />
  );

  return (
    <article className="content-admin-gallery-tile">
      {sourceUrl ? (
        <a
          aria-label={`${sourceLabel} '${item.title}' 원문을 새 창에서 엽니다.`}
          className="content-admin-gallery-link"
          href={sourceUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          {image}
        </a>
      ) : (
        <div className="content-admin-gallery-media">{image}</div>
      )}
      <div className="content-admin-gallery-overlay">
        <div className="content-admin-gallery-copy">
          <span>{sourceLabel}</span>
          <strong>{item.title}</strong>
        </div>
        <div className="content-admin-gallery-actions">
          <Button
            aria-label={`'${item.title}' 이미지를 포토갤러리에서 숨깁니다.`}
            disabled={isHiding}
            size="sm"
            variant="secondary"
            onClick={() => onHide(item)}
          >
            숨김
          </Button>
        </div>
      </div>
    </article>
  );
}

export function GallerySection() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [success, setSuccess] = useState<string | null>(null);
  const debouncedQ = useDebouncedValue(q);
  const photosQuery = useQuery(
    adminGalleryPhotosQueryOptions({
      page,
      pageSize: GALLERY_PAGE_SIZE,
      q: debouncedQ || undefined,
    }),
  );
  const hideMutation = useMutation(removeGalleryItemMutationOptions());
  const items = photosQuery.data?.items ?? [];

  const hide = async (item: AdminGalleryPhotoListItem) => {
    if (
      !window.confirm(
        `'${item.title}' 이미지를 포토갤러리에서 숨길까요?\n원본 콘텐츠와 업로드 파일은 유지됩니다.`,
      )
    )
      return;

    setSuccess(null);
    try {
      await hideMutation.mutateAsync({
        galleryId: item.galleryId,
        fileId: item.fileId,
      });
      if (items.length === 1 && page > 1) setPage(page - 1);
      await queryClient.invalidateQueries({ queryKey: galleryQueryKeys.all });
      setSuccess("선택한 이미지를 포토갤러리에서 숨겼습니다.");
    } catch {
      /* mutation 상태로 표시 */
    }
  };

  return (
    <section className="content-admin-section">
      <SectionTitle
        title="포토갤러리 관리"
        description="게시된 콘텐츠에서 포토갤러리 노출을 선택한 이미지를 관리합니다."
      />
      <FilterBar>
        <Input
          aria-label="갤러리 이미지 검색"
          placeholder="원본 제목 검색"
          value={q}
          onChange={(event) => {
            setQ(event.target.value);
            setPage(1);
            setSuccess(null);
          }}
        />
      </FilterBar>
      <MutationMessage error={hideMutation.error} success={success} />
      <TableShell
        className="content-admin-gallery-shell"
        isLoading={photosQuery.isPending}
        error={photosQuery.error}
        isEmpty={items.length === 0}
        emptyMessage="포토갤러리에 노출할 이미지가 없습니다."
      >
        <div className="content-admin-gallery-grid">
          {items.map((item) => (
            <GalleryPhotoTile
              key={`${item.galleryId}-${item.fileId}`}
              item={item}
              isHiding={hideMutation.isPending}
              onHide={(target) => void hide(target)}
            />
          ))}
        </div>
      </TableShell>
      <Pager
        page={page}
        total={photosQuery.data?.total ?? 0}
        totalPages={photosQuery.data?.totalPages ?? 0}
        onChange={setPage}
      />
    </section>
  );
}
