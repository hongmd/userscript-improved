# Userscript Improved

[![CI](https://github.com/hongmd/userscript-improved/actions/workflows/ci.yml/badge.svg)](https://github.com/hongmd/userscript-improved/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/hongmd/userscript-improved)](https://github.com/hongmd/userscript-improved/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

A collection of browser userscripts for improving day-to-day browsing, media handling, and site-specific workflows. The repository focuses on lightweight scripts with practical UI controls, persistent settings, and compatibility with modern userscript managers.

## Scripts

### [URL Visit Tracker (Improved)](./scripts/URL-Visit-Tracker-Improved.user.js)

Tracks URL visits with a floating badge, hover tooltip, configurable URL normalization, and large local history capacity.

Key features:
- Floating visit counter badge
- Hover tooltip with visit history
- Configurable query/hash normalization
- Search URL cleanup and utility-page filtering
- Debounced storage writes and optional Web Worker cleanup

### [Visited Links Enhanced](./scripts/visited-improved.user.js)

Applies a customizable color style to visited links and includes a simple color picker via the userscript manager menu.

Also available as a minified build:
- [visited-improved-min.user.js](./scripts-min/visited-improved-min.user.js)

### [Reject ServiceWorker Auto](./scripts/Reject-ServiceWorker-Auto.user.js)

Blocks `ServiceWorker` registration by default, with whitelist management for sites where background features should remain enabled.

### [Handlers Helper (Improved)](./scripts/Handlers-Helper/Handlers-Helper-Improved.user.js)

Adds drag-to-action behavior for media links with support for external handlers such as MPV, `yt-dlp`, and `streamlink`.

### [Facebook Story Downloader](./scripts/FB-story-download.user.js)

Adds a download button for Facebook stories when supported media is detected on story pages.

### [VOZ: Add Ignore Button in Threads](./scripts/voz-user-ignore-button.user.js)

Adds an `Ignore` action next to user posts in VOZ forum threads and links directly to the XenForo ignore flow.

## Requirements

- A userscript manager such as [Tampermonkey](https://tampermonkey.net/), Violentmonkey, or ScriptCat
- A modern Chromium- or Firefox-based browser
- Optional external tools for some scripts, such as MPV or `yt-dlp`

## Installation

1. Install a userscript manager extension.
2. Open the script you want from the [`scripts`](./scripts) directory.
3. Click the file and open the raw version on GitHub.
4. Confirm installation in your userscript manager.

For the minified visited-links build, install the file from [`scripts-min`](./scripts-min).

## Development

Install dependencies:

```bash
npm install
```

Available commands:

```bash
npm run build:min   # rebuild scripts-min/visited-improved-min.user.js
npm run check       # syntax-check every userscript
```

Useful local checks:

```bash
node --check build-minify.js
find scripts -name '*.user.js' -print0 | xargs -0 -n1 node --check
```

CI runs both on every push and PR. Pushing a `v*` tag publishes a GitHub Release with all userscripts attached.

## Repository Layout

```text
scripts/       Source userscripts
scripts-min/   Built/minified distributables
build-minify.js  Minifier for visited-improved.user.js
```

## Notes

- The main actively featured script is `URL-Visit-Tracker-Improved.user.js`.
- `build-minify.js` currently generates the minified build only for `visited-improved.user.js`.
- Some scripts are generic and work on many sites, while others are site-specific.

## License

Repository metadata is currently distributed under the license declared in [package.json](./package.json). Individual scripts may also include their own header license metadata.
