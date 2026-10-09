import test from "node:test";
import assert from "node:assert/strict";
import roster from "../src/generated/speed-roster.json" with { type: "json" };
import { compareSpeedBuilds, speedPresets } from "../src/speed.ts";

test("neutral rank comparison mixes all five builds in descending speed order with unique rows", () => {
  const rows = compareSpeedBuilds(roster.pokemon, "garchomp", 169, "all", {
    stage: 0,
    ability: "none",
  });
  const dragonite = rows.filter((p) => p.id === "dragonite");
  assert.deepEqual(
    dragonite.map((p) => [p.preset, p.speed]),
    [
      ["scarf", 217],
      ["fastest", 145],
      ["max", 132],
      ["zero", 100],
      ["slowest", 90],
    ],
  );
  assert.equal(new Set(rows.map((p) => p.rowId)).size, rows.length);
  assert.ok(rows.every((p, i) => i === 0 || rows[i - 1].speed >= p.speed));
  assert.ok(
    rows.every((p) => p.id !== "garchomp" && p.difference === p.speed - 169),
  );
  assert.equal(
    rows.length,
    (roster.pokemon.length - 1) * 4 +
      roster.pokemon.filter((p) => p.id !== "garchomp" && !p.mega).length,
  );
});

test("each distribution filter is exactly the corresponding subset of the full comparison", () => {
  const all = compareSpeedBuilds(roster.pokemon, "garchomp", 169);
  for (const preset of Object.keys(speedPresets)) {
    assert.deepEqual(
      compareSpeedBuilds(roster.pokemon, "garchomp", 169, preset),
      all.filter((p) => p.preset === preset),
    );
  }
});

test("ranks and eligible abilities apply to every build without impossible scarf duplicates", () => {
  const rows = compareSpeedBuilds(roster.pokemon, "garchomp", 169, "all", {
    stage: 1,
    ability: "swiftSwim",
  });
  assert.equal(
    rows.find((p) => p.id === "swampertmega" && p.preset === "fastest").speed,
    402,
  );
  assert.equal(
    rows.find((p) => p.id === "swampert" && p.preset === "fastest").speed,
    184,
  );
  assert.ok(rows.every((p) => !p.mega || p.preset !== "scarf"));
  const unburden = compareSpeedBuilds(roster.pokemon, "garchomp", 169, "all", {
    stage: 2,
    ability: "unburden",
  });
  assert.equal(unburden.filter((p) => p.id === "hawlucha").length, 4);
  assert.equal(
    unburden.find((p) => p.id === "hawlucha" && p.preset === "fastest").speed,
    748,
  );
  assert.ok(unburden.some((p) => p.id === "dragonite" && p.preset === "scarf"));
});

test("a filter with no eligible opponents yields an empty comparison", () => {
  const mega = roster.pokemon.filter((p) => p.mega);
  assert.deepEqual(compareSpeedBuilds(mega, "garchompmega", 158, "scarf"), []);
});

test("default list includes only reachable boosted ranks and retains every neutral build", () => {
  const all = compareSpeedBuilds(roster.pokemon, "garchomp", 169);
  assert.equal(new Set(all.map((p) => p.rowId)).size, all.length);
  assert.ok(all.every((p, i) => i === 0 || all[i - 1].speed >= p.speed));
  for (const stage of [0, 1, 2]) {
    const filtered = compareSpeedBuilds(
      roster.pokemon,
      "garchomp",
      169,
      "all",
      { stage, ability: "none" },
    );
    assert.deepEqual(
      filtered,
      all.filter((p) => p.appliedConfig.stage === stage),
    );
  }
  for (const id of [
    "gengar",
    "gholdengo",
    "ditto",
    "staraptormega",
    "malamarmega",
  ]) {
    const rows = all.filter((p) => p.id === id);
    assert.ok(rows.length > 0);
    assert.ok(
      rows.every((p) => p.appliedConfig.stage === 0),
      id,
    );
  }
  assert.deepEqual(
    all
      .filter((p) => p.id === "dragonite" && p.preset === "fastest")
      .map((p) => [p.appliedConfig.stage, p.speed]),
    [
      [2, 290],
      [1, 217],
      [0, 145],
    ],
  );
  const dragonDance = all.find(
    (p) => p.id === "dragonite" && p.appliedConfig.stage === 2,
  );
  assert.ok(dragonDance.rankSources.includes("りゅうのまい ×2"));
});

test("boost witnesses distinguish one-stage, two-stage and once-only effects", () => {
  const rows = compareSpeedBuilds(roster.pokemon, "garchomp", 169, "fastest");
  const find = (id, stage) =>
    rows.find((p) => p.id === id && p.appliedConfig.stage === stage);
  assert.match(find("torkoal", 2).rankSources.join(), /からをやぶる ×1/);
  assert.doesNotMatch(find("torkoal", 1).rankSources.join(), /からをやぶる/);
  assert.match(
    find("skarmory", 2).rankSources.join(),
    /くだけるよろい ×1（物理技を受けた後）/,
  );
  assert.equal(find("skarmory", 1), undefined);
  assert.equal(find("cameruptmega", 1), undefined);
  assert.equal(find("cameruptmega", 2), undefined);
  assert.match(find("blaziken", 1).rankSources.join(), /かそく ×1/);
  assert.match(find("blaziken", 2).rankSources.join(), /かそく ×2/);
  assert.match(find("greninja", 1).rankSources.join(), /きずなへんげ/);
  assert.doesNotMatch(find("greninja", 2).rankSources.join(), /きずなへんげ/);
  assert.match(find("swampert", 1).rankSources.join(), /追加効果発動時/);
});

test("rank abilities are not stacked with a different active ability", async () => {
  const { speedRankSources } = await import("../src/speed-boosts.ts");
  const skarmory = roster.pokemon.find((p) => p.id === "skarmory");
  const config = { ...speedPresets.fastest, stage: 2 };
  assert.ok(
    speedRankSources(skarmory, config).some((s) =>
      s.includes("くだけるよろい"),
    ),
  );
  assert.ok(
    speedRankSources(skarmory, config, "Sturdy").every(
      (s) => !s.includes("くだけるよろい"),
    ),
  );
  assert.deepEqual(
    speedRankSources({ ...skarmory, id: "unknown" }, config),
    [],
  );
});
