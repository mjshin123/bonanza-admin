import {
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

import {
  LIST_IMAGE_SIZE,
  defaultImageCrop,
  normalizeImageCrop,
  type ImageCrop,
} from "../../lib/imageCrop";
import { Button } from "../button";
import { CroppedImage } from "../cropped-image";

type Corner = "nw" | "ne" | "sw" | "se";

type ImageCropperProps = {
  src: string;
  /** 저장된 자르기 영역. 없으면 가운데를 기준으로 자동 맞춤 */
  value?: ImageCrop | null;
  onChange: (crop: ImageCrop | null) => void;
  /** 목록에 표시될 크기. 이 가로세로 비율로 잘린다. */
  size?: { width: number; height: number };
  listLabel?: string;
};

const MIN_WIDTH = 0.12;
const KEY_STEP = 0.02;
const HANDLE = 12;
const STAGE_MAX_WIDTH = 440;
const PREVIEW_WIDTH = 200;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const HANDLE_POSITION: Record<Corner, CSSProperties> = {
  nw: { left: -HANDLE / 2, top: -HANDLE / 2, cursor: "nwse-resize" },
  ne: { right: -HANDLE / 2, top: -HANDLE / 2, cursor: "nesw-resize" },
  sw: { left: -HANDLE / 2, bottom: -HANDLE / 2, cursor: "nesw-resize" },
  se: { right: -HANDLE / 2, bottom: -HANDLE / 2, cursor: "nwse-resize" },
};

const captionStyle: CSSProperties = {
  fontSize: "var(--text-caption)",
  color: "var(--text-strong)",
};

/**
 * 목록 비율(기본 400:250)의 바깥 상자 안에 이미지를 가로 또는 세로에 맞춰 넣고,
 * 같은 비율로 고정된 자르기 상자를 끌어 이동하고 모서리를 끌어 크기를 조정한다.
 * 오른쪽에는 목록·상세 페이지 미리보기가 작게 함께 보인다.
 */
export function ImageCropper({
  src,
  value,
  onChange,
  size = LIST_IMAGE_SIZE,
  listLabel = "목록 미리보기",
}: ImageCropperProps) {
  const ratio = size.width / size.height;
  // 이미지가 실제로 그려지는 영역. 자르기 좌표는 이 영역 기준(0~1)이다.
  const frameRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<
    | { mode: "move"; px: number; py: number; crop: ImageCrop }
    | { mode: "resize"; corner: Corner; ox: number; oy: number }
    | null
  >(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);

  const stored = normalizeImageCrop(value);
  const crop =
    stored ?? (natural ? defaultImageCrop(natural.w, natural.h, ratio) : null);

  // 이미지가 상자보다 가로로 길면 가로에 맞추고, 세로로 길면 세로에 맞춘다.
  const frameStyle: CSSProperties = natural
    ? {
        aspectRatio: `${natural.w} / ${natural.h}`,
        ...(natural.w / natural.h >= ratio ? { width: "100%" } : { height: "100%" }),
      }
    : { width: "100%", height: "100%", opacity: 0 };

  const startMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!crop) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      mode: "move",
      px: event.clientX,
      py: event.clientY,
      crop,
    };
  };

  const startResize = (corner: Corner) => (event: PointerEvent<HTMLDivElement>) => {
    if (!crop) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    // 반대편 모서리를 고정한 채 크기를 바꾼다.
    dragRef.current = {
      mode: "resize",
      corner,
      ox: corner.includes("w") ? crop.x + crop.width : crop.x,
      oy: corner.includes("n") ? crop.y + crop.height : crop.y,
    };
  };

  const handleMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const rect = frameRef.current?.getBoundingClientRect();
    if (!drag || !rect || !rect.width || !rect.height) return;

    if (drag.mode === "move") {
      onChange({
        ...drag.crop,
        x: clamp(drag.crop.x + (event.clientX - drag.px) / rect.width, 0, 1 - drag.crop.width),
        y: clamp(drag.crop.y + (event.clientY - drag.py) / rect.height, 0, 1 - drag.crop.height),
      });
      return;
    }

    // 정규화 좌표에서 가로세로 비율 유지: height = width * k
    const k = rect.width / (rect.height * ratio);
    const dirX = drag.corner.includes("e") ? 1 : -1;
    const dirY = drag.corner.includes("s") ? 1 : -1;
    const px = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const py = clamp((event.clientY - rect.top) / rect.height, 0, 1);
    const maxWidth = Math.min(
      dirX > 0 ? 1 - drag.ox : drag.ox,
      (dirY > 0 ? 1 - drag.oy : drag.oy) / k,
    );
    const minWidth = Math.min(maxWidth, Math.max(MIN_WIDTH, 40 / rect.width));
    const width = clamp(
      Math.max((px - drag.ox) * dirX, ((py - drag.oy) * dirY) / k),
      minWidth,
      maxWidth,
    );
    const height = width * k;
    onChange({
      width,
      height,
      x: dirX > 0 ? drag.ox : drag.ox - width,
      y: dirY > 0 ? drag.oy : drag.oy - height,
    });
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  const handleKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!crop) return;
    const step: Record<string, [number, number]> = {
      ArrowLeft: [-KEY_STEP, 0],
      ArrowRight: [KEY_STEP, 0],
      ArrowUp: [0, -KEY_STEP],
      ArrowDown: [0, KEY_STEP],
    };
    const delta = step[event.key];
    if (!delta) return;
    event.preventDefault();
    onChange({
      ...crop,
      x: clamp(crop.x + delta[0], 0, 1 - crop.width),
      y: clamp(crop.y + delta[1], 0, 1 - crop.height),
    });
  };

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "var(--sp-5)",
        alignItems: "flex-start",
      }}
    >
      <div style={{ display: "grid", gap: "var(--sp-2)", flex: "1 1 280px", maxWidth: STAGE_MAX_WIDTH }}>
        <strong style={captionStyle}>자를 영역 선택</strong>
        {/* 바깥 상자: 목록과 같은 비율. 이미지는 이 안에 가로/세로 맞춤으로 들어간다. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            aspectRatio: `${size.width} / ${size.height}`,
            overflow: "hidden",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-sm)",
            background: "var(--surface-subtle)",
            userSelect: "none",
          }}
          onPointerCancel={endDrag}
          onPointerMove={handleMove}
          onPointerUp={endDrag}
        >
          <div ref={frameRef} style={{ position: "relative", overflow: "hidden", flex: "none", ...frameStyle }}>
            <img
              alt=""
              draggable={false}
              src={src}
              style={{ display: "block", width: "100%", height: "100%" }}
              onLoad={(event) =>
                setNatural({
                  w: event.currentTarget.naturalWidth,
                  h: event.currentTarget.naturalHeight,
                })
              }
            />
            {crop ? (
              <div
                aria-label="목록에 사용할 영역. 끌어서 이동하고 모서리를 끌어 크기를 조정합니다."
                role="group"
                style={{
                  position: "absolute",
                  left: `${crop.x * 100}%`,
                  top: `${crop.y * 100}%`,
                  width: `${crop.width * 100}%`,
                  height: `${crop.height * 100}%`,
                  boxSizing: "border-box",
                  border: "2px solid #fff",
                  boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.5)",
                  cursor: "move",
                  touchAction: "none",
                }}
                tabIndex={0}
                onKeyDown={handleKey}
                onPointerDown={startMove}
              >
                {(Object.keys(HANDLE_POSITION) as Corner[]).map((corner) => (
                  <div
                    key={corner}
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      width: HANDLE,
                      height: HANDLE,
                      boxSizing: "border-box",
                      border: "2px solid var(--teal-600, #0d9488)",
                      background: "#fff",
                      touchAction: "none",
                      ...HANDLE_POSITION[corner],
                    }}
                    onPointerDown={startResize(corner)}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "var(--text-caption)" }}>
          밝은 상자를 끌어 위치를, 모서리를 끌어 크기를 조정하세요. 비율은 {size.width}:{size.height}로 고정됩니다.
        </p>
        <div>
          <Button
            disabled={!stored}
            size="sm"
            type="button"
            variant="ghost"
            onClick={() => onChange(null)}
          >
            자동 맞춤
          </Button>
        </div>
      </div>
      <div style={{ display: "grid", gap: "var(--sp-4)", flex: `0 0 ${PREVIEW_WIDTH}px` }}>
        <div style={{ display: "grid", gap: "var(--sp-2)" }}>
          <strong style={captionStyle}>
            {listLabel} ({size.width}×{size.height})
          </strong>
          <CroppedImage
            crop={stored}
            src={src}
            style={{
              width: PREVIEW_WIDTH,
              aspectRatio: `${size.width} / ${size.height}`,
              border: "1px solid var(--border)",
              borderRadius: "var(--r-sm)",
            }}
          />
        </div>
        <div style={{ display: "grid", gap: "var(--sp-2)" }}>
          <strong style={captionStyle}>상세 페이지 (원본 비율)</strong>
          <img
            alt=""
            src={src}
            style={{
              display: "block",
              maxWidth: PREVIEW_WIDTH,
              maxHeight: 160,
              width: "auto",
              height: "auto",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-sm)",
            }}
          />
        </div>
      </div>
    </div>
  );
}
