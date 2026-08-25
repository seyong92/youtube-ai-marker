export type FilterMode = "mark" | "blur" | "hide";
export type DisclosureStatus = "ai" | "not-ai" | "unknown";
export type HealthStatus = "ok" | "degraded";

export interface Settings {
  mode: FilterMode;
}

export interface CacheEntry {
  status: DisclosureStatus;
  checkedAt: number;
}

export interface PageStats {
  checked: number;
  marked: number;
  hidden: number;
  pending: number;
  health: HealthStatus;
}

export const DEFAULT_SETTINGS: Settings = { mode: "mark" };
