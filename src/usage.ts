import { supportedSeason, normalizeId } from "./data.ts";
export const API_ORIGIN = "https://championsbattledata.com";
export type UsageRow = {
  category: string;
  name: string;
  rank: number;
  percent: number | null;
  points?: number[];
};
export type UsageSnapshot = {
  speciesId: string;
  season: string;
  date: string;
  rows: UsageRow[];
};
export type UsageIndex = {
  date: string;
  season: string;
  pokemon: { id: string; name: string; rank: number | null }[];
};
export type CacheEntry<T> = {
  data?: T;
  checkedAt: string;
  attemptDay: string;
  error?: string;
};
export const japanDay = (now = new Date()) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
const record = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
function date(v: unknown) {
  if (typeof v !== "string" || !/^\d{2}_\d{2}_\d{4}$/.test(v))
    throw new Error("提供元の日付が不正です");
  const [d, m, y] = v.split("_");
  const iso = `${y}-${m}-${d}`;
  if (new Date(iso).toISOString().slice(0, 10) !== iso)
    throw new Error("提供元の日付が不正です");
  return iso;
}
export function parseUsage(value: unknown, id: string): UsageSnapshot {
  const root = record(value);
  if (
    root.showdownId !== id ||
    root.format !== "Singles" ||
    !Array.isArray(root.daily) ||
    !root.daily.length
  )
    throw new Error("このポケモンのシングル統計がありません");
  const latest = record(root.daily[0]);
  if (typeof latest.season !== "string" || !Array.isArray(latest.rows))
    throw new Error("統計の形式が変わっています");
  const rows: UsageRow[] = [];
  for (const value of latest.rows) {
    const r = record(value);
    if (
      ![
        "move",
        "held_item",
        "ability",
        "stat_alignment",
        "stat_points",
      ].includes(String(r.category))
    )
      continue;
    if (
      !Number.isInteger(r.rank) ||
      Number(r.rank) < 1 ||
      typeof r.name !== "string"
    )
      throw new Error("統計の項目が不正です");
    const percent = r.percentage_value === null ? null : r.percentage_value;
    if (
      percent !== null &&
      (typeof percent !== "number" ||
        !Number.isFinite(percent) ||
        percent < 0 ||
        percent > 100)
    )
      throw new Error("採用率が不正です");
    let points: number[] | undefined;
    if (r.category === "stat_points") {
      points = [
        "hp_points",
        "attack_points",
        "defense_points",
        "sp_atk_points",
        "sp_def_points",
        "speed_points",
      ].map((k) => (r[k] === "" ? NaN : Number(r[k])));
      if (
        [
          "hp_points",
          "attack_points",
          "defense_points",
          "sp_atk_points",
          "sp_def_points",
          "speed_points",
        ].some((k) => r[k] === null || r[k] === undefined)
      )
        throw new Error("能力配分が欠落しています");
      if (
        points.some((n) => !Number.isInteger(n) || n < 0 || n > 32) ||
        points.reduce((a, b) => a + b, 0) > 66
      )
        throw new Error("能力配分が不正です");
    }
    rows.push({
      category: String(r.category),
      name: r.name,
      rank: Number(r.rank),
      percent,
      ...(points ? { points } : {}),
    });
  }
  if (!rows.length) throw new Error("採用率のデータがありません");
  return {
    speciesId: id,
    season: latest.season,
    date: date(latest.date),
    rows: rows.sort(
      (a, b) => (b.percent ?? -1) - (a.percent ?? -1) || a.rank - b.rank,
    ),
  };
}
export function parseIndex(value: unknown): UsageIndex {
  const r = record(value);
  if (!Array.isArray(r.pokemon) || !Array.isArray(r.dailyDataFolders))
    throw new Error("一覧データの形式が変わっています");
  const folders = r.dailyDataFolders
    .filter(
      (v): v is string =>
        typeof v === "string" && /^M\d+\/\d{2}_\d{2}_\d{4}$/.test(v),
    )
    .map((v) => ({ season: v.split("/")[0], date: date(v.split("/")[1]) }))
    .sort((a, b) => b.date.localeCompare(a.date));
  if (!folders.length) throw new Error("一覧にデータ日付がありません");
  const pokemon = r.pokemon
    .map(record)
    .filter(
      (p) =>
        typeof p.showdownId === "string" &&
        Array.isArray(p.battleDataCsvs) &&
        (p.battleDataCsvs as unknown[]).some(
          (v) => record(v).format === "Singles",
        ),
    )
    .map((p) => {
      const summary = record(
        record(record(record(p.summary).battleSummary).Current).Singles,
      );
      const rank = summary.position;
      return {
        id: normalizeId(String(p.showdownId)),
        name: String(p.showdownName ?? p.name ?? p.showdownId),
        rank: Number.isInteger(rank) && Number(rank) > 0 ? Number(rank) : null,
      };
    });
  if (!pokemon.length) throw new Error("シングルの一覧がありません");
  return {
    ...folders[0],
    pokemon: pokemon.sort(
      (a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity),
    ),
  };
}
export function usageCompatible(data: { season: string } | undefined) {
  return !!data && data.season === supportedSeason;
}
export function cacheIsDue(
  entry: { attemptDay: string } | undefined,
  now = new Date(),
) {
  return entry?.attemptDay !== japanDay(now);
}
const pending = new Map<string, Promise<CacheEntry<unknown>>>();
export interface CacheStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
const memory = new Map<string, CacheEntry<unknown>>();
function storage(): CacheStorage | undefined {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return undefined;
  }
}
export async function refreshResource<T>(
  key: string,
  url: string,
  parse: (v: unknown) => T,
  options: {
    force?: boolean;
    now?: Date;
    fetcher?: typeof fetch;
    storage?: CacheStorage;
    validateCache?: (value: unknown) => boolean;
  } = {},
): Promise<CacheEntry<T>> {
  const now = options.now ?? new Date(),
    store = options.storage ?? storage();
  let prior = memory.get(key) as CacheEntry<T> | undefined;
  try {
    const raw = store?.getItem(key);
    if (raw) {
      const x = JSON.parse(raw);
      if (
        typeof x.checkedAt === "string" &&
        typeof x.attemptDay === "string" &&
        (!x.data || !options.validateCache || options.validateCache(x.data))
      )
        prior = x;
    }
  } catch {
    /* In-memory fallback when persistent storage is unavailable. */
  }
  if (!options.force && !cacheIsDue(prior, now)) return prior!;
  if (pending.has(key)) return pending.get(key)! as Promise<CacheEntry<T>>;
  const task = (async () => {
    let next: CacheEntry<T>;
    try {
      const response = await (options.fetcher ?? fetch)(url, {
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = parse(await response.json());
      next = { data, checkedAt: now.toISOString(), attemptDay: japanDay(now) };
    } catch (e) {
      next = {
        ...prior,
        checkedAt: prior?.checkedAt ?? "",
        attemptDay: japanDay(now),
        error: `更新に失敗しました（${e instanceof Error ? e.message : "通信エラー"}）。${prior?.data ? "前回のデータを表示しています。" : "手動で再試行できます。"}`,
      };
    }
    memory.set(key, next);
    try {
      store?.setItem(key, JSON.stringify(next));
    } catch {
      next = {
        ...next,
        error: [
          next.error,
          "統計を端末に保存できません。今回はメモリー内で保持します。",
        ]
          .filter(Boolean)
          .join(" "),
      };
      memory.set(key, next);
    }
    return next;
  })();
  pending.set(key, task);
  try {
    return await task;
  } finally {
    pending.delete(key);
  }
}
export function validSnapshot(value: unknown, id: string) {
  try {
    const v = record(value);
    if (
      v.speciesId !== id ||
      typeof v.date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(v.date) ||
      !Array.isArray(v.rows)
    )
      return false;
    const [y, m, d] = v.date.split("-");
    const keys = [
      "hp_points",
      "attack_points",
      "defense_points",
      "sp_atk_points",
      "sp_def_points",
      "speed_points",
    ];
    parseUsage(
      {
        showdownId: id,
        format: "Singles",
        daily: [
          {
            season: v.season,
            date: `${d}_${m}_${y}`,
            rows: v.rows.map((x) => {
              const r = record(x);
              return {
                ...r,
                percentage_value: r.percent,
                ...(Array.isArray(r.points)
                  ? Object.fromEntries(
                      keys.map((k, i) => [k, (r.points as number[])[i]]),
                    )
                  : {}),
              };
            }),
          },
        ],
      },
      id,
    );
    return true;
  } catch {
    return false;
  }
}
export function validIndex(value: unknown) {
  const v = record(value);
  return (
    validIsoDate(v.date) &&
    typeof v.season === "string" &&
    /^M\d+$/.test(v.season) &&
    Array.isArray(v.pokemon) &&
    v.pokemon.length > 0 &&
    v.pokemon.every((x) => {
      const r = record(x);
      return (
        typeof r.id === "string" &&
        typeof r.name === "string" &&
        (r.rank === null || (Number.isInteger(r.rank) && Number(r.rank) > 0))
      );
    })
  );
}
function validIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(parsed.valueOf()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}
export const loadUsageIndex = (force = false) =>
  refreshResource(
    "battle-note-usage-index-v1",
    `${API_ORIGIN}/api`,
    parseIndex,
    { force, validateCache: validIndex },
  );
export const loadUsage = (id: string, force = false) =>
  refreshResource(
    `battle-note-usage-${id}-v1`,
    `${API_ORIGIN}/api/battle/Singles/${encodeURIComponent(id)}?days=1`,
    (v) => parseUsage(v, id),
    { force, validateCache: (v) => validSnapshot(v, id) },
  );
