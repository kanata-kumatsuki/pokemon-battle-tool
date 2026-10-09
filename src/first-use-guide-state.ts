export const FIRST_USE_GUIDE_STORAGE_KEY = "battle-note-first-use-guide-v1";

type GuideMarkerStorage = Pick<Storage, "setItem">;

export function shouldShowFirstUseGuide(
  savedData: string | null,
  guideMarker: string | null,
  storageReadable = true,
): boolean {
  return storageReadable && savedData === null && guideMarker === null;
}

export function markFirstUseGuideSeen(storage: GuideMarkerStorage): boolean {
  try {
    storage.setItem(FIRST_USE_GUIDE_STORAGE_KEY, "shown");
    return true;
  } catch {
    return false;
  }
}
