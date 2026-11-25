import { queryOptions } from "@tanstack/react-query";
import { CONTENT_QUERY_OPTIONS } from "@shared/api/content";

/** 운영 웹사이트에서 모달로 보여주는 공지 팝업 */
export type NoticePopupDto = {
  id: string;
  title: string;
  content: string;
  imageFileId: string | null;
  imageUrl: string | null;
  /** 모달 버튼에 표시되는 이름. 기본값은 DEFAULT_NOTICE_POPUP_BUTTON_LABEL */
  buttonLabel: string;
  /** 보여줄 기간(YYYY-MM-DD, 시작일·종료일 모두 포함) */
  startsOn: string;
  endsOn: string;
  isVisible: boolean;
  createdAt: string;
  updatedAt: string;
  createdByLogin?: string | null;
  updatedByLogin?: string | null;
};

export const DEFAULT_NOTICE_POPUP_BUTTON_LABEL = "확인";

export const noticePopupQueryKeys = { all: ["notice-popups"] as const };

/** 노출 상태가 노출인 항목을 위로, 같은 상태끼리는 업로드 일시가 최근인 항목을 위로 */
export function sortNoticePopups<T extends Pick<NoticePopupDto, "isVisible" | "createdAt">>(
  items: T[],
): T[] {
  return [...items].sort(
    (a, b) =>
      Number(b.isVisible) - Number(a.isVisible) ||
      b.createdAt.localeCompare(a.createdAt),
  );
}

async function fetchNoticePopups(): Promise<NoticePopupDto[]> {
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}

export const noticePopupsQueryOptions = () =>
  queryOptions({
    ...CONTENT_QUERY_OPTIONS,
    queryKey: noticePopupQueryKeys.all,
    queryFn: fetchNoticePopups,
  });
