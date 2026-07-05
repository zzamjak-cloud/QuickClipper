import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import Anthropic from '@anthropic-ai/sdk';

const anthropicApiKey = defineSecret('ANTHROPIC_API_KEY');

initializeApp();

/** 번역 결과 JSON 스키마 — 구조화 출력으로 파싱 실패 방지 */
const TRANSLATION_SCHEMA = {
  type: 'object',
  properties: {
    titleKo: { type: 'string', description: '한국어로 번역된 제목' },
    summaryKo: { type: 'string', description: '한국어로 번역된 요약문 (원문 요약이 없으면 빈 문자열)' },
  },
  required: ['titleKo', 'summaryKo'],
  additionalProperties: false,
} as const;

/**
 * 온디맨드 번역: digests/{date}/items/{itemId}의 제목+요약을 한국어로 번역.
 * 결과는 해당 문서에 캐시되어 같은 항목 재번역 시 API 호출 없이 반환된다.
 */
export const translateItem = onCall(
  {
    region: 'asia-northeast3',
    secrets: [anthropicApiKey],
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

    const client = new Anthropic({ apiKey: anthropicApiKey.value() });
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      output_config: { format: { type: 'json_schema', schema: TRANSLATION_SCHEMA } },
      messages: [
        {
          role: 'user',
          content: [
            '다음 영문 뉴스의 제목과 요약을 자연스러운 한국어로 번역해줘.',
            '고유명사(회사명, 제품명, 인명)는 원어를 유지하거나 통용되는 한글 표기를 사용해.',
            '',
            `제목: ${item.title}`,
            `요약: ${item.summary || '(요약 없음)'}`,
          ].join('\n'),
        },
      ],
    });

    const text = response.content.find((b) => b.type === 'text')?.text;
    if (!text) {
      throw new HttpsError('internal', '번역 응답이 비어 있습니다');
    }
    const parsed = JSON.parse(text) as { titleKo: string; summaryKo: string };

    // Firestore에 캐시 (다음 호출부터 과금 없음)
    await ref.update({ titleKo: parsed.titleKo, summaryKo: parsed.summaryKo });

    return parsed;
  },
);
