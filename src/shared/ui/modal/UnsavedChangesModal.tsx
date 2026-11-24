import { Button } from "../button";
import { Modal } from "./Modal";

type UnsavedChangesModalProps = {
  open: boolean;
  onStay: () => void;
  onLeave: () => void;
  /** 본문 문구. 생략하면 순서 변경 기준 문구를 쓴다. */
  message?: string;
};

export function UnsavedChangesModal({
  open,
  onStay,
  onLeave,
  message = "순서 변경 내용을 저장하지 않고 이동하면 변경한 순서가 사라집니다. 이동하시겠습니까?",
}: UnsavedChangesModalProps) {
  return (
    <Modal compact open={open} onClose={onStay} title="저장하지 않은 변경사항이 있습니다">
      <p style={{ color: "var(--text-body)", fontSize: "var(--text-body-sm)" }}>
        {message}
      </p>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: "var(--sp-3)",
          paddingTop: "var(--sp-4)",
        }}
      >
        <Button variant="ghost" onClick={onStay}>
          계속 편집
        </Button>
        <Button variant="danger" onClick={onLeave}>
          저장하지 않고 이동
        </Button>
      </div>
    </Modal>
  );
}
