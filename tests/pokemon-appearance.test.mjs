import test from "node:test";
import assert from "node:assert/strict";
import {
  pokemonAppearance,
  getPokemon,
  pokemon,
  itemCatalog,
  makeBuild,
} from "../src/data.ts";
import images from "../src/generated/artwork.json" with { type: "json" };

test("each Mega Stone resolves its exact form and an available local image", () => {
  for (const item of Object.values(itemCatalog)) {
    for (const [baseName, targetName] of Object.entries(item.megaStone ?? {})) {
      const base = pokemon.find((p) => p.calcName === baseName);
      if (!base) continue;
      const appearance = pokemonAppearance(base.id, item.name);
      assert.equal(appearance.calcName, targetName, item.name);
      assert.ok(images.artwork[appearance.speciesId], targetName);
    }
  }
});

test("Garchomp and Charizard stones keep normal, X, Y and Z forms distinct", () => {
  assert.equal(
    pokemonAppearance(445, "ガブリアスナイト").calcName,
    "Garchomp-Mega",
  );
  assert.equal(
    pokemonAppearance(445, "ガブリアスナイトＺ").calcName,
    "Garchomp-Mega-Z",
  );
  assert.equal(
    pokemonAppearance(445, "ガブリアスナイトZ").calcName,
    "Garchomp-Mega-Z",
  );
  assert.equal(
    pokemonAppearance(6, "リザードナイトＸ").calcName,
    "Charizard-Mega-X",
  );
  assert.equal(
    pokemonAppearance(6, "リザードナイトＹ").calcName,
    "Charizard-Mega-Y",
  );
});

test("removing a stone, incompatible stones and existing Mega forms preserve the right appearance", () => {
  for (const item of [
    undefined,
    "もちものなし",
    "きあいのタスキ",
    "アブソルナイト",
    "unknown",
  ]) {
    assert.equal(pokemonAppearance(445, item), getPokemon(445));
  }
  const mega = pokemonAppearance(445, "ガブリアスナイトＺ");
  assert.equal(pokemonAppearance(mega.id, "もちものなし"), mega);
  const build = { ...makeBuild(445), item: "ガブリアスナイトＺ" };
  const before = structuredClone(build);
  pokemonAppearance(build.pokemonId, build.item);
  assert.deepEqual(build, before);
});
