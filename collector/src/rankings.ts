import { FieldValue } from 'firebase-admin/firestore';

// 게임 순위 수집: iOS(앱스토어 RSS) / aOS(구글플레이 스크레이퍼) / 스팀(스토어 API)
// 저장 구조: rankings/{date}/charts/{chartId}
//   chartId 예: ios-topfree-kr, aos-grossing-us, steam-topsellers-kr, steam-mostplayed-global

export interface ChartItem {
  rank: number;
  name: string;
  url: string;
  icon?: string;
  publisher?: string;
}

const COUNTRIES = ['kr', 'us', 'jp'] as const;
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; QuickClipper/1.0)' };

/** iOS 앱스토어 게임 차트 (레거시 RSS, 장르 6014=게임) */
async function fetchIosChart(country: string, chart: 'topfree' | 'grossing'): Promise<ChartItem[]> {
  const feed = chart === 'topfree' ? 'topfreeapplications' : 'topgrossingapplications';
  const url = `https://itunes.apple.com/${country}/rss/${feed}/limit=50/genre=6014/json`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000), headers: UA });
  if (!res.ok) throw new Error(`iOS ${chart} ${country} HTTP ${res.status}`);
  const json = await res.json();
  const entries = (json.feed?.entry ?? []) as Record<string, any>[];
  return entries.map((e, i) => ({
    rank: i + 1,
    name: e['im:name']?.label ?? '(이름 없음)',
    url: e.link?.attributes?.href ?? e.id?.label ?? '',
    icon: e['im:image']?.at(-1)?.label,
    publisher: e['im:artist']?.label,
  }));
}

/** 구글플레이 게임 차트 (비공식 스크레이퍼 — 실패 허용) */
async function fetchAosChart(country: string, chart: 'topfree' | 'grossing'): Promise<ChartItem[]> {
  // 공식 API가 없어 google-play-scraper 사용 (타입 선언 없음)
  const gplay = ((await import('google-play-scraper')) as any).default;
  const apps = await gplay.list({
    collection: chart === 'topfree' ? gplay.collection.TOP_FREE : gplay.collection.GROSSING,
    category: gplay.category.GAME,
    country,
    num: 50,
  });
  return (apps as Record<string, any>[]).map((a, i) => ({
    rank: i + 1,
    name: a.title ?? '(이름 없음)',
    url: a.url ?? `https://play.google.com/store/apps/details?id=${a.appId}`,
    icon: a.icon,
    publisher: a.developer,
  }));
}

/** 스팀 국가별 최고 판매 (스토어 featured API) */
async function fetchSteamTopSellers(country: string): Promise<ChartItem[]> {
  const url = `https://store.steampowered.com/api/featuredcategories?cc=${country}&l=koreana`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000), headers: UA });
  if (!res.ok) throw new Error(`Steam topsellers ${country} HTTP ${res.status}`);
  const json = await res.json();
  const items = (json.top_sellers?.items ?? []) as Record<string, any>[];
  return items.map((g, i) => ({
    rank: i + 1,
    name: g.name ?? '(이름 없음)',
    url: `https://store.steampowered.com/app/${g.id}`,
    icon: g.small_capsule_image ?? g.large_capsule_image,
  }));
}

/** 스팀 글로벌 최다 플레이 (공식 차트 API, 상위 20개 이름 조회) */
async function fetchSteamMostPlayed(): Promise<ChartItem[]> {
  const res = await fetch('https://api.steampowered.com/ISteamChartsService/GetMostPlayedGames/v1/', {
    signal: AbortSignal.timeout(10000),
    headers: UA,
  });
  if (!res.ok) throw new Error(`Steam mostplayed HTTP ${res.status}`);
  const ranks = ((await res.json()).response?.ranks ?? []).slice(0, 20) as { rank: number; appid: number }[];

  const items: ChartItem[] = [];
  for (const r of ranks) {
    let name = `App ${r.appid}`;
    let icon: string | undefined;
    try {
      const detail = await fetch(
        `https://store.steampowered.com/api/appdetails?appids=${r.appid}&filters=basic&l=koreana`,
        { signal: AbortSignal.timeout(8000), headers: UA },
      );
      const data = (await detail.json())[r.appid]?.data;
      if (data?.name) name = data.name;
      icon = data?.capsule_imagev5 ?? data?.header_image;
    } catch {
      // 이름 조회 실패는 무시하고 appid로 표시
    }
    items.push({ rank: r.rank, name, url: `https://store.steampowered.com/app/${r.appid}`, icon });
  }
  return items;
}

/** 전체 순위 수집·저장. 차트 단위로 실패 허용. */
export async function collectRankings(db: FirebaseFirestore.Firestore, date: string): Promise<void> {
  const jobs: { chartId: string; fetch: () => Promise<ChartItem[]> }[] = [];

  for (const cc of COUNTRIES) {
    for (const chart of ['topfree', 'grossing'] as const) {
      jobs.push({ chartId: `ios-${chart}-${cc}`, fetch: () => fetchIosChart(cc, chart) });
      jobs.push({ chartId: `aos-${chart}-${cc}`, fetch: () => fetchAosChart(cc, chart) });
    }
    jobs.push({ chartId: `steam-topsellers-${cc}`, fetch: () => fetchSteamTopSellers(cc) });
  }
  jobs.push({ chartId: 'steam-mostplayed-global', fetch: fetchSteamMostPlayed });

  let saved = 0;
  for (const job of jobs) {
    try {
      const items = await job.fetch();
      if (items.length === 0) throw new Error('0건');
      await db.doc(`rankings/${date}/charts/${job.chartId}`).set({
        chartId: job.chartId,
        date,
        items,
        updatedAt: FieldValue.serverTimestamp(),
      });
      saved++;
    } catch (err) {
      console.warn(`  ✗ 순위 ${job.chartId}: ${err}`);
    }
  }
  await db.doc(`rankings/${date}`).set({ date, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  console.log(`[rankings] ${jobs.length}개 차트 중 ${saved}개 저장`);
}
