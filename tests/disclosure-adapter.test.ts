import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { classifyWatchHtml, extractInitialData } from "../src/content/disclosure-adapter";

const fixture = (name: string) => readFileSync(
  fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)),
  "utf8",
);

describe("classifyWatchHtml", () => {
  it("recognizes the official AI disclosure by structural help article id", () => {
    expect(classifyWatchHtml(fixture("ai-disclosed.html"))).toBe("ai");
  });

  it("does not infer AI use when a valid watch response has no disclosure", () => {
    expect(classifyWatchHtml(fixture("not-disclosed.html"))).toBe("not-ai");
  });

  it("fails open when the response is not a watch response", () => {
    expect(classifyWatchHtml("<html><title>Consent</title></html>")).toBe("unknown");
  });

  it("ignores disclosure-like text outside structured initial data", () => {
    const html = `${fixture("not-disclosed.html")}<p>howThisWasMadeSectionViewModel 15447836</p>`;
    expect(classifyWatchHtml(html)).toBe("not-ai");
  });

  it("parses braces and escapes inside JSON strings", () => {
    const html = '<script>var ytInitialData = {"watchEndpoint":{},"text":"a } \\\"quote\\\""};</script>';
    expect(extractInitialData(html)).toEqual({ watchEndpoint: {}, text: 'a } "quote"' });
  });
});
