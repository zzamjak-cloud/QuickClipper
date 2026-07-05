import type { RawItem, SourceDef } from '../types.js';

// Reddit은 익명 API 접근을 차단하므로 OAuth(client_credentials) 필수.
// https://www.reddit.com/prefs/apps 에서 "script" 앱 등록 후
// REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET 환경변수로 주입한다.

const UA = 'QuickClipper/1.0 (personal news digest)';

interface RedditPost {
  data: {
    title: string;
    permalink: string;
    url: string;
    selftext?: string;
    ups: number;
    created_utc: number;
    stickied: boolean;
  };
}

/** Reddit OAuth 자격증명이 설정되어 있는지 */
export function hasRedditCredentials(): boolean {
  return !!(process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET);
}

// 액세스 토큰은 1시간 유효 — 한 번 발급받아 재사용
let cachedToken: string | null = null;

async function getToken(): Promise<string> {
  if (cachedToken) return cachedToken;

  const basic = Buffer.from(
    `${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`,
  ).toString('base64');

  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': UA,
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error(`Reddit 토큰 발급 실패 HTTP ${res.status}`);

  const json = await res.json();
  cachedToken = json.access_token;
  if (!cachedToken) throw new Error('Reddit 토큰 응답에 access_token 없음');
  return cachedToken;
}

/** 서브레딧 일간 Top 게시물 수집 (OAuth API) */
export async function fetchReddit(source: SourceDef): Promise<RawItem[]> {
  const token = await getToken();
  const limit = source.limit ?? 15;
  const url = `https://oauth.reddit.com/r/${source.target}/top?t=day&limit=${limit}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, 'User-Agent': UA },
  });
  if (!res.ok) throw new Error(`Reddit r/${source.target} HTTP ${res.status}`);
  const json = await res.json();

  return (json.data?.children ?? [])
    .filter((post: RedditPost) => !post.data.stickied)
    .map((post: RedditPost) => ({
      title: post.data.title.trim(),
      // 토론 중심이므로 레딧 스레드로 연결
      url: `https://www.reddit.com${post.data.permalink}`,
      summary: post.data.selftext?.slice(0, 500) ?? '',
      publishedAt: new Date(post.data.created_utc * 1000),
      sourceScore: post.data.ups,
    }));
}
