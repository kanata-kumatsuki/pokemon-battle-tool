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
    dailyDataFolders: ["M5/31_08_2026", "M6/19_09_2026"],
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
    pokemon: [{ id: "garchomp", name: "Garchomp", rank: 2 }],
  });
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
  assert.equal(validIndex({ ...index, season: "M7" }), true);
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
