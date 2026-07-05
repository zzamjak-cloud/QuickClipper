import { initFirestore, kstDateString } from './pipeline/store.js';
import { collectRankings } from './rankings.js';

// 게임 순위만 단독 수집 (개발·수동 갱신용)
const db = initFirestore();
await collectRankings(db, kstDateString(new Date()));
process.exit(0);
