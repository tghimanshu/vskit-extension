# VSKit Auto Unmute + Auto Next

A lightweight browser extension that improves the VSKit watch experience by:

- forcing videos to stay unmuted, and
- moving to the next episode automatically when playback ends.

## Why this exists

VSKit watch flows can feel repetitive when you have to unmute every episode and manually move to the next one.
This extension removes both friction points while staying minimal and privacy-friendly.

## Feature highlights

- **Auto Unmute**
  - Removes `defaultMuted`
  - Forces `video.muted = false`
  - Restores volume to `1` if it is `0`
- **Auto Next Episode**
  - Detects current episode via URL query params (`ep`)
  - Tries UI-based next click first (active marker + episode controls)
  - Falls back to next resolved episode link
  - Final fallback: increments `ep` in URL
- **SPA-aware navigation support**
  - Hooks into `history.pushState`, `history.replaceState`, `popstate`, and `hashchange`
  - Re-binds video handlers after route changes
- **Dynamic content support**
  - Uses `MutationObserver` to bind newly injected video nodes
- **No backend, no tracking**
  - Content script only, scoped to VSKit watch pages

## How it works

```text
Open /watch/* page
  -> Find/bind video elements
  -> Force unmute on key playback/volume lifecycle events
  -> On video end:
       1) Try next episode control click
       2) Else resolve next episode link
       3) Else increment ?ep= in URL
```

## Installation (local)

1. Clone or download this repository.
2. Open your Chromium browser extension page:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select this project folder.

## Permissions & privacy

- Runs only on:
  - `https://vskit.tv/watch/*`
  - `https://www.vskit.tv/watch/*`
- No remote calls
- No analytics
- No storage usage
- No personal data collection

## Compatibility

- Manifest V3 extension
- Designed for Chromium-based browsers
- Works on VSKit watch page routes (`/watch/*`)

## Project structure

```text
.
├── manifest.json   # Extension metadata and URL matching
└── content.js      # Unmute + autoplay-next logic
```

## Known limitations

- If VSKit changes episode control markup significantly, selector heuristics may need updates.
- If a title has missing/non-sequential episode numbers, URL fallback may not always map to a valid next item.

## Development notes

No build step is required.

- Edit `content.js`
- Reload extension from browser extension page
- Refresh VSKit watch tab and retest

## Roadmap ideas

- Optional popup toggle: auto-unmute / auto-next on/off
- Per-series behavior controls
- Small in-page indicator when next-episode logic triggers

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.
