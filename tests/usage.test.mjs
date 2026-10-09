import test from "node:test";
import assert from "node:assert/strict";
import {
  parseUsage,
  parseIndex,
  refreshResource,
  japanDay,
  validSnapshot,
  validIndex,
  usageCompatible,
} from "../src/usage.ts";
import * as usageApi from "../src/usage.ts";
const raw = {
  showdownId: "garchomp",
  format: "Singles",
  daily: [
    {
      season: "M6",
      date: "19_09_2026",
      rows: [
        { category: "move", rank: 1, name: "Earthquake", percentage_value: 80 },
        {
          category: "move",
          rank: 2,
          name: "Dragon Claw",
          percentage_value: 90,
        },
        {
          category: "stat_points",
          rank: 1,
          name: "",
          percentage_value: null,
          hp_points: 2,
          attack_points: 32,
          defense_points: 0,
          sp_atk_points: 0,
          sp_def_points: 0,
          speed_points: 32,
        },
      ],
    },
  ],
};
const parse = (v) => parseUsage(v, "garchomp");
function storage() {
  const map = new Map();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => map.set(k, v),
  };
}
test("source validation sorts adoption without inventing percentages and rejects malformed data", () => {
  const data = parse(raw);
  assert.equal(data.rows[0].name, "Dragon Claw");
  assert.equal(data.rows.at(-1).percent, null);
  assert.equal(data.date, "2026-09-19");
  assert.ok(validSnapshot(data, "garchomp"));
  assert.ok(!validSnapshot({ ...data, rows: null }, "garchomp"));
  for (const mutate of [
    (v) => (v.format = "Doubles"),
    (v) => (v.daily[0].date = "31_02_2026"),
    (v) => (v.daily[0].rows[0].percentage_value = 101),
    (v) => (v.daily[0].rows[2].hp_points = null),
  ]) {
    const v = structuredClone(raw);
    mutate(v);
    assert.throws(() => parse(v));
  }
  assert.ok(!usageCompatible({ season: "M7" }));
});
test("index reads rank separately from species stats and latest season", () => {
  const index = parseIndex({
    defaultSeason: "Current",
    seasons: ["Current", "M6", "M5", "M4"],
    dailyDataFolders: ["M6/19_09_2026", "M5/31_08_2026", "M6/18_09_2026"],
    pokemon: [
      {
        showdownId: "Garchomp",
        showdownName: "Garchomp",
        battleDataCsvs: [{ format: "Singles" }],
        summary: { battleSummary: { Current: { Singles: { position: 2 } } } },
      },
    ],
  });
  assert.deepEqual(index, {
    season: "M6",
    date: "2026-09-19",
    previousSeason: "M5",
    availableSeasons: ["M6", "M5", "M4"],
    pokemon: [{ id: "garchomp", name: "Garchomp", rank: 2 }],
  });
});
test("an explicit default season selects the next API-listed season as previous", () => {
  const index = parseIndex({
    defaultSeason: "M6",
    seasons: ["Current", "M7", "M6", "M5", "M4"],
    dailyDataFolders: ["M7/09_10_2026", "M6/30_09_2026", "M5/31_08_2026"],
    pokemon: [
      {
        showdownId: "garchomp",
        showdownName: "Garchomp",
        battleDataCsvs: [{ format: "Singles" }],
      },
    ],
  });
  assert.equal(index.season, "M6");
  assert.equal(index.previousSeason, "M5");
  assert.deepEqual(index.availableSeasons, ["M6", "M5", "M4"]);
});
test("usage accepts only the API index's current or immediately previous season", () => {
  const index = {
    season: "M7",
    previousSeason: "M6",
    availableSeasons: ["M7", "M6", "M5"],
  };
  assert.equal(usageCompatible({ season: "M7" }), false);
  assert.equal(usageCompatible({ season: "M7" }, index), true);
  assert.equal(usageCompatible({ season: "M6" }, index), true);
  assert.equal(usageCompatible({ season: "M5" }, index), false);
});
test("usage falls back one season for incomplete current data, caches, and retries current manually", async () => {
  const index = {
    data: {
      date: "2026-10-09",
      season: "M7",
      previousSeason: "M6",
      availableSeasons: ["M7", "M6", "M5"],
      pokemon: [{ id: "garchomp-fallback-test", name: "Garchomp", rank: 1 }],
    },
    checkedAt: "2026-10-09T00:00:00.000Z",
    attemptDay: "2026-10-09",
  };
  const makeSeason = (season, categories) => ({
    showdownId: "garchomp-fallback-test",
    format: "Singles",
    daily: [
      {
        season,
        date: "09_10_2026",
        rows: categories.map((category, rank) => ({
          category,
          rank: rank + 1,
          name: category === "stat_points" ? "" : `value-${category}`,
          percentage_value: category === "stat_points" ? null : 50,
          ...(category === "stat_points"
            ? {
                hp_points: 2,
                attack_points: 32,
                defense_points: 0,
                sp_atk_points: 0,
                sp_def_points: 0,
                speed_points: 32,
              }
            : {}),
        })),
      },
    ],
  });
  const required = [
    "move",
    "ability",
    "held_item",
    "stat_alignment",
    "stat_points",
  ];
  const store = storage();
  const seasons = [];
  let currentCalls = 0;
  const fetcher = async (url) => {
    const season = new URL(url).searchParams.get("season");
    seasons.push(season);
    if (season === "M7") {
      currentCalls++;
      return {
        ok: true,
        json: async () =>
          makeSeason(
            "M7",
            currentCalls === 1 ? required.slice(0, 3) : required,
          ),
      };
    }
    return { ok: true, json: async () => makeSeason("M6", required) };
  };
  const options = {
    index,
    fetcher,
    storage: store,
    now: new Date("2026-10-09T03:00:00.000Z"),
  };

  const fallback = await usageApi.loadUsage(
    "garchomp-fallback-test",
    false,
    options,
  );
  assert.equal(fallback.data?.season, "M6");
  assert.match(fallback.error, /M7/);
  assert.match(fallback.error, /M6/);
  assert.deepEqual(seasons, ["M7", "M6"]);

  const cached = await usageApi.loadUsage(
    "garchomp-fallback-test",
    false,
    options,
  );
  assert.equal(cached.data?.season, "M6");
  assert.deepEqual(seasons, ["M7", "M6"]);

  const retried = await usageApi.loadUsage(
    "garchomp-fallback-test",
    true,
    options,
  );
  assert.equal(retried.data?.season, "M7");
  assert.equal(retried.error, undefined);
  assert.deepEqual(seasons, ["M7", "M6", "M7"]);

  const nextDay = await usageApi.loadUsage("garchomp-fallback-test", false, {
    ...options,
    now: new Date("2026-10-10T03:00:00.000Z"),
  });
  assert.equal(nextDay.data?.season, "M7");
  assert.equal(nextDay.error, undefined);
  assert.deepEqual(seasons, ["M7", "M6", "M7", "M7"]);
});
test("a validated same-day v1 snapshot migrates under its indexed season", async () => {
  const id = "garchomp-legacy-cache-test";
  const index = {
    data: {
      date: "2026-10-09",
      season: "M7",
      previousSeason: "M6",
      availableSeasons: ["M7", "M6"],
      pokemon: [{ id, name: "Garchomp", rank: 1 }],
    },
    checkedAt: "2026-10-09T00:00:00.000Z",
    attemptDay: "2026-10-09",
  };
  const categories = [
    "move",
    "ability",
    "held_item",
    "stat_alignment",
    "stat_points",
  ];
  const legacy = {
    data: parseUsage(
      {
        ...raw,
        showdownId: id,
        daily: [
          {
            ...raw.daily[0],
            season: "M7",
            rows: categories.map((category, rank) => ({
              category,
              rank: rank + 1,
              name: category === "stat_points" ? "" : `value-${category}`,
              percentage_value: category === "stat_points" ? null : 50,
              ...(category === "stat_points"
                ? {
                    hp_points: 2,
                    attack_points: 32,
                    defense_points: 0,
                    sp_atk_points: 0,
                    sp_def_points: 0,
                    speed_points: 32,
                  }
                : {}),
            })),
          },
        ],
      },
      id,
    ),
    checkedAt: "2026-10-09T00:00:00.000Z",
    attemptDay: "2026-10-09",
  };
  const store = storage();
  store.setItem(`battle-note-usage-${id}-v1`, JSON.stringify(legacy));
  let calls = 0;
  const result = await usageApi.loadUsage(id, false, {
    index,
    storage: store,
    now: new Date("2026-10-09T03:00:00.000Z"),
    fetcher: async () => {
      calls++;
      throw Error("network should not be needed for today's v1 cache");
    },
  });

  assert.equal(result.data?.season, "M7");
  assert.equal(result.error, undefined);
  assert.equal(calls, 0);
  assert.ok(store.getItem(`battle-note-usage-${id}-M7-v2`));
});
test("an existing same-day v2 snapshot takes priority over a legacy v1 snapshot", async () => {
  const id = "garchomp-v2-priority-test";
  const index = {
    data: {
      date: "2026-10-09",
      season: "M7",
      previousSeason: "M6",
      availableSeasons: ["M7", "M6"],
      pokemon: [{ id, name: "Garchomp", rank: 1 }],
    },
    checkedAt: "2026-10-09T00:00:00.000Z",
    attemptDay: "2026-10-09",
  };
  const fullSnapshot = (moveName) =>
    parseUsage(
      {
        ...raw,
        showdownId: id,
        daily: [
          {
            ...raw.daily[0],
            season: "M7",
            rows: [
              {
                category: "move",
                rank: 1,
                name: moveName,
                percentage_value: 50,
              },
              {
                category: "ability",
                rank: 1,
                name: "Rough Skin",
                percentage_value: 50,
              },
              {
                category: "held_item",
                rank: 1,
                name: "Choice Band",
                percentage_value: 50,
              },
              {
                category: "stat_alignment",
                rank: 1,
                name: "Jolly",
                percentage_value: 50,
              },
              {
                category: "stat_points",
                rank: 1,
                name: "",
                percentage_value: null,
                hp_points: 2,
                attack_points: 32,
                defense_points: 0,
                sp_atk_points: 0,
                sp_def_points: 0,
                speed_points: 32,
              },
            ],
          },
        ],
      },
      id,
    );
  const store = storage();
  const v2 = {
    data: fullSnapshot("Earthquake"),
    checkedAt: "2026-10-09T01:00:00.000Z",
    attemptDay: "2026-10-09",
  };
  const v1 = {
    data: fullSnapshot("Dragon Claw"),
    checkedAt: "2026-10-09T00:30:00.000Z",
    attemptDay: "2026-10-09",
  };
  store.setItem(`battle-note-usage-${id}-M7-v2`, JSON.stringify(v2));
  store.setItem(`battle-note-usage-${id}-v1`, JSON.stringify(v1));

  const result = await usageApi.loadUsage(id, false, {
    index,
    storage: store,
    now: new Date("2026-10-09T03:00:00.000Z"),
    fetcher: async () => {
      throw Error("network should not be needed for today's v2 cache");
    },
  });

  assert.equal(
    result.data?.rows.find((row) => row.category === "move")?.name,
    "Earthquake",
  );
  assert.equal(
    JSON.parse(store.getItem(`battle-note-usage-${id}-M7-v2`)).data.rows.find(
      (row) => row.category === "move",
    ).name,
    "Earthquake",
  );
});
test("usage falls back from an empty-season HTTP 404", async () => {
  const id = "garchomp-404-fallback-test";
  const index = {
    data: {
      date: "2026-10-09",
      season: "M7",
      previousSeason: "M6",
      availableSeasons: ["M7", "M6"],
      pokemon: [{ id, name: "Garchomp", rank: 1 }],
    },
    checkedAt: "2026-10-09T00:00:00.000Z",
    attemptDay: "2026-10-09",
  };
  const seasons = [];
  const result = await usageApi.loadUsage(id, false, {
    index,
    storage: storage(),
    now: new Date("2026-10-09T03:00:00.000Z"),
    fetcher: async (url) => {
      const season = new URL(url).searchParams.get("season");
      seasons.push(season);
      if (season === "M7") return { ok: false, status: 404 };
      return {
        ok: true,
        json: async () => ({
          ...raw,
          showdownId: id,
          daily: [{ ...raw.daily[0], season: "M6" }],
        }),
      };
    },
  });
  assert.equal(result.data?.season, "M6");
  assert.match(result.error, /HTTP 404/);
  assert.match(result.error, /前シーズンM6/);
  assert.deepEqual(seasons, ["M7", "M6"]);
});
test("when both snapshots are partial, usage keeps the one with more categories", async () => {
  const id = "garchomp-partial-coverage-test";
  const index = {
    data: {
      date: "2026-10-09",
      season: "M7",
      previousSeason: "M6",
      availableSeasons: ["M7", "M6"],
      pokemon: [{ id, name: "Garchomp", rank: 1 }],
    },
    checkedAt: "2026-10-09T00:00:00.000Z",
    attemptDay: "2026-10-09",
  };
  const seasons = [];
  const snapshot = (season, categories) => ({
    showdownId: id,
    format: "Singles",
    daily: [
      {
        season,
        date: "09_10_2026",
        rows: categories.map((category, rank) => ({
          category,
          rank: rank + 1,
          name: `value-${category}`,
          percentage_value: 40,
        })),
      },
    ],
  });
  const result = await usageApi.loadUsage(id, false, {
    index,
    storage: storage(),
    now: new Date("2026-10-09T03:00:00.000Z"),
    fetcher: async (url) => {
      const season = new URL(url).searchParams.get("season");
      seasons.push(season);
      return {
        ok: true,
        json: async () =>
          snapshot(
            season,
            season === "M7"
              ? ["move", "ability", "held_item"]
              : ["move", "held_item"],
          ),
      };
    },
  });
  assert.equal(result.data?.season, "M7");
  assert.match(result.error, /性格/);
  assert.deepEqual(seasons, ["M7", "M6"]);
});
test("usage retains incomplete current data when the prior season is absent", async () => {
  const index = {
    data: {
      date: "2026-10-09",
      season: "M7",
      previousSeason: null,
      availableSeasons: ["M7"],
      pokemon: [{ id: "garchomp-no-prior-test", name: "Garchomp", rank: 1 }],
    },
    checkedAt: "2026-10-09T00:00:00.000Z",
    attemptDay: "2026-10-09",
  };
  const entry = await usageApi.loadUsage("garchomp-no-prior-test", false, {
    index,
    now: new Date("2026-10-09T03:00:00.000Z"),
    storage: storage(),
    fetcher: async (url) => ({
      ok: true,
      json: async () => ({
        ...raw,
        showdownId: "garchomp-no-prior-test",
        daily: [
          {
            ...raw.daily[0],
            season: "M7",
            rows: raw.daily[0].rows,
          },
        ],
      }),
    }),
  });
  assert.equal(entry.data?.season, "M7");
  assert.match(entry.error, /前シーズンのデータは一覧にありません/);
  assert.match(entry.error, /性格/);
});
test("usage rejects a mismatched response and stops after the indexed previous season", async () => {
  const index = {
    data: {
      date: "2026-10-09",
      season: "M7",
      previousSeason: "M6",
      availableSeasons: ["M7", "M6", "M5"],
      pokemon: [{ id: "garchomp-mismatch-test", name: "Garchomp", rank: 1 }],
    },
    checkedAt: "2026-10-09T00:00:00.000Z",
    attemptDay: "2026-10-09",
  };
  const seasons = [];
  const entry = await usageApi.loadUsage("garchomp-mismatch-test", false, {
    index,
    now: new Date("2026-10-09T03:00:00.000Z"),
    storage: storage(),
    fetcher: async (url) => {
      const requested = new URL(url).searchParams.get("season");
      seasons.push(requested);
      return {
        ok: true,
        json: async () => ({
          ...raw,
          showdownId: "garchomp-mismatch-test",
          daily: [
            {
              ...raw.daily[0],
              season: requested === "M7" ? "M6" : "M5",
            },
          ],
        }),
      };
    },
  });
  assert.equal(entry.data, undefined);
  assert.deepEqual(seasons, ["M7", "M6"]);
  assert.match(entry.error, /シーズンが指定と一致しません/);
});
test("index cache rejects impossible dates and malformed season identifiers", () => {
  const index = parseIndex({
    dailyDataFolders: ["M6/19_09_2026"],
    pokemon: [
      {
        showdownId: "Garchomp",
        showdownName: "Garchomp",
        battleDataCsvs: [{ format: "Singles" }],
      },
    ],
  });
  assert.equal(validIndex(index), true);
  assert.equal(validIndex({ ...index, date: "2026-02-30" }), false);
  assert.equal(validIndex({ ...index, season: "season-six" }), false);
  assert.equal(validIndex({ ...index, season: "M7" }), false);
  assert.equal(
    validIndex({
      ...index,
      season: "M7",
      previousSeason: "M6",
      availableSeasons: ["M7", "M6"],
    }),
    true,
  );
  assert.equal(usageCompatible({ season: "M7" }), false);
});
test("an invalid index cache is fetched again even on the same Japan day", async () => {
  const store = storage();
  store.setItem(
    "bad-index-cache",
    JSON.stringify({
      data: {
        date: "2026-02-30",
        season: "M6",
        pokemon: [{ id: "garchomp", name: "Garchomp", rank: 1 }],
      },
      checkedAt: "old",
      attemptDay: "2026-09-24",
    }),
  );
  let calls = 0;
  const now = new Date("2026-09-24T03:00:00.000Z");
  const entry = await refreshResource(
    "bad-index-cache",
    "https://example.test",
    parseIndex,
    {
      storage: store,
      now,
      validateCache: validIndex,
      fetcher: async () => {
        calls++;
        return {
          ok: true,
          json: async () => ({
            dailyDataFolders: ["M6/19_09_2026"],
            pokemon: [
              {
                showdownId: "garchomp",
                showdownName: "Garchomp",
                battleDataCsvs: [{ format: "Singles" }],
              },
            ],
          }),
        };
      },
    },
  );
  assert.equal(calls, 1);
  assert.equal(entry.data?.date, "2026-09-19");
});
test("JST boundary, daily cache, failure fallback and manual retry preserve successful date", async () => {
  const store = storage();
  let calls = 0;
  let fail = false;
  const fetcher = async () => {
    calls++;
    if (fail) throw Error("offline");
    return { ok: true, json: async () => raw };
  };
  const before = new Date("2026-09-19T14:59:00Z"),
    after = new Date("2026-09-19T15:01:00Z");
  assert.equal(japanDay(after), "2026-09-20");
  const first = await refreshResource(
    "daily-test",
    "https://example.test",
    parse,
    { storage: store, fetcher, now: before },
  );
  await refreshResource("daily-test", "https://example.test", parse, {
    storage: store,
    fetcher,
    now: before,
  });
  assert.equal(calls, 1);
  fail = true;
  const stale = await refreshResource(
    "daily-test",
    "https://example.test",
    parse,
    { storage: store, fetcher, now: after },
  );
  assert.deepEqual(stale.data, first.data);
  assert.equal(stale.checkedAt, first.checkedAt);
  assert.match(stale.error, /前回/);
  await refreshResource("daily-test", "https://example.test", parse, {
    storage: store,
    fetcher,
    now: after,
  });
  assert.equal(calls, 2);
  fail = false;
  const renewed = await refreshResource(
    "daily-test",
    "https://example.test",
    parse,
    { storage: store, fetcher, now: after, force: true },
  );
  assert.equal(calls, 3);
  assert.equal(renewed.error, undefined);
});
test("concurrent fetch deduplication and unusable persistent cache", async () => {
  const store = storage();
  store.setItem(
    "corrupt-test",
    JSON.stringify({
      attemptDay: japanDay(),
      checkedAt: "today",
      data: { bad: true },
    }),
  );
  let calls = 0;
  const options = {
    storage: store,
    validateCache: (v) => validSnapshot(v, "garchomp"),
    fetcher: async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 5));
      return { ok: true, json: async () => raw };
    },
  };
  const [a, b] = await Promise.all([
    refreshResource("corrupt-test", "https://example.test", parse, options),
    refreshResource("corrupt-test", "https://example.test", parse, options),
  ]);
  assert.equal(calls, 1);
  assert.deepEqual(a, b);
  const badStore = {
    getItem() {
      throw Error("disabled");
    },
    setItem() {
      throw Error("full");
    },
  };
  const entry = await refreshResource(
    "memory-test",
    "https://example.test",
    parse,
    { storage: badStore, fetcher: options.fetcher },
  );
  assert.ok(entry.data);
  assert.match(entry.error, /保存できません/);
});
