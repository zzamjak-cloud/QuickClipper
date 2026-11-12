// 수집 파이프라인 공용 타입 정의

/** 수집 소스 타입 */
export type SourceType = 'rss' | 'hackernews';

/** 소스 등급 — 점수 가감·후보 상한·신선도 윈도를 정한다 (index.ts / score.ts) */
export type SourceTier = 'official' | 'media' | 'community';

/** 소스 정의 — sources.config.ts에서 선언 */
export interface SourceDef {
  id: string;
  name: string;
  type: SourceType;
  tier: SourceTier;
  /** rss: 피드 URL / hackernews: 미사용 */
  target: string;
  /** 소스당 최대 수집 개수 (기본: rss 30, hackernews 20) */
  limit?: number;
  /** false면 수집에서 제외 (기본 true) */
  enabled?: boolean;
  /** 제목+요약에 하나 이상 포함되어야 하는 키워드 */
  includeKeywords?: string[];
  /** 제목+요약에 포함되면 제외할 키워드 */
  excludeKeywords?: string[];
  lang: 'ko' | 'en';
}

/** 수집 직후의 원시 항목 */
export interface RawItem {
  title: string;
  url: string;
  summary: string;
  publishedAt: Date | null;
  /** 소스 자체 지표 (HN 포인트, GeekNews 추천수 등). 없으면 null */
  sourceScore: number | null;
  /** 피드에서 추출한 썸네일 (없으면 og:image 보강 단계에서 채움) */
  imageUrl?: string;
}

/** 정규화·점수화가 끝난 항목 */
export interface DigestItem {
  title: string;
  url: string;
  summary: string;
  sourceId: string;
  sourceName: string;
  sourceTier: SourceTier;
  lang: 'ko' | 'en';
  /** 0~100 정규화 중요도 (등급 가감 반영) */
  score: number;
  publishedAt: Date | null;
  collectedAt: Date;
  imageUrl?: string;
  /** 같은 이슈를 보도한 다른 소스들 (교차 보도 클러스터) */
  relatedSources?: { name: string; url: string }[];
}

/** out/candidates.json — Claude 요약 단계의 입력 */
export interface Candidate {
  /** 리포트에서 항목을 가리키는 키 (c1, c2, …) */
  id: string;
  title: string;
  url: string;
  summary: string;
  sourceId: string;
  sourceName: string;
  lang: 'ko' | 'en';
  score: number;
  /** ISO 문자열 (JSON 직렬화) */
  publishedAt: string | null;
  imageUrl?: string;
  relatedSources?: { name: string; url: string }[];
}

export interface CandidatesFile {
  date: string;
  collectedAt: string;
  candidates: Candidate[];
}

/** out/report.json — Claude가 생성하는 한국어 리포트 문서 (id는 모두 후보 id) */
export interface Report {
  headline: string;
  /** 리드 문단 (3~4문장) */
  lede: string;
  sections: ReportSection[];
  /** 섹션에 쓰지 않은 후보 중 한 줄로 소개할 짧은 소식 */
  briefs: { id: string; oneLine: string }[];
}

export interface ReportSection {
  title: string;
  /** 본문 문단 (2~4개) — 이 섹션 bookmarks 후보만 근거로 작성 */
  body: string[];
  /** 대표 이미지로 쓸 후보 id (이미지가 있는 이 섹션 북마크 중 하나) */
  heroId: string | null;
  /** 원문으로 이어지는 북마크 카드 */
  bookmarks: { id: string; reason: string }[];
}
