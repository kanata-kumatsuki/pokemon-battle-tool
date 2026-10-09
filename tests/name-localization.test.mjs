import test from "node:test";
import assert from "node:assert/strict";
import {
  pokemon,
  abilityCatalog,
  itemCatalog,
  moveCatalog,
  englishAbility,
  englishItem,
  moveByName,
  learnableMoves,
  initialData,
  makeBuild,
  normalizeSavedData,
} from "../src/data.ts";

const japanese = (name) =>
  /[ぁ-んァ-ヶ一-龯]/u.test(name) &&
  (!/[a-z]{2,}/i.test(name.normalize("NFKC")) ||
    name.normalize("NFKC") === "DDラリアット");

test("all abilities, items and moves have Japanese display names and calculator mappings", () => {
  for (const entry of Object.values(abilityCatalog)) {
    assert.ok(japanese(entry.name), entry.name);
    assert.equal(englishAbility(entry.name), entry.englishName);
  }
  for (const entry of Object.values(itemCatalog)) {
    assert.ok(japanese(entry.name), entry.name);
    assert.equal(englishItem(entry.name), entry.englishName);
  }
  for (const entry of Object.values(moveCatalog)) {
    assert.ok(japanese(entry.name), entry.name);
    assert.equal(moveByName(entry.name)?.englishName, entry.englishName);
  }
  for (const p of pokemon) {
    for (const name of p.abilities) {
      assert.ok(japanese(name), `${p.name}: ${name}`);
      assert.ok(englishAbility(name), name);
    }
    for (const [name] of learnableMoves(p))
      assert.ok(japanese(name), `${p.name}: ${name}`);
  }
  assert.equal(abilityCatalog.auraguard.name, "はどうのぼうご");
  assert.equal(abilityCatalog.eelevate.name, "うなぎのぼり");
  assert.equal(abilityCatalog.firemane.name, "ほのおのたてがみ");
});

test("English ability and move labels migrate for every form in parties and both histories", () => {
  for (const p of pokemon) {
    for (const ability of p.abilities) {
      const expected = initialData();
      const build = { ...makeBuild(p.id), ability };
      expected.parties[0].members[0] = build;
      expected.attackHistory = [structuredClone(build)];
      expected.defenseHistory = [structuredClone(build)];
      const legacy = structuredClone(expected);
      for (const b of [
        legacy.parties[0].members[0],
        ...legacy.attackHistory,
        ...legacy.defenseHistory,
      ]) {
        b.ability = englishAbility(b.ability);
        b.moves = b.moves.map((name) => moveByName(name).englishName);
      }
      const before = structuredClone(legacy);
      assert.deepEqual(
        normalizeSavedData(legacy),
        expected,
        `${p.name}: ${ability}`,
      );
      assert.deepEqual(legacy, before);
    }
  }
});

test("localization does not accept unknown, incompatible or duplicate build entries", () => {
  for (const patch of [
    { ability: "Unknown Ability" },
    { ability: "Aura Guard" },
    { moves: ["Unknown Move"] },
    { moves: [null] },
    { moves: ["Earthquake", "じしん"] },
    { moves: ["Make It Rain"] },
  ]) {
    const saved = initialData();
    Object.assign(saved.parties[0].members[0], patch);
    assert.equal(normalizeSavedData(saved), null);
  }
});
