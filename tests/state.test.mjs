import test from "node:test";
import assert from "node:assert/strict";
import {
  addHistory,
  initialData,
  makeBuild,
  validateSavedData,
} from "../src/data.ts";

test("history keeps the most recent six distinct builds without modifying the source", () => {
  const ids = [445, 1000, 149, 778, 10009, 823, 637];
  let history = [];
  for (const id of ids) history = addHistory(history, makeBuild(id));
  assert.deepEqual(
    history.map((b) => b.pokemonId),
    ids.slice(1).reverse(),
  );
  const previous = structuredClone(history);
  const selected = makeBuild(149);
  const next = addHistory(history, selected);
  assert.equal(next.length, 6);
  assert.equal(next[0].pokemonId, 149);
  assert.equal(next.filter((b) => b.pokemonId === 149).length, 1);
  selected.points[0] = 0;
  assert.equal(next[0].points[0], 2);
  assert.deepEqual(history, previous);
});

test("different builds of the same species remain separate; attack and defense histories are independent", () => {
  const saved = initialData();
  const first = makeBuild(445);
  const second = { ...first, item: "こだわりスカーフ" };
  saved.attackHistory = addHistory(
    addHistory(saved.attackHistory, first),
    second,
  );
  assert.equal(saved.attackHistory.length, 2);
  assert.equal(saved.defenseHistory.length, 0);
  assert.ok(validateSavedData(saved));
});

test("party and history backup round trips through JSON", () => {
  const saved = initialData();
  saved.parties[1].members[0] = makeBuild(730);
  saved.parties[1].name = "テストパーティ";
  saved.attackHistory = addHistory([], makeBuild(778));
  const restored = JSON.parse(JSON.stringify(saved));
  assert.ok(validateSavedData(restored));
  assert.deepEqual(restored, saved);
});

test("invalid backup shape, bounds and identifiers are rejected before replacement", () => {
  for (const bad of [null, [], {}, { version: 2 }, "data"])
    assert.equal(validateSavedData(bad), false);
  const mutations = [
    (d) => d.parties.push(d.parties[0]),
    (d) => d.parties[0].members.pop(),
    (d) =>
      d.attackHistory.push(...Array.from({ length: 7 }, () => makeBuild(445))),
    (d) => {
      d.parties[0].members[0].pokemonId = -1;
    },
    (d) => {
      d.parties[0].members[0].points = [32, 32, 32, 0, 0, 0];
    },
    (d) => {
      d.parties[0].members[0].points[0] = -1;
    },
    (d) => {
      d.parties[0].members[0].points[0] = 1.5;
    },
    (d) => {
      d.parties[0].members[0].ability = "unrecognized";
    },
    (d) => {
      d.parties[0].members[0].moves = ["unrecognized"];
    },
  ];
  for (const mutate of mutations) {
    const data = initialData();
    mutate(data);
    assert.equal(validateSavedData(data), false);
  }
});
