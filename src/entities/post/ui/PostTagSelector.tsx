import { POST_TAG_OPTIONS } from "../model/postTags";
import "./PostTagSelector.css";

type PostTagSelectorProps = {
  disabled?: boolean;
  onChange: (tags: string[]) => void;
  selectedTags: string[];
};

export function PostTagSelector({
  disabled = false,
  onChange,
  selectedTags,
}: PostTagSelectorProps) {
  const visibleOptions = Array.from(
    new Set([
      ...POST_TAG_OPTIONS,
      ...selectedTags.filter(
        (tag) =>
          !POST_TAG_OPTIONS.includes(tag as (typeof POST_TAG_OPTIONS)[number]),
      ),
    ]),
  );

  const toggleTag = (tag: string) => {
    onChange(
      selectedTags.includes(tag)
        ? selectedTags.filter((selectedTag) => selectedTag !== tag)
        : [...selectedTags, tag],
    );
  };

  return (
    <fieldset className="post-tag-selector" disabled={disabled}>
      <legend>태그</legend>
      <p>게시물 목록에 표시할 태그를 여러 개 선택할 수 있습니다.</p>
      <div>
        {visibleOptions.map((tag) => {
          const isSelected = selectedTags.includes(tag);

          return (
            <button
              key={tag}
              aria-pressed={isSelected}
              className={isSelected ? "post-tag-selector__option--selected" : undefined}
              disabled={disabled}
              type="button"
              onClick={() => toggleTag(tag)}
            >
              {tag}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
