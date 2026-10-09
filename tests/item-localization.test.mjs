import test from "node:test";
import assert from "node:assert/strict";
import {
  items,
  itemCatalog,
  englishItem,
  initialData,
  makeBuild,
  normalizeSavedData,
  validateSavedData,
} from "../src/data.ts";

test("every held item has a Japanese display name and a working calculator mapping", () => {
  assert.ok(items.every((name) => /[ぁ-んァ-ヶ一-龯]/u.test(name)));
  assert.equal(new Set(items).size, items.length);
  for (const item of Object.values(itemCatalog)) {
    assert.equal(englishItem(item.name), item.englishName);
  }
  assert.equal(itemCatalog.absolitez.name, "アブソルナイトＺ");
  assert.equal(itemCatalog.delphoxite.name, "マフォクシナイト");
});

test("legacy English item labels migrate in parties and both histories without mutating the original", () => {
  for (const item of Object.values(itemCatalog)) {
    const saved = initialData();
    saved.parties[0].members[0].item = item.englishName;
    saved.attackHistory = [{ ...makeBuild(445), item: item.englishName }];
    saved.defenseHistory = [{ ...makeBuild(1000), item: item.englishName }];
    const before = structuredClone(saved);
    const migrated = normalizeSavedData(JSON.parse(JSON.stringify(saved)));
    assert.ok(migrated, item.englishName);
    assert.equal(migrated.parties[0].members[0].item, item.name);
    assert.equal(migrated.attackHistory[0].item, item.name);
    assert.equal(migrated.defenseHistory[0].item, item.name);
    assert.ok(validateSavedData(migrated));
    assert.deepEqual(saved, before);
  }
});

test("Japanese backups round trip and invalid data is not legalized by migration", () => {
  const saved = initialData();
  assert.deepEqual(normalizeSavedData(saved), saved);
  saved.parties[0].members[0].item = "アブソルナイトZ";
  assert.equal(
    normalizeSavedData(saved).parties[0].members[0].item,
    "アブソルナイトＺ",
  );
  saved.parties[0].members[0].item = "Unknown Stone";
  assert.equal(normalizeSavedData(saved), null);
  for (const bad of [
    null,
    [],
    {},
    "data",
    { parties: [null], attackHistory: [], defenseHistory: [] },
  ]) {
    assert.equal(normalizeSavedData(bad), null);
  }
});
