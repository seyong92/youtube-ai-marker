# YouTube AI Marker

A privacy-first Chrome extension that marks, blurs, or hides regular YouTube videos when YouTube officially discloses them as **Made with AI**.

The extension does not attempt to detect AI content itself. Unknown or unrecognized videos are always shown.

## Current scope

- Desktop `youtube.com`
- Home, search, subscriptions, channel video grids, and watch-page recommendations
- Regular videos only; Shorts, mobile web, and embeds are intentionally excluded
- Local-only settings and decision cache; no server or telemetry

## Install in Chrome developer mode

1. Install dependencies with `npm install`.
2. Build the extension with `npm run build`.
3. Open `chrome://extensions`.
4. Enable **Developer mode**.
5. Choose **Load unpacked** and select the generated `dist` directory.
6. Open or reload YouTube.

After source changes, run `npm run build`, click the extension's reload button on `chrome://extensions`, and reload YouTube.

## Verify

```sh
npm run check
npm test
npm run build
```

## How classification works

For cards near the viewport, the extension fetches the corresponding YouTube watch page with the existing browser session. It parses YouTube's structured initial page data and only returns a positive result when a `howThisWasMadeSectionViewModel` contains YouTube's official AI disclosure help article identifier (`15447836`).

This is an undocumented YouTube web response, so it can change. The parser is isolated in `src/content/disclosure-adapter.ts`, response failures are treated as unknown, and unknown videos are never filtered.

## Privacy

The extension makes requests only to the YouTube origin already being viewed. It stores filter settings and a bounded, expiring video-ID decision cache in Chrome local storage. It has no analytics, telemetry, account system, or external backend.

## Icon assets

The hand-authored vector source is `src/static/icons/icon.svg`. It uses fixed geometric paths and a flat palette: charcoal `#202124`, signal red `#e62117`, and warm white `#f7f7f5`.

Chrome does not support SVG files for manifest or toolbar icons, so deterministic 16, 32, 48, and 128 pixel PNG exports are generated from the SVG:

```sh
npm run icons
```

The regular build runs this export automatically and copies both the source SVG and PNG assets into `dist/icons`.

## License

MIT
