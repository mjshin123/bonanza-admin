# KFCPA Admin

KFCPA 관리자 SPA와 Supabase migration을 관리하는 독립 저장소입니다.

## 로컬 실행

1. `.env.example`을 `.env.local`로 복사하고 Supabase URL과 publishable key를 설정합니다.
2. `npm install`
3. `npm run dev`

관리자 화면은 `/`에서 실행됩니다. 공개 회원가입은 비활성화되어 있으며, 승인된 Supabase Auth 계정만 로그인할 수 있습니다.

## 검증

```bash
npm run lint
npm run build
```

DB migration은 이 저장소의 `supabase/migrations`에서만 관리합니다.
# kfcpa-admin
