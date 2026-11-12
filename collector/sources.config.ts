import type { SourceDef } from './src/types.js';

// 범용 소스(HN·GeekNews)에서 AI 관련 글만 남기는 키워드.
// 짧은 영문 키워드는 filters.ts에서 단어 경계로 매칭해 "said" 같은 오탐을 막는다.
const AI_KEYWORDS = [
  'ai',
  'agi',
  'llm',
  'llms',
  'gpt',
  'chatgpt',
  'openai',
  'anthropic',
  'claude',
  'gemini',
  'deepmind',
  'llama',
  'mistral',
  'deepseek',
  'qwen',
  'copilot',
  'hugging face',
  'huggingface',
  'machine learning',
  'deep learning',
  'neural',
  'transformer',
  'diffusion',
  'inference',
  'fine-tuning',
  'agentic',
  'ai agent',
  'rag',
  'mcp',
  '인공지능',
  '생성형',
  '머신러닝',
  '딥러닝',
  '에이전트',
  '언어모델',
  '언어 모델',
];

// 수집 대상 소스 선언 — 소스를 추가/제거하려면 이 파일만 수정하면 된다.
// 공식 블로그는 실제 피드 응답을 확인한 것만 둔다 (Anthropic은 공식 RSS 없음).
export const SOURCES: SourceDef[] = [
  // ── AI 전문 매체 ─────────────────────────────────────
  {
    id: 'techcrunch-ai',
    name: 'TechCrunch AI',
    type: 'rss',
    tier: 'media',
    target: 'https://techcrunch.com/category/artificial-intelligence/feed/',
    lang: 'en',
  },
  {
    id: 'verge-ai',
    name: 'The Verge AI',
    type: 'rss',
    tier: 'media',
    target: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml',
    lang: 'en',
  },

  // ── 공식 블로그 ─────────────────────────────────────
  {
    id: 'openai-news',
    name: 'OpenAI',
    type: 'rss',
    tier: 'official',
    target: 'https://openai.com/news/rss.xml',
    limit: 10,
    lang: 'en',
  },
  {
    id: 'google-deepmind',
    name: 'Google DeepMind',
    type: 'rss',
    tier: 'official',
    target: 'https://deepmind.google/blog/rss.xml',
    limit: 10,
    lang: 'en',
  },
  {
    id: 'google-ai',
    name: 'Google AI',
    type: 'rss',
    tier: 'official',
    target: 'https://blog.google/technology/ai/rss/',
    limit: 10,
    lang: 'en',
  },
  {
    id: 'huggingface',
    name: 'Hugging Face',
    type: 'rss',
    tier: 'official',
    target: 'https://huggingface.co/blog/feed.xml',
    limit: 10,
    lang: 'en',
  },

  // ── 커뮤니티 (AI 키워드 필터) ─────────────────────────
  {
    id: 'hackernews',
    name: 'Hacker News',
    type: 'hackernews',
    tier: 'community',
    target: '',
    limit: 15,
    includeKeywords: AI_KEYWORDS,
    lang: 'en',
  },
  {
    id: 'geeknews',
    name: 'GeekNews',
    type: 'rss',
    tier: 'community',
    target: 'https://feeds.feedburner.com/geeknews-feed',
    includeKeywords: AI_KEYWORDS,
    lang: 'ko',
  },
];
