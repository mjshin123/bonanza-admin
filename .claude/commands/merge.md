---
name: merge
description: "지정한 타겟 브랜치를 최신 상태로 갱신하고 현재 작업 브랜치에 병합한 뒤 충돌이 없고 검증이 통과하면 작업 브랜치를 push한다. 사용자가 타겟 브랜치의 최신 변경을 작업 브랜치에 merge하거나 동기화해 달라고 요청하거나 $merge를 명시적으로 호출할 때 사용한다."
---

# Merge Target Branch

타겟 브랜치의 최신 변경사항을 현재 작업 브랜치에 안전하게 병합한다. 현재 작업 브랜치를 타겟 브랜치로 병합하는 workflow가 아님을 명확히 구분한다.

## 입력

- `TARGET=<branch>` 형식으로 타겟 브랜치를 받는다.
- 타겟이 제공되지 않았거나 모호하면 추측하지 말고 main 브랜치를 머지한다.

## 1. 분석

- 저장소에 적용되는 `CLAUDE.md`를 먼저 읽고 지시를 따른다.
- 다음 항목을 읽기 전용 명령으로 확인한다.
  - 저장소 루트와 현재 작업 브랜치
  - 현재 브랜치의 upstream과 push 대상 remote
  - 로컬 및 remote-tracking 브랜치
  - staged, unstaged, untracked 파일
  - 진행 중인 merge, rebase 또는 cherry-pick 여부
- detached HEAD, 진행 중인 Git 작업 또는 미커밋 변경이 있으면 checkout이나 merge를 시작하지 않고 중단 사유를 한국어로 설명한다.
- 현재 작업 브랜치와 타겟 브랜치가 같으면 중단한다.
- 기본 remote는 현재 tracking 설정을 우선 사용하고, 확인할 수 없으면 `origin` 사용 여부를 사용자에게 확인한다.

## 2. 계획 및 승인

- 다음 내용을 사용자에게 간결하게 제시한다.
  - 현재 작업 브랜치
  - 타겟 브랜치와 remote
  - checkout, pull, merge, 검증, push 순서
  - 실행할 검증 명령
  - 충돌 발생 시 중단한다는 사실
- checkout, fetch, pull, merge 또는 push 전에 사용자의 명시적인 승인을 한 번 받는다.
- 승인 후 브랜치나 작업 트리 상태가 달라지면 중단하고 다시 분석한다.

## 3. 타겟 브랜치 최신화

- 승인 후 현재 작업 브랜치 이름을 다시 확인해 기록한다.
- remote의 타겟 브랜치를 fetch한다.
- 로컬 타겟 브랜치가 있으면 해당 브랜치로 checkout한다.
- 로컬 타겟 브랜치가 없고 remote-tracking 브랜치가 있으면 이를 추적하는 로컬 브랜치를 만든다.
- 타겟 브랜치에서 지정한 remote를 기준으로 `git pull --ff-only`를 실행한다.
- fast-forward가 불가능하거나 pull이 실패하면 병합을 진행하지 않는다. 안전하게 가능하면 원래 작업 브랜치로 돌아간 뒤 오류를 설명한다.

## 4. 작업 브랜치에 병합

- 원래 작업 브랜치로 checkout하고 브랜치가 정확한지 다시 확인한다.
- 최신화한 로컬 타겟 브랜치를 `git merge --no-edit <target>`으로 병합한다.
- 충돌이 발생하면 다음을 수행한다.
  - 충돌 파일 목록과 현재 브랜치 상태를 확인한다.
  - 충돌을 임의로 해결하거나 merge를 abort하지 않는다.
  - push하지 않는다.
  - 사용자에게 충돌 파일과 선택 가능한 다음 작업을 한국어로 설명한다.
- stash, reset, rebase, branch 삭제 또는 force push를 자동으로 수행하지 않는다.

## 5. 검증 및 push

- 충돌 없이 병합됐으면 프로젝트 지시에 따른 검증을 실행한다. 이 저장소에서는 기본적으로 다음을 실행한다.

```powershell
npm run lint
npm run build
```

- 검증이 실패하면 작업 브랜치를 push하지 않고 실패 원인과 현재 로컬 merge 상태를 알린다.
- 검증이 통과하면 현재 작업 브랜치를 기존 upstream에 push한다. upstream이 없으면 계획에서 승인받은 remote에 `-u` 옵션으로 연결해 push한다.
- push가 실패하면 force push나 이력 재작성으로 우회하지 않는다.

## 6. 완료 보고

- 다음 정보를 한국어로 보고한다.
  - 최신화한 타겟 브랜치
  - 병합된 작업 브랜치
  - merge 결과와 commit hash
  - 검증 결과
  - push한 remote와 브랜치
- 충돌이나 실패가 있었다면 원격 push가 수행되지 않았음을 명확히 표시하고, 사용자가 다음에 해야 할 일을 쉽게 설명한다.
