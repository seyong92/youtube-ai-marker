import type { DisclosureStatus } from "../shared/types";

const INITIAL_DATA_MARKERS = [
  "var ytInitialData = ",
  "window[\"ytInitialData\"] = ",
  "ytInitialData = ",
];

const AI_DISCLOSURE_HELP_ARTICLE = /(?:support\.google\.com\/youtube\/answer\/|\/youtube\/answer\/)?15447836(?:[?&#/]|$)/;

export function classifyWatchHtml(html: string): DisclosureStatus {
  const initialData = extractInitialData(html);
  if (!initialData) return "unknown";

  let foundWatchMetadata = false;
  let foundAiDisclosure = false;

  walk(initialData, (key, value) => {
    if (key === "videoPrimaryInfoRenderer" || key === "watchEndpoint") {
      foundWatchMetadata = true;
    }

    if (key !== "howThisWasMadeSectionViewModel" || !isRecord(value)) return;
    if (containsAiDisclosureHelpLink(value)) foundAiDisclosure = true;
  });

  if (foundAiDisclosure) return "ai";
  return foundWatchMetadata ? "not-ai" : "unknown";
}

export function extractInitialData(html: string): unknown | null {
  for (const marker of INITIAL_DATA_MARKERS) {
    let markerIndex = html.indexOf(marker);
    while (markerIndex !== -1) {
      const objectStart = html.indexOf("{", markerIndex + marker.length);
      if (objectStart === -1) break;
      const objectEnd = findJsonObjectEnd(html, objectStart);
      if (objectEnd !== -1) {
        try {
          return JSON.parse(html.slice(objectStart, objectEnd + 1));
        } catch {
          // A different inline assignment may have matched. Keep looking.
        }
      }
      markerIndex = html.indexOf(marker, markerIndex + marker.length);
    }
  }
  return null;
}

function findJsonObjectEnd(source: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }

    if (character === '"') inString = true;
    else if (character === "{") depth += 1;
    else if (character === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }

  return -1;
}

function containsAiDisclosureHelpLink(value: unknown): boolean {
  let found = false;
  walk(value, (_key, child) => {
    if (typeof child === "string" && AI_DISCLOSURE_HELP_ARTICLE.test(child)) found = true;
  });
  return found;
}

function walk(value: unknown, visitor: (key: string, value: unknown) => void): void {
  if (Array.isArray(value)) {
    value.forEach((item) => walk(item, visitor));
    return;
  }
  if (!isRecord(value)) return;

  for (const [key, child] of Object.entries(value)) {
    visitor(key, child);
    walk(child, visitor);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
