import { GoogleGenAI } from '@google/genai';
import type { Briefing, DigestItem } from '../types.js';

// 배치 AI 부가기능: 오늘의 브리핑 / 클러스터 종합 요약 / 주간 리포트
// 모두 GEMINI_API_KEY 기반 — 미설정·실패 시 건너뜀 (수집 자체엔 영향 없음)

function client(): GoogleGenAI {
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
}

/** 항목을 프롬프트용 한 줄로 압축 */
function itemLine(it: DigestItem, i: number): string {
  const title = it.titleKo ?? it.title;
  const summary = (it.summaryKo ?? it.summary).slice(0, 100);
  return `${i}. [${it.category}] ${title} — ${summary}`;
}

const BRIEFING_SCHEMA = {
  type: 'object',
  properties: {
    points: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '브리핑 항목 제목 (한국어, 간결하게)' },
          body: { type: 'string', description: '1~2문장 설명 (한국어)' },
          category: { type: 'string', description: '해당 카테고리명' },
        },
        required: ['title', 'body', 'category'],
      },
    },
  },
  required: ['points'],
};

/** ① 오늘의 브리핑 — 전체 수집 항목 중 꼭 알아야 할 5가지 */
export async function generateBriefing(items: DigestItem[]): Promise<Briefing | null> {
  try {
    const top = [...items].sort((a, b) => b.score - a.score).slice(0, 100);
    const response = await client().models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        '아래는 오늘 수집된 뉴스 목록이야. 오늘 꼭 알아야 할 핵심 이슈 5가지를 골라 브리핑을 작성해줘.',
        '규칙: 서로 다른 주제로 다양하게 (한 카테고리에 몰지 말 것), 중요도·화제성 우선, 한국어로.',
        '',
        ...top.map(itemLine),
      ].join('\n'),
      config: { responseMimeType: 'application/json', responseJsonSchema: BRIEFING_SCHEMA },
    });
    const briefing = JSON.parse(response.text ?? '') as Briefing;
    if (!briefing.points?.length) return null;
    console.log(`[briefing] 오늘의 브리핑 ${briefing.points.length}건 생성`);
    return { points: briefing.points.slice(0, 5) };
  } catch (err) {
    console.warn(`[briefing] 생성 실패: ${err}`);
    return null;
  }
}

const CLUSTER_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      i: { type: 'integer' },
      summary: { type: 'string', description: '여러 소스를 종합한 2문장 한국어 요약' },
    },
    required: ['i', 'summary'],
  },
};

/** ③ 교차 보도 이슈 종합 요약 — relatedSources가 있는 항목 대상 (원본 배열 수정) */
export async function summarizeClusters(items: DigestItem[]): Promise<void> {
  const clusters = items.filter((it) => (it.relatedSources?.length ?? 0) >= 1).slice(0, 20);
  if (clusters.length === 0) return;

  try {
    const payload = clusters.map((it, i) => ({
      i,
      title: it.titleKo ?? it.title,
      summary: (it.summaryKo ?? it.summary).slice(0, 200),
      otherSources: it.relatedSources!.map((s) => s.name),
    }));
    const response = await client().models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        '아래는 여러 매체가 동시에 보도한 이슈들이야. 각 이슈를 종합해 2문장 한국어 요약을 작성해줘. i 값 유지.',
        '',
        JSON.stringify(payload),
      ].join('\n'),
      config: { responseMimeType: 'application/json', responseJsonSchema: CLUSTER_SCHEMA },
    });
    const results = JSON.parse(response.text ?? '[]') as { i: number; summary: string }[];
    for (const r of results) {
      if (clusters[r.i] && r.summary) clusters[r.i].clusterSummary = r.summary;
    }
    console.log(`[cluster] 교차 보도 이슈 ${results.length}건 종합 요약`);
  } catch (err) {
    console.warn(`[cluster] 요약 실패: ${err}`);
  }
}

const REPORT_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: '리포트 제목 (예: 7월 1주차 트렌드 리포트)' },
    sections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          heading: { type: 'string', description: '섹션 제목 (한국어)' },
          body: { type: 'string', description: '섹션 본문 3~5문장 (한국어)' },
        },
        required: ['heading', 'body'],
      },
    },
  },
  required: ['title', 'sections'],
};

/** ④ 주간 트렌드 리포트 — 지난 7일 다이제스트 기반 */
export async function generateWeeklyReport(
  db: FirebaseFirestore.Firestore,
  dates: string[],
): Promise<void> {
  // 날짜별 상위 항목 수집
  const lines: string[] = [];
  for (const date of dates) {
    const snap = await db
      .collection(`digests/${date}/items`)
      .orderBy('score', 'desc')
      .limit(40)
      .get();
    snap.docs.forEach((doc, i) => {
      lines.push(`[${date}] ${itemLine(doc.data() as DigestItem, i)}`);
    });
  }
  if (lines.length < 30) {
    console.warn('[report] 데이터 부족 — 주간 리포트 건너뜀');
    return;
  }

  const response = await client().models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      '아래는 지난 한 주간 수집된 주요 뉴스 목록이야. 한 주를 돌아보는 트렌드 리포트를 작성해줘.',
      '규칙: 4~6개 섹션 (분야별 핵심 흐름), 단순 나열이 아니라 흐름과 의미를 짚을 것, 한국어.',
      '',
      ...lines,
    ].join('\n'),
    config: { responseMimeType: 'application/json', responseJsonSchema: REPORT_SCHEMA },
  });

  const report = JSON.parse(response.text ?? '') as { title: string; sections: { heading: string; body: string }[] };
  const weekId = dates[dates.length - 1]; // 리포트 생성일 (주 마지막 날)
  await db.doc(`reports/${weekId}`).set({
    weekId,
    startDate: dates[0],
    endDate: weekId,
    title: report.title,
    sections: report.sections,
    generatedAt: new Date(),
  });
  console.log(`[report] 주간 리포트 저장: ${report.title} (${weekId})`);
}
