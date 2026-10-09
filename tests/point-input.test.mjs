import test from "node:test";
import assert from "node:assert/strict";
import { parsePointInput } from "../src/point-input.ts";

test("point input accepts half/full-width digits, blank editing and leading zeroes", () => {
  for (const [text, value] of [
    ["", 0],
    ["0", 0],
    ["012", 12],
    ["００１２", 12],
    ["３２", 32],
    ["1２", 12],
    ["　１２　", 12],
  ]) {
    assert.equal(parsePointInput(text, 32), value);
  }
});

test("point input preserves individual and remaining total limits", () => {
  assert.equal(parsePointInput("９９", 32), 32);
  assert.equal(parsePointInput("32", 12), 12);
  assert.equal(parsePointInput("１", 0), 0);
  assert.equal(parsePointInput("9".repeat(400), 32), 32);
});

test("unfinished IME text and non-integer notation do not become point values", () => {
  for (const text of [
    "に",
    "１２あ",
    "abc",
    "1e2",
    "1.2",
    "１．２",
    "-1",
    "+2",
    "1 2",
    "NaN",
    "Infinity",
  ]) {
    assert.equal(parsePointInput(text, 32), null, text);
  }
});
