# Bonanza Factory 디자인 시스템

이 프로젝트의 색상 기준은 Bonanza Blue와 Neutral Grey입니다. 폰트, 글자 크기, 간격, 모서리와 레이아웃은 기존 관리 화면 체계를 유지합니다.

- Primary: `--blue-500` (`#1640db`)
- Hover/Active: `--blue-600` / `--blue-700`
- Surface/Text: `--grey-0`부터 `--grey-950`
- 의미 토큰: `--primary`, `--background`, `--surface-*`, `--text-*`, `--border`, `--success`, `--warning`, `--danger`
- 다크 테마: `.dark` 클래스에서 같은 의미 토큰을 재정의합니다.

구현 토큰은 `src/shared/config/tokens/colors.css`를 단일 소스로 사용합니다.
