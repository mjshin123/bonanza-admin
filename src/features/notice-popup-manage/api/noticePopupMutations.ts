import { mutationOptions } from "@tanstack/react-query";

import { DEFAULT_NOTICE_POPUP_BUTTON_LABEL } from "@entities/notice-popup";
import { requireExpectedUpdatedAt, requireUuid } from "@shared/api/content";

export type SaveNoticePopupInput = {
  id?: string;
  expectedUpdatedAt?: string;
  title: string;
  content: string;
  imageFileId: string | null;
  buttonLabel: string;
  startsOn: string;
  endsOn: string;
  isVisible: boolean;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** 저장 전 입력값을 검증하고 정리한다. 버튼 명칭을 비우면 기본값('확인')을 쓴다. */
export function normalizeNoticePopupInput(input: SaveNoticePopupInput) {
  const title = input.title.trim();
  const content = input.content.trim();
  const buttonLabel = input.buttonLabel.trim() || DEFAULT_NOTICE_POPUP_BUTTON_LABEL;
  if (!title || title.length > 100)
    throw new RangeError("제목은 1~100자로 입력해 주세요.");
  if (!content || content.length > 2000)
    throw new RangeError("내용은 1~2000자로 입력해 주세요.");
  if (buttonLabel.length > 20)
    throw new RangeError("버튼 명칭은 20자 이하로 입력해 주세요.");
  if (!DATE_PATTERN.test(input.startsOn) || !DATE_PATTERN.test(input.endsOn))
    throw new RangeError("보여줄 기간의 시작일과 종료일을 입력해 주세요.");
  if (input.endsOn < input.startsOn)
    throw new RangeError("종료일은 시작일과 같거나 이후여야 합니다.");
  return { ...input, title, content, buttonLabel };
}

async function save(input: SaveNoticePopupInput): Promise<void> {
  normalizeNoticePopupInput(input);
  if (input.id) {
    requireUuid(input.id);
    requireExpectedUpdatedAt(input.expectedUpdatedAt!);
  }
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}

async function setVisibility(input: {
  ids: string[];
  isVisible: boolean;
}): Promise<void> {
  for (const id of input.ids) requireUuid(id);
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}

async function remove(ids: string[]): Promise<void> {
  for (const id of ids) requireUuid(id);
  throw new Error("백엔드가 아직 연결되지 않았습니다.");
}

export const saveNoticePopupMutationOptions = () =>
  mutationOptions({ mutationKey: ["notice-popups", "save"], mutationFn: save });
export const setNoticePopupsVisibilityMutationOptions = () =>
  mutationOptions({
    mutationKey: ["notice-popups", "visibility"],
    mutationFn: setVisibility,
  });
export const deleteNoticePopupsMutationOptions = () =>
  mutationOptions({ mutationKey: ["notice-popups", "delete"], mutationFn: remove });
