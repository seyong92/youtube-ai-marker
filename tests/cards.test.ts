// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { discoverVideoCards, findThumbnail, getVideoId } from "../src/content/cards";

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

  it("rejects Shorts and malformed ids", () => {
    expect(getVideoId("https://www.youtube.com/shorts/gWlfmUrazFw")).toBeNull();
    expect(getVideoId("https://www.youtube.com/watch?v=too-short")).toBeNull();
  });
});
