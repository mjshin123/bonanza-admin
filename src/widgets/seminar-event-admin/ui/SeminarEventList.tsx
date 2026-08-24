import { useMemo, useState, type ReactNode } from "react";

import type { SeminarEventListItem } from "@entities/seminar-event";
import { Button, Card, Input, Notice, Pagination } from "@shared/ui";

type SeminarSortOrder = "newest" | "oldest";

type SeminarEventListProps = {
  categoryControl: ReactNode;
  errorMessage?: string | null;
  isLoading: boolean;
  items: SeminarEventListItem[];
  onCreate: () => void;
  onDelete: (event: SeminarEventListItem) => void;
  onDeleteSelected: () => void;
  onEdit: (event: SeminarEventListItem) => void;
  onSelectedPostIdsChange: (ids: string[]) => void;
  selectedPostIds: string[];
  total: number;
};

const PAGE_SIZES = [10, 20, 50] as const;

function formatCreatedAt(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function AdminSeminarTable({
  allVisibleSelected,
  items,
  onDelete,
  onEdit,
  onSelectVisible,
  onSelectionChange,
  selectedPostIds,
}: {
  allVisibleSelected: boolean;
  items: SeminarEventListItem[];
  onDelete: (event: SeminarEventListItem) => void;
  onEdit: (event: SeminarEventListItem) => void;
  onSelectVisible: (checked: boolean) => void;
  onSelectionChange: (postId: string, checked: boolean) => void;
  selectedPostIds: string[];
}) {
  return (
    <div className="seminar-admin-table-scroll">
      <table className="seminar-admin-table">
        <colgroup>
          <col className="seminar-admin-table-check-column" />
          <col />
          <col className="seminar-admin-table-date-column" />
          <col className="seminar-admin-table-status-column" />
          <col className="seminar-admin-table-manage-column" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">
              <input
                aria-label="현재 화면 전체 선택"
                checked={allVisibleSelected}
                type="checkbox"
                onChange={(event) => onSelectVisible(event.target.checked)}
              />
            </th>
            <th scope="col">제목</th>
            <th scope="col">작성일</th>
            <th scope="col">상태</th>
            <th scope="col">관리</th>
          </tr>
        </thead>
        <tbody>
          {items.map((event) => {
            const isSelected = selectedPostIds.includes(event.post_id);

            return (
              <tr
                key={event.post_id}
                className={
                  isSelected ? "seminar-admin-table-row--selected" : undefined
                }
              >
                <td>
                  <input
                    checked={isSelected}
                    type="checkbox"
                    aria-label={`${event.post.title} 선택`}
                    onChange={(selectionEvent) =>
                      onSelectionChange(
                        event.post_id,
                        selectionEvent.target.checked,
                      )
                    }
                  />
                </td>
                <td className="seminar-admin-table-title">
                  <span>
                    <strong>{event.post.title}</strong>
                  </span>
                </td>
                <td>
                  <time dateTime={event.post.created_at}>
                    {formatCreatedAt(event.post.created_at)}
                  </time>
                </td>
                <td>
                  <span
                    className={`seminar-admin-publish-status seminar-admin-publish-status--${event.post.is_published ? "published" : "draft"}`}
                  >
                    {event.post.is_published ? "등록" : "임시저장"}
                  </span>
                </td>
                <td>
                  <div className="seminar-admin-table-actions">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => onEdit(event)}
                    >
                      수정
                    </Button>
                    <Button
                      size="sm"
                      variant="text"
                      onClick={() => onDelete(event)}
                    >
                      삭제
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function SeminarEventList({
  categoryControl,
  errorMessage,
  isLoading,
  items,
  onCreate,
  onDelete,
  onDeleteSelected,
  onEdit,
  onSelectedPostIdsChange,
  selectedPostIds,
  total,
}: SeminarEventListProps) {
  const [query, setQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<SeminarSortOrder>("newest");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0]);

  const filteredItems = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("ko-KR");
    const matchingItems = keyword
      ? items.filter((event) =>
          event.post.title.toLocaleLowerCase("ko-KR").includes(keyword),
        )
      : items;

    return [...matchingItems].sort((left, right) => {
      const difference =
        Date.parse(right.post.created_at) - Date.parse(left.post.created_at);
      return sortOrder === "newest" ? difference : -difference;
    });
  }, [items, query, sortOrder]);

  const pageCount = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagedItems = filteredItems.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const visibleIds = new Set(pagedItems.map((event) => event.post_id));
  const allVisibleSelected =
    pagedItems.length > 0 &&
    pagedItems.every((event) => selectedPostIds.includes(event.post_id));

  const handleItemSelection = (postId: string, checked: boolean) => {
    onSelectedPostIdsChange(
      checked
        ? Array.from(new Set([...selectedPostIds, postId]))
        : selectedPostIds.filter((id) => id !== postId),
    );
  };

  const handleSelectVisible = (checked: boolean) => {
    onSelectedPostIdsChange(
      checked
        ? Array.from(new Set([...selectedPostIds, ...visibleIds]))
        : selectedPostIds.filter((id) => !visibleIds.has(id)),
    );
  };

  const hasItems = !isLoading && !errorMessage && items.length > 0;
  const hasSearchResult = filteredItems.length > 0;

  return (
    <section
      className="seminar-admin-list-section"
      aria-label="세미나·포럼 게시물 목록"
    >
      <div className="seminar-admin-list-toolbar">
        <div className="seminar-admin-list-category">{categoryControl}</div>
        <div className="seminar-admin-list-actions">
          <Button onClick={onCreate}>게시물 작성</Button>
          <Button
            disabled={selectedPostIds.length === 0}
            variant="ghost"
            onClick={onDeleteSelected}
          >
            선택 삭제
            {selectedPostIds.length > 0 ? ` (${selectedPostIds.length})` : ""}
          </Button>
        </div>
      </div>

      <div className="seminar-admin-list-meta">
        <span data-numeric className="seminar-admin-total">
          {query.trim() ? `검색 ${filteredItems.length}건 / ` : ""}전체{" "}
          <strong>{total}</strong>건
        </span>
        <div className="seminar-admin-list-filters">
          <Input
            aria-label="제목 검색"
            placeholder="제목 검색"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
          />
          <button
            aria-label={
              sortOrder === "newest"
                ? "현재 최신순, 오래된순으로 변경"
                : "현재 오래된순, 최신순으로 변경"
            }
            className="seminar-admin-sort-button"
            title={sortOrder === "newest" ? "최신순" : "오래된순"}
            type="button"
            onClick={() => {
              setSortOrder((current) =>
                current === "newest" ? "oldest" : "newest",
              );
              setPage(1);
            }}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24">
              {sortOrder === "newest" ? (
                <path d="M7 5v14m0 0-3-3m3 3 3-3M13 7h7m-7 5h5m-5 5h3" />
              ) : (
                <path d="M7 19V5m0 0L4 8m3-3 3 3m3-1h3m-3 5h5m-5 5h7" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {errorMessage ? (
        <Notice tone="danger" title="일정을 불러오지 못했습니다.">
          {errorMessage}
        </Notice>
      ) : null}

      {isLoading ? (
        <Card className="seminar-admin-empty-card">
          세미나 일정을 불러오는 중입니다.
        </Card>
      ) : null}

      {!isLoading && !errorMessage && items.length === 0 ? (
        <Card className="seminar-admin-empty-card">
          <span>등록된 게시물이 없습니다</span>
        </Card>
      ) : null}

      {hasItems && !hasSearchResult ? (
        <Card className="seminar-admin-empty-card">
          <span>등록된 게시물이 없습니다</span>
        </Card>
      ) : null}

      {pagedItems.length > 0 ? (
        <AdminSeminarTable
          allVisibleSelected={allVisibleSelected}
          items={pagedItems}
          onDelete={onDelete}
          onEdit={onEdit}
          onSelectVisible={handleSelectVisible}
          onSelectionChange={handleItemSelection}
          selectedPostIds={selectedPostIds}
        />
      ) : null}

      {hasItems && hasSearchResult ? (
        <div className="seminar-admin-list-footer">
          <Pagination
            page={currentPage}
            pageCount={pageCount}
            onChange={setPage}
          />
          <label>
            <span>게시물 수</span>
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}개
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
    </section>
  );
}
