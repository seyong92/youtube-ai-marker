import { clearCache, getSettings, setSettings } from "../shared/storage";
import type { FilterMode, PageStats } from "../shared/types";

void initialize();

async function initialize(): Promise<void> {
  localize();
  const settings = await getSettings();
  const selected = document.querySelector<HTMLInputElement>(`input[name='mode'][value='${settings.mode}']`);
  if (selected) selected.checked = true;

  document.querySelectorAll<HTMLInputElement>("input[name='mode']").forEach((input) => {
    input.addEventListener("change", () => {
      if (input.checked) void setSettings({ mode: input.value as FilterMode });
    });
  });

  document.querySelector<HTMLButtonElement>("#clear-cache")?.addEventListener("click", async () => {
    await clearCache();
    const button = document.querySelector<HTMLButtonElement>("#clear-cache");
    if (button) button.textContent = chrome.i18n.getMessage("cacheCleared");
  });

  await loadStats();
}

function localize(): void {
  document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((element) => {
    const key = element.dataset.i18n;
    if (key) element.textContent = chrome.i18n.getMessage(key);
  });
}

async function loadStats(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab.id) {
    setText("status", chrome.i18n.getMessage("openYouTube"));
    return;
  }

  try {
    const stats = await chrome.tabs.sendMessage(tab.id, { type: "yam:get-stats" }) as PageStats;
    setText("checked-count", String(stats.checked));
    setText("marked-count", String(stats.marked));
    setText("hidden-count", String(stats.hidden));
    setText("status", chrome.i18n.getMessage(stats.health === "ok" ? "statusOk" : "statusDegraded"));
    document.querySelector("#status")?.classList.toggle("warning", stats.health === "degraded");
  } catch {
    setText("status", chrome.i18n.getMessage("statusUnavailable"));
  }
}

function setText(id: string, value: string): void {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}
