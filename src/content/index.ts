import { cacheStatus, getCachedStatus, getSettings, isSettingsChange } from "../shared/storage";
import type { DisclosureStatus, FilterMode, PageStats } from "../shared/types";
import { discoverVideoCards, findThumbnail, type VideoCard } from "./cards";
import { classifyShortsHtml, classifyWatchHtml } from "./disclosure-adapter";
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
    const kind = card.dataset.yamMediaKind;
    if (videoId && (kind === "video" || kind === "short")) {
      void classifyAndRender({ element: card, videoId, kind });
    }
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
    if (card.element.dataset.yamVideoId === card.videoId
      && card.element.dataset.yamMediaKind === card.kind) {
      if (card.element.dataset.yamStatus === "ai") ensureBadge(card.element);
      continue;
    }
    cardStatus.delete(card.element);
    card.element.classList.remove("yam-ai-card", "yam-ai-blurred", "yam-ai-hidden");
    card.element.querySelector(".yam-ai-badge")?.remove();
    card.element.dataset.yamVideoId = card.videoId;
    card.element.dataset.yamMediaKind = card.kind;
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
  const status = cached ?? await getOrCreateRequest(card);
  if (card.element.dataset.yamVideoId !== card.videoId
    || card.element.dataset.yamMediaKind !== card.kind) return;
  cardStatus.set(card.element, status);
  card.element.dataset.yamStatus = status;
  render(card.element, status);
  recount();
}

function getOrCreateRequest(card: VideoCard): Promise<DisclosureStatus> {
  const requestKey = `${card.kind}:${card.videoId}`;
  const existing = inFlight.get(requestKey);
  if (existing) return existing;

  const request = queue.run(async () => {
    try {
      const path = card.kind === "short"
        ? `/shorts/${encodeURIComponent(card.videoId)}?hl=en`
        : `/watch?v=${encodeURIComponent(card.videoId)}&hl=en`;
      const response = await fetch(path, {
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error(`YouTube returned ${response.status}`);
      const html = await response.text();
      const status = card.kind === "short"
        ? classifyShortsHtml(html, card.videoId)
        : classifyWatchHtml(html);
      if (status === "unknown") failedRequests += 1;
      await cacheStatus(card.videoId, status);
      return status;
    } catch {
      failedRequests += 1;
      try {
        await cacheStatus(card.videoId, "unknown");
      } catch {
        // Storage failures must never prevent the fail-open result.
      }
      return "unknown";
    } finally {
      inFlight.delete(requestKey);
    }
  });

  inFlight.set(requestKey, request);
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
