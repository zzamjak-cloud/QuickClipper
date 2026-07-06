// 수집 파이프라인 공용 타입 정의

/** 지원 카테고리 (PLAN.md 기준, 점진 확장) */
export type Category =
  | '글로벌 핫이슈'
  | 'AI'
  | '인사이트'
  | '게임'
  | '아트'
  | 'IT'
  | '증권'
  | '여행'
  | '맛집'
  | '구인';

/** 수집 소스 타입 */
export type SourceType = 'rss' | 'hackernews' | 'reddit' | 'navernews' | 'gamejobs';

export type CompanySize = '대기업' | '중소기업' | '스타트업';

/** 소스 정의 — sources.config.ts에서 선언 */
export interface SourceDef {
  id: string;
  name: string;
  type: SourceType;
  category: Category;
  /** rss: 피드 URL / reddit: 서브레딧 이름 / navernews: 검색 키워드 / hackernews: 미사용 */
  target: string;
  /** 소스당 최대 수집 개수 (기본 20) */
  limit?: number;
  /** false면 수집에서 제외 (기본 true) */
  enabled?: boolean;
  /** 요약문 언어 — 번역하기 버튼 노출 여부 판단용 */
  lang: 'ko' | 'en';
  /** 구인 소스 전용: 기업 규모 필터 */
  companySize?: CompanySize;
  /** 구인 소스 전용: 모바일/캐주얼 게임사 우선 표시 */
  mobileCasual?: boolean;
}

/** 수집 직후의 원시 항목 */
export interface RawItem {
  title: string;
  url: string;
  summary: string;
  publishedAt: Date | null;
  /** 소스 자체 지표 (HN 포인트, Reddit 업보트 등). 없으면 null */
  sourceScore: number | null;
  /** 피드에서 추출한 썸네일 (없으면 og:image 보강 단계에서 채움) */
  imageUrl?: string;
  jobCompany?: string;
  jobCompanySize?: CompanySize;
  jobRole?: string;
  jobLocation?: string;
  jobEmployment?: string;
  jobUpdatedAt?: string;
  jobMobileCasual?: boolean;
}

/** 정규화·점수화가 끝나 Firestore에 저장되는 항목 */
export interface DigestItem {
  title: string;
  url: string;
  summary: string;
  category: Category;
  sourceId: string;
  sourceName: string;
  lang: 'ko' | 'en';
  /** 0~100 정규화 중요도 (카테고리 내 정렬용) */
  score: number;
  publishedAt: Date | null;
  collectedAt: Date;
  /** 썸네일 이미지 */
  imageUrl?: string;
  /** 배치 번역 결과 (영문 항목만) */
  titleKo?: string;
  summaryKo?: string;
  /** 같은 이슈를 보도한 다른 소스들 (교차 보도 클러스터) */
  relatedSources?: { name: string; url: string }[];
  /** 클러스터 종합 요약 (2개 소스 이상 이슈) */
  clusterSummary?: string;
  jobCompany?: string;
  jobCompanySize?: CompanySize;
  jobRole?: string;
  jobLocation?: string;
  jobEmployment?: string;
  jobUpdatedAt?: string;
  jobMobileCasual?: boolean;
}

/** 오늘의 AI 브리핑 */
export interface Briefing {
  points: { title: string; body: string; category: string }[];
}
