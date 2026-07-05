import { SOURCES } from '../sources.config.js';
import { initFirestore } from './pipeline/store.js';

// sources.config.ts의 소스 정의를 Firestore sources 컬렉션에 시드한다.
// 이후 소스 편집은 관리자 설정 UI에서 수행. (기존 문서는 덮어씀, UI 추가분은 유지)
async function main() {
  const db = initFirestore();
  for (const source of SOURCES) {
    await db.doc(`sources/${source.id}`).set(source, { merge: true });
    console.log(`  ✓ ${source.id} (${source.category} / ${source.name})`);
  }
  console.log(`[seed] ${SOURCES.length}개 소스 시드 완료`);
}

main().then(() => process.exit(0));
