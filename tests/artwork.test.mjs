import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import manifest from "../src/generated/artwork.json" with { type: "json" };
import roster from "../src/generated/speed-roster.json" with { type: "json" };
import { artwork, pokemon } from "../src/data.ts";

test("every selectable and speed-comparison form has an intact local full illustration", async () => {
  const speciesIds = pokemon.map((p) => p.speciesId).sort();
  assert.deepEqual(Object.keys(manifest.artwork).sort(), speciesIds);
  assert.deepEqual(roster.pokemon.map((p) => p.id).sort(), speciesIds);
  for (const id of speciesIds) {
    const entry = manifest.artwork[id];
    assert.equal(artwork(id), entry.path);
    const bytes = await readFile(
      new URL(`../public${entry.path}`, import.meta.url),
    );
    assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", id);
    assert.equal(bytes.readUInt32BE(16), entry.width, id);
    assert.equal(bytes.readUInt32BE(20), entry.height, id);
    assert.ok(entry.width >= 100 && entry.height >= 100, id);
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      entry.sha256,
      id,
    );
  }
});

test("visually distinct forms retain distinct full illustrations", () => {
  for (const forms of [
    ["charizard", "charizardmegax", "charizardmegay"],
    ["garchomp", "garchompmega", "garchompmegaz"],
    ["vivillon", "vivillonfancy", "vivillonpokeball"],
    ["mimikyu", "mimikyubusted"],
    ["meowstic", "meowsticf"],
    ["maushold", "mausholdfour"],
    ["raichu", "raichualola"],
  ]) {
    assert.equal(
      new Set(forms.map((id) => manifest.artwork[id].sha256)).size,
      forms.length,
      forms.join(", "),
    );
  }
});
