/**
 * 목록 썸네일에 쓸 이미지 영역(자르기 영역).
 * 원본 이미지는 그대로 두고, 원본 대비 0~1 비율의 사각형만 저장한다.
 * 가로세로 비율은 목록 썸네일 비율(`LIST_IMAGE_SIZE`)로 고정되며, 화면에서는 이 영역만 잘라 보여준다.
 */
export type ImageCrop = { x: number; y: number; width: number; height: number };

/** 목록 썸네일의 기본 크기(가로×세로). 기능마다 필요하면 다른 크기를 넘긴다. */
export const LIST_IMAGE_SIZE = { width: 400, height: 250 } as const;

export const LIST_IMAGE_RATIO = LIST_IMAGE_SIZE.width / LIST_IMAGE_SIZE.height;

const clamp01 = (value: number) =>
  Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;

/** 저장된 값을 안전한 범위로 정리한다. 올바르지 않으면 null(= 가운데 자동 맞춤) */
export function normalizeImageCrop(crop?: Partial<ImageCrop> | null): ImageCrop | null {
  if (!crop) return null;
  const width = clamp01(crop.width ?? 0);
  const height = clamp01(crop.height ?? 0);
  if (width < 0.01 || height < 0.01) return null;
  return {
    x: Math.min(clamp01(crop.x ?? 0), 1 - width),
    y: Math.min(clamp01(crop.y ?? 0), 1 - height),
    width,
    height,
  };
}

/** 지정 비율로 원본에서 가장 크게, 가운데를 기준으로 자른 영역 */
export function defaultImageCrop(
  naturalWidth: number,
  naturalHeight: number,
  ratio: number = LIST_IMAGE_RATIO,
): ImageCrop {
  const imageRatio = naturalWidth / naturalHeight;
  const width = imageRatio >= ratio ? ratio / imageRatio : 1;
  const height = imageRatio >= ratio ? 1 : imageRatio / ratio;
  return { x: (1 - width) / 2, y: (1 - height) / 2, width, height };
}
