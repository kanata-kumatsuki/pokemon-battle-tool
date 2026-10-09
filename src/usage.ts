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
  previousSeason: string | null;
  availableSeasons: string[];
  pokemon: { id: string; name: string; rank: number | null }[];
};
export type UsageSeasonContext = {
  season: string;
  previousSeason: string | null;
  availableSeasons: string[];
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
  const folderSeasons = [...new Set(folders.map((folder) => folder.season))];
  const declaredSeasons = Array.isArray(r.seasons)
    ? [
        ...new Set(
          r.seasons.filter(
            (season): season is string =>
              typeof season === "string" && /^M\d+$/.test(season),
          ),
        ),
      ]
    : [];
  const seasonOrder = declaredSeasons.length ? declaredSeasons : folderSeasons;
  const defaultSeason =
    typeof r.defaultSeason === "string" && /^M\d+$/.test(r.defaultSeason)
      ? r.defaultSeason
      : undefined;
  const season = defaultSeason ?? seasonOrder[0] ?? folders[0].season;
  const seasonIndex = seasonOrder.indexOf(season);
  if (seasonIndex < 0)
    throw new Error("一覧の既定シーズンがシーズン一覧にありません");
  const availableSeasons = seasonOrder.slice(seasonIndex);
  const previousSeason = availableSeasons[1] ?? null;
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
    season,
    date: (folders.find((folder) => folder.season === season) ?? folders[0])
      .date,
    previousSeason,
    availableSeasons,
    pokemon: pokemon.sort(
      (a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity),
    ),
  };
}
export function usageCompatible(
  data: { season: string } | undefined,
  context?: UsageSeasonContext,
) {
  if (!data || !/^M\d+$/.test(data.season)) return false;
  if (!context) return data.season === supportedSeason;
  if (!/^M\d+$/.test(context.season)) return false;
  if (
    !Array.isArray(context.availableSeasons) ||
    context.availableSeasons[0] !== context.season ||
    context.availableSeasons[1] !== (context.previousSeason ?? undefined) ||
    new Set(context.availableSeasons).size !==
      context.availableSeasons.length ||
    !context.availableSeasons.every((season) => /^M\d+$/.test(season))
  )
    return false;
  return (
    data.season === context.season ||
    (context.previousSeason !== null && data.season === context.previousSeason)
  );
}
export const usageCategories = [
  "move",
  "ability",
  "held_item",
  "stat_alignment",
  "stat_points",
] as const;
export const usageCategoryLabels: Record<
  (typeof usageCategories)[number],
  string
> = {
  move: "わざ",
  ability: "特性",
  held_item: "もちもの",
  stat_alignment: "性格",
  stat_points: "能力配分",
};
export function missingUsageCategories(data: UsageSnapshot) {
  return usageCategories.filter(
    (category) => !data.rows.some((row) => row.category === category),
  );
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
      typeof v.season !== "string" ||
      !/^M\d+$/.test(v.season) ||
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
    Array.isArray(v.availableSeasons) &&
    v.availableSeasons.length > 0 &&
    v.availableSeasons[0] === v.season &&
    v.availableSeasons.every(
      (season: unknown) => typeof season === "string" && /^M\d+$/.test(season),
    ) &&
    new Set(v.availableSeasons).size === v.availableSeasons.length &&
    (v.previousSeason === null ||
      (typeof v.previousSeason === "string" &&
        /^M\d+$/.test(v.previousSeason) &&
        v.previousSeason === v.availableSeasons[1])) &&
    (v.previousSeason === null ? v.availableSeasons.length === 1 : true) &&
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
type RefreshOptions = {
  now?: Date;
  fetcher?: typeof fetch;
  storage?: CacheStorage;
};

export const loadUsageIndex = (force = false, options: RefreshOptions = {}) =>
  refreshResource(
    "battle-note-usage-index-v1",
    `${API_ORIGIN}/api`,
    parseIndex,
    { ...options, force, validateCache: validIndex },
  );
type UsageLoadOptions = RefreshOptions & {
  index?: CacheEntry<UsageIndex>;
};

function parseUsageForSeason(value: unknown, id: string, season: string) {
  const snapshot = parseUsage(value, id);
  if (snapshot.season !== season)
    throw new Error("提供元のシーズンが指定と一致しません");
  return snapshot;
}

function seasonIssue(entry: CacheEntry<UsageSnapshot>, missing: string[]) {
  if (!entry.data) return entry.error ?? "統計データがありません。";
  if (missing.length)
    return `不足項目：${missing
      .map(
        (category) =>
          usageCategoryLabels[category as keyof typeof usageCategoryLabels],
      )
      .join("、")}。`;
  return entry.error ?? "";
}

function cachedSeasonEntry(value: unknown, id: string, season: string) {
  const cached = record(value);
  if (
    typeof cached.checkedAt !== "string" ||
    typeof cached.attemptDay !== "string" ||
    (cached.data !== undefined &&
      (!validSnapshot(cached.data, id) ||
        record(cached.data).season !== season))
  )
    return undefined;
  return cached as CacheEntry<UsageSnapshot>;
}

export async function loadUsage(
  id: string,
  force = false,
  options: UsageLoadOptions = {},
): Promise<CacheEntry<UsageSnapshot>> {
  const now = options.now ?? new Date();
  const indexEntry = options.index ?? (await loadUsageIndex(force, options));
  const index = indexEntry.data;
  if (!index || !validIndex(index))
    return {
      checkedAt: "",
      attemptDay: japanDay(now),
      error:
        indexEntry.error ??
        "利用できるシーズン情報がありません。手動で再試行できます。",
    };

  const loadSeason = (season: string) => {
    const key = `battle-note-usage-${id}-${season}-v2`;
    const store = options.storage ?? storage();
    let existing = cachedSeasonEntry(memory.get(key), id, season);
    if (!existing) {
      try {
        const raw = store?.getItem(key);
        if (raw) existing = cachedSeasonEntry(JSON.parse(raw), id, season);
      } catch {
        /* Ignore an invalid current cache and fetch the indexed season. */
      }
    }
    if (existing) {
      memory.set(key, existing);
    } else {
      let legacy: unknown = memory.get(`battle-note-usage-${id}-v1`);
      try {
        const raw = store?.getItem(`battle-note-usage-${id}-v1`);
        if (raw) legacy = JSON.parse(raw);
      } catch {
        /* Ignore an invalid legacy cache and fetch the indexed season. */
      }
      const cached = cachedSeasonEntry(legacy, id, season);
      if (cached?.data) {
        memory.set(key, cached);
        try {
          store?.setItem(key, JSON.stringify(cached));
        } catch {
          /* Keep the migrated entry in memory when storage is unavailable. */
        }
      }
    }
    return refreshResource<UsageSnapshot>(
      key,
      `${API_ORIGIN}/api/battle/Singles/${encodeURIComponent(id)}?season=${encodeURIComponent(season)}&days=1`,
      (value) => parseUsageForSeason(value, id, season),
      {
        ...options,
        now,
        force,
        validateCache: (value) =>
          validSnapshot(value, id) && record(value).season === season,
      },
    );
  };

  const current = await loadSeason(index.season);
  const currentMissing = current.data
    ? missingUsageCategories(current.data)
    : [...usageCategories];
  if (current.data && !currentMissing.length) return current;

  const previous = index.previousSeason
    ? await loadSeason(index.previousSeason)
    : undefined;
  const previousMissing = previous?.data
    ? missingUsageCategories(previous.data)
    : [...usageCategories];
  const currentCoverage = usageCategories.length - currentMissing.length;
  const previousCoverage = usageCategories.length - previousMissing.length;
  const usePrevious =
    !!previous?.data && (!current.data || previousCoverage > currentCoverage);
  const selected = usePrevious ? previous! : current;
  const selectedMissing = usePrevious ? previousMissing : currentMissing;
  const reason = seasonIssue(current, currentMissing);
  if (!selected.data)
    return {
      ...current,
      error: [
        reason,
        index.previousSeason && previous?.error
          ? `前シーズン${index.previousSeason}も取得できませんでした: ${previous.error}`
          : "",
      ]
        .filter(Boolean)
        .join(" "),
    };

  const fallbackNote = usePrevious
    ? `今シーズン${index.season}の統計が不足しているため、前シーズン${index.previousSeason}を表示中です。`
    : `今シーズン${index.season}の統計に不足があります。`;
  const previousAvailability = index.previousSeason
    ? ""
    : "前シーズンのデータは一覧にありません。";
  const partialNote = selectedMissing.length
    ? `不足項目：${selectedMissing
        .map(
          (category) =>
            usageCategoryLabels[category as keyof typeof usageCategoryLabels],
        )
        .join("、")}。`
    : "";
  const selectedUpdateIssue = selected.error
    ? "表示中のシーズンの更新に失敗し、保存済みデータを表示しています。"
    : "";
  return {
    ...selected,
    attemptDay: current.attemptDay,
    error: [
      fallbackNote,
      !current.data ? reason : "",
      previousAvailability,
      partialNote,
      selectedUpdateIssue,
    ]
      .filter(Boolean)
      .join(" "),
  };
}
