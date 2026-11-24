import { useMemo, useState, type ReactNode } from "react";

import type { LegacyAdminPostListItem } from "@entities/post";
import {
  BulkActionBar,
  Button,
  Card,
  Input,
  Notice,
  Pagination,
} from "@shared/ui";

import { formatPostDate } from "../model/generalPostForm";

type PostSortOrder = "newest" | "oldest";

type GeneralPostListProps = {
  boardCode: string;
  boardName: string;
  categoryControl: ReactNode;
  errorMessage?: string | null;
  isLoading: boolean;
  items: LegacyAdminPostListItem[];
  onCreate: () => void;
  onDelete: (post: LegacyAdminPostListItem) => void;
  onDeleteSelected: () => void;
  onEdit: (post: LegacyAdminPostListItem) => void;
  onSelectedPostIdsChange: (ids: string[]) => void;
  selectedPostIds: string[];
  total: number;
};

const PAGE_SIZES = [10, 20, 50] as const;
const PINNED_BOARD_CODES = new Set(["notice", "association_news"]);

function AdminPostTable({
  allVisibleSelected,
  items,
  onDelete,
  onEdit,
  onSelectVisible,
  onSelectionChange,
  selectedPostIds,
  showPinnedLabel,
}: {
  allVisibleSelected: boolean;
  items: LegacyAdminPostListItem[];
  onDelete: (post: LegacyAdminPostListItem) => void;
  onEdit: (post: LegacyAdminPostListItem) => void;
  onSelectVisible: (checked: boolean) => void;
  onSelectionChange: (postId: string, checked: boolean) => void;
  selectedPostIds: string[];
  showPinnedLabel: boolean;
}) {
  return (
    <div className="general-admin-table-scroll">
      <table className="general-admin-table">
        <colgroup>
          <col className="general-admin-table-check-column" />
          <col />
          <col className="general-admin-table-date-column" />
          <col className="general-admin-table-status-column" />
          <col className="general-admin-table-manage-column" />
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
          {items.map((post) => {
            const isSelected = selectedPostIds.includes(post.id);

            return (
              <tr
                key={post.id}
                className={
                  isSelected ? "general-admin-table-row--selected" : undefined
                }
              >
                <td>
                  <input
                    checked={isSelected}
                    type="checkbox"
                    aria-label={`${post.title} 선택`}
                    onChange={(event) =>
                      onSelectionChange(post.id, event.target.checked)
                    }
                  />
                </td>
                <td className="general-admin-table-title">
                  <span>
                    {showPinnedLabel && post.is_pinned ? (
                      <small className="general-admin-table-status general-admin-table-status--pinned">
                        고정
                      </small>
                    ) : null}
                    <strong>{post.title}</strong>
                  </span>
                </td>
                <td>
                  <time dateTime={post.created_at}>
                    {formatPostDate(post.created_at)}
                  </time>
                </td>
                <td>
                  <span
                    className={`general-admin-publish-status general-admin-publish-status--${post.is_published ? "published" : "draft"}`}
                  >
                    {post.is_published ? "등록" : "임시저장"}
                  </span>
                </td>
                <td>
                  <div className="general-admin-table-actions">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => onEdit(post)}
                    >
                      수정
                    </Button>
                    <Button
                      size="sm"
                      variant="text"
                      onClick={() => onDelete(post)}
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

export function GeneralPostList({
  boardCode,
  boardName,
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
}: GeneralPostListProps) {
  const [query, setQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<PostSortOrder>("newest");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0]);
  const supportsPinnedGroup = PINNED_BOARD_CODES.has(boardCode);

  const filteredItems = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("ko-KR");
    const matchingItems = keyword
      ? items.filter((post) =>
          post.title.toLocaleLowerCase("ko-KR").includes(keyword),
        )
      : items;

    return [...matchingItems].sort((left, right) => {
      if (supportsPinnedGroup && left.is_pinned !== right.is_pinned) {
        return left.is_pinned ? -1 : 1;
      }

      const difference =
        Date.parse(right.created_at) - Date.parse(left.created_at);
      return sortOrder === "newest" ? difference : -difference;
    });
  }, [items, query, sortOrder, supportsPinnedGroup]);

  const pageCount = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagedItems = filteredItems.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const visibleIds = new Set(pagedItems.map((post) => post.id));
  const allVisibleSelected =
    pagedItems.length > 0 &&
    pagedItems.every((post) => selectedPostIds.includes(post.id));

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
      className="general-post-list-section"
      aria-label={`${boardName} 게시물 목록`}
    >
      <div className="general-admin-list-toolbar">
        <div className="general-admin-list-category">{categoryControl}</div>
        <div className="general-admin-list-actions">
          <Button onClick={onCreate}>게시물 작성</Button>
        </div>
      </div>

      <div className="general-admin-list-meta">
        <span className="general-post-total">
          {query.trim() ? `검색 ${filteredItems.length}건 / ` : ""}전체{" "}
          <strong>{total}</strong>건
        </span>
        <div className="general-admin-list-filters">
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
            className="general-admin-sort-button"
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
        <Notice tone="danger" title="게시물을 불러오지 못했습니다.">
          {errorMessage}
        </Notice>
      ) : null}

      {isLoading ? (
        <Card className="general-post-empty-card">
          게시물을 불러오는 중입니다.
        </Card>
      ) : null}

      {!isLoading && !errorMessage && items.length === 0 ? (
        <Card className="general-post-empty-card">
          <span>등록된 게시물이 없습니다</span>
        </Card>
      ) : null}

      {hasItems && !hasSearchResult ? (
        <Card className="general-post-empty-card">
          <span>등록된 게시물이 없습니다</span>
        </Card>
      ) : null}

      {pagedItems.length > 0 ? (
        <BulkActionBar
          selectedCount={selectedPostIds.length}
          emptyHint="게시글을 삭제하려면 원하는 게시글을 선택해 주세요."
        >
          <Button size="sm" variant="danger" onClick={onDeleteSelected}>
            선택 삭제
          </Button>
        </BulkActionBar>
      ) : null}

      {pagedItems.length > 0 ? (
        <AdminPostTable
          allVisibleSelected={allVisibleSelected}
          items={pagedItems}
          showPinnedLabel={supportsPinnedGroup}
          onDelete={onDelete}
          onEdit={onEdit}
          onSelectVisible={handleSelectVisible}
          onSelectionChange={handleItemSelection}
          selectedPostIds={selectedPostIds}
        />
      ) : null}

      {hasItems && hasSearchResult ? (
        <div className="general-admin-list-footer">
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
