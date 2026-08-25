import { cacheStatus, getCachedStatus, getSettings, isSettingsChange } from "../shared/storage";
import type { DisclosureStatus, FilterMode, PageStats } from "../shared/types";
import { discoverVideoCards, findThumbnail, type VideoCard } from "./cards";
import { classifyWatchHtml } from "./disclosure-adapter";
import { RequestQueue } from "./request-queue";

const queue = new RequestQueue(3);
const inFlight = new Map<string, Promise<DisclosureStatus>>();
const cardStatus = new WeakMap<HTMLElement, DisclosureStatus>();
let mode: FilterMode = "mark";
let failedRequests = 0;
let stats: PageStats = emptyStats();
let scanScheduled = false;

const intersectionObserver = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    intersectionObserver.unobserve(entry.target);
    const card = entry.target as HTMLElement;
    const videoId = card.dataset.yamVideoId;
    if (videoId) void classifyAndRender({ element: card, videoId });
  }
}, { rootMargin: "600px 0px" });

void initialize();

async function initialize(): Promise<void> {
  mode = (await getSettings()).mode;
  scan(document);

  const mutationObserver = new MutationObserver((mutations) => {
    if (mutations.length > 0) scheduleScan();
  });
  mutationObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["href"],
  });
  document.addEventListener("yt-navigate-finish", scheduleScan);

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    const settings = isSettingsChange(changes);
    if (!settings) return;
    mode = settings.mode;
    document.querySelectorAll<HTMLElement>("[data-yam-status='ai']").forEach(applyMode);
    recount();
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "yam:get-stats") sendResponse(stats);
  });
}

function scan(root: ParentNode): void {
  for (const card of discoverVideoCards(root)) {
    if (card.element.dataset.yamVideoId === card.videoId) {
      if (card.element.dataset.yamStatus === "ai") ensureBadge(card.element);
      continue;
    }
    cardStatus.delete(card.element);
    card.element.classList.remove("yam-ai-card", "yam-ai-blurred", "yam-ai-hidden");
    card.element.querySelector(".yam-ai-badge")?.remove();
    card.element.dataset.yamVideoId = card.videoId;
    delete card.element.dataset.yamStatus;
    intersectionObserver.observe(card.element);
  }
  recount();
}

async function classifyAndRender(card: VideoCard): Promise<void> {
  let cached: DisclosureStatus | null = null;
  try {
    cached = await getCachedStatus(card.videoId);
  } catch {
    failedRequests += 1;
  }
  const status = cached ?? await getOrCreateRequest(card.videoId);
  if (card.element.dataset.yamVideoId !== card.videoId) return;
  cardStatus.set(card.element, status);
  card.element.dataset.yamStatus = status;
  render(card.element, status);
  recount();
}

function getOrCreateRequest(videoId: string): Promise<DisclosureStatus> {
  const existing = inFlight.get(videoId);
  if (existing) return existing;

  const request = queue.run(async () => {
    try {
      const response = await fetch(`/watch?v=${encodeURIComponent(videoId)}&hl=en`, {
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error(`YouTube returned ${response.status}`);
      const status = classifyWatchHtml(await response.text());
      if (status === "unknown") failedRequests += 1;
      await cacheStatus(videoId, status);
      return status;
    } catch {
      failedRequests += 1;
      try {
        await cacheStatus(videoId, "unknown");
      } catch {
        // Storage failures must never prevent the fail-open result.
      }
      return "unknown";
    } finally {
      inFlight.delete(videoId);
    }
  });

  inFlight.set(videoId, request);
  return request;
}

function scheduleScan(): void {
  if (scanScheduled) return;
  scanScheduled = true;
  requestAnimationFrame(() => {
    scanScheduled = false;
    scan(document);
  });
}

function render(card: HTMLElement, status: DisclosureStatus): void {
  card.classList.remove("yam-ai-card", "yam-ai-blurred", "yam-ai-hidden");
  if (status !== "ai") {
    card.querySelector(".yam-ai-badge")?.remove();
    return;
  }

  card.classList.add("yam-ai-card");
  ensureBadge(card);
  applyMode(card);
}

function ensureBadge(card: HTMLElement): void {
  const thumbnail = findThumbnail(card);
  if (!thumbnail) return;

  let badge = card.querySelector<HTMLElement>(".yam-ai-badge");
  if (!badge) {
    badge = document.createElement("span");
    badge.className = "yam-ai-badge";
    badge.textContent = chrome.i18n.getMessage("badgeLabel") || "AI disclosed";
  }
  if (badge.parentElement !== thumbnail) {
    thumbnail.append(badge);
  }
}

function applyMode(card: HTMLElement): void {
  card.classList.toggle("yam-ai-blurred", mode === "blur");
  card.classList.toggle("yam-ai-hidden", mode === "hide");
}

function recount(): void {
  const cards = [...document.querySelectorAll<HTMLElement>("[data-yam-video-id]")];
  stats = {
    checked: cards.filter((card) => cardStatus.has(card)).length,
    marked: cards.filter((card) => card.dataset.yamStatus === "ai").length,
    hidden: cards.filter((card) => card.classList.contains("yam-ai-hidden")).length,
    pending: cards.filter((card) => !cardStatus.has(card)).length,
    health: failedRequests >= 3 ? "degraded" : "ok",
  };
}

function emptyStats(): PageStats {
  return { checked: 0, marked: 0, hidden: 0, pending: 0, health: "ok" };
}
