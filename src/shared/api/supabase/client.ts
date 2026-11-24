/** 외부 백엔드가 연결되기 전의 로컬 경계입니다. */
const createLocalBackend = (): any => {
  const target = () => Promise.resolve({ data: null, error: new Error("백엔드가 아직 연결되지 않았습니다."), count: 0 });
  return new Proxy(target, {
    apply: () => createLocalBackend(),
    get: (_target, key) => (key === "then" ? undefined : createLocalBackend()),
  });
};

export const localBackend = createLocalBackend();
/** @deprecated 기존 화면 전환 기간의 호환 별칭입니다. */
export const supabase = localBackend;
