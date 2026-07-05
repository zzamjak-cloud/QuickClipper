import { useEffect, useState } from 'react';
import type { ChartItem } from '../lib/rankings';
import { fetchChart } from '../lib/rankings';

type Mode = 'mobile' | 'steam';

const COUNTRIES = [
  { value: 'kr', label: '한국' },
  { value: 'us', label: '미국' },
  { value: 'jp', label: '일본' },
] as const;

const PLATFORMS = [
  { value: 'ios', label: 'iOS' },
  { value: 'aos', label: 'aOS' },
] as const;

const MOBILE_CHARTS = [
  { value: 'topfree', label: '인기 무료' },
  { value: 'grossing', label: '최고 매출' },
] as const;

const STEAM_CHARTS = [
  { value: 'topsellers', label: '최고 판매' },
  { value: 'popularnew', label: '인기 신작' },
  { value: 'earlyaccess', label: '얼리액세스' },
  { value: 'demos', label: '인기 데모 (넥스트 페스트)' },
  { value: 'mostplayed', label: '최다 플레이 (글로벌)' },
] as const;

const selectCls =
  'rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 outline-none';

/** 게임 탭의 순위 보기 — 모바일(iOS/aOS 국가별) / 스팀(차트·국가별) */
export function GameRankings({ mode }: { mode: Mode }) {
  const [country, setCountry] = useState('kr');
  const [platform, setPlatform] = useState('ios');
  const [chart, setChart] = useState('topfree');
  const [steamChart, setSteamChart] = useState('topsellers');
  const [items, setItems] = useState<ChartItem[] | null>(null);
  const [dataDate, setDataDate] = useState('');
  const [loading, setLoading] = useState(false);

  const chartId =
    mode === 'mobile'
      ? `${platform}-${chart}-${country}`
      : steamChart === 'mostplayed'
        ? 'steam-mostplayed-global'
        : `steam-${steamChart}-${country}`;

  useEffect(() => {
    setLoading(true);
    fetchChart(chartId)
      .then((result) => {
        setItems(result?.items ?? null);
        setDataDate(result?.date ?? '');
      })
      .finally(() => setLoading(false));
  }, [chartId]);

  return (
    <div>
      {/* 필터 드롭다운 */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {mode === 'steam' && (
          <select
            value={steamChart}
            onChange={(e) => setSteamChart(e.target.value)}
            className={selectCls}
          >
            {STEAM_CHARTS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        )}

        {!(mode === 'steam' && steamChart === 'mostplayed') && (
          <select value={country} onChange={(e) => setCountry(e.target.value)} className={selectCls}>
            {COUNTRIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        )}

        {mode === 'mobile' && (
          <>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className={selectCls}
            >
              {PLATFORMS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <select value={chart} onChange={(e) => setChart(e.target.value)} className={selectCls}>
              {MOBILE_CHARTS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </>
        )}

        {dataDate && <span className="ml-auto text-xs text-slate-400">{dataDate} 기준</span>}
      </div>

      {/* 순위 리스트 */}
      {loading ? (
        <p className="py-16 text-center text-slate-400">불러오는 중…</p>
      ) : !items || items.length === 0 ? (
        <p className="py-16 text-center text-slate-400">
          순위 데이터가 아직 없습니다. 다음 수집(매일 06:30) 후 표시됩니다.
        </p>
      ) : (
        <ol className="space-y-1.5">
          {items.map((item) => (
            <li key={item.rank}>
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm transition hover:shadow-md"
              >
                <span className="w-6 shrink-0 text-center text-sm font-bold tabular-nums text-slate-400">
                  {item.rank}
                </span>
                {item.icon && (
                  <img
                    src={item.icon}
                    alt=""
                    loading="lazy"
                    className={`shrink-0 bg-slate-100 object-cover ${
                      chartId.startsWith('steam') ? 'h-8 w-20 rounded' : 'h-9 w-9 rounded-lg'
                    }`}
                  />
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">{item.name}</p>
                  {item.publisher && (
                    <p className="truncate text-xs text-slate-400">{item.publisher}</p>
                  )}
                </div>
              </a>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
