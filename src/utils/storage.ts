/**
 * Thin, fail-safe localStorage JSON helpers. All persisted keys carry the
 * `ppl.v1.` version prefix (docs/03 §7); write a migration when bumping.
 */

export const STORAGE_KEYS = {
  decks: "ppl.v1.decks",
  activeDeckId: "ppl.v1.activeDeckId",
  basicTags: "ppl.v1.basicTags",
  settings: "ppl.v1.settings",
} as const;

export function readJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch (err) {
    console.warn(`[storage] failed to read ${key}:`, err);
    return null;
  }
}

export function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`[storage] failed to write ${key}:`, err);
  }
}

export function removeKey(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (err) {
    console.warn(`[storage] failed to remove ${key}:`, err);
  }
}
