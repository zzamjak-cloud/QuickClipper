import type { RawItem, SourceDef } from '../types.js';

const ART_ROLE_RE =
  /(아트\s*디렉터|아트\s*PM|art\s*director|art\s*pm|UI\s*(?:\/?\s*UX|디자이너|디자인)|UX\s*(?:디자이너|디자인)|2D\s*(?:\/\s*3D)?\s*(?:아티스트|디자이너|디자인|그래픽|애니메이터)|3D\s*(?:아티스트|디자이너|디자인|그래픽|이펙터|모델러|모델링|애니메이터)|게임\s*아티스트|(?:원화|컨셉|일러스트|그래픽|이펙터|애니메이터|캐릭터|배경|모델러|모델링|테크니컬\s*아티스트|technical\s*artist|TA))/i;

const ART_CONTEXT_RE =
  /(아트|art|디자인|디자이너|UI|UX|2D|3D|원화|컨셉|일러스트|그래픽|이펙터|애니메이터|캐릭터|배경|모델러|모델링|technical\s*artist|TA)/i;

const NON_ART_RE =
  /(프로그래머|개발자|엔지니어|서버|클라이언트|QA|테스터|마케팅|사업|운영|영업|재무|회계|인사|법무|데이터|AI|ML|보안|번역|로컬라이제이션|사운드|기획자|PO|프로듀서)/i;

const JOB_TITLE_RE =
  /(?:\[[^\]]+\]\s*)?(?:게임\s*)?(?:아트\s*디렉터|아트\s*PM|art\s*director|art\s*pm|UI\s*(?:\/?\s*UX|디자이너|디자인)\s*(?:디자이너|디자인)?|UX\s*(?:디자이너|디자인)|2D\s*(?:\/\s*3D)?\s*(?:아티스트|디자이너|디자인|그래픽|애니메이터)|3D\s*(?:아티스트|디자이너|디자인|그래픽|이펙터|모델러|모델링|애니메이터)|원화가?|컨셉\s*아티스트|캐릭터\s*(?:아티스트|디자이너|원화|모델러|모델링)|배경\s*(?:아티스트|디자이너|원화|모델러|모델링)|이펙터|애니메이터|일러스트레이터|그래픽\s*디자이너|테크니컬\s*아티스트|technical\s*artist|TA)(?:[\w가-힣\s()[\]\/&+.,:-]{0,55})?/gi;

function decodeEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function cleanHtml(html: string): string {
  return decodeEntities(
    html
      .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanJobTitle(value: string): string {
  const title = value
    .replace(/\s+(?:게임\s+아트|디자인)\s+경력.*$/i, '')
    .replace(/\s+(?:신입|경력|경력무관|정규직|계약직|인턴|아르바이트|프리랜서)\b.*$/i, '')
    .replace(/\s+(?:지원하기|상세보기|바로가기).*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return title.slice(0, 120).trim();
}

function sourceCompany(source: SourceDef): string {
  return source.name.replace(/\s*(채용|Careers?)$/i, '').trim();
}

function absoluteUrl(href: string, base: string): string | null {
  if (/^(?:javascript:|mailto:|tel:|#)/i.test(href)) return null;
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

function isArtJob(text: string): boolean {
  if (!ART_ROLE_RE.test(text)) return false;
  if (/PM|프로젝트\s*매니저/i.test(text) && !/(아트|art|UI|UX|디자인|creative|크리에이티브)/i.test(text)) {
    return false;
  }
  return !NON_ART_RE.test(text) || ART_CONTEXT_RE.test(text);
}

function inferRole(text: string): string | undefined {
  if (/아트\s*디렉터|art\s*director/i.test(text)) return '아트디렉터';
  if (/아트\s*PM|art\s*pm/i.test(text)) return '아트PM';
  if (/UI\s*(?:\/?\s*UX|디자이너|디자인)|UX\s*(?:디자이너|디자인)/i.test(text)) return 'UI/UX';
  if (/2D/i.test(text)) return '2D 아티스트';
  if (/원화|컨셉/i.test(text)) return '원화/컨셉';
  if (/이펙터/i.test(text)) return '이펙터';
  if (/애니메이터/i.test(text)) return '애니메이터';
  if (/테크니컬\s*아티스트|technical\s*artist|TA/i.test(text)) return '테크니컬 아티스트';
  if (/3D/i.test(text)) return '3D 아티스트';
  return '게임 아트';
}

function inferEmployment(text: string): string | undefined {
  return text.match(/전환형\s*인턴|정규직|계약직|인턴|아르바이트|프리랜서|Regular|Contractor|Internship|Part\s*Time/i)?.[0];
}

function inferLocation(text: string): string | undefined {
  return text.match(/서울|성수|강남|판교|분당|성남|과천|부산|제주|Remote|Seoul|Pangyo|Bundang/i)?.[0];
}

function inferUpdatedAt(text: string): string | undefined {
  const match = text.match(/\b(20\d{2})[./-](\d{1,2})[./-](\d{1,2})\b/);
  if (!match) return undefined;
  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function toDate(date: string | undefined): Date | null {
  if (!date) return null;
  const parsed = new Date(`${date}T00:00:00+09:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeDate(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  return inferUpdatedAt(value);
}

function contextAround(html: string, index: number): string {
  return cleanHtml(html.slice(Math.max(0, index - 350), index + 700));
}

function extractTitles(text: string): string[] {
  const titles = new Set<string>();
  for (const match of text.matchAll(JOB_TITLE_RE)) {
      const title = cleanJobTitle(match[0]);
      if (title.length >= 4 && isArtJob(title)) titles.add(title);
  }
  return [...titles];
}

async function fetchHtml(url: string): Promise<string> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
        },
      });
      if (res.status === 403) {
        console.warn(`[gamejobs] ${url} 접근 차단(403) — 해당 소스는 건너뜀`);
        return '';
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      lastError = err;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 750));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError;
}

async function fetchNetmarbleJobs(source: SourceDef): Promise<RawItem[]> {
  const apiUrl = new URL('/api/v1/apply/announces', source.target);
  apiUrl.searchParams.set('page', '1');
  apiUrl.searchParams.set('size', String(source.limit ?? 1000));

  const res = await fetch(apiUrl, {
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'ko-KR,ko;q=0.9',
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = (await res.json()) as { content?: Record<string, unknown>[] };
  const companyFallback = sourceCompany(source);
  const limit = source.limit ?? 50;

  return (data.content ?? [])
    .map((job) => {
      const title = cleanJobTitle(String(job.annoSubject ?? ''));
      const company = String(job.companyNm ?? companyFallback);
      const context = [
        title,
        company,
        job.carJobGroupNm,
        job.carWorkGroupNm,
        job.entTypeNm,
        job.reqTypeNm,
        ...(Array.isArray(job.hashtag)
          ? job.hashtag.map((tag) =>
              tag && typeof tag === 'object' && 'hashtag' in tag
                ? (tag as { hashtag?: unknown }).hashtag
                : '',
            )
          : []),
      ]
        .filter(Boolean)
        .join(' ');
      const updatedAt = normalizeDate(job.staDate) ?? normalizeDate(job.modDate);
      const id = String(job.carAnnoId ?? encodeURIComponent(title));
      return {
        title,
        url: new URL(`/announce/view?anno_id=${id}`, source.target).toString(),
        summary: [
          `회사: ${company}`,
          source.companySize ? `규모: ${source.companySize}` : null,
          source.mobileCasual ? '모바일/캐주얼 중심' : null,
          job.entTypeNm ? `고용형태: ${job.entTypeNm}` : null,
          updatedAt ? `기준일: ${updatedAt}` : null,
        ]
          .filter(Boolean)
          .join(' · '),
        publishedAt: toDate(updatedAt) ?? new Date(),
        sourceScore: null,
        jobCompany: company,
        jobCompanySize: source.companySize,
        jobRole: inferRole(context),
        jobEmployment: typeof job.entTypeNm === 'string' ? job.entTypeNm : undefined,
        jobUpdatedAt: updatedAt,
        jobMobileCasual: source.mobileCasual,
        _context: context,
      };
    })
    .filter((item) => item.title.length >= 4 && isArtJob(item._context))
    .sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0))
    .slice(0, limit)
    .map(({ _context, ...item }) => item);
}

/** 국내 게임사 공식 채용 페이지에서 아트 직군 공고를 추출한다. */
export async function fetchGameJobs(source: SourceDef): Promise<RawItem[]> {
  if (new URL(source.target).hostname === 'career.netmarble.com') {
    return fetchNetmarbleJobs(source);
  }

  const html = await fetchHtml(source.target);
  if (!html) return [];
  const company = sourceCompany(source);
  const limit = source.limit ?? 50;
  const items = new Map<string, RawItem>();

  const anchorRe = /<a\b[^>]*href=["']?([^"'\s>]+)[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(anchorRe)) {
    const href = absoluteUrl(match[1], source.target);
    if (!href) continue;
    const label = cleanHtml(match[2]);
    const context = contextAround(html, match.index ?? 0);
    const titles = label.length > 140 ? extractTitles(label) : [cleanJobTitle(label)];
    for (const title of titles) {
      const text = `${title} ${context}`;
      if (title.length < 4 || !isArtJob(title)) continue;
      const updatedAt = inferUpdatedAt(text);
      items.set(`${href}#${title}`, {
        title,
        url: href,
        summary: [
          `회사: ${company}`,
          source.companySize ? `규모: ${source.companySize}` : null,
          source.mobileCasual ? '모바일/캐주얼 중심' : null,
          inferEmployment(text) ? `고용형태: ${inferEmployment(text)}` : null,
          inferLocation(text) ? `근무지: ${inferLocation(text)}` : null,
          updatedAt ? `기준일: ${updatedAt}` : null,
        ]
          .filter(Boolean)
          .join(' · '),
        publishedAt: toDate(updatedAt) ?? new Date(),
        sourceScore: null,
        jobCompany: company,
        jobCompanySize: source.companySize,
        jobRole: inferRole(title),
        jobLocation: inferLocation(text),
        jobEmployment: inferEmployment(text),
        jobUpdatedAt: updatedAt,
        jobMobileCasual: source.mobileCasual,
      });
    }
  }

  if (items.size < limit) {
    const pageText = cleanHtml(html);
    for (const title of extractTitles(pageText)) {
      const index = pageText.indexOf(title);
      const context = index >= 0 ? pageText.slice(index, index + 360) : title;
      const text = `${title} ${context}`;
      const updatedAt = inferUpdatedAt(text);
      items.set(`${source.target}#${encodeURIComponent(title)}`, {
        title,
        url: `${source.target}#${encodeURIComponent(title)}`,
        summary: [
          `회사: ${company}`,
          source.companySize ? `규모: ${source.companySize}` : null,
          source.mobileCasual ? '모바일/캐주얼 중심' : null,
          inferEmployment(text) ? `고용형태: ${inferEmployment(text)}` : null,
          inferLocation(text) ? `근무지: ${inferLocation(text)}` : null,
          updatedAt ? `기준일: ${updatedAt}` : null,
        ]
          .filter(Boolean)
          .join(' · '),
        publishedAt: toDate(updatedAt) ?? new Date(),
        sourceScore: null,
        jobCompany: company,
        jobCompanySize: source.companySize,
        jobRole: inferRole(title),
        jobLocation: inferLocation(text),
        jobEmployment: inferEmployment(text),
        jobUpdatedAt: updatedAt,
        jobMobileCasual: source.mobileCasual,
      });
      if (items.size >= limit) break;
    }
  }

  return [...items.values()]
    .sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0))
    .slice(0, limit);
}
