import test from "node:test";
import assert from "node:assert/strict";
import {
  FIRST_USE_GUIDE_STORAGE_KEY,
  markFirstUseGuideSeen,
  shouldShowFirstUseGuide,
} from "../src/first-use-guide-state.ts";

function makeStorage({ fail = false } = {}) {
  const values = new Map();
  return {
    values,
    setItem(key, value) {
      if (fail) throw new Error("QuotaExceededError");
      values.set(key, value);
    },
  };
}

test("first use requires both saved data and the guide marker to be absent", () => {
  assert.equal(shouldShowFirstUseGuide(null, null), true);
  assert.equal(shouldShowFirstUseGuide("{}", null), false);
  assert.equal(shouldShowFirstUseGuide(null, "shown"), false);
  assert.equal(shouldShowFirstUseGuide("{}", "shown"), false);
});

test("unreadable storage does not assume a new user", () => {
  assert.equal(shouldShowFirstUseGuide(null, null, false), false);
});

test("the guide marker is stored independently under its own key", () => {
  const storage = makeStorage();

  assert.equal(markFirstUseGuideSeen(storage), true);
  assert.equal(storage.values.get(FIRST_USE_GUIDE_STORAGE_KEY), "shown");
  assert.equal(storage.values.has("battle-note-ui-v1"), false);
});

test("a marker write failure is reported without throwing", () => {
  assert.equal(markFirstUseGuideSeen(makeStorage({ fail: true })), false);
});
