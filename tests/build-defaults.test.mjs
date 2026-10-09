import test from "node:test";
import assert from "node:assert/strict";
import {
  getPokemon,
  itemsForPokemon,
  itemCatalog,
  japaneseAbility,
  japaneseItem,
  learnableMoves,
  makeBuild,
  pokemonAppearance,
  pokemon,
  usageSourcePokemon,
} from "../src/data.ts";
import {
  DefaultBuildSelectionGate,
  popularBuild,
  resolvePopularBuildSelection,
} from "../src/build-defaults.ts";

const validUsage = (speciesId, rows, season = "M6") => ({
  speciesId,
  season,
  date: "2026-09-24",
  rows,
});
const loadM6Index = async () => ({
  data: {
    date: "2026-09-24",
    season: "M6",
    pokemon: [{ id: "gholdengo", name: "Gholdengo", rank: 1 }],
  },
  checkedAt: "2026-09-24T00:00:00.000Z",
  attemptDay: "2026-09-24",
});

test("popular build picks legal independent category leaders by rate, not row order", () => {
  const p = getPokemon(1000);
  const legalMoves = learnableMoves(p).map(([name]) => name);
  const rows = [
    { category: "ability", name: "Levitate", rank: 1, percent: 99 },
    { category: "ability", name: "Good as Gold", rank: 2, percent: 80 },
    { category: "held_item", name: "Choice Specs", rank: 1, percent: 99 },
    { category: "held_item", name: "Leftovers", rank: 2, percent: 80 },
    { category: "stat_alignment", name: "Modest", rank: 2, percent: 40 },
    { category: "stat_alignment", name: "Timid", rank: 1, percent: 90 },
    {
      category: "stat_points",
      name: "",
      rank: 2,
      percent: 40,
      points: [0, 0, 4, 32, 0, 30],
    },
    {
      category: "stat_points",
      name: "",
      rank: 1,
      percent: 90,
      points: [2, 0, 0, 32, 0, 32],
    },
    { category: "move", name: "Earthquake", rank: 1, percent: 99 },
    { category: "move", name: "Thunderbolt", rank: 5, percent: 60 },
    { category: "move", name: "Recover", rank: 4, percent: 70 },
    { category: "move", name: "Make It Rain", rank: 3, percent: 80 },
    { category: "move", name: "Shadow Ball", rank: 2, percent: 90 },
    { category: "move", name: "Future Move", rank: 6, percent: 100 },
  ];
  const result = popularBuild(1000, validUsage(p.speciesId, rows));

  assert.equal(result.source, "usage");
  assert.equal(result.build.ability, japaneseAbility("Good as Gold"));
  assert.equal(result.build.item, japaneseItem("Leftovers"));
  assert.equal(result.build.nature, "おくびょう");
  assert.deepEqual(result.build.points, [2, 0, 0, 32, 0, 32]);
  assert.deepEqual(result.build.moves, [
    legalMoves.find((name) => name === "シャドーボール"),
    legalMoves.find((name) => name === "ゴールドラッシュ"),
    legalMoves.find((name) => name === "じこさいせい"),
    legalMoves.find((name) => name === "１０まんボルト"),
  ]);
  assert.deepEqual(result.applied, {
    ability: true,
    item: true,
    nature: true,
    points: true,
    moves: 4,
  });
  assert.equal(result.order, "rate");
});

test("missing percentages use usage rank and malformed or illegal categories keep initial values", () => {
  const p = getPokemon(445);
  const baseline = makeBuild(p.id);
  const result = popularBuild(
    p.id,
    validUsage(p.speciesId, [
      { category: "move", name: "Earthquake", rank: 2, percent: null },
      { category: "move", name: "Dragon Claw", rank: 1, percent: null },
      {
        category: "ability",
        name: "Not a Garchomp ability",
        rank: 1,
        percent: null,
      },
    ]),
  );

  assert.equal(result.build.ability, baseline.ability);
  assert.deepEqual(result.build.points, baseline.points);
  assert.deepEqual(result.build.moves, ["ドラゴンクロー", "じしん"]);
  assert.equal(result.order, "rank");
});

test("known fields retain the observed same-species values through default application", () => {
  const p = getPokemon(1000);
  const observed = {
    ...makeBuild(p.id),
    ability: p.abilities[0],
    item: "こだわりスカーフ",
    nature: "ずぶとい",
    points: [32, 0, 32, 0, 2, 0],
  };
  const result = popularBuild(
    p.id,
    validUsage(p.speciesId, [
      { category: "ability", name: "Good as Gold", rank: 1, percent: 99 },
      { category: "held_item", name: "Leftovers", rank: 1, percent: 99 },
      { category: "stat_alignment", name: "Timid", rank: 1, percent: 99 },
      {
        category: "stat_points",
        name: "",
        rank: 1,
        percent: 99,
        points: [2, 0, 0, 32, 0, 32],
      },
      { category: "move", name: "Shadow Ball", rank: 1, percent: 99 },
    ]),
    { ability: true, item: true, nature: true, points: true },
    observed,
  );

  assert.equal(result.build.ability, observed.ability);
  assert.equal(result.build.item, observed.item);
  assert.equal(result.build.nature, observed.nature);
  assert.deepEqual(result.build.points, observed.points);
  assert.deepEqual(result.build.moves, ["シャドーボール"]);
  assert.deepEqual(result.applied, {
    ability: false,
    item: false,
    nature: false,
    points: false,
    moves: 1,
  });
});

test("exact species and supported season are required, with the usual initial build as fallback", () => {
  const base = getPokemon(6);
  const mega = pokemon.find((p) => p.speciesId === "charizardmegax");
  assert.ok(mega);
  const baseBuild = makeBuild(base.id);
  const wrongForm = popularBuild(
    mega.id,
    validUsage(mega.speciesId, [
      { category: "ability", name: "Blaze", rank: 1, percent: 90 },
    ]),
  );
  assert.equal(wrongForm.source, "usual");
  assert.equal(wrongForm.reason, "species");
  assert.deepEqual(wrongForm.build, makeBuild(mega.id));

  const nextSeason = popularBuild(
    base.id,
    validUsage(base.speciesId, [], "M7"),
  );
  assert.equal(nextSeason.source, "usual");
  assert.equal(nextSeason.reason, "season");
  assert.deepEqual(nextSeason.build, baseBuild);
});

test("a Mega-form snapshot is not mistaken for its pre-Mega source", () => {
  const mega = pokemon.find((p) => p.speciesId === "charizardmegax");
  assert.ok(mega);
  const result = popularBuild(
    mega.id,
    validUsage(mega.speciesId, [
      { category: "ability", name: "Tough Claws", rank: 1, percent: 90 },
      { category: "held_item", name: "Charizardite X", rank: 1, percent: 99 },
      { category: "move", name: "Dragon Claw", rank: 1, percent: 90 },
    ]),
  );

  assert.equal(result.source, "usual");
  assert.equal(result.reason, "species");
  assert.equal(result.build.ability, mega.abilities[0]);
  assert.equal(result.build.item, "もちものなし");
  assert.deepEqual(result.build, makeBuild(mega.id));
  assert.deepEqual(itemsForPokemon(mega), ["もちものなし"]);
});

test("each Mega usage source is an explicit, unique Mega Stone base form", () => {
  for (const mega of pokemon.filter((p) => p.mega)) {
    const sources = new Set(
      Object.values(itemCatalog)
        .flatMap((item) => Object.entries(item.megaStone ?? {}))
        .filter(([, megaName]) => megaName === mega.calcName)
        .map(
          ([baseName]) =>
            pokemon.find((p) => !p.mega && p.calcName === baseName)?.id,
        )
        .filter((id) => id !== undefined),
    );
    assert.equal(sources.size, 1, `${mega.name} must have one explicit base`);
    const source = usageSourcePokemon(mega.id);
    assert.ok(source);
    assert.equal(source.id, [...sources][0]);
    assert.equal(source.mega, false);
  }

  const charizard = getPokemon(6);
  const charizardX = pokemon.find((p) => p.speciesId === "charizardmegax");
  const charizardY = pokemon.find((p) => p.speciesId === "charizardmegay");
  const garchompMega = pokemon.find((p) => p.speciesId === "garchompmega");
  const garchompMegaZ = pokemon.find((p) => p.speciesId === "garchompmegaz");
  assert.ok(charizardX && charizardY && garchompMega && garchompMegaZ);
  assert.equal(usageSourcePokemon(charizardX.id).id, charizard.id);
  assert.equal(usageSourcePokemon(charizardY.id).id, charizard.id);
  assert.equal(usageSourcePokemon(garchompMega.id).id, 445);
  assert.equal(usageSourcePokemon(garchompMegaZ.id).id, 445);
});

test("Charizard X and Y filter the same base rows against their own Mega abilities", () => {
  const charizard = getPokemon(6);
  const rows = [
    { category: "ability", name: "Tough Claws", rank: 1, percent: 80 },
    { category: "ability", name: "Drought", rank: 2, percent: 60 },
    { category: "held_item", name: "Charizardite X", rank: 1, percent: 99 },
    { category: "held_item", name: "Charizardite Y", rank: 2, percent: 90 },
    { category: "move", name: "Flamethrower", rank: 1, percent: 80 },
  ];
  const usage = validUsage(charizard.speciesId, rows);
  const charizardX = pokemon.find((p) => p.speciesId === "charizardmegax");
  const charizardY = pokemon.find((p) => p.speciesId === "charizardmegay");
  assert.ok(charizardX && charizardY);

  const resultX = popularBuild(charizardX.id, usage);
  const resultY = popularBuild(charizardY.id, usage);
  assert.equal(resultX.source, "usage");
  assert.equal(resultX.build.ability, japaneseAbility("Tough Claws"));
  assert.equal(resultY.build.ability, japaneseAbility("Drought"));
  assert.equal(resultX.build.item, "もちものなし");
  assert.equal(resultY.build.item, "もちものなし");
  assert.deepEqual(resultX.build.moves, ["かえんほうしゃ"]);
  assert.deepEqual(resultY.build.moves, ["かえんほうしゃ"]);
  assert.equal(resultX.usageSourceName, charizard.name);
  assert.equal(resultY.usageSourceName, charizard.name);

  const crossFormData = popularBuild(
    charizardX.id,
    validUsage(charizardY.speciesId, rows),
  );
  assert.equal(crossFormData.source, "usual");
  assert.equal(crossFormData.reason, "species");
});

test("Mega Garchomp Z accepts only target-legal rows and preserves Stone conversion", () => {
  const megaZ = pokemon.find((p) => p.speciesId === "garchompmegaz");
  const base = getPokemon(445);
  assert.ok(megaZ);
  const result = popularBuild(
    megaZ.id,
    validUsage(base.speciesId, [
      { category: "ability", name: "Sand Force", rank: 1, percent: 99 },
      { category: "ability", name: "Levitate", rank: 2, percent: 80 },
      { category: "held_item", name: "Garchompite Z", rank: 1, percent: 99 },
      { category: "held_item", name: "Choice Scarf", rank: 2, percent: 50 },
      { category: "stat_alignment", name: "Adamant", rank: 1, percent: 75 },
      {
        category: "stat_points",
        name: "",
        rank: 1,
        percent: 75,
        points: [2, 32, 0, 0, 0, 32],
      },
      { category: "move", name: "Earthquake", rank: 1, percent: 90 },
      { category: "move", name: "Future Sight", rank: 2, percent: 80 },
    ]),
  );

  assert.equal(result.source, "usage");
  assert.equal(result.build.pokemonId, megaZ.id);
  assert.equal(result.build.ability, japaneseAbility("Levitate"));
  assert.equal(result.build.item, "もちものなし");
  assert.equal(result.build.nature, "いじっぱり");
  assert.deepEqual(result.build.points, [2, 32, 0, 0, 0, 32]);
  assert.deepEqual(result.build.moves, ["じしん"]);
  assert.equal(result.usageSourceName, base.name);

  const zStone = Object.values(itemCatalog).find(
    (item) => item.megaStone?.Garchomp === "Garchomp-Mega-Z",
  );
  assert.ok(zStone);
  assert.equal(pokemonAppearance(base.id, zStone.name).id, megaZ.id);
  assert.deepEqual(itemsForPokemon(megaZ), ["もちものなし"]);
});

test("async Mega selection loads the exact pre-Mega source and applies it to the selected target", async () => {
  const megaZ = pokemon.find((p) => p.speciesId === "garchompmegaz");
  assert.ok(megaZ);
  const requested = [];
  const gate = new DefaultBuildSelectionGate();
  const result = await resolvePopularBuildSelection(
    gate,
    gate.begin("battle:attack"),
    megaZ.id,
    async (speciesId) => {
      requested.push(speciesId);
      return {
        data: validUsage("garchomp", [
          { category: "ability", name: "Levitate", rank: 1, percent: 85 },
          {
            category: "held_item",
            name: "Garchompite Z",
            rank: 1,
            percent: 99,
          },
        ]),
        checkedAt: "2026-09-24T00:00:00.000Z",
        attemptDay: "2026-09-24",
      };
    },
    { loadIndex: loadM6Index },
  );

  assert.deepEqual(requested, ["garchomp"]);
  assert.equal(result.build.pokemonId, megaZ.id);
  assert.equal(result.build.ability, japaneseAbility("Levitate"));
  assert.equal(result.build.item, "もちものなし");
  assert.equal(result.usageSourceName, "ガブリアス");
});

test("selection gate discards A→B→A late responses and canceled edits/context changes", () => {
  const gate = new DefaultBuildSelectionGate();
  const firstA = gate.begin("party:0:2");
  const b = gate.begin("party:0:2");
  const secondA = gate.begin("party:0:2");
  assert.equal(gate.complete(firstA), false);
  assert.equal(gate.complete(b), false);
  assert.equal(gate.complete(secondA), true);

  const beforeManualEdit = gate.begin("battle:defense");
  gate.cancel("battle:defense");
  assert.equal(gate.complete(beforeManualEdit), false);

  const beforePartySwitch = gate.begin("party:0:2");
  gate.cancel();
  assert.equal(gate.complete(beforePartySwitch), false);

  const beforeDeleteImportHistory = gate.begin("party:1:5");
  gate.cancel();
  assert.equal(gate.complete(beforeDeleteImportHistory), false);
  assert.equal(gate.complete(beforeDeleteImportHistory), false);
});

test("async usage selection applies only the latest A→B→A response", async () => {
  const gate = new DefaultBuildSelectionGate();
  const pendingLoads = [];
  const load = (speciesId) =>
    new Promise((resolve) => pendingLoads.push({ speciesId, resolve }));
  const firstA = resolvePopularBuildSelection(
    gate,
    gate.begin("battle:defense"),
    1000,
    load,
    { loadIndex: loadM6Index },
  );
  const b = resolvePopularBuildSelection(
    gate,
    gate.begin("battle:defense"),
    445,
    load,
    { loadIndex: loadM6Index },
  );
  const secondA = resolvePopularBuildSelection(
    gate,
    gate.begin("battle:defense"),
    1000,
    load,
    { loadIndex: loadM6Index },
  );

  assert.deepEqual(
    pendingLoads.map(({ speciesId }) => speciesId),
    ["gholdengo", "garchomp", "gholdengo"],
  );
  pendingLoads[2].resolve({
    data: validUsage("gholdengo", [
      { category: "stat_alignment", name: "Timid", rank: 1, percent: 80 },
    ]),
    checkedAt: "2026-09-24T00:00:00.000Z",
    attemptDay: "2026-09-24",
  });
  const currentResult = await secondA;
  assert.equal(currentResult.source, "usage");
  let currentBuild = currentResult.build;
  assert.equal(currentBuild.nature, "おくびょう");

  pendingLoads[0].resolve({
    data: validUsage("gholdengo", [
      { category: "stat_alignment", name: "Modest", rank: 1, percent: 99 },
    ]),
    checkedAt: "2026-09-24T00:00:00.000Z",
    attemptDay: "2026-09-24",
  });
  assert.equal(await firstA, undefined);
  assert.equal(currentBuild.nature, "おくびょう");

  pendingLoads[1].resolve({
    data: validUsage("garchomp", [
      { category: "stat_alignment", name: "Jolly", rank: 1, percent: 99 },
    ]),
    checkedAt: "2026-09-24T00:00:00.000Z",
    attemptDay: "2026-09-24",
  });
  assert.equal(await b, undefined);
  assert.equal(currentBuild.pokemonId, 1000);
});

test("canceling during a pending load protects a history or saved build", async () => {
  const gate = new DefaultBuildSelectionGate();
  let resolveLoad;
  const pending = resolvePopularBuildSelection(
    gate,
    gate.begin("battle:attack"),
    1000,
    () => new Promise((resolve) => (resolveLoad = resolve)),
    { loadIndex: loadM6Index },
  );
  const loadedHistory = makeBuild(445);
  gate.cancel("battle:attack");
  let currentBuild = structuredClone(loadedHistory);
  resolveLoad({
    data: validUsage("gholdengo", [
      { category: "stat_alignment", name: "Timid", rank: 1, percent: 99 },
    ]),
    checkedAt: "2026-09-24T00:00:00.000Z",
    attemptDay: "2026-09-24",
  });

  assert.equal(await pending, undefined);
  assert.deepEqual(currentBuild, loadedHistory);
});

test("async resolver uses validated stale cache after a 404 and blocks an unsupported index season", async () => {
  const gate = new DefaultBuildSelectionGate();
  const ticket = gate.begin("battle:attack");
  const stale = await resolvePopularBuildSelection(
    gate,
    ticket,
    1000,
    async () => ({
      data: validUsage("gholdengo", [
        { category: "stat_alignment", name: "Timid", rank: 1, percent: 90 },
      ]),
      checkedAt: "2026-09-23T00:00:00.000Z",
      attemptDay: "2026-09-24",
      error: "更新失敗（HTTP 404）。前回のデータを表示しています。",
    }),
    { loadIndex: loadM6Index },
  );
  assert.equal(stale.source, "usage");
  assert.equal(stale.build.nature, "おくびょう");
  assert.match(stale.cacheError, /HTTP 404/);

  const newerSeason = await resolvePopularBuildSelection(
    gate,
    gate.begin("battle:attack"),
    1000,
    async () => ({
      data: validUsage("gholdengo", [
        { category: "stat_alignment", name: "Timid", rank: 1, percent: 90 },
      ]),
      checkedAt: "2026-09-24T00:00:00.000Z",
      attemptDay: "2026-09-24",
    }),
    {
      loadIndex: async () => ({
        data: {
          date: "2026-09-25",
          season: "M7",
          pokemon: [{ id: "gholdengo", name: "Gholdengo", rank: 1 }],
        },
        checkedAt: "2026-09-25T00:00:00.000Z",
        attemptDay: "2026-09-25",
      }),
    },
  );
  assert.equal(newerSeason.source, "usual");
  assert.equal(newerSeason.reason, "season");
  assert.equal(newerSeason.season, "M7");
  assert.equal(newerSeason.build.nature, makeBuild(1000).nature);
});

test("uncached request failures return the usual build and expose the failure", async () => {
  const gate = new DefaultBuildSelectionGate();
  const result = await resolvePopularBuildSelection(
    gate,
    gate.begin("party:2:4"),
    1000,
    async () => {
      throw new Error("HTTP 503");
    },
    { loadIndex: loadM6Index },
  );

  assert.equal(result.source, "usual");
  assert.equal(result.reason, "missing");
  assert.equal(result.requestError, "HTTP 503");
  assert.deepEqual(result.build, makeBuild(1000));
});
