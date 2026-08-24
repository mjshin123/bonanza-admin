import DOMPurify, { type Config } from "dompurify";

import { getPublicAssetUrl } from "@shared/api/supabase";

export type PostContentImage = {
  alt: string;
  src: string;
  storagePath: string | null;
  uploadId: string | null;
};

const RICH_CONTENT_PATTERN =
  /<\/?(?:a|blockquote|br|code|em|h2|h3|hr|img|li|ol|p|pre|s|span|strong|u|ul)\b/i;
const ALLOWED_FONT_SIZES = new Set([
  "14px",
  "16px",
  "18px",
  "20px",
  "24px",
  "32px",
]);
const ALLOWED_TEXT_COLORS = new Set([
  "#1a1d24",
  "#5c5857",
  "#1a304c",
  "#2b5b60",
  "#c6392e",
]);

const SANITIZE_OPTIONS: Config = {
  ALLOWED_ATTR: [
    "alt",
    "data-storage-path",
    "href",
    "rel",
    "src",
    "style",
    "target",
    "title",
  ],
  ALLOWED_TAGS: [
    "a",
    "blockquote",
    "br",
    "code",
    "em",
    "h2",
    "h3",
    "hr",
    "img",
    "li",
    "ol",
    "p",
    "pre",
    "s",
    "span",
    "strong",
    "u",
    "ul",
  ],
  ALLOW_DATA_ATTR: false,
};

function normalizeTextColor(value: string) {
  const normalized = value.trim().toLowerCase();

  if (/^#[0-9a-f]{6}$/.test(normalized)) {
    return normalized;
  }

  const rgb = normalized.match(
    /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/,
  );

  if (!rgb) {
    return "";
  }

  const channels = rgb.slice(1).map(Number);

  if (channels.some((channel) => channel < 0 || channel > 255)) {
    return "";
  }

  return `#${channels
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`;
}

function normalizeTextStyles(value: string) {
  const document = parseHtml(value);

  for (const element of document.body.querySelectorAll<HTMLElement>(
    "[style]",
  )) {
    if (element.tagName !== "SPAN") {
      element.removeAttribute("style");
      continue;
    }

    const styles: string[] = [];
    const color = normalizeTextColor(element.style.color);
    const fontSize = element.style.fontSize.trim().toLowerCase();

    if (ALLOWED_TEXT_COLORS.has(color)) {
      styles.push(`color: ${color}`);
    }

    if (ALLOWED_FONT_SIZES.has(fontSize)) {
      styles.push(`font-size: ${fontSize}`);
    }

    if (styles.length > 0) {
      element.setAttribute("style", styles.join("; "));
    } else {
      element.removeAttribute("style");
    }
  }

  return document.body.innerHTML;
}

function sanitizeHtml(value: string) {
  return DOMPurify.sanitize(
    normalizeTextStyles(value),
    SANITIZE_OPTIONS,
  ) as string;
}

function escapeHtml(value: string) {
  const element = document.createElement("div");
  element.textContent = value;
  return element.innerHTML;
}

function plainTextToHtml(value: string) {
  if (!value.trim()) {
    return "<p></p>";
  }

  return value
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function parseHtml(value: string) {
  return new DOMParser().parseFromString(value, "text/html");
}

export function preparePostContentForEditor(value: string) {
  const normalized = RICH_CONTENT_PATTERN.test(value)
    ? value
    : plainTextToHtml(value);

  return sanitizeHtml(normalized);
}

export function sanitizePostContent(value: string) {
  return sanitizeHtml(preparePostContentForEditor(value));
}

export function getPostContentImages(value: string): PostContentImage[] {
  if (!value) {
    return [];
  }

  return Array.from(parseHtml(value).querySelectorAll("img")).map((image) => ({
    alt: image.getAttribute("alt") ?? "",
    src: image.getAttribute("src") ?? "",
    storagePath: image.getAttribute("data-storage-path"),
    uploadId: image.getAttribute("data-upload-id"),
  }));
}

export function getPostContentImagePaths(value: string) {
  return getPostContentImages(value)
    .map((image) => image.storagePath)
    .filter((path): path is string => Boolean(path));
}

export function finalizePostContent(
  value: string,
  uploadedPaths: ReadonlyMap<string, string>,
) {
  const document = parseHtml(value);

  for (const image of document.querySelectorAll("img")) {
    const uploadId = image.getAttribute("data-upload-id");

    if (uploadId) {
      const storagePath = uploadedPaths.get(uploadId);

      if (!storagePath) {
        image.remove();
        continue;
      }

      image.setAttribute("data-storage-path", storagePath);
      image.setAttribute("src", getPublicAssetUrl(storagePath) ?? "");
      image.removeAttribute("data-upload-id");
    }
  }

  return sanitizeHtml(document.body.innerHTML);
}

export function getRemovedPostContentImagePaths(
  previousContent: string,
  nextContent: string,
) {
  const nextPaths = new Set(getPostContentImagePaths(nextContent));

  return Array.from(new Set(getPostContentImagePaths(previousContent))).filter(
    (path) => !nextPaths.has(path),
  );
}

export function hasMeaningfulPostContent(value: string) {
  const document = parseHtml(preparePostContentForEditor(value));
  return Boolean(document.body.textContent?.trim() || document.querySelector("img"));
}
