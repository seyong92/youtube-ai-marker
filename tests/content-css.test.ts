import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  fileURLToPath(new URL("../src/static/content.css", import.meta.url)),
  "utf8",
);

describe("YouTube layout isolation", () => {
  it("does not override thumbnail positioning on every marked card", () => {
    const rules = [...css.matchAll(/([^{}]+)\{([^{}]+)\}/g)];
    const unsafeRule = rules.find(([, selector, declarations]) =>
      selector.includes(".yam-ai-card") && /position\s*:/.test(declarations),
    );
    expect(unsafeRule?.[0]).toBeUndefined();
  });
});
