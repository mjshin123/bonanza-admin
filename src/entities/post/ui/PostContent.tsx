import { sanitizePostContent } from "../lib/postContent";

type PostContentProps = {
  className?: string;
  content: string;
  emptyText?: string;
};

export function PostContent({
  className,
  content,
  emptyText = "내용이 없습니다.",
}: PostContentProps) {
  if (!content.trim()) {
    return <div className={className}>{emptyText}</div>;
  }

  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitizePostContent(content) }}
    />
  );
}
