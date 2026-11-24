import { useCallback, useState } from "react";

export type OrderMove = { id: string; direction: -1 | 1 };

/**
 * 순서 변경을 저장 전까지 화면에서만 반영한다.
 * 이동 내역(moves)을 남겨 두어 저장 시 한 칸 이동 단위로 순서대로 재생할 수 있다.
 */
export function useOrderDraft<T extends { id: string }>(serverItems: T[]) {
  const [draft, setDraft] = useState<T[] | null>(null);
  const [moves, setMoves] = useState<OrderMove[]>([]);
  const items = draft ?? serverItems;

  const move = useCallback(
    (id: string, direction: -1 | 1) => {
      const current = draft ?? serverItems;
      const index = current.findIndex((item) => item.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return;
      const next = [...current];
      [next[index], next[target]] = [next[target]!, next[index]!];
      setDraft(next);
      setMoves((log) => [...log, { id, direction }]);
    },
    [draft, serverItems],
  );

  const reset = useCallback(() => {
    setDraft(null);
    setMoves([]);
  }, []);

  return { items, moves, isDirty: moves.length > 0, move, reset };
}
