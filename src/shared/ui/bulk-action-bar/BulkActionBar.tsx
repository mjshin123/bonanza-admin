import type { ReactNode } from "react";

import "./BulkActionBar.css";

type BulkActionBarProps = {
  selectedCount: number;
  /** 선택이 없을 때 회색으로 보여주는 안내 문구 */
  emptyHint: string;
  /** 선택이 있을 때 노출할 버튼들 (숨김·삭제 등) */
  children: ReactNode;
};

export function BulkActionBar({
  selectedCount,
  emptyHint,
  children,
}: BulkActionBarProps) {
  return (
    <div className="bulk-action-bar" aria-live="polite">
      {selectedCount > 0 ? (
        <>
          <span className="bulk-action-bar__count">
            {selectedCount}건 선택됨
          </span>
          <div className="bulk-action-bar__actions">{children}</div>
        </>
      ) : (
        <span className="bulk-action-bar__hint">{emptyHint}</span>
      )}
    </div>
  );
}
