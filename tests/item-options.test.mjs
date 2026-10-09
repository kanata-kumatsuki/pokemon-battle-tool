import test from "node:test";
import assert from "node:assert/strict";
import { getPokemon, itemsForPokemon, supportedSeason } from "../src/data.ts";
import { itemOptions } from "../src/item-options.ts";

const garchomp = getPokemon(445);
const snapshot = (rows) => ({
  speciesId: "garchomp",
  season: supportedSeason,
  date: "2026-09-20",
  rows,
});
const row = (name, percent, rank) => ({
  category: "held_item",
  name,
  percent,
  rank,
});
const names = (result) => result.options.map((o) => o.name);

test("held items are ordered by this species' adoption percentages without changing eligibility", () => {
  const usage = snapshot([
    row("Leftovers", 3, 3),
    row("Garchompite Z", 50, 1),
    row("Focus Sash", 25, 2),
    row("Absolite", 99, 1),
    row("Unknown", 100, 1),
    { ...row("Life Orb", 90, 1), category: "move" },
  ]);
  const before = structuredClone(usage);
  const result = itemOptions(garchomp, usage);
  assert.deepEqual(names(result).slice(0, 4), [
    "もちものなし",
    "ガブリアスナイトＺ",
    "きあいのタスキ",
    "たべのこし",
  ]);
  assert.equal(result.usePercent, true);
  assert.deepEqual(new Set(names(result)), new Set(itemsForPokemon(garchomp)));
  assert.deepEqual(usage, before);
  const tail = names(result).slice(4);
  assert.deepEqual(tail, [...tail].sort(new Intl.Collator("ja").compare));
});

test("missing, wrong species and unsupported season data fall back to Japanese order", () => {
  for (const usage of [
    undefined,
    snapshot([]),
    { ...snapshot([row("Focus Sash", 80, 1)]), speciesId: "gholdengo" },
    { ...snapshot([row("Focus Sash", 80, 1)]), season: "unsupported" },
  ]) {
    const result = itemOptions(garchomp, usage);
    assert.equal(result.hasUsage, false);
    assert.equal(names(result)[0], "もちものなし");
    assert.deepEqual(
      names(result).slice(1),
      itemsForPokemon(garchomp).slice(1).sort(new Intl.Collator("ja").compare),
    );
  }
});

test("rank-only or mixed coverage uses source ranks without fabricating percentages", () => {
  const result = itemOptions(
    garchomp,
    snapshot([
      row("Leftovers", 40, 2),
      row("Focus Sash", null, 1),
      row("Life Orb", null, 3),
    ]),
  );
  assert.equal(result.hasUsage, true);
  assert.equal(result.usePercent, false);
  assert.deepEqual(names(result).slice(1, 4), [
    "きあいのタスキ",
    "たべのこし",
    "いのちのたま",
  ]);
  assert.equal(result.options[1].usage.percent, null);
});

test("Japanese aliases, ties and zero percent entries retain their reported values", () => {
  const result = itemOptions(
    garchomp,
    snapshot([
      row("ガブリアスナイトZ", 10, 2),
      row("Focus Sash", 10, 1),
      row("Leftovers", 0, 3),
    ]),
  );
  assert.deepEqual(names(result).slice(1, 4), [
    "きあいのタスキ",
    "ガブリアスナイトＺ",
    "たべのこし",
  ]);
  assert.equal(result.options[3].usage.percent, 0);
});
