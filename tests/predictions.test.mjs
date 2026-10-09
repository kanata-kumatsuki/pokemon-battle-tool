import test from "node:test";
import assert from "node:assert/strict";
import {
  assumptions,
  predictActions,
  unknownInfo,
} from "../src/predictions.ts";
import { makeBuild, pokemon } from "../src/data.ts";
import { defaultSide } from "../src/battle.ts";
const usage = {
  speciesId: "gholdengo",
  season: "M6",
  date: "2026-09-19",
  rows: [
    { category: "move", name: "Shadow Ball", rank: 1, percent: 98 },
    { category: "move", name: "Make It Rain", rank: 2, percent: 90 },
    { category: "move", name: "Recover", rank: 3, percent: 60 },
    { category: "move", name: "Thunderbolt", rank: 4, percent: 20 },
    { category: "held_item", name: "Choice Scarf", rank: 1, percent: 30 },
    { category: "stat_alignment", name: "Timid", rank: 1, percent: 50 },
    {
      category: "stat_points",
      name: "",
      rank: 1,
      percent: 20,
      points: [2, 0, 0, 32, 0, 32],
    },
  ],
};
const input = () => ({
  attack: makeBuild(445),
  defense: makeBuild(1000),
  move: "じしん",
  attackSide: defaultSide(),
  defenseSide: defaultSide(),
  field: { weather: "なし", terrain: "なし", trickRoom: false, gravity: false },
  known: unknownInfo(),
  usage,
  opponents: [],
});
test("known facts constrain every hypothesized build and remain unchanged", () => {
  const b = makeBuild(1000),
    k = { ...unknownInfo(), item: true, nature: true, points: true };
  const original = structuredClone(b);
  for (const v of assumptions(b, k, usage)) {
    assert.equal(v.build.item, b.item);
    assert.equal(v.build.nature, b.nature);
    assert.deepEqual(v.build.points, b.points);
  }
  assert.deepEqual(b, original);
  assert.equal(assumptions(b, { ...k, ability: true }, usage).length, 1);
});
test("Mega predictions consume only the explicit base snapshot with Mega-legal assumptions and moves", () => {
  const mega = pokemon.find((p) => p.speciesId === "garchompmegaz");
  assert.ok(mega);
  const megaUsage = {
    speciesId: "garchomp",
    season: "M6",
    date: "2026-09-19",
    rows: [
      { category: "ability", name: "Levitate", rank: 1, percent: 90 },
      { category: "held_item", name: "Choice Scarf", rank: 1, percent: 90 },
      { category: "stat_alignment", name: "Adamant", rank: 1, percent: 90 },
      {
        category: "stat_points",
        name: "",
        rank: 1,
        percent: 90,
        points: [0, 32, 0, 0, 0, 32],
      },
      { category: "move", name: "Earthquake", rank: 1, percent: 90 },
      { category: "move", name: "Future Sight", rank: 2, percent: 100 },
    ],
  };
  const target = { ...makeBuild(mega.id), item: "もちものなし" };
  const variants = assumptions(target, unknownInfo(), megaUsage);
  assert.equal(variants[0].label, "採用上位の仮定");
  assert.equal(variants[0].build.ability, mega.abilities[0]);
  assert.equal(variants[0].build.item, "もちものなし");
  assert.equal(variants[0].build.nature, "いじっぱり");
  assert.deepEqual(variants[0].build.points, [0, 32, 0, 0, 0, 32]);
  assert.ok(variants[0].notes.some((note) => note.includes("ガブリアス")));

  const predicted = predictActions({
    ...input(),
    defense: target,
    usage: megaUsage,
  });
  assert.ok(
    predicted.candidates.some((candidate) => candidate.name === "じしん"),
  );
  assert.ok(
    !predicted.candidates.some((candidate) => candidate.name === "みらいよち"),
  );

  const wrongForm = predictActions({
    ...input(),
    defense: target,
    usage: { ...megaUsage, speciesId: "charizard" },
  });
  assert.ok(
    !wrongForm.candidates.some((candidate) => candidate.name === "じしん"),
  );
});
test("never invent a species for an unknown switch; four known moves exclude statistical alternatives", () => {
  const i = input();
  assert.ok(
    predictActions(i).candidates.every(
      (c) => c.kind !== "交代" || c.key === "switch:unknown",
    ),
  );
  i.known.moves = ["じこさいせい", "まもる", "わるだくみ", "１０まんボルト"];
  const result = predictActions(i);
  assert.ok(!result.candidates.some((c) => c.name === "じこさいせい"));
  assert.ok(!result.candidates.some((c) => c.name === "１０まんボルト"));
  assert.ok(!result.candidates.some((c) => c.name === "シャドーボール"));
  assert.ok(result.candidates.length <= 3);
  i.usage = undefined;
  i.known = unknownInfo();
  assert.ok(
    predictActions(i).candidates.every((c) => c.key === "switch:unknown"),
  );
});
test("switch only to supplied viable candidates and remove fainted or current Pokemon", () => {
  const i = input();
  i.opponents = [
    { id: 149, state: "selected" },
    { id: 823, state: "fainted" },
    { id: 1000, state: "selected" },
  ];
  const result = predictActions(i);
  assert.ok(result.candidates.some((c) => c.key === "switch:149"));
  assert.ok(
    !result.candidates.some((c) =>
      ["switch:823", "switch:1000"].includes(c.key),
    ),
  );
});
test("a revealed bench Mega Stone is honored while unconfirmed build fields stay default", () => {
  const i = input();
  const gyarados = {
    ...makeBuild(130),
    item: "ギャラドスナイト",
    nature: "ずぶとい",
    ability: "じしんかじょう",
    points: [32, 0, 32, 0, 0, 0],
  };
  i.opponents = [
    {
      id: 130,
      state: "selected",
      observedBuild: gyarados,
      known: { ...unknownInfo(), item: true },
    },
  ];
  const observedBefore = structuredClone(i.opponents[0]);
  const revealed = predictActions(i).candidates.find(
    (c) => c.key === "switch:130",
  );
  assert.ok(revealed);
  assert.ok(revealed.reasons.includes("選択した技を受けた場合 47.1〜55.8%"));
  assert.ok(revealed.assumptions.includes("判明済みのもちものを反映"));
  assert.ok(revealed.assumptions.some((s) => s.includes("未判明項目は標準値")));
  assert.deepEqual(i.opponents[0], observedBefore);

  i.opponents[0].known = unknownInfo();
  const unconfirmed = predictActions(i).candidates.find(
    (c) => c.key === "switch:130",
  );
  assert.ok(unconfirmed);
  assert.ok(unconfirmed.reasons.includes("選択した技を無効化できる"));
});
test("unknown season blocks predictions; sleep and full HP contradict attacks and recovery", () => {
  const i = input();
  assert.equal(predictActions({ ...i, season: "M7" }).candidates.length, 0);
  assert.equal(
    predictActions({ ...i, usage: { ...usage, season: "M7" } }).candidates
      .length,
    0,
  );
  const seasonContext = {
    season: "M7",
    previousSeason: "M6",
    availableSeasons: ["M7", "M6", "M5"],
  };
  assert.ok(
    predictActions({ ...i, season: "M7", seasonContext }).candidates.length > 0,
  );
  assert.ok(
    predictActions({
      ...i,
      season: "M7",
      seasonContext,
      usage: { ...usage, season: "M7" },
    }).candidates.length > 0,
  );
  assert.equal(
    predictActions({
      ...i,
      season: "M7",
      seasonContext,
      usage: { ...usage, season: "M5" },
    }).candidates.length,
    0,
  );
  i.defenseSide.status = "slp";
  assert.ok(
    predictActions(i).candidates.every((c) => c.key === "switch:unknown"),
  );
  i.defenseSide.status = "";
  i.defenseSide.hp = 20;
  // With no remaining unknown bench, the healing option remains in the top three.
  i.opponents = [
    { id: 149, state: "fainted" },
    { id: 823, state: "fainted" },
  ];
  assert.ok(
    predictActions(i).candidates.some((c) => c.name === "じこさいせい"),
  );
});

test("rare super-effective KO moves cannot lead over common moves", () => {
  const i = input();
  i.attack = makeBuild(6);
  i.move = "かえんほうしゃ";
  i.usage = {
    ...usage,
    rows: [
      { category: "move", name: "Power Gem", rank: 8, percent: 3.8 },
      { category: "move", name: "Shadow Ball", rank: 1, percent: 98.7 },
      { category: "move", name: "Thunderbolt", rank: 4, percent: 30.2 },
    ],
  };
  const result = predictActions(i);
  assert.equal(result.candidates[0].name, "シャドーボール");
  assert.ok(!result.candidates[0].reasons.some((r) => r.includes("3.8%")));
  i.known.moves = ["パワージェム"];
  assert.equal(predictActions(i).candidates[0].name, "パワージェム");
});

test("low-usage-only matchups do not promote an unconfirmed move into first place", () => {
  const i = input();
  i.opponents = [
    { id: 149, state: "fainted" },
    { id: 823, state: "fainted" },
  ];
  i.usage = {
    ...usage,
    rows: [{ category: "move", name: "Shadow Ball", rank: 1, percent: 3.8 }],
  };
  assert.equal(predictActions(i).candidates.length, 0);
  assert.ok(
    predictActions(i).warnings.some((w) => w.includes("1位を提示していません")),
  );
  i.usage.rows[0].percent = 20;
  assert.equal(predictActions(i).candidates[0].name, "シャドーボール");
  i.usage.rows[0].percent = 19.9;
  assert.equal(predictActions(i).candidates.length, 0);
  i.usage.rows[0].percent = null;
  i.usage.rows[0].rank = 4;
  assert.equal(predictActions(i).candidates[0].name, "シャドーボール");
  i.usage.rows[0].rank = 5;
  assert.equal(predictActions(i).candidates.length, 0);
});

test("status moves can lead when recovery is useful and popular", () => {
  const i = input();
  i.defenseSide.hp = 20;
  i.usage = {
    ...usage,
    rows: [
      { category: "move", name: "Recover", rank: 1, percent: 95 },
      { category: "move", name: "Shadow Ball", rank: 2, percent: 20 },
    ],
  };
  i.opponents = [
    { id: 149, state: "fainted" },
    { id: 823, state: "fainted" },
  ];
  assert.equal(predictActions(i).candidates[0].name, "じこさいせい");
  i.defenseSide.hp = 100;
  assert.ok(
    !predictActions(i).candidates.some((c) => c.name === "じこさいせい"),
  );
});

test("single-target stat changes distinguish useful drops and exclude ally-only moves", () => {
  const i = input();
  i.defense = makeBuild(3);
  i.known.moves = ["あまえる"];
  const charm = predictActions(i).candidates.find(
    (c) => c.key === "move:あまえる",
  );
  assert.ok(charm);
  assert.ok(
    charm.reasons.some((r) => r.includes("こちらのこうげきランクを下げる")),
  );
  assert.equal(charm.score, 26);

  i.defense = makeBuild(130);
  i.known.moves = ["いばる"];
  i.move = "じしん";
  const swagger = predictActions(i).candidates.find(
    (c) => c.key === "move:いばる",
  );
  assert.ok(swagger);
  assert.ok(
    swagger.reasons.some((r) => r.includes("こちらのこうげきランクを上げる")),
  );
  assert.ok(
    swagger.reasons.includes("相手に有利な能力変化としては加点していません"),
  );
  assert.equal(swagger.score, 12);

  i.defense = makeBuild(38);
  i.known.moves = ["とおぼえ"];
  const howl = predictActions(i).candidates.find(
    (c) => c.key === "move:とおぼえ",
  );
  assert.ok(howl);
  assert.ok(
    howl.reasons.some((r) => r.includes("相手のこうげきランクを上げる")),
  );
  assert.equal(howl.score, 26);

  i.defense = makeBuild(858);
  i.known.moves = ["アロマミスト"];
  i.move = "ドラゴンクロー";
  const aromaticMist = predictActions(i);
  assert.ok(
    !aromaticMist.candidates.some((c) => c.key === "move:アロマミスト"),
  );
  assert.ok(
    aromaticMist.warnings.some((w) => w.includes("対象となる味方がいない")),
  );
});

test("unknown switches are conditional and never invent an extra revealed team member", () => {
  const i = input();
  i.usage = undefined;
  const result = predictActions(i);
  assert.equal(result.candidates[0].name, "交代（交代先は不明）");
  assert.ok(
    result.candidates[0].assumptions.some((s) =>
      s.includes("安全に受けられるとは限りません"),
    ),
  );
  i.move = "つるぎのまい";
  assert.equal(predictActions(i).candidates.length, 0);
  i.move = "じしん";
  i.opponents = [
    { id: 149, state: "fainted" },
    { id: 823, state: "fainted" },
  ];
  assert.equal(predictActions(i).candidates.length, 0);
  i.opponents = [149, 823, 445, 778, 10009].map((id) => ({
    id,
    state: "unknown",
  }));
  assert.ok(
    !predictActions(i).candidates.some((c) => c.key === "switch:unknown"),
  );
});
