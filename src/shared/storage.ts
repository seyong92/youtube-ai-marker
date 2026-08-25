import type { CacheEntry, DisclosureStatus, Settings } from "./types";
import { DEFAULT_SETTINGS } from "./types";

const SETTINGS_KEY = "yam:settings:v1";
const CACHE_KEY = "yam:cache:v2";
const MAX_CACHE_ENTRIES = 2_000;

const TTL: Record<DisclosureStatus, number> = {
  ai: 7 * 24 * 60 * 60 * 1_000,
  "not-ai": 24 * 60 * 60 * 1_000,
  unknown: 15 * 60 * 1_000,
};

type CacheRecord = Record<string, CacheEntry>;
let pendingCacheWrite: Promise<void> = Promise.resolve();

export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  const stored = result[SETTINGS_KEY] as Partial<Settings> | undefined;
  const mode = stored?.mode;
  return mode === "mark" || mode === "blur" || mode === "hide"
    ? { mode }
    : DEFAULT_SETTINGS;
}

export async function setSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
}

export async function getCachedStatus(videoId: string, now = Date.now()): Promise<DisclosureStatus | null> {
  const result = await chrome.storage.local.get(CACHE_KEY);
  const cache = (result[CACHE_KEY] ?? {}) as CacheRecord;
  const entry = cache[videoId];
  if (!entry || now - entry.checkedAt > TTL[entry.status]) return null;
  return entry.status;
}

export async function cacheStatus(videoId: string, status: DisclosureStatus): Promise<void> {
  pendingCacheWrite = pendingCacheWrite.catch(() => undefined).then(async () => {
    const result = await chrome.storage.local.get(CACHE_KEY);
    const cache = (result[CACHE_KEY] ?? {}) as CacheRecord;
    cache[videoId] = { status, checkedAt: Date.now() };

    const entries = Object.entries(cache);
    if (entries.length > MAX_CACHE_ENTRIES) {
      entries
        .sort(([, left], [, right]) => right.checkedAt - left.checkedAt)
        .slice(MAX_CACHE_ENTRIES)
        .forEach(([id]) => delete cache[id]);
    }

    await chrome.storage.local.set({ [CACHE_KEY]: cache });
  });
  await pendingCacheWrite;
}

export async function clearCache(): Promise<void> {
  await chrome.storage.local.remove(CACHE_KEY);
}

export function isSettingsChange(
  changes: Record<string, chrome.storage.StorageChange>,
): Settings | null {
  const value = changes[SETTINGS_KEY]?.newValue as Partial<Settings> | undefined;
  const mode = value?.mode;
  return mode === "mark" || mode === "blur" || mode === "hide" ? { mode } : null;
}
