import test from "node:test";
import assert from "node:assert/strict";
import {
  getPokemon,
  pokemon,
  itemCatalog,
  makeBuild,
  resolveBattleBuild,
  validateSavedData,
  initialData,
} from "../src/data.ts";
import {
  calcPokemon,
  damageFor,
  actionOrder,
  defaultSide,
} from "../src/battle.ts";

const field = {
  weather: "なし",
  terrain: "なし",
  trickRoom: false,
  gravity: false,
};
const withStone = (name) => ({ ...makeBuild(445), item: name });

test("Mega Stones change effective stats, typing, ability and speed while preserving the saved base build", () => {
  const base = withStone("ガブリアスナイトＺ");
  const before = structuredClone(base);
  const effective = resolveBattleBuild(base);
  assert.equal(getPokemon(effective.pokemonId).calcName, "Garchomp-Mega-Z");
  assert.equal(effective.ability, "ふゆう");
  assert.deepEqual(getPokemon(effective.pokemonId).types, ["dragon"]);
  assert.deepEqual(
    getPokemon(effective.pokemonId).stats,
    [108, 130, 85, 141, 85, 151],
  );
  assert.equal(calcPokemon(base, defaultSide()).rawStats.spe, 223);
  assert.equal(
    calcPokemon(withStone("ガブリアスナイト"), defaultSide()).rawStats.spe,
    158,
  );
  assert.equal(
    calcPokemon(withStone("もちものなし"), defaultSide()).rawStats.spe,
    169,
  );
  assert.equal(
    resolveBattleBuild({ ...base, item: "もちものなし" }).ability,
    "さめはだ",
  );
  assert.deepEqual(base, before);
  const saved = initialData();
  saved.parties[0].members[0] = base;
  assert.ok(validateSavedData(JSON.parse(JSON.stringify(saved))));
});

test("each compatible Mega Stone gives the corresponding form's calculator stats and ability", () => {
  for (const item of Object.values(itemCatalog)) {
    for (const [name, target] of Object.entries(item.megaStone ?? {})) {
      const base = pokemon.find((p) => p.calcName === name);
      const mega = pokemon.find((p) => p.calcName === target);
      if (!base) continue;
      assert.ok(mega, target);
      const build = { ...makeBuild(base.id), item: item.name };
      const mon = calcPokemon(build, defaultSide());
      const direct = calcPokemon(
        {
          ...build,
          pokemonId: mega.id,
          ability: mega.abilities[0],
          item: "もちものなし",
        },
        defaultSide(),
      );
      assert.equal(mon.name, target);
      assert.equal(mon.ability, direct.ability);
      assert.deepEqual(mon.rawStats, direct.rawStats, item.name);
    }
  }
});

test("damage and action order use Mega stats, Ground STAB removal and Levitate", () => {
  const mega = withStone("ガブリアスナイトＺ");
  const defender = makeBuild(1000);
  const damage = (a, d) =>
    damageFor(a, d, "じしん", defaultSide(), defaultSide(), field);
  assert.ok(damage(mega, defender).max < damage(makeBuild(445), defender).max);
  assert.equal(damage(makeBuild(445), mega).max, 0);
  assert.ok(damage(makeBuild(445), withStone("もちものなし")).max > 0);
  const order = actionOrder(
    mega,
    defender,
    "じしん",
    "シャドーボール",
    defaultSide(),
    defaultSide(),
    field,
  );
  assert.equal(order.attackSpeed, 223);
  assert.equal(order.first, "attack");
});
