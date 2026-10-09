import test from "node:test";
import assert from "node:assert/strict";
import {
  duplicateItemWarning,
  partyHasChanges,
  partySaveErrors,
} from "../src/party-validation.ts";
import { makeBuild } from "../src/data.ts";
const member = (id, item) => ({ ...makeBuild(id), item });
test("duplicate held items identify every affected slot without changing the draft", () => {
  const party = {
    name: "確認",
    members: [
      member(445, "きあいのタスキ"),
      member(149, "きあいのタスキ"),
      member(1000, "たべのこし"),
      null,
      member(778, "たべのこし"),
      member(823, "きあいのタスキ"),
    ],
  };
  const before = structuredClone(party);
  const warning = duplicateItemWarning(party);
  assert.match(warning, /もちものが重複しています/);
  assert.match(
    warning,
    /きあいのタスキ（1枠目のガブリアス・2枠目のカイリュー・6枠目のアーマーガア）/,
  );
  assert.match(warning, /たべのこし（3枠目のサーフゴー・5枠目のミミッキュ）/);
  assert.deepEqual(party, before);
});
test("empty slots and multiple itemless members are allowed; fixing a duplicate clears the warning", () => {
  const party = {
    name: "確認",
    members: [
      member(445, "もちものなし"),
      member(149, "もちものなし"),
      null,
      member(1000, "たべのこし"),
      null,
      null,
    ],
  };
  assert.equal(duplicateItemWarning(party), "");
  party.members[1].item = "たべのこし";
  assert.notEqual(duplicateItemWarning(party), "");
  party.members[1].item = "ラムのみ";
  assert.equal(duplicateItemWarning(party), "");
  assert.equal(
    duplicateItemWarning({ name: "空", members: Array(6).fill(null) }),
    "",
  );
});
test("item aliases share identity but different Mega Stones are distinct", () => {
  assert.notEqual(
    duplicateItemWarning({
      name: "確認",
      members: [member(445, "Focus Sash"), member(149, "きあいのタスキ")],
    }),
    "",
  );
  assert.equal(
    duplicateItemWarning({
      name: "確認",
      members: [
        member(445, "ガブリアスナイト"),
        member(445, "ガブリアスナイトＺ"),
      ],
    }),
    "",
  );
});

test("party dirty state compares the saved values, including nested build edits", () => {
  const saved = {
    name: "確認",
    members: [member(445, "きあいのタスキ"), null, null, null, null, null],
  };
  assert.equal(partyHasChanges(structuredClone(saved), saved), false);
  assert.equal(partyHasChanges({ ...saved, name: "別の名前" }, saved), true);
  const changedBuild = structuredClone(saved);
  changedBuild.members[0].points[1] += 1;
  assert.equal(partyHasChanges(changedBuild, saved), true);
  const changedSlot = structuredClone(saved);
  changedSlot.members[1] = member(149, "もちものなし");
  assert.equal(partyHasChanges(changedSlot, saved), true);
});

test("complete party saves report blank names and duplicate items across every draft", () => {
  const parties = [
    { name: "   ", members: Array(6).fill(null) },
    {
      name: "二つ目",
      members: [
        member(445, "きあいのタスキ"),
        member(149, "きあいのタスキ"),
        null,
        null,
        null,
        null,
      ],
    },
    { name: "三つ目", members: Array(6).fill(null) },
  ];
  const errors = partySaveErrors(parties, [0, 1]);
  assert.equal(errors.length, 2);
  assert.match(errors[0], /パーティ1の名前を入力してください/);
  assert.match(errors[1], /パーティ2「二つ目」：もちものが重複しています/);
  assert.match(errors[1], /1枠目のガブリアス・2枠目のカイリュー/);
});

test("an unchanged legacy party does not block saving another valid party", () => {
  const parties = [
    {
      name: "旧パーティ",
      members: [
        member(445, "きあいのタスキ"),
        member(149, "きあいのタスキ"),
        null,
        null,
        null,
        null,
      ],
    },
    { name: "編集したパーティ", members: Array(6).fill(null) },
    { name: "パーティ 3", members: Array(6).fill(null) },
  ];

  assert.deepEqual(partySaveErrors(parties, [1]), []);
});
