# QuickClipper 구현 계획 (v1.0.0)

> 기반 문서: `1.0.0.md` — 매일 아침 7시, 카테고리별 정보를 자동 수집·요약해서 PC/모바일로 받아보고, 원하는 정보는 개인 자산으로 보관하는 서비스.

---

## 1. 핵심 아키텍처 결정 (중요)

### 1-1. 수집은 클라우드에서, 열람은 어디서나

원문의 "Tauri 로컬앱에서 수집" 방향에는 구조적 문제가 있음:
**아침 7시 수집이 돌려면 그 시간에 PC가 켜져 있어야 하고, 출근길 모바일에서는 로컬앱 데이터에 접근할 수 없음.**

따라서 다음 구조를 추천:

```
[GitHub Actions cron (매일 06:30 KST)]
        │  RSS/API 수집 → 규칙 기반 분류/중복제거/정렬 (AI 미사용)
        ▼
[Firestore]  ← 일일 다이제스트 + 사용자 스크랩 보관
        ▼
[React PWA (Firebase Hosting)] ←── PC 브라우저 + 모바일 출근길 열람
```

- **수집기(Collector)**: Node/TypeScript 스크립트. GitHub Actions cron으로 실행 → 서버 비용 0원.
  - Actions cron은 최대 수십 분 지연될 수 있으므로 06:30 KST(21:30 UTC)에 걸어 7시 전 완료 보장.
  - 대안: Firebase Cloud Functions scheduled (Blaze 요금제 필요) — 지연이 문제되면 이후 전환.
- **저장소**: Firestore (TeamScheduler 경험 재사용). 오프라인 캐시(persistentLocalCache)로 지하철 등 오프라인 열람 대응.
- **클라이언트**: React 단일 코드베이스의 웹앱/PWA — PC는 브라우저, 모바일은 홈화면 설치(PWA)로 대응.

### 1-2. 정보 소스 현실성 평가

| 소스 | 방식 | 난이도 | 시점 |
|---|---|---|---|
| GeekNews | RSS (`feeds.feedburner.com/geeknews-feed`) | 쉬움 | Phase 1 |
| Hacker News | 공식 API (top stories) | 쉬움 | Phase 1 |
| Reddit | 서브레딧 `.json` / RSS (top of day) | 쉬움 | Phase 1 |
| Google Alerts | 키워드별 RSS 피드 | 쉬움 (수동 등록 1회) | Phase 1 |
| Substack / Medium / 브런치 / Velog | RSS | 쉬움 | Phase 1~2 |
| 네이버 뉴스 | 네이버 검색 Open API (무료 쿼터) | 보통 | Phase 2 |
| 네이버 데이터랩 | 공식 API | 보통 | Phase 3 |
| Google Trends | 공식 API 없음 (비공식 라이브러리/SerpAPI) | 보통~어려움 | Phase 3 |
| **X (트위터)** | API 유료 ($100+/월), 스크래핑은 차단·약관 위반 | **어려움** | 보류 |
| **LinkedIn** | 피드 API 미제공, 스크래핑 약관 위반 | **어려움** | 보류 |

→ **v1.0은 RSS/공식 API 소스만으로 시작.** X/LinkedIn은 "핵심 계정들이 어차피 뉴스로 재생산되는" 특성상 GeekNews/HN/Reddit으로 상당 부분 커버됨. 필요해지면 유료 API 도입을 별도 판단.

### 1-3. 처리 파이프라인 — AI 없이 규칙 기반 (토큰 비용 0원)

매일 배치는 AI 호출 없이 순수 알고리즘으로 처리:

- **카테고리 분류**: 소스 자체가 카테고리를 결정 (`sources.config.ts`에서 소스↔카테고리 매핑). GeekNews→IT, r/gamedev→게임, Google Alerts "LLM"→AI 식으로 수집 시점에 이미 확정됨.
- **요약**: RSS 피드에 포함된 `description`/`summary` 필드를 그대로 사용 (대부분의 피드가 제공). 없으면 본문 첫 문단 추출(텍스트 파싱).
- **중요도 정렬**: 소스 자체 지표 활용 — HN 포인트, Reddit 업보트, 발행 시각. 지표가 없는 RSS는 최신순.
- **중복제거**: URL 정규화(쿼리스트링 제거 등) + 제목 유사도(단어 집합 비교) 알고리즘.

**AI는 온디맨드 "번역하기" 버튼으로만 사용** (배치 비용 0원 유지):
- 해외 소스(HN, Reddit, Medium 등) 카드에 **번역하기 버튼** 표시 → 클릭 시에만 Claude API(Haiku)로 제목+요약문을 한국어 번역. 실제로 읽는 글에만 소액 과금.
- 번역 결과는 해당 다이제스트 항목에 **캐시 저장**(Firestore) — 같은 항목을 다시 열거나 다른 기기에서 봐도 재과금 없음.
- API 키를 클라이언트에 노출할 수 없으므로 번역 호출은 **Firebase Functions(호출형 함수) 경유** — Blaze 요금제 필요하지만 이 사용량이면 사실상 무료 구간.
- 같은 구조로 추후 "AI 3줄 요약" 버튼도 쉽게 추가 가능.

---

## 2. 기술 스택 (레퍼런스 프로젝트 준거)

| 영역 | 선택 | 근거 |
|---|---|---|
| 프론트엔드 | React 19 + TypeScript + Vite 7 | TeamScheduler/QuickFolder 공통 |
| 스타일 | Tailwind CSS v4 (`@tailwindcss/vite`) | QuickFolder 방식 |
| 상태관리 | Zustand (slice 패턴) | TeamScheduler 방식 |
| 백엔드 | Firebase (Firestore + Auth + Hosting) | TeamScheduler 경험 재사용 |
| 인증 | Firebase Google Auth (`signInWithPopup`) | TeamScheduler 방식 그대로 |
| 수집기 | Node 20 + TypeScript (`rss-parser` 등) | Actions에서 실행 |
| 스케줄러 | GitHub Actions cron | 무료, QuickFolder CI 경험 재사용 |
| AI 번역 | Claude API (claude-haiku-4-5) + Firebase Functions | "번역하기" 버튼 클릭 시에만 호출, 결과 캐시 |
| 모바일 | PWA (manifest + service worker) | 별도 앱 개발 없이 홈화면 설치 |

### 저장 구조 (Firestore)

```
digests/{date}/items/{itemId}     # 일일 수집 결과 (공용, 수집기가 기록)
  - title, url, source, category, summary, score, publishedAt
users/{uid}/clips/{clipId}        # 사용자가 보관한 스크랩 (개인 자산)
  - itemRef 스냅샷 + tags, memo, clippedAt
users/{uid}/settings              # 카테고리/소스/키워드 구독 설정
sources/{sourceId}                # 수집 대상 소스 정의 (URL, 타입, 카테고리)
```

- 스크랩은 원본 링크가 죽어도 남도록 **스냅샷 복사** 방식으로 저장.
- 오래된 다이제스트는 30일 후 자동 정리(수집기에서 처리), 스크랩은 영구 보관.

### 디렉토리 구조

```
QuickClipper/
├── 1.0.0.md, PLAN.md
├── collector/            # 수집·요약 파이프라인 (Node/TS, Actions에서 실행)
│   ├── src/sources/      # 소스별 fetcher (rss, hackernews, reddit, naver ...)
│   ├── src/pipeline/     # 정규화 → 중복제거 → AI 요약 → Firestore 저장
│   └── sources.config.ts # 카테고리·소스 선언 (여기만 고치면 소스 추가)
├── web/                  # React 웹앱 (PWA)
│   └── src/ (components, store, lib/firebase, pages)
└── .github/workflows/
    ├── collect.yml       # cron 06:30 KST 수집
    └── deploy.yml        # web 변경 시 Firebase Hosting 배포
```

---

## 3. 단계별 로드맵

### Phase 0 — 프로젝트 세팅 (0.5일)
- [x] GitHub 레포 생성 (`zzamjak-cloud/QuickClipper`)
- [ ] Firebase 프로젝트 생성 (Firestore + Auth + Hosting), 보안 규칙 초안
- [ ] 모노레포 스캐폴딩 (`collector/`, `web/`)

### Phase 1 — 수집 파이프라인 MVP (2~3일)
- [ ] RSS 수집기: GeekNews, HN, Reddit(카테고리별 서브레딧), Google Alerts
- [ ] 정규화 → URL/제목 기준 중복제거 → 소스 기반 분류·지표 기반 정렬 → Firestore 저장
- [ ] `collect.yml` cron 가동 + 실패 시 알림(Actions 실패 메일)
- **완료 기준: 매일 아침 Firestore에 카테고리별 다이제스트가 자동으로 쌓임**

### Phase 2 — 열람 웹앱/PWA (3~5일)
- [ ] Google 로그인, 오늘의 다이제스트 뷰 (카테고리 탭: 글로벌 핫이슈/AI/인사이트/게임/아트/IT/증권/여행/맛집)
- [ ] 카드형 UI: 피드 요약문 + 원문 링크 + 중요도 정렬
- [ ] 해외 소스 카드에 **번역하기 버튼** — Firebase Functions 경유 Claude 번역 + Firestore 캐시
- [ ] 스크랩(보관) 버튼 → `users/{uid}/clips` 저장
- [ ] PWA 설정 (manifest, 홈화면 설치, 오프라인 캐시)
- [ ] Firebase Hosting 자동 배포
- **완료 기준: 출근길 폰에서 오늘 다이제스트를 보고 스크랩 가능**

### Phase 3 — 개인화 & 정보 자산화 (1주)
- [ ] 소스/키워드 구독 관리 UI (sources 컬렉션 편집)
- [ ] 스크랩 보관함: 태그, 메모, 검색, 날짜별 아카이브
- [ ] 네이버 뉴스 API, 데이터랩, Google Trends 소스 추가
- [ ] 과거 다이제스트 브라우징 (달력 뷰)
- [ ] (선택) AI 3줄 요약 버튼 — 번역과 동일한 온디맨드 구조 재사용

---

## 4. 원문 대비 변경·추천 사항 요약

1. **수집 주체를 로컬앱 → 클라우드(Actions cron)로 변경** — PC가 꺼져 있어도 7시 수집 보장, 모바일 열람 가능.
2. **X/LinkedIn은 v1.0에서 제외** — 유료 API/약관 문제. RSS 기반 소스로 시작하고 커버리지 부족 시 재검토.
3. **Tauri 데스크탑/모바일 앱 제외, 웹앱 + PWA로 통일** — 데이터가 클라우드에 있으므로 PC는 브라우저, 모바일은 PWA 홈화면 설치로 충분. 단일 코드베이스로 개발·유지보수 비용 최소화.
4. **스크랩은 스냅샷 저장** — 링크가 죽어도 "내 정보 자산"이 남도록.
5. **일일 배치에 AI 미사용 (토큰 비용 0원)** — 분류는 소스 매핑, 요약은 피드 제공 요약문, 정렬은 소스 지표로 해결. AI는 해외 소스 카드의 **"번역하기" 버튼** 클릭 시에만 호출하고 결과를 캐시해 재과금을 막음.
