import test from "node:test";
import assert from "node:assert/strict";
import {
  initialData,
  getPokemon,
  japaneseItem,
  makeBuild,
  pokemon,
  pokemonAppearance,
} from "../src/data.ts";
import { DefaultBuildSelectionGate } from "../src/build-defaults.ts";
import {
  canApplyStarterParty,
  resolveStarterPartySelection,
  selectStarterParty,
} from "../src/starter-party.ts";
import { partySaveErrors } from "../src/party-validation.ts";

const makeIndex = (candidates) => ({
  date: "2026-10-09",
  season: "M7",
  previousSeason: "M6",
  availableSeasons: ["M7", "M6"],
  pokemon: candidates,
});

const snapshot = (speciesId, rows = []) => ({
  data: { speciesId, season: "M7", date: "2026-10-09", rows },
  checkedAt: "2026-10-09T00:00:00.000Z",
  attemptDay: "2026-10-09",
});

const pokemonRow = (speciesId, rank, name = speciesId) => ({
  id: speciesId,
  name,
  rank,
});

const moveRow = {
  category: "move",
  name: "Earthquake",
  rank: 1,
  percent: 80,
};

test("starter selection uses ranked local Pokemon, skips unknown ranks and duplicates", async () => {
  const ids = [
    "garchomp",
    "dragonite",
    "gholdengo",
    "rotomwash",
    "mimikyu",
    "corviknight",
  ];
  const candidates = ids
    .map((id, index) => pokemonRow(id, index + 1))
    .reverse();
  candidates.push(
    pokemonRow("garchomp", 1, "duplicate"),
    pokemonRow("unregistered", 2),
    pokemonRow("pikachu", null),
  );
  const requested = [];
  const result = await selectStarterParty(makeIndex(candidates), async (id) => {
    requested.push(id);
    return { checkedAt: "", attemptDay: "" };
  });

  assert.equal(result.ok, true);
  assert.deepEqual(
    result.picks.map(({ id }) => getPokemon(id).speciesId),
    ids,
  );
  assert.deepEqual(
    result.picks.map(({ rank }) => rank),
    [1, 2, 3, 4, 5, 6],
  );
  assert.deepEqual(requested, ids);
  assert.equal(result.party.members.length, 6);
  assert.deepEqual(partySaveErrors([result.party], [0]), []);
});

test("direct Mega and ordinary Mega Stone builds share a two-Mega cap", async () => {
  const rankRows = [
    pokemonRow("charizardmegax", 1, "Mega Charizard X"),
    pokemonRow("garchomp", 2, "Garchomp"),
    pokemonRow("venusaurmega", 3, "Mega Venusaur"),
    pokemonRow("blastoise", 4, "Blastoise"),
    pokemonRow("gholdengo", 5, "Gholdengo"),
    pokemonRow("mimikyu", 6, "Mimikyu"),
    pokemonRow("dragonite", 7, "Dragonite"),
    pokemonRow("rotomwash", 8, "Rotom-Wash"),
  ];
  const usage = {
    charizard: [
      { category: "held_item", name: "Charizardite X", rank: 1, percent: 90 },
    ],
    garchomp: [
      { category: "held_item", name: "Garchompite Z", rank: 1, percent: 90 },
    ],
    blastoise: [
      { category: "held_item", name: "Blastoisinite", rank: 1, percent: 90 },
    ],
    gholdengo: [
      { category: "held_item", name: "Leftovers", rank: 1, percent: 90 },
      moveRow,
    ],
    mimikyu: [
      { category: "held_item", name: "Leftovers", rank: 1, percent: 90 },
      moveRow,
    ],
    dragonite: [
      { category: "held_item", name: "Leftovers", rank: 1, percent: 90 },
      moveRow,
    ],
    rotomwash: [
      { category: "held_item", name: "Leftovers", rank: 1, percent: 90 },
      moveRow,
    ],
  };
  const requests = [];
  const result = await selectStarterParty(makeIndex(rankRows), async (id) => {
    requests.push(id);
    return snapshot(id, usage[id] ?? []);
  });

  assert.equal(result.ok, true);
  assert.deepEqual(
    result.picks.map(({ rank }) => rank),
    [1, 2, 5, 6, 7, 8],
  );
  assert.equal(result.picks.filter(({ mega }) => mega).length, 2);
  assert.equal(result.picks[0].megaSource, "direct");
  assert.equal(result.picks[1].megaSource, "stone");
  assert.equal(result.picks[1].item, japaneseItem("Garchompite Z"));
  assert.equal(
    pokemonAppearance(result.picks[1].id, result.picks[1].item).mega,
    true,
  );
  assert.deepEqual(
    result.skippedMegas.map(({ rank, megaSource, item }) => ({
      rank,
      megaSource,
      item,
    })),
    [
      { rank: 3, megaSource: "direct", item: "もちものなし" },
      { rank: 4, megaSource: "stone", item: japaneseItem("Blastoisinite") },
    ],
  );
  assert.ok(!requests.includes("venusaur"));
  assert.deepEqual(partySaveErrors([result.party], [0]), []);
  assert.equal(result.party.members[3].item, "もちものなし");
});

test("missing detail uses a non-Mega default, while missing ranks never become top candidates", async () => {
  const known = pokemon
    .filter((entry) => !entry.mega)
    .slice(0, 6)
    .map((entry, index) => pokemonRow(entry.speciesId, index + 1));
  const result = await selectStarterParty(makeIndex(known), async () => {
    throw new Error("temporary detail failure");
  });

  assert.equal(result.ok, true);
  assert.ok(result.picks.every((pick) => !pick.mega));

  const withoutRanks = await selectStarterParty(
    makeIndex(known.map((row) => ({ ...row, rank: null }))),
    async () => ({ checkedAt: "", attemptDay: "" }),
  );
  assert.deepEqual(withoutRanks, {
    ok: false,
    reason: "insufficient-ranked-pokemon",
    selected: 0,
  });
});

test("insufficient ranked candidates leave the caller with no partial party", async () => {
  const megaIds = ["charizardmegax", "venusaurmega", "garchompmega"];
  const result = await selectStarterParty(
    makeIndex(megaIds.map((id, index) => pokemonRow(id, index + 1))),
    async () => ({ checkedAt: "", attemptDay: "" }),
  );

  assert.deepEqual(result, {
    ok: false,
    reason: "insufficient-ranked-pokemon",
    selected: 2,
  });
});

test("starter result is discarded after a user cancels while detail data is loading", async () => {
  const gate = new DefaultBuildSelectionGate();
  const ticket = gate.begin("starter:party");
  let resolveDetail;
  const requested = [];
  const pending = resolveStarterPartySelection(
    gate,
    ticket,
    async () => ({
      data: makeIndex([
        pokemonRow("garchomp", 1),
        pokemonRow("dragonite", 2),
        pokemonRow("gholdengo", 3),
        pokemonRow("rotomwash", 4),
        pokemonRow("mimikyu", 5),
        pokemonRow("corviknight", 6),
      ]),
      checkedAt: "2026-10-09T00:00:00.000Z",
      attemptDay: "2026-10-09",
    }),
    async (id) => {
      requested.push(id);
      return await new Promise((resolve) => {
        resolveDetail = resolve;
      });
    },
  );
  await new Promise((resolve) => setImmediate(resolve));
  gate.cancel("starter:party");
  resolveDetail({ checkedAt: "", attemptDay: "" });

  assert.equal(await pending, undefined);
  assert.deepEqual(requested, ["garchomp"]);
});

test("starter application requires an absent saved key and an untouched initial party", () => {
  const initial = initialData().parties[0];
  const base = {
    firstUse: true,
    storageValue: null,
    userEdited: false,
    draft: structuredClone(initial),
    initial,
  };

  assert.equal(canApplyStarterParty(base), true);
  assert.equal(canApplyStarterParty({ ...base, firstUse: false }), false);
  assert.equal(canApplyStarterParty({ ...base, storageValue: "{}" }), false);
  assert.equal(canApplyStarterParty({ ...base, userEdited: true }), false);
  assert.equal(
    canApplyStarterParty({
      ...base,
      draft: { ...base.draft, name: "編集中" },
    }),
    false,
  );
});

test("invalid index and absent rank data report safe fallback reasons", async () => {
  assert.deepEqual(
    await selectStarterParty(undefined, async () => snapshot("x")),
    {
      ok: false,
      reason: "invalid-ranking",
      selected: 0,
    },
  );

  const gate = new DefaultBuildSelectionGate();
  const ticket = gate.begin("starter:party");
  assert.deepEqual(
    await resolveStarterPartySelection(
      gate,
      ticket,
      async () => ({ checkedAt: "", attemptDay: "" }),
      async () => snapshot("garchomp"),
    ),
    { ok: false, reason: "invalid-ranking", selected: 0 },
  );
});

test("starter candidates are selected only once per base Mega species", async () => {
  const result = await selectStarterParty(
    makeIndex([
      pokemonRow("charizardmegax", 1),
      pokemonRow("charizardmegay", 2),
      pokemonRow("garchomp", 3),
      pokemonRow("dragonite", 4),
      pokemonRow("gholdengo", 5),
      pokemonRow("rotomwash", 6),
      pokemonRow("mimikyu", 7),
    ]),
    async (id) => snapshot(id, []),
  );

  assert.equal(result.ok, true);
  assert.deepEqual(
    result.picks.map(({ rank }) => rank),
    [1, 3, 4, 5, 6, 7],
  );
  assert.deepEqual(
    result.party.members[1],
    makeBuild(result.party.members[1].pokemonId),
  );
});
