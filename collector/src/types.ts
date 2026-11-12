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

/** out/report.json — Claude가 생성하는 한국어 리포트 */
export interface Report {
  briefing: {
    headline: string;
    summary: string;
    keyPoints: string[];
  };
  items: {
    id: string;
    titleKo: string;
    summaryKo: string;
    whyItMatters: string;
    tags: string[];
    /** 같은 사건을 다룬 다른 후보 id — 이 항목 하나로 합쳐진다 */
    relatedIds: string[];
  }[];
}
