export type PersistenceResult =
  | { ok: true }
  | { ok: false; reason: "disabled" | "failed" };

type KeyValueStorage = Pick<Storage, "setItem">;

export function writeSavedData(
  storage: KeyValueStorage,
  key: string,
  value: unknown,
  allowed: boolean,
): PersistenceResult {
  if (!allowed) return { ok: false, reason: "disabled" };

  try {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) return { ok: false, reason: "failed" };
    storage.setItem(key, serialized);
    return { ok: true };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
