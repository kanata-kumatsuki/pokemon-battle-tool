import test from "node:test";
import assert from "node:assert/strict";
import {
  getPokemon,
  itemCatalog,
  itemsForPokemon,
  pokemon,
  makeBuild,
} from "../src/data.ts";
import { assumptions, unknownInfo } from "../src/predictions.ts";

test("Garchomp offers only its two Mega Stones alongside general items", () => {
  const options = itemsForPokemon(getPokemon(445));
  assert.deepEqual(
    Object.values(itemCatalog)
      .filter((i) => i.megaStone && options.includes(i.name))
      .map((i) => i.name),
    ["ガブリアスナイト", "ガブリアスナイトＺ"],
  );
  assert.ok(options.includes("きあいのタスキ"));
  assert.ok(options.includes("たべのこし"));
  assert.ok(!options.includes("でんきだま"));
  assert.ok(!options.includes("ながねぎ"));
  assert.equal(options[0], "もちものなし");
});

test("exclusive items distinguish evolved species and regional forms", () => {
  assert.ok(itemsForPokemon(getPokemon(25)).includes("でんきだま"));
  assert.ok(!itemsForPokemon(getPokemon(26)).includes("でんきだま"));
  for (const id of ["farfetchd", "sirfetchd"]) {
    const p = pokemon.find((p) => p.speciesId === id);
    assert.ok(p, id);
    assert.ok(itemsForPokemon(p).includes("ながねぎ"), id);
  }
  const alolanRaichu = pokemon.find((p) => p.speciesId === "raichualola");
  assert.ok(alolanRaichu);
  assert.ok(!itemsForPokemon(alolanRaichu).includes("ライチュウナイトＸ"));
  assert.ok(itemsForPokemon(getPokemon(26)).includes("ライチュウナイトＸ"));
});

test("all directly selected Mega forms exclude additional held items", () => {
  for (const p of pokemon.filter((p) => p.mega)) {
    assert.deepEqual(itemsForPokemon(p), ["もちものなし"], p.name);
    assert.ok(itemsForPokemon(p).includes(makeBuild(p.id).item));
  }
});

test("general conditional items remain available regardless of the current moves", () => {
  const options = itemsForPokemon(getPokemon(445));
  for (const name of [
    "もくたん",
    "しめったいわ",
    "ひかりのねんど",
    "エレキシード",
  ])
    assert.ok(options.includes(name), name);
  const before = JSON.stringify(itemCatalog);
  itemsForPokemon(getPokemon(1000));
  assert.equal(JSON.stringify(itemCatalog), before);
});

test("usage suggestions cannot apply another species' exclusive item", () => {
  const build = makeBuild(445);
  const usage = {
    speciesId: "garchomp",
    season: "M6",
    date: "2026-09-19",
    rows: [{ category: "held_item", name: "Light Ball", rank: 1, percent: 90 }],
  };
  assert.ok(
    assumptions(build, unknownInfo(), usage).every(
      (a) => a.build.item !== "でんきだま",
    ),
  );
  usage.rows[0].name = "Garchompite Z";
  assert.equal(
    assumptions(build, unknownInfo(), usage)[0].build.item,
    "ガブリアスナイトＺ",
  );
});
