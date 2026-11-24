import { Button } from "../button";

import "./BulkActionBar.css";

type OrderSaveBarProps = {
  isDirty: boolean;
  isPending: boolean;
  onSave: () => void;
  onCancel: () => void;
};

/** 순서를 바꾼 뒤 저장 전까지 목록 상단에 나타나는 저장 바 */
export function OrderSaveBar({
  isDirty,
  isPending,
  onSave,
  onCancel,
}: OrderSaveBarProps) {
  if (!isDirty) return null;
  return (
    <div className="order-save-bar" role="status">
      <span>순서가 변경되었습니다. 저장해야 홈페이지에 반영됩니다.</span>
      <div className="bulk-action-bar__actions">
        <Button disabled={isPending} size="sm" variant="ghost" onClick={onCancel}>
          되돌리기
        </Button>
        <Button disabled={isPending} size="sm" onClick={onSave}>
          {isPending ? "저장 중…" : "순서 저장"}
        </Button>
      </div>
    </div>
  );
}
