import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateSpeed,
  compareSpeeds,
  normalizePokemonSearch,
  speedPresets,
  resolveSpeedConfig,
} from "../src/speed.ts";
import roster from "../src/generated/speed-roster.json" with { type: "json" };

test("Champions speed uses SP and nature with integer rounding, including 0 SP", () => {
  assert.equal(calculateSpeed(102, speedPresets.fastest), 169);
  assert.equal(calculateSpeed(102, speedPresets.max), 154);
  assert.equal(calculateSpeed(102, speedPresets.zero), 122);
  assert.equal(calculateSpeed(102, speedPresets.slowest), 109);
  assert.equal(calculateSpeed(84, { ...speedPresets.zero, points: 2 }), 106);
  assert.equal(calculateSpeed(80, speedPresets.fastest), 145);
});
test("opponent rank +1 and +2 change comparisons without changing the reference", () => {
  const one = compareSpeeds(roster.pokemon, "garchomp", 169, "fastest", {
    stage: 1,
    ability: "none",
  });
  const two = compareSpeeds(roster.pokemon, "garchomp", 169, "fastest", {
    stage: 2,
    ability: "none",
  });
  assert.equal(one.find((p) => p.id === "dragonite").speed, 217);
  assert.equal(two.find((p) => p.id === "dragonite").speed, 290);
  assert.equal(one.find((p) => p.id === "dragonite").difference, 48);
});
test("active abilities only affect eligible forms and chain with ranks", () => {
  const rows = compareSpeeds(roster.pokemon, "garchomp", 169, "fastest", {
    stage: 1,
    ability: "swiftSwim",
  });
  assert.equal(rows.find((p) => p.id === "swampertmega").speed, 402);
  assert.equal(rows.find((p) => p.id === "swampert").speed, 184);
  assert.equal(
    rows.find((p) => p.id === "swampert").appliedConfig.ability,
    "none",
  );
  assert.equal(
    rows.find((p) => p.id === "swampertmega").appliedConfig.ability,
    "swiftSwim",
  );
});
test("Unburden excludes a held scarf for both selected and opponent builds", () => {
  const hawlucha = roster.pokemon.find((p) => p.id === "hawlucha");
  const config = resolveSpeedConfig(hawlucha, {
    ...speedPresets.scarf,
    ability: "unburden",
  });
  assert.equal(config.scarf, false);
  assert.equal(calculateSpeed(hawlucha.baseSpeed, config), 374);
  const rows = compareSpeeds(roster.pokemon, "garchomp", 169, "scarf", {
    stage: 0,
    ability: "unburden",
  });
  assert.equal(rows.find((p) => p.id === "hawlucha").speed, 374);
  assert.equal(rows.find((p) => p.id === "aerodactyl").speed, 300);
  const invalid = resolveSpeedConfig(
    roster.pokemon.find((p) => p.id === "garchomp"),
    { ...speedPresets.scarf, ability: "swiftSwim" },
  );
  assert.equal(invalid.ability, "none");
  assert.equal(calculateSpeed(102, invalid), 253);
});
test("ability and item multipliers round once, using half-down rounding", () => {
  assert.equal(
    calculateSpeed(53, { ...speedPresets.scarf, ability: "quickFeet" }),
    259,
  );
  assert.equal(
    calculateSpeed(102, { ...speedPresets.fastest, ability: "quickFeet" }),
    253,
  );
  assert.equal(
    calculateSpeed(102, { ...speedPresets.scarf, ability: "swiftSwim" }),
    507,
  );
  assert.equal(
    calculateSpeed(102, { ...speedPresets.fastest, ability: "slowStart" }),
    84,
  );
});
test("rank is applied before scarf, half points round down, invalid SP is rejected", () => {
  assert.equal(calculateSpeed(102, speedPresets.scarf), 253);
  assert.equal(calculateSpeed(102, { ...speedPresets.scarf, stage: 1 }), 379);
  assert.equal(calculateSpeed(102, { ...speedPresets.scarf, stage: -1 }), 168);
  assert.equal(calculateSpeed(5, { ...speedPresets.slowest, stage: -6 }), 5);
  for (const points of [-1, 33, 1.5, NaN])
    assert.throws(
      () => calculateSpeed(102, { ...speedPresets.zero, points }),
      RangeError,
    );
});
test("positive rank, Choice Scarf and a speed ability all stack after the stat formula", () => {
  // floor((102 + 32 + 20) * 1.1) = 169; +1 rank gives 253;
  // Scarf ×1.5 and Swift Swim ×2 then produce exactly 759.
  assert.equal(
    calculateSpeed(102, {
      ...speedPresets.scarf,
      stage: 1,
      ability: "swiftSwim",
    }),
    759,
  );
});
test("all other forms are sorted by speed, ties share rank and Mega forms cannot hold scarf", () => {
  const rows = compareSpeeds(roster.pokemon, "garchomp", 169, "fastest");
  assert.equal(rows.length, roster.pokemon.length - 1);
  assert.ok(rows.every((p) => p.id !== "garchomp"));
  assert.ok(rows.every((p, i) => i === 0 || rows[i - 1].speed >= p.speed));
  assert.ok(rows.some((p) => p.difference === 0));
  assert.ok(rows.every((p) => p.difference === p.speed - 169));
  const scarf = compareSpeeds(roster.pokemon, "garchomp", 169, "scarf");
  const mega = scarf.find((p) => p.id === "aerodactylmega");
  const normal = scarf.find((p) => p.id === "aerodactyl");
  assert.equal(mega.speed, 222);
  assert.equal(normal.speed, 300);
});
test("roster is unique, complete for the snapshot, localized and excludes unavailable species", () => {
  assert.equal(roster.pokemon.length, 358);
  assert.equal(new Set(roster.pokemon.map((p) => p.id)).size, 358);
  assert.ok(
    roster.pokemon.every((p) => p.baseSpeed > 0 && p.name && p.types.length),
  );
  assert.ok(!roster.pokemon.some((p) => p.id === "bulbasaur"));
  assert.ok(roster.pokemon.find((p) => p.id === "meowsticfmega").mega);
  assert.ok(roster.pokemon.find((p) => p.id === "palafinhero"));
  assert.ok(roster.pokemon.find((p) => p.id === "meowsticf"));
  assert.equal(
    normalizePokemonSearch("がぶりあす"),
    normalizePokemonSearch("ガブリアス"),
  );
});
