import test from "node:test";
import assert from "node:assert/strict";
import { itemRecovery, repeatedAttackKnockout } from "../src/item-recovery.ts";
import { damageFor, defaultSide } from "../src/battle.ts";
import { makeBuild } from "../src/data.ts";

const recover = (overrides = {}) =>
  itemRecovery({
    maxHP: 200,
    currentHP: 200,
    hitRolls: [[100]],
    item: "Sitrus Berry",
    defenderAbility: "",
    attackerAbility: "",
    attackerItem: "",
    move: "Earthquake",
    mode: "auto",
    surviveFullHP: false,
    ...overrides,
  });

test("Sitrus activates at half HP, only while alive, with integer healing", () => {
  const r = recover({ hitRolls: [[99, 100, 200]] });
  assert.equal(r.minHP, 0);
  assert.equal(r.maxHP, 150);
  assert.equal(r.minHealed, 0);
  assert.equal(r.maxHealed, 50);
  assert.ok(Math.abs(r.koChance - 100 / 3) < 1e-10);
  const aboveOddThreshold = recover({
    maxHP: 201,
    currentHP: 201,
    hitRolls: [[100]],
  });
  assert.equal(aboveOddThreshold.minHP, 101);
  assert.equal(aboveOddThreshold.maxHealed, 0);
  const atOddThreshold = recover({
    maxHP: 201,
    currentHP: 201,
    hitRolls: [[101]],
  });
  assert.equal(atOddThreshold.minHP, 150);
  assert.equal(atOddThreshold.maxHealed, 50);
  assert.equal(
    recover({ maxHP: 215, currentHP: 161, hitRolls: [[80]] }).minHP,
    134,
  );
  assert.equal(recover({ hitRolls: [[99]] }).maxHealed, 0);
});

test("a berry heals between hits only once and changes multihit knockout probability", () => {
  const input = {
    hitRolls: [
      [100, 120],
      [90, 140],
    ],
  };
  assert.equal(recover(input).koChance, 25);
  assert.equal(recover({ ...input, mode: "none" }).koChance, 75);
  assert.equal(recover({ hitRolls: [[100], [50], [50]] }).minHP, 50);
  assert.equal(recover({ hitRolls: [[100], [50], [50]] }).maxHealed, 50);
});

test("Leftovers heals once at end of turn, never revives, and caps at maximum HP", () => {
  assert.equal(
    recover({ item: "Leftovers", hitRolls: [[20], [20]] }).minHP,
    172,
  );
  assert.equal(recover({ item: "Leftovers", hitRolls: [[200]] }).maxHP, 0);
  assert.equal(recover({ item: "Leftovers", hitRolls: [[5]] }).maxHealed, 5);
  assert.equal(recover({ item: "Leftovers", hitRolls: [[0]] }).maxHP, 200);
});

test("removal prevents berry healing, while Sticky Hold and failed attacks retain items", () => {
  for (const move of [
    "Knock Off",
    "Incinerate",
    "Bug Bite",
    "Pluck",
    "Thief",
    "Covet",
  ]) {
    assert.equal(recover({ move }).maxHealed, 0, move);
  }
  assert.equal(
    recover({ move: "Knock Off", defenderAbility: "Sticky Hold" }).maxHealed,
    50,
  );
  assert.equal(
    recover({
      move: "Knock Off",
      defenderAbility: "Sticky Hold",
      attackerAbility: "Mold Breaker",
    }).maxHealed,
    0,
  );
  assert.equal(
    recover({ move: "Thief", attackerItem: "Life Orb" }).maxHealed,
    50,
  );
  assert.equal(
    recover({
      move: "Knock Off",
      item: "Leftovers",
      currentHP: 100,
      hitRolls: [[0]],
    }).maxHealed,
    12,
  );
});

test("ability and healing-block conditions are respected", () => {
  assert.equal(recover({ defenderAbility: "Klutz" }).maxHealed, 0);
  assert.equal(recover({ attackerAbility: "Unnerve" }).maxHealed, 0);
  assert.equal(
    recover({
      defenderAbility: "Ripen",
      maxHP: 215,
      currentHP: 215,
      hitRolls: [[115]],
    }).maxHealed,
    106,
  );
  assert.equal(recover({ defenderAbility: "Cheek Pouch" }).maxHealed, 100);
  assert.equal(recover({ item: "Oran Berry" }).maxHealed, 10);
  assert.equal(recover({ item: "Shell Bell" }).maxHealed, 0);
  assert.equal(recover({ move: "Psychic Noise" }).maxHealed, 0);
  assert.equal(
    recover({ move: "Psychic Noise", attackerAbility: "Sheer Force" })
      .maxHealed,
    50,
  );
  const mixed = recover({
    move: "Psychic Noise",
    item: "Leftovers",
    currentHP: 100,
    hitRolls: [[0, 10]],
  });
  assert.equal(mixed.maxHP, 112);
  assert.equal(mixed.minHP, 90);
});

test("Japanese build integration preserves damage rolls when recovery is disabled", () => {
  const a = makeBuild(445),
    d = { ...makeBuild(450), item: "オボンのみ" };
  const f = {
    weather: "なし",
    terrain: "なし",
    trickRoom: false,
    gravity: false,
  };
  const calc = (mode, move = "じしん") =>
    damageFor(
      a,
      d,
      move,
      defaultSide(),
      { ...defaultSide(), hp: 75 },
      f,
      false,
      undefined,
      mode,
    );
  const yes = calc("auto"),
    no = calc("none");
  assert.deepEqual(yes.rolls, no.rolls);
  assert.equal(yes.recovery.minHealed, Math.floor(yes.maxHP / 4));
  assert.equal(
    yes.recovery.minHP - no.recovery.minHP,
    Math.floor(yes.maxHP / 4),
  );
  assert.equal(no.recovery.maxHealed, 0);
  assert.equal(calc("auto", "はたきおとす").recovery.maxHealed, 0);
});

test("repeated KO estimates keep berry consumption across uses and honor recovery mode", () => {
  const input = {
    maxHP: 200,
    currentHP: 200,
    hitRolls: [[80]],
    item: "Sitrus Berry",
    defenderAbility: "",
    attackerAbility: "",
    attackerItem: "",
    move: "Earthquake",
    mode: "auto",
    surviveFullHP: false,
    focusSash: false,
  };
  const withBerry = repeatedAttackKnockout(input);
  const withoutRecovery = repeatedAttackKnockout({ ...input, mode: "none" });
  assert.equal(withBerry.firstKOUse, 4);
  assert.equal(withBerry.guaranteedKOUse, 4);
  assert.equal(withBerry.chanceByFirstKO, 100);
  assert.equal(withoutRecovery.firstKOUse, 3);
});

test("repeated KO estimates apply Leftovers each surviving turn", () => {
  const result = repeatedAttackKnockout({
    maxHP: 200,
    currentHP: 200,
    hitRolls: [[50]],
    item: "Leftovers",
    defenderAbility: "",
    attackerAbility: "",
    attackerItem: "",
    move: "Earthquake",
    mode: "auto",
    surviveFullHP: false,
    focusSash: false,
  });
  assert.equal(result.firstKOUse, 5);
  assert.equal(result.guaranteedKOUse, 5);
});

test("a multihit move consumes its berry once across repeated uses", () => {
  const result = repeatedAttackKnockout({
    maxHP: 200,
    currentHP: 200,
    hitRolls: [[40], [40]],
    item: "Sitrus Berry",
    defenderAbility: "",
    attackerAbility: "",
    attackerItem: "",
    move: "Scale Shot",
    mode: "auto",
    surviveFullHP: false,
    focusSash: false,
  });
  assert.equal(result.firstKOUse, 4);
  assert.equal(result.guaranteedKOUse, 4);
});

test("Knock Off keeps recovery items removed on later repeated uses", () => {
  const result = repeatedAttackKnockout({
    maxHP: 100,
    currentHP: 100,
    hitRolls: [[20]],
    item: "Leftovers",
    defenderAbility: "",
    attackerAbility: "",
    attackerItem: "",
    move: "Knock Off",
    mode: "auto",
    surviveFullHP: false,
    focusSash: false,
  });
  assert.equal(result.firstKOUse, 5);
  assert.equal(result.guaranteedKOUse, 5);
});

test("repeated KO probability is cumulative and certainty requires every path to faint", () => {
  const input = {
    maxHP: 100,
    currentHP: 100,
    hitRolls: [[50, 100]],
    item: "",
    defenderAbility: "",
    attackerAbility: "",
    attackerItem: "",
    move: "Earthquake",
    mode: "auto",
    surviveFullHP: false,
  };
  const oneUse = itemRecovery(input);
  const result = repeatedAttackKnockout({ ...input, focusSash: false });
  assert.equal(result.firstKOUse, 1);
  assert.equal(result.chanceByFirstKO, 50);
  assert.equal(result.chanceByFirstKO, oneUse.koChance);
  assert.equal(result.guaranteedKOUse, 2);
  assert.equal(result.chanceByLimit, 100);
});

test("a tiny live branch prevents the repeated estimate from claiming certainty", () => {
  const result = repeatedAttackKnockout({
    maxHP: 100,
    currentHP: 100,
    hitRolls: [[...Array(15).fill(100), 0]],
    item: "",
    defenderAbility: "",
    attackerAbility: "",
    attackerItem: "",
    move: "Earthquake",
    mode: "none",
    surviveFullHP: false,
    focusSash: false,
    useLimit: 10,
  });
  assert.equal(result.firstKOUse, 1);
  assert.equal(result.chanceByFirstKO, 93.75);
  assert.equal(result.guaranteedKOUse, null);
  assert.ok(result.chanceByLimit < 100);
  assert.ok(result.chanceByLimit > 99.9999999999);
});

test("zero damage and stable recovery cycles cannot claim a KO", () => {
  const noDamage = repeatedAttackKnockout({
    maxHP: 100,
    currentHP: 100,
    hitRolls: [[0, 0]],
    item: "",
    defenderAbility: "",
    attackerAbility: "",
    attackerItem: "",
    move: "Earthquake",
    mode: "auto",
    surviveFullHP: false,
    focusSash: false,
  });
  assert.equal(noDamage.impossible, true);
  assert.equal(noDamage.firstKOUse, null);
  assert.equal(noDamage.chanceByLimit, 0);
  const leftoversCycle = repeatedAttackKnockout({
    maxHP: 100,
    currentHP: 100,
    hitRolls: [[1]],
    item: "Leftovers",
    defenderAbility: "",
    attackerAbility: "",
    attackerItem: "",
    move: "Earthquake",
    mode: "auto",
    surviveFullHP: false,
    focusSash: false,
  });
  assert.equal(leftoversCycle.impossible, true);
  assert.equal(leftoversCycle.firstKOUse, null);
});

test("the ten-use limit remains explicit and Focus Sash is consumed once", () => {
  const beyondLimit = repeatedAttackKnockout({
    maxHP: 200,
    currentHP: 200,
    hitRolls: [[10]],
    item: "",
    defenderAbility: "",
    attackerAbility: "",
    attackerItem: "",
    move: "Earthquake",
    mode: "none",
    surviveFullHP: false,
    focusSash: false,
  });
  assert.equal(beyondLimit.useLimit, 10);
  assert.equal(beyondLimit.firstKOUse, null);
  assert.equal(beyondLimit.impossible, false);

  const sash = repeatedAttackKnockout({
    maxHP: 100,
    currentHP: 100,
    hitRolls: [[100]],
    item: "Focus Sash",
    defenderAbility: "",
    attackerAbility: "",
    attackerItem: "",
    move: "Earthquake",
    mode: "auto",
    surviveFullHP: true,
    focusSash: true,
  });
  assert.equal(sash.firstKOUse, 2);
  assert.equal(sash.guaranteedKOUse, 2);
});

test("an already fainted target is treated as an immediate KO", () => {
  const result = repeatedAttackKnockout({
    maxHP: 100,
    currentHP: 0,
    hitRolls: [[0]],
    item: "",
    defenderAbility: "",
    attackerAbility: "",
    attackerItem: "",
    move: "Earthquake",
    mode: "auto",
    surviveFullHP: false,
    focusSash: false,
  });
  assert.equal(result.alreadyKnockedOut, true);
  assert.equal(result.guaranteedKOUse, 0);
});
