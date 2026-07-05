import type { SourceDef } from './src/types.js';

// 수집 대상 소스 선언 — 소스를 추가/제거하려면 이 파일만 수정하면 된다.
// Google Alerts는 https://www.google.com/alerts 에서 키워드 등록 후
// "RSS 피드로 전송"을 선택하고 생성된 피드 URL을 rss 타입으로 추가한다.
export const SOURCES: SourceDef[] = [
  // ── IT ──────────────────────────────────────────────
  {
    id: 'geeknews',
    name: 'GeekNews',
    type: 'rss',
    category: 'IT',
    target: 'https://feeds.feedburner.com/geeknews-feed',
    lang: 'ko',
  },
  {
    id: 'hackernews',
    name: 'Hacker News',
    type: 'hackernews',
    category: 'IT',
    target: '',
    limit: 20,
    lang: 'en',
  },

  // ── AI ──────────────────────────────────────────────
  {
    id: 'techcrunch-ai',
    name: 'TechCrunch AI',
    type: 'rss',
    category: 'AI',
    target: 'https://techcrunch.com/category/artificial-intelligence/feed/',
    lang: 'en',
  },
  {
    id: 'verge-ai',
    name: 'The Verge AI',
    type: 'rss',
    category: 'AI',
    target: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml',
    lang: 'en',
  },
  {
    id: 'reddit-localllama',
    name: 'r/LocalLLaMA',
    type: 'reddit',
    category: 'AI',
    target: 'LocalLLaMA',
    lang: 'en',
  },

  // ── 글로벌 핫이슈 ────────────────────────────────────
  {
    id: 'bbc-world',
    name: 'BBC World',
    type: 'rss',
    category: '글로벌 핫이슈',
    target: 'https://feeds.bbci.co.uk/news/world/rss.xml',
    lang: 'en',
  },
  {
    id: 'reddit-worldnews',
    name: 'r/worldnews',
    type: 'reddit',
    category: '글로벌 핫이슈',
    target: 'worldnews',
    lang: 'en',
  },

  // ── 게임 ────────────────────────────────────────────
  {
    id: 'gamespot-news',
    name: 'GameSpot',
    type: 'rss',
    category: '게임',
    target: 'https://www.gamespot.com/feeds/game-news/',
    lang: 'en',
  },
  {
    id: 'gamedeveloper',
    name: 'Game Developer',
    type: 'rss',
    category: '게임',
    target: 'https://www.gamedeveloper.com/rss.xml',
    lang: 'en',
  },
  {
    id: 'reddit-games',
    name: 'r/Games',
    type: 'reddit',
    category: '게임',
    target: 'Games',
    lang: 'en',
  },

  // ── 인사이트 ────────────────────────────────────────
  {
    id: 'medium-product',
    name: 'Medium #product-management',
    type: 'rss',
    category: '인사이트',
    target: 'https://medium.com/feed/tag/product-management',
    lang: 'en',
  },

  // ── 아트 ────────────────────────────────────────────
  {
    id: 'colossal',
    name: 'Colossal',
    type: 'rss',
    category: '아트',
    target: 'https://www.thisiscolossal.com/feed/',
    lang: 'en',
  },
  {
    id: 'reddit-digitalart',
    name: 'r/DigitalArt',
    type: 'reddit',
    category: '아트',
    target: 'DigitalArt',
    lang: 'en',
  },

  // 증권/여행/맛집: Phase 3에서 네이버 API 소스로 추가 예정
];
