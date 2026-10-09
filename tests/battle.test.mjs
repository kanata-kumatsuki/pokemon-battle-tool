import test from "node:test";
import assert from "node:assert/strict";
import {
  damageFor,
  actionOrder,
  defaultSide,
  calcPokemon,
} from "../src/battle.ts";
import { makeBuild, pokemon, learnableMoves } from "../src/data.ts";
const field = {
  weather: "なし",
  terrain: "なし",
  trickRoom: false,
  gravity: false,
};
const a = makeBuild(445),
  d = makeBuild(1000);
const calc = (
  attack = a,
  defense = d,
  move = "じしん",
  as = defaultSide(),
  ds = defaultSide(),
  f = field,
  crit = false,
  hits,
) => damageFor(attack, defense, move, as, ds, f, crit, hits);
test("Champions SP stats and hand-calculated Earthquake rolls retain probability weight", () => {
  assert.deepEqual(calcPokemon(a, defaultSide()).rawStats, {
    hp: 185,
    atk: 182,
    def: 115,
    spa: 90,
    spd: 105,
    spe: 169,
  });
  // floor(floor(22*100*182/115)/50)+2 = 71; random before STAB and effectiveness.
  const rolls = Array.from(
    { length: 16 },
    (_, i) => Math.floor(Math.floor((71 * (85 + i)) / 100) * 1.5) * 2,
  );
  const result = calc();
  assert.equal(result.min, Math.min(...rolls));
  assert.equal(result.max, Math.max(...rolls));
  assert.equal(
    result.koChance,
    (rolls.filter((n) => n >= 194).length / 16) * 100,
  );
  assert.equal(result.koChance, 56.25);
  // Gholdengo max HP is 87 base + 32 SP + 75; damage percentages use max HP.
  assert.equal(result.maxHP, 194);
  assert.equal(result.currentHP, 194);
  assert.equal(result.minPercent, (Math.min(...rolls) / 194) * 100);
  assert.equal(result.maxPercent, (Math.max(...rolls) / 194) * 100);
  const at99Percent = calc(a, d, "じしん", defaultSide(), {
    ...defaultSide(),
    hp: 99,
  });
  assert.equal(at99Percent.currentHP, 192);
  assert.equal(
    at99Percent.koChance,
    (rolls.filter((n) => n >= 192).length / 16) * 100,
  );
  assert.equal(
    calc(a, d, "じしん", defaultSide(), { ...defaultSide(), hp: 50 }).koChance,
    100,
  );
});
test("reflect, burn, critical hit, stages, protect and type immunity change damage", () => {
  const baseline = calc().max;
  assert.ok(
    calc(a, d, "じしん", defaultSide(), { ...defaultSide(), reflect: true })
      .max < baseline,
  );
  assert.ok(
    calc(a, d, "じしん", { ...defaultSide(), status: "brn" }).max < baseline,
  );
  assert.ok(
    calc(a, d, "じしん", { ...defaultSide(), boosts: [0, 2, 0, 0, 0, 0] }).max >
      baseline,
  );
  assert.ok(
    calc(
      a,
      d,
      "じしん",
      defaultSide(),
      { ...defaultSide(), reflect: true },
      field,
      true,
    ).max > baseline,
  );
  assert.equal(
    calc(a, d, "じしん", defaultSide(), { ...defaultSide(), protected: true })
      .max,
    0,
  );
  assert.equal(calc(a, makeBuild(149)).max, 0);
  const immune = damageFor(
    a,
    { ...makeBuild(149), item: "オレンのみ" },
    "じしん",
    defaultSide(),
    { ...defaultSide(), hp: 75 },
    field,
  );
  // Dragonite has 168 max HP here; Ground immunity leaves its 126 HP untouched.
  assert.equal(immune.maxHP, 168);
  assert.equal(immune.currentHP, 126);
  assert.equal(immune.minPercent, 0);
  assert.equal(immune.maxPercent, 0);
  assert.equal(immune.recovery.minHP, 126);
  assert.equal(immune.recovery.maxHP, 126);
  assert.equal(immune.recovery.maxHealed, 0);
  assert.equal(immune.koChance, 0);
  assert.equal(calc(a, d, "つるぎのまい").statusMove, true);
});
test("sash saves at full HP, not after chip; multiple hits can break it", () => {
  const weak = { ...makeBuild(25), item: "きあいのタスキ" };
  assert.equal(calc(a, weak).koChance, 0);
  assert.equal(
    calc(a, weak, "じしん", defaultSide(), { ...defaultSide(), hp: 99 })
      .koChance,
    100,
  );
  const multi = calc(
    a,
    weak,
    "スケイルショット",
    defaultSide(),
    defaultSide(),
    field,
    false,
    5,
  );
  assert.ok(multi.koChance > 0);
  assert.throws(() =>
    calc(
      a,
      weak,
      "スケイルショット",
      defaultSide(),
      defaultSide(),
      field,
      false,
      10,
    ),
  );
  assert.equal(
    calc(a, d, "じしん", defaultSide(), defaultSide(), field, false, 5).max,
    calc().max,
  );
});
test("weather affects damage and priority precedes Trick Room; paralysis and scarf affect speed", () => {
  const fire = makeBuild(6);
  assert.ok(
    calc(fire, d, "かえんほうしゃ", defaultSide(), defaultSide(), {
      ...field,
      weather: "はれ",
    }).max > calc(fire, d, "かえんほうしゃ").max,
  );
  const order = (
    x = a,
    y = d,
    am = "じしん",
    dm = "ゴールドラッシュ",
    as = defaultSide(),
    ds = defaultSide(),
    f = field,
  ) => actionOrder(x, y, am, dm, as, ds, f);
  assert.equal(order().first, "attack");
  assert.equal(
    order(a, d, "じしん", "ゴールドラッシュ", defaultSide(), defaultSide(), {
      ...field,
      trickRoom: true,
    }).first,
    "defense",
  );
  assert.equal(order(a, makeBuild(149), "じしん", "しんそく").first, "defense");
  assert.equal(
    order(a, d, "じしん", "ゴールドラッシュ", {
      ...defaultSide(),
      status: "par",
    }).first,
    "defense",
  );
  assert.equal(order({ ...a, item: "こだわりスカーフ" }).attackSpeed, 253);
  assert.equal(order(a, a, "じしん", "じしん").first, "tie");
});
test("every listed form has a valid build and legal editable moves; special forms calculate", () => {
  for (const p of pokemon) {
    const b = makeBuild(p.id);
    assert.ok(calcPokemon(b, defaultSide()).stats.spe > 0, p.name);
    assert.ok(learnableMoves(p).length);
    assert.ok(b.moves.every((m) => learnableMoves(p).some(([n]) => n === m)));
  }
  assert.equal(calc(a, makeBuild(778)).koChance, null);
});

test("random priority effects stay within priority brackets and unmodeled survival cannot claim a guaranteed KO", () => {
  const random = { ...d, item: "せんせいのツメ" };
  assert.equal(
    actionOrder(
      a,
      random,
      "じしん",
      "ゴールドラッシュ",
      defaultSide(),
      defaultSide(),
      field,
    ).first,
    "unknown",
  );
  assert.equal(
    actionOrder(
      a,
      random,
      "まもる",
      "ゴールドラッシュ",
      defaultSide(),
      defaultSide(),
      field,
    ).first,
    "attack",
  );
  assert.equal(calc(a, { ...d, item: "きあいのハチマキ" }).koChance, null);
});
