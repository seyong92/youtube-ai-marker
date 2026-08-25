const CARD_SELECTORS = [
  "ytd-rich-item-renderer",
  "ytd-video-renderer",
  "ytd-grid-video-renderer",
  "ytd-compact-video-renderer",
  "ytd-playlist-video-renderer",
].join(",");

const VIDEO_LINK_SELECTORS = [
  "a#thumbnail[href*='/watch']",
  "a#video-title[href*='/watch']",
  "a.yt-lockup-view-model__content-image[href*='/watch']",
].join(",");

export interface VideoCard {
  element: HTMLElement;
  videoId: string;
}

export function discoverVideoCards(root: ParentNode = document): VideoCard[] {
  const elements = new Set<HTMLElement>();
  if (root instanceof HTMLElement) {
    const containingCard = root.closest<HTMLElement>(CARD_SELECTORS);
    if (containingCard) elements.add(containingCard);
  }
  root.querySelectorAll<HTMLElement>(CARD_SELECTORS).forEach((element) => elements.add(element));

  // YouTube is gradually replacing renderer elements with lockup view models.
  root.querySelectorAll<HTMLAnchorElement>("a.yt-lockup-view-model__content-image[href*='/watch']")
    .forEach((link) => {
      const card = link.closest<HTMLElement>("yt-lockup-view-model, .yt-lockup-view-model");
      if (card) elements.add(card);
    });

  return [...elements].flatMap((element) => {
    const link = element.querySelector<HTMLAnchorElement>(VIDEO_LINK_SELECTORS);
    const videoId = link ? getVideoId(link.href) : null;
    return videoId ? [{ element, videoId }] : [];
  });
}

export function getVideoId(href: string): string | null {
  try {
    const url = new URL(href, location.origin);
    if (url.pathname !== "/watch") return null;
    const videoId = url.searchParams.get("v");
    return videoId && /^[A-Za-z0-9_-]{11}$/.test(videoId) ? videoId : null;
  } catch {
    return null;
  }
}

export function findThumbnail(card: HTMLElement): HTMLElement | null {
  return card.querySelector<HTMLElement>("a#thumbnail")
    ?? card.querySelector<HTMLElement>(".yt-lockup-view-model__content-image")
    ?? card.querySelector<HTMLElement>("ytd-thumbnail");
}
