import test from "node:test";
import assert from "node:assert/strict";
import { writeSavedData } from "../src/persistence.ts";

function makeStorage(entries = []) {
  const values = new Map(entries);
  let calls = 0;
  let failedWrites = 0;
  return {
    values,
    get calls() {
      return calls;
    },
    failNextWrite() {
      failedWrites += 1;
    },
    setItem(key, value) {
      calls += 1;
      if (failedWrites > 0) {
        failedWrites -= 1;
        throw new Error("QuotaExceededError");
      }
      values.set(key, value);
    },
  };
}

test("saved data is serialized and written when persistence is allowed", () => {
  const storage = makeStorage();
  const data = { version: 1, parties: [{ name: "QA" }] };

  assert.deepEqual(writeSavedData(storage, "battle-note-ui-v1", data, true), {
    ok: true,
  });
  assert.equal(storage.values.get("battle-note-ui-v1"), JSON.stringify(data));
  assert.equal(storage.calls, 1);
});

test("a failed storage write leaves the previously saved value intact", () => {
  const key = "battle-note-ui-v1";
  const previous = "previous saved value";
  const storage = makeStorage([[key, previous]]);
  storage.failNextWrite();

  assert.deepEqual(writeSavedData(storage, key, { version: 1 }, true), {
    ok: false,
    reason: "failed",
  });
  assert.equal(storage.values.get(key), previous);
  assert.equal(storage.calls, 1);
});

test("a successful write recovers after a failed write", () => {
  const key = "battle-note-ui-v1";
  const previous = "previous saved value";
  const storage = makeStorage([[key, previous]]);
  storage.failNextWrite();

  assert.deepEqual(writeSavedData(storage, key, { version: 1 }, true), {
    ok: false,
    reason: "failed",
  });
  assert.equal(storage.values.get(key), previous);
  assert.deepEqual(writeSavedData(storage, key, { version: 1 }, true), {
    ok: true,
  });
  assert.deepEqual(JSON.parse(storage.values.get(key)), { version: 1 });
  assert.equal(storage.calls, 2);
});

test("disabled persistence does not call storage or replace its previous value", () => {
  const key = "battle-note-ui-v1";
  const previous = "existing protected value";
  const storage = makeStorage([[key, previous]]);

  assert.deepEqual(writeSavedData(storage, key, { version: 1 }, false), {
    ok: false,
    reason: "disabled",
  });
  assert.equal(storage.values.get(key), previous);
  assert.equal(storage.calls, 0);
});
