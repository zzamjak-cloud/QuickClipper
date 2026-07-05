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
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다');
    }

    const { date, itemId } = (request.data ?? {}) as { date?: string; itemId?: string };
    // 문서 경로에 들어가므로 형식을 엄격히 검증 (경로 조작 방지)
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new HttpsError('invalid-argument', 'date 형식이 올바르지 않습니다 (YYYY-MM-DD)');
    }
    if (!itemId || !/^[a-f0-9]{20}$/.test(itemId)) {
      throw new HttpsError('invalid-argument', 'itemId 형식이 올바르지 않습니다');
    }

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
