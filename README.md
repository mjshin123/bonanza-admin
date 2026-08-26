# KFCPA Admin

KFCPA 관리자 SPA와 Supabase migration을 관리하는 독립 저장소입니다.

## 로컬 실행

1. `.env.example`을 `.env.local`로 복사하고 Supabase URL과 publishable key를 설정합니다.
2. `npm install`
3. `npm run dev`

관리자 화면은 `/`에서 실행됩니다. 공개 회원가입은 비활성화되어 있으며, 승인된 Supabase Auth 계정만 로그인할 수 있습니다.

## 방문 통계 대시보드

관리자 기본 랜딩은 Cloudflare Web Analytics 집계를 조회하는 대시보드입니다. 브라우저에는 Cloudflare API Token을 전달하지 않으며, 인증된 관리자만 `admin-web-analytics` Supabase Edge Function을 통해 집계를 조회합니다.

Edge Function 배포 전에 다음 secret을 설정합니다.

```bash
supabase secrets set CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_TAG=... CLOUDFLARE_SITE_TAG=...
supabase functions deploy admin-web-analytics
```

- `CLOUDFLARE_API_TOKEN`: Account Analytics Read 권한만 가진 API Token
- `CLOUDFLARE_ACCOUNT_TAG`: Web Analytics 사이트를 소유한 Cloudflare Account ID
- `CLOUDFLARE_SITE_TAG`: 공개 홈페이지의 Web Analytics Site Token
- 조회 결과는 관리자 브라우저에서 10분간 캐시하며 DB나 Redis에 적재하지 않습니다.

## 검증

```bash
npm run lint
npm run test
npm run build
```

DB migration은 이 저장소의 `supabase/migrations`에서만 관리합니다.

## API 문서

- [빠른 API 가이드](./API_GUIDE.md): 인증, 조회·저장 RPC, 파일 처리, 오류 코드
- [상세 API 명세](./kfcpa-api-명세.md)
- [DB 명세](./KFCPA_DB_명세서_v1.md)

# kfcpa-admin
