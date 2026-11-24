import { useEffect, useSyncExternalStore } from "react";

let dirty = false;
const listeners = new Set<() => void>();

function setEditorDirty(next: boolean) {
  if (dirty === next) return;
  dirty = next;
  listeners.forEach((listener) => listener());
}

/** 작성 화면에 입력·선택이 한 번이라도 있었는지 구독한다. */
export function useEditorDirty() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => dirty,
    () => false,
  );
}

/**
 * 작성 폼에 연결한다. 반환된 핸들러를 form의 onInput·onChange에 걸면
 * 사용자가 입력하거나 선택했을 때만 변경됨으로 기록하고, 화면이 닫히면 해제한다.
 */
export function useEditorDirtyTracker() {
  useEffect(() => () => setEditorDirty(false), []);
  return () => setEditorDirty(true);
}
