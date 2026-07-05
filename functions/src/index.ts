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

/** 관심 프로필 JSON 스키마 */
const PROFILE_SCHEMA = {
  type: 'object',
  properties: {
    interests: {
      type: 'array',
      items: { type: 'string' },
      description: '사용자의 관심 주제 3~6개 (한국어 짧은 구문)',
    },
    keywords: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          word: { type: 'string', description: '기사 제목/요약에서 매칭할 키워드 (한국어 또는 영어)' },
          weight: { type: 'integer', description: '중요도 1~5' },
        },
        required: ['word', 'weight'],
      },
      description: '관심도 매칭용 키워드 10~20개 (한국어·영어 각각 포함)',
    },
  },
  required: ['interests', 'keywords'],
};

/**
 * 관심 프로필 생성: 사용자의 클릭·스크랩 이력을 분석해
 * users/{uid}/profile/main에 키워드 프로필 저장. (주 1회 수준 호출)
 */
export const generateProfile = onCall(
  {
    region: 'asia-northeast3',
    secrets: [geminiApiKey],
    maxInstances: 3,
    timeoutSeconds: 60,
  },
  async (request) => {
    await assertAllowed(request.auth);
    const uid = request.auth!.uid;
    const db = getFirestore();

    const [clicksSnap, clipsSnap] = await Promise.all([
      db.collection(`users/${uid}/clicks`).orderBy('ts', 'desc').limit(100).get(),
      db.collection(`users/${uid}/clips`).orderBy('clippedAt', 'desc').limit(100).get(),
    ]);

    const lines: string[] = [];
    clipsSnap.docs.forEach((d) => {
      const c = d.data();
      lines.push(`[스크랩/${c.category}] ${c.titleKo ?? c.title}${c.tags?.length ? ` #${c.tags.join(' #')}` : ''}`);
    });
    clicksSnap.docs.forEach((d) => {
      const c = d.data();
      lines.push(`[클릭/${c.category}] ${c.title}`);
    });

    if (lines.length < 5) {
      throw new HttpsError('failed-precondition', '활동 기록이 아직 부족합니다 (5건 이상 필요)');
    }

    const ai = new GoogleGenAI({ apiKey: geminiApiKey.value() });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        '아래는 뉴스 앱 사용자의 스크랩·클릭 이력이야. 이 사용자의 관심사를 분석해줘.',
        'keywords는 앞으로 기사 제목·요약과 문자열 매칭에 쓰이니, 실제 기사에 자주 등장할 구체적 단어로 (한국어와 영어 표기 모두 포함).',
        '',
        ...lines.slice(0, 150),
      ].join('\n'),
      config: { responseMimeType: 'application/json', responseJsonSchema: PROFILE_SCHEMA },
    });
    if (!response.text) {
      throw new HttpsError('internal', '프로필 생성 응답이 비어 있습니다');
    }
    const profile = JSON.parse(response.text) as {
      interests: string[];
      keywords: { word: string; weight: number }[];
    };

    await db.doc(`users/${uid}/profile/main`).set({
      interests: profile.interests.slice(0, 6),
      keywords: profile.keywords.slice(0, 20),
      updatedAt: new Date(),
    });

    return profile;
  },
);

/** 태그 제안 JSON 스키마 */
const TAGS_SCHEMA = {
  type: 'object',
  properties: {
    tags: {
      type: 'array',
      items: { type: 'string' },
      description: '한국어 태그 2~3개 (각 1~3단어, # 없이)',
    },
  },
  required: ['tags'],
};

/** 스크랩 자동 태그: 제목·요약으로 태그 2~3개 제안 */
export const suggestTags = onCall(
  {
    region: 'asia-northeast3',
    secrets: [geminiApiKey],
    maxInstances: 5,
    timeoutSeconds: 30,
  },
  async (request) => {
    await assertAllowed(request.auth);
    const { title, summary, category } = (request.data ?? {}) as {
      title?: string;
      summary?: string;
      category?: string;
    };
    if (!title || title.length > 500) {
      throw new HttpsError('invalid-argument', 'title이 올바르지 않습니다');
    }

    const ai = new GoogleGenAI({ apiKey: geminiApiKey.value() });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        '다음 기사에 어울리는 분류 태그 2~3개를 제안해줘. 짧고 재사용 가능한 한국어 태그로 (예: LLM, 게임개발, 국내여행).',
        `카테고리: ${(category ?? '').slice(0, 20)}`,
        `제목: ${title}`,
        `요약: ${(summary ?? '').slice(0, 300)}`,
      ].join('\n'),
      config: { responseMimeType: 'application/json', responseJsonSchema: TAGS_SCHEMA },
    });
    if (!response.text) {
      throw new HttpsError('internal', '태그 제안 응답이 비어 있습니다');
    }
    const parsed = JSON.parse(response.text) as { tags: string[] };
    return { tags: parsed.tags.slice(0, 3).map((t) => t.replace(/^#/, '').trim()) };
  },
);
