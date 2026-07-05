import { GoogleGenAI } from '@google/genai';
import type { DigestItem } from '../types.js';

// 영문 항목을 Gemini로 일괄 번역한다 (제목 + 요약 → 한국어).
// 20개씩 묶어 호출 — 190건 기준 하루 ~8회로 무료 쿼터 내에서 동작.
// GEMINI_API_KEY 미설정 시 건너뜀 (UI는 원문 표시로 폴백).

const CHUNK_SIZE = 20;

const RESPONSE_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      i: { type: 'integer', description: '입력 항목의 인덱스' },
      titleKo: { type: 'string', description: '한국어로 번역된 제목' },
      summaryKo: { type: 'string', description: '한국어로 번역된 요약 (입력 요약이 없으면 빈 문자열)' },
    },
    required: ['i', 'titleKo', 'summaryKo'],
  },
};

export function hasGeminiCredentials(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

/** 영문 항목 일괄 번역 (원본 배열을 직접 수정). 청크 실패는 해당 청크만 원문 유지. */
export async function translateItems(items: DigestItem[]): Promise<void> {
  const targets = items.filter((it) => it.lang === 'en');
  if (targets.length === 0) return;

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  let translated = 0;

  for (let start = 0; start < targets.length; start += CHUNK_SIZE) {
    const chunk = targets.slice(start, start + CHUNK_SIZE);
    const payload = chunk.map((it, i) => ({
      i,
      title: it.title,
      summary: it.summary.slice(0, 300),
    }));

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          '다음 영문 뉴스 항목들의 제목과 요약을 자연스러운 한국어로 번역해줘.',
          '고유명사(회사명, 제품명, 인명)는 원어를 유지하거나 통용되는 한글 표기를 사용해.',
          '각 항목의 i 값을 그대로 유지해서 JSON 배열로 반환해.',
          '',
          JSON.stringify(payload),
        ].join('\n'),
        config: {
          responseMimeType: 'application/json',
          responseJsonSchema: RESPONSE_SCHEMA,
        },
      });

      const results = JSON.parse(response.text ?? '[]') as {
        i: number;
        titleKo: string;
        summaryKo: string;
      }[];
      for (const r of results) {
        const item = chunk[r.i];
        if (item && r.titleKo) {
          item.titleKo = r.titleKo;
          item.summaryKo = r.summaryKo || undefined;
          translated++;
        }
      }
    } catch (err) {
      console.warn(`[translate] 청크 ${start / CHUNK_SIZE + 1} 번역 실패 (원문 유지): ${err}`);
    }
  }
  console.log(`[translate] 영문 ${targets.length}건 중 ${translated}건 번역 완료`);
}
