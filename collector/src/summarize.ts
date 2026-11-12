import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import {
  CANDIDATES_PATH,
  PROMPT_PATH,
  REPORT_JSON_SCHEMA,
  REPORT_PATH,
  validateReport,
} from './report.js';
import type { CandidatesFile } from './types.js';

// 2단계(summarize): Claude Code 헤드리스(claude -p)로 candidates.json → 한국어 리포트(report.json).
// 인증은 CI에선 CLAUDE_CODE_OAUTH_TOKEN, 로컬에선 claude 로그인 세션을 그대로 쓴다.
// 실패하면 report.json을 만들지 않고 종료 코드 1 — publish가 원문으로 폴백한다.

const MODEL = process.env.CLAUDE_MODEL ?? 'claude-sonnet-5-5';
const TIMEOUT_MS = 10 * 60_000;

function runClaude(input: string): Promise<string> {
  const args = [
    '-p',
    '--model',
    MODEL,
    '--output-format',
    'json',
    '--json-schema',
    JSON.stringify(REPORT_JSON_SCHEMA),
    // 텍스트 생성만 필요하므로 도구·MCP·사용자 설정(훅/플러그인)을 모두 배제
    '--tools',
    '',
    '--strict-mcp-config',
    '--setting-sources',
    'project',
    '--no-session-persistence',
  ];
  return new Promise((resolve, reject) => {
    const child = spawn('claude', args, { stdio: ['pipe', 'pipe', 'inherit'] });
    let stdout = '';
    const timer = setTimeout(() => child.kill('SIGTERM'), TIMEOUT_MS);
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout);
      else reject(new Error(`claude 종료 code=${code} signal=${signal} ${stdout.slice(0, 500)}`));
    });
    child.stdin.end(input);
  });
}

/** --output-format json 결과에서 리포트 객체 추출 (structured_output 우선, 없으면 result 텍스트 파싱) */
function extractReport(stdout: string): unknown {
  const envelope = JSON.parse(stdout) as {
    is_error?: boolean;
    result?: string;
    structured_output?: unknown;
  };
  if (envelope.is_error) throw new Error(`claude 오류 응답: ${envelope.result ?? ''}`);
  if (envelope.structured_output && typeof envelope.structured_output === 'object') {
    return envelope.structured_output;
  }
  const textResult = envelope.result ?? '';
  const start = textResult.indexOf('{');
  const end = textResult.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('응답에서 JSON 객체를 찾지 못함');
  return JSON.parse(textResult.slice(start, end + 1));
}

async function main() {
  const { candidates } = JSON.parse(await readFile(CANDIDATES_PATH, 'utf8')) as CandidatesFile;
  const prompt = await readFile(PROMPT_PATH, 'utf8');
  // 토큰 절약: 모델 판단에 필요한 필드만 전달
  const compact = candidates.map((c) => ({
    id: c.id,
    title: c.title,
    summary: c.summary,
    source: c.sourceName,
    publishedAt: c.publishedAt,
    score: c.score,
    alsoReportedBy: c.relatedSources?.map((s) => s.name),
  }));
  const input = `${prompt}\n\n## candidates\n${JSON.stringify(compact)}\n`;

  console.log(`[summarize] 후보 ${candidates.length}건 → claude -p (${MODEL})`);
  const report = validateReport(extractReport(await runClaude(input)), candidates);
  if (!report) throw new Error('리포트 검증 실패 (브리핑 누락 또는 유효 항목 부족)');

  await writeFile(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(`[summarize] ${REPORT_PATH} 저장 — 항목 ${report.items.length}건`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[summarize] 실패 — publish는 원문으로 폴백:', err);
    process.exit(1);
  });
