import type { CSSProperties } from "react";

import { normalizeImageCrop, type ImageCrop } from "../../lib/imageCrop";

type CroppedImageProps = {
  src: string;
  /** 보여줄 영역. 없으면 가운데를 기준으로 채워서 자른다. */
  crop?: ImageCrop | null;
  alt?: string;
  className?: string;
  /** 바깥 상자의 크기·테두리 등. 상자의 가로세로 비율이 자르기 영역 비율과 같아야 한다. */
  style?: CSSProperties;
};

/** 저장된 자르기 영역만 보여주는 이미지. 관리자 목록과 미리보기에서 함께 쓴다. */
export function CroppedImage({ src, crop, alt = "", className, style }: CroppedImageProps) {
  const area = normalizeImageCrop(crop);
  return (
    <div
      className={className}
      style={{ position: "relative", overflow: "hidden", ...style }}
    >
      {area ? (
        <img
          alt={alt}
          draggable={false}
          src={src}
          style={{
            position: "absolute",
            maxWidth: "none",
            width: `${100 / area.width}%`,
            height: `${100 / area.height}%`,
            left: `${(-area.x / area.width) * 100}%`,
            top: `${(-area.y / area.height) * 100}%`,
          }}
        />
      ) : (
        <img
          alt={alt}
          draggable={false}
          src={src}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      )}
    </div>
  );
}
