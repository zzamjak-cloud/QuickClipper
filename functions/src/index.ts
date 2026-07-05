import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as logger from 'firebase-functions/logger';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';

const geminiApiKey = defineSecret('GEMINI_API_KEY');
const openaiApiKey = defineSecret('OPENAI_API_KEY');

initializeApp();

interface Translation {
  titleKo: string;
  summaryKo: string;
}

/** 번역 결과 JSON 스키마 — 구조화 출력으로 파싱 실패 방지 (Gemini/OpenAI 공용) */
const TRANSLATION_SCHEMA = {
  type: 'object',
  properties: {
    titleKo: { type: 'string', description: '한국어로 번역된 제목' },
    summaryKo: { type: 'string', description: '한국어로 번역된 요약문 (원문 요약이 없으면 빈 문자열)' },
  },
  required: ['titleKo', 'summaryKo'],
  additionalProperties: false,
};

function buildPrompt(title: string, summary?: string): string {
  return [
    '다음 영문 뉴스의 제목과 요약을 자연스러운 한국어로 번역해줘.',
    '고유명사(회사명, 제품명, 인명)는 원어를 유지하거나 통용되는 한글 표기를 사용해.',
    '',
    `제목: ${title}`,
    `요약: ${summary || '(요약 없음)'}`,
  ].join('\n');
}

/** 1차: Gemini (무료 쿼터) */
async function translateWithGemini(prompt: string): Promise<Translation> {
  const ai = new GoogleGenAI({ apiKey: geminiApiKey.value() });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseJsonSchema: TRANSLATION_SCHEMA,
    },
  });
  if (!response.text) throw new Error('Gemini 응답이 비어 있음');
  return JSON.parse(response.text) as Translation;
}

/** 2차 폴백: OpenAI (Gemini 쿼터 초과·장애 시) */
async function translateWithOpenAI(prompt: string): Promise<Translation> {
  const openai = new OpenAI({ apiKey: openaiApiKey.value() });
  const response = await openai.responses.create({
    model: 'gpt-5.4-nano',
    input: prompt,
    text: {
      format: {
        type: 'json_schema',
        name: 'translation',
        strict: true,
        schema: TRANSLATION_SCHEMA,
      },
    },
  });
  if (!response.output_text) throw new Error('OpenAI 응답이 비어 있음');
  return JSON.parse(response.output_text) as Translation;
}

/** 허용 목록 검증 — 허용되지 않은 계정의 API 호출(과금) 차단 */
async function assertAllowed(auth: { token: { email?: string } } | undefined): Promise<void> {
  if (!auth) {
    throw new HttpsError('unauthenticated', '로그인이 필요합니다');
  }
  const email = auth.token.email;
  const accessSnap = await getFirestore().doc('config/access').get();
  const access = (accessSnap.data() ?? {}) as { admins?: string[]; allowed?: string[] };
  const isAllowed =
    !!email && ((access.admins ?? []).includes(email) || (access.allowed ?? []).includes(email));
  if (!isAllowed) {
    throw new HttpsError('permission-denied', '허용되지 않은 계정입니다');
  }
}

/** date/itemId 입력 검증 — 문서 경로에 들어가므로 형식을 엄격히 확인 (경로 조작 방지) */
function validateItemRef(data: unknown): { date: string; itemId: string } {
  const { date, itemId } = (data ?? {}) as { date?: string; itemId?: string };
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new HttpsError('invalid-argument', 'date 형식이 올바르지 않습니다 (YYYY-MM-DD)');
  }
  if (!itemId || !/^[a-f0-9]{20}$/.test(itemId)) {
    throw new HttpsError('invalid-argument', 'itemId 형식이 올바르지 않습니다');
  }
  return { date, itemId };
}

/**
 * 온디맨드 번역: digests/{date}/items/{itemId}의 제목+요약을 한국어로 번역.
 * Gemini 우선, 실패 시 OpenAI 폴백. 결과는 문서에 캐시되어 재호출 시 과금 없음.
 */
export const translateItem = onCall(
  {
    region: 'asia-northeast3',
    secrets: [geminiApiKey, openaiApiKey],
    maxInstances: 5, // 개인용 앱 — 폭주 방지
  },
  async (request) => {
    await assertAllowed(request.auth);
    const { date, itemId } = validateItemRef(request.data);

    const ref = getFirestore().doc(`digests/${date}/items/${itemId}`);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new HttpsError('not-found', '해당 다이제스트 항목이 없습니다');
    }
    const item = snap.data() as { title: string; summary?: string; titleKo?: string; summaryKo?: string };

    // 캐시 히트: 이미 번역된 항목은 API 호출 없이 즉시 반환
    if (item.titleKo) {
      return { titleKo: item.titleKo, summaryKo: item.summaryKo ?? '' };
    }

    const prompt = buildPrompt(item.title, item.summary);

    let parsed: Translation;
    try {
      parsed = await translateWithGemini(prompt);
    } catch (geminiError) {
      logger.warn('Gemini 번역 실패 — OpenAI 폴백 시도', { error: String(geminiError) });
      try {
        parsed = await translateWithOpenAI(prompt);
      } catch (openaiError) {
        logger.error('OpenAI 폴백도 실패', { error: String(openaiError) });
        throw new HttpsError('internal', '번역에 실패했습니다 (Gemini/OpenAI 모두 실패)');
      }
    }

    // Firestore에 캐시 (다음 호출부터 과금 없음)
    await ref.update({ titleKo: parsed.titleKo, summaryKo: parsed.summaryKo });

    return parsed;
  },
);

interface TranslatedArticle {
  title: string;
  paragraphs: string[];
}

/** 번역 기사 JSON 스키마 */
const ARTICLE_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: '한국어로 번역된 기사 제목' },
    paragraphs: {
      type: 'array',
      items: { type: 'string' },
      description: '한국어로 번역된 본문 단락들 (원문 단락 구조 유지)',
    },
  },
  required: ['title', 'paragraphs'],
};

/** HTML에서 본문 후보 텍스트 추출 (스크립트·스타일 제거 후 태그 스트립) */
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<(p|div|br|h[1-6]|li)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#\d+;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();
}

/**
 * 앱 내 번역 리더: 기사 원문을 가져와 본문만 추출·한국어 전문 번역.
 * 결과는 항목 문서에 캐시 (재열람 시 즉시 표시, 과금 없음).
 */
export const readArticle = onCall(
  {
    region: 'asia-northeast3',
    secrets: [geminiApiKey],
    maxInstances: 5,
    timeoutSeconds: 120,
    memory: '512MiB',
  },
  async (request) => {
    await assertAllowed(request.auth);
    const { date, itemId } = validateItemRef(request.data);

    const ref = getFirestore().doc(`digests/${date}/items/${itemId}`);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new HttpsError('not-found', '해당 다이제스트 항목이 없습니다');
    }
    const item = snap.data() as { url: string; title: string; articleKo?: TranslatedArticle };

    // 캐시 히트
    if (item.articleKo) {
      return item.articleKo;
    }

    // 원문 페이지 수집
    let pageText = '';
    try {
      const res = await fetch(item.url, {
        signal: AbortSignal.timeout(15000),
        redirect: 'follow',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
          Accept: 'text/html',
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      pageText = htmlToText(await res.text()).slice(0, 50000);
    } catch (err) {
      logger.warn('기사 원문 수집 실패', { url: item.url, error: String(err) });
      throw new HttpsError('unavailable', '원문 페이지를 가져오지 못했습니다 (사이트 차단 가능성)');
    }
    if (pageText.length < 200) {
      throw new HttpsError('unavailable', '본문을 추출하지 못했습니다');
    }

    // Gemini: 본문 추출 + 전문 번역 (한 번에)
    const ai = new GoogleGenAI({ apiKey: geminiApiKey.value() });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        '아래는 웹페이지에서 추출한 텍스트야. 기사 본문만 골라내서 자연스러운 한국어로 번역해줘.',
        '규칙:',
        '- 메뉴, 광고, 추천 기사, 댓글, 구독 안내 등 본문이 아닌 내용은 제외',
        '- 원문의 단락 구조를 유지하고, 빠짐없이 전체 본문을 번역 (요약 금지)',
        '- 전문 번역가 수준의 자연스러운 문장으로, 고유명사는 원어 병기 가능',
        `- 기사 제목: ${item.title}`,
        '',
        pageText,
      ].join('\n'),
      config: {
        responseMimeType: 'application/json',
        responseJsonSchema: ARTICLE_SCHEMA,
      },
    });

    if (!response.text) {
      throw new HttpsError('internal', '번역 응답이 비어 있습니다');
    }
    const article = JSON.parse(response.text) as TranslatedArticle;

    // 캐시 저장 (Firestore 문서 1MB 제한 고려해 방어적으로 자름)
    const totalLen = article.paragraphs.join('').length;
    if (totalLen < 300000) {
      await ref.update({ articleKo: article });
    }

    return article;
  },
);
