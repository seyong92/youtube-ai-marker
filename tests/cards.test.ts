// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { discoverVideoCards, findThumbnail, getMediaReference, getVideoId } from "../src/content/cards";

describe("video card discovery", () => {
  it("finds classic YouTube renderer cards", () => {
    document.body.innerHTML = `
      <ytd-rich-item-renderer>
        <a id="thumbnail" href="https://www.youtube.com/watch?v=gWlfmUrazFw"></a>
      </ytd-rich-item-renderer>`;
    expect(discoverVideoCards()).toHaveLength(1);
    expect(discoverVideoCards()[0].videoId).toBe("gWlfmUrazFw");
  });

  it("finds current lockup view model cards", () => {
    document.body.innerHTML = `
      <yt-lockup-view-model>
        <a class="yt-lockup-view-model__content-image" href="/watch?v=gWlfmUrazFw"></a>
      </yt-lockup-view-model>`;
    expect(discoverVideoCards()).toHaveLength(1);
  });

  it("finds current desktop Shorts lockup cards", () => {
    document.body.innerHTML = `
      <ytm-shorts-lockup-view-model-v2>
        <ytm-shorts-lockup-view-model>
          <a class="reel-item-endpoint" href="/shorts/gWlfmUrazFw"><img></a>
        </ytm-shorts-lockup-view-model>
      </ytm-shorts-lockup-view-model-v2>`;
    const cards = discoverVideoCards();
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ videoId: "gWlfmUrazFw", kind: "short" });
    expect(cards[0].element.tagName).toBe("YTM-SHORTS-LOCKUP-VIEW-MODEL-V2");
  });

  it("finds classic Shorts renderer cards", () => {
    document.body.innerHTML = `
      <ytd-reel-item-renderer>
        <a id="thumbnail" href="/shorts/gWlfmUrazFw"></a>
      </ytd-reel-item-renderer>`;
    expect(discoverVideoCards()[0]).toMatchObject({ videoId: "gWlfmUrazFw", kind: "short" });
  });

  it("rescans the containing card when a nested link changes", () => {
    document.body.innerHTML = `
      <ytd-video-renderer>
        <div><a id="thumbnail" href="/watch?v=gWlfmUrazFw"></a></div>
      </ytd-video-renderer>`;
    const link = document.querySelector("a")!;
    expect(discoverVideoCards(link)[0].videoId).toBe("gWlfmUrazFw");
  });

  it("anchors the badge to the thumbnail link instead of its larger renderer", () => {
    document.body.innerHTML = `
      <ytd-video-renderer>
        <ytd-thumbnail><a id="thumbnail" href="/watch?v=gWlfmUrazFw"></a></ytd-thumbnail>
      </ytd-video-renderer>`;
    const card = document.querySelector<HTMLElement>("ytd-video-renderer")!;
    expect(findThumbnail(card)?.tagName).toBe("A");
  });

  it("accepts Shorts ids and rejects malformed ids", () => {
    expect(getVideoId("https://www.youtube.com/shorts/gWlfmUrazFw")).toBe("gWlfmUrazFw");
    expect(getMediaReference("/shorts/gWlfmUrazFw")).toEqual({
      videoId: "gWlfmUrazFw",
      kind: "short",
    });
    expect(getVideoId("https://www.youtube.com/watch?v=too-short")).toBeNull();
  });
});
