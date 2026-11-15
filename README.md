# StudyDock

**StudyDock** is a free, local-first Chromium extension that combines an always-active tab engine, a Canvas page guard, quiz answer recall, an on-page status toolbar, and an optional kiosk-style frame in one product.


## What it does

### Always-active tab

The always-active engine is adapted from the Always Active Tab / Always Active Window v3 implementation in [`always-active/v3`](always-active/v3). It keeps a page in the visible and focused state while its tab is in the background:

- Spoofs `document.visibilityState`, `document.webkitVisibilityState`, `document.hidden`, and `document.webkitHidden`.
- Forces `document.hasFocus()` to return true.
- Blocks focus, blur, visibility, pagehide/pageshow, mouseleave/mouseout, and pointer-capture events.
- Blocks hidden-page redirects and can preserve the page's fullscreen state.
- Supports per-site host lists, wildcards, exclusions, and per-host event policies.

Canvas course pages are protected automatically. Other sites are opt-in from the popup, or can be enabled globally in Settings.

### Canvas Privacy Guard

On Canvas course pages (`/courses/<id>/...`), StudyDock adds a Canvas-specific suppression layer:

- Blocks focus/visibility event delivery to Canvas quiz UIs.
- Removes hidden accessibility spans that can act as simple attention detectors.
- Applies the always-active engine automatically when Privacy Guard is enabled.
- Can be turned off without removing the extension or signing in.

### Quiz Recall (Canvas Quiz Loader integration)

The quiz-loading logic that existed in the paid build is now the free **Quiz Recall** feature:

- Runs only on `/courses/<course>/quizzes/<quiz>/take` pages.
- Reads the current user's own prior submission history through the Canvas API.
- Finds the best-scoring answer for each question.
- Fills the answer when the question is hovered.
- Never submits the quiz and never sends data to an external server.

This is the integrated Canvas Quiz Loader functionality, renamed and made free. It defaults to on and can be disabled in the popup or Settings.

### On-page toolbar

On Canvas course pages, a small movable toolbar shows the live state of:

- Always-active tab
- Privacy Guard
- Quiz Recall
- Hidden-detector cleanup

The toolbar can be dragged, minimized, hidden, or disabled in Settings. Its **Settings** button opens the StudyDock options page.

### Kiosk bar

The optional kiosk bar opens the current Canvas page inside a kiosk-style frame with a StudyDock header and Restart/Exit controls. It is a visual session tool, not a bypass for a real lockdown browser or proctoring agent.

### Per-site control

The popup provides:

- Current-site status and a one-click always-active toggle.
- An “always active everywhere” wildcard.
- Master pause switch.
- Quiz Recall, Privacy Guard, and toolbar switches.
- Kiosk bar controls on Canvas pages.

The full settings page adds host lists, exclusions, blocked hosts, event-blocking options, and per-host policies.

---

## Free guarantee

This build is intentionally free:

- No paywall, pricing page, purchase flow, subscription, trial, or license check.
- No login, email capture, device registration, or account requirement.
- No usage counters, feature entitlements, or premium tiers.
- No analytics client, install IDs, A/B pricing, or remote configuration.
- No paid runtime dependencies.
- No remote CSS, fonts, images, or scripts. The extension does not contact a StudyDock server because there is none.

The only network request the extension makes is the Canvas API request used by Quiz Recall, sent from the Canvas page to the same Canvas origin and only when you enable that feature.

Legacy paid/account storage keys from the previous build are deleted during upgrade. Settings that still apply are preserved.

---

## Installation

Requires a Chromium-based browser with Manifest V3 support (Chrome, Edge, Brave, Opera, Chromium). Chrome/Chromium 111 or newer is recommended.

1. Download or clone this repository.
2. Open `chrome://extensions` (or `edge://extensions`).
3. Enable **Developer mode**.
4. Choose **Load unpacked**.
5. Select this directory (the directory containing `manifest.json`).
6. Pin **StudyDock** to the toolbar.

The extension requests host access to all HTTP/HTTPS sites because it must be able to inject into any Canvas instance and any host you explicitly enable. Settings are stored locally with `chrome.storage.local`.

### First run

- Open the StudyDock popup.
- Canvas course pages are protected automatically when Privacy Guard is on.
- To keep a non-Canvas site active, use **Enable always-active here**.
- To apply always-active to every site, turn on **Always active everywhere**.
- Use **Settings** for host lists, exclusions, blocked hosts, event options, and policies.

---

## Architecture

The paid build had a payment server, analytics, A/B pricing, login/account UI, remote assets, and separate content-script paths. This rebuild removes all of that and uses one small, local architecture:

```text
manifest.json                 MV3 manifest, permissions, static quiz-loader match
background.js                 service worker: settings, host registration, badge,
                              migration, message handling
popup.html/.css/.js           unified current-site and feature controls
options.html/.css/.js         full settings page
styles.css                    shared UI design system
content/
  always-active-page.js       MAIN-world always-active engine (adapted v3)
  always-active-isolated.js   ISOLATED-world settings/port bridge
  canvas-guard-page.js        Canvas event guard, detector cleanup, toolbar
  canvas-guard-isolated.js    kiosk frame, settings shortcut, UI visibility
  quiz-loader.js              Canvas Quiz Recall
always-active/                upstream MPL-2.0 source for provenance
icons/                        StudyDock brand mark and toolbar icons
```

The page engine and Canvas guard share one hidden `#studydock-port` element. The isolated world publishes storage-derived state onto that element; the MAIN world reads it. This preserves the Always Active Tab communication model while avoiding a second visibility/focus implementation.

Dynamic content scripts are registered by `background.js` for:

- Canvas course pages: `*://*/courses/*`
- Every host in the always-active list, including `*`
- Exclusions from the blocked-host list

The static Quiz Recall script matches:

- `*://*/courses/*/quizzes/*/take*`

---

## Implementation plan used for this rebuild

1. Audit the existing paid extension: identify payment, analytics, account, remote asset, and content-script dependencies.
2. Choose the StudyDock brand; create a local mark and icons; replace all user-facing copy.
3. Remove payment/account/analytics paths; delete remote CSS, fonts, images, and dead marketing pages.
4. Vendor the Always Active v3 engine into `content/`; merge its state bridge with the Canvas guard.
5. Integrate the existing quiz-loader logic as a free, default-on content script with a single toggle.
6. Rebuild the popup and options page around the merged feature set.
7. Validate syntax and manifest, load the extension in Chromium, and exercise popup, options, host toggles, immediate injection, toolbar, kiosk, and quiz filling.
8. Document setup, changes, and limitations.

---

## What changed

### Added

- Single **StudyDock** brand, local SVG/PNG mark, updated manifest name/description/icons.
- Unified popup with current-site state, always-active toggle, global wildcard, master pause, and feature switches.
- Full options page with host lists, exclusions, blocked hosts, event options, and policies.
- Shared hidden port between the always-active engine and Canvas guard.
- Live on-page status panel that reflects actual storage state.
- Free Quiz Recall with a safe URL guard, error handling, and query/answer fallbacks.
- Immediate injection when a site is enabled from the popup.
- Legacy storage migration and cleanup of paid/account/analytics keys.

### Removed

- Payment, pricing, purchase, upgrade, subscription, cancellation, and lifetime-plan UI.
- Login/logout, email verification, device IDs, account management, and support Discord links.
- Payment/analytics clients, remote configuration calls, and uninstall tracking.
- Remote stylesheets, fonts, demo videos, payment logos, testimonials, and branded screenshots.
- External-message webhook handler and cross-origin extension messaging entry.
- Paid-gate checks in background, popup, content, and quiz scripts.
- The old forced reload loop and paid-only feature locks.

### Changed

- The toolbar action now opens the unified popup instead of immediately toggling the current site. The per-site toggle is one click inside the popup.
- The always-active engine and Canvas guard now share state through one port, so visibility/focus spoofing is not implemented twice.
- Quiz loading is enabled by default and controlled by one `quizLoaderEnabled` setting (legacy `saveCorrectAnswers` is migrated).
- Dynamic scripts no longer use `matchOriginAsFallback` because Canvas path-scoped matches require a `*` path for that flag. The normal document-start injection path is preserved.

---

## Preserved behavior

- Always Active Tab's visibility/focus spoofing, event blocking, redirect protection, fullscreen option, host lists, wildcards, policies, and badge.
- Canvas page guard, hidden-detector cleanup, movable toolbar, and settings shortcut.
- Kiosk-style frame with restart and exit.
- Quiz answer recall from prior submissions, including multiple-choice, multiple-answer, matching, fill-in-blank, multiple-blank, numerical/formula, and essay fallbacks.
- Existing settings for blocked URLs, toolbar visibility, privacy guard, and quiz answers.

---

## Limitations

- **Chromium only in this package.** The manifest targets Chromium MV3. Firefox packaging would need a separate manifest/API pass.
- **The always-active engine cannot control browser-level throttling, OS focus, screenshots, server-side telemetry, or third-party proctoring software.** It only changes page-visible state.
- **Quiz Recall depends on Canvas's classic quiz submission-history APIs.** New Quizzes, institutional API restrictions, or courses with no prior attempts may not return usable data.
- **Kiosk mode is visual only.** It does not bypass a real kiosk app or lockdown browser.
- **The action click gesture changed** because the product now has a unified popup (a manifest popup suppresses `chrome.action.onClicked`). Use the popup's site toggle.
- **Some sites may misbehave with visibility spoofing.** Add the host to Excluded hosts or Blocked hosts, or disable Privacy Guard for Canvas.
- **Disabling protections on an open tab may require a reload** because page-world overrides cannot be cleanly uninstalled in place. The popup exposes a Reload tab button when needed.
- **No cloud sync.** Settings are local to the browser profile.

---

## Verification

The rebuild was checked with:

```bash
for f in background.js popup.js options.js content/*.js; do node --check "$f"; done
jq . manifest.json
```

It was also loaded unpacked in Chromium 156 with a local Canvas-shaped fixture and verified for:

- Service worker registration with no console errors.
- Dynamic content-script registration for Canvas paths and explicit hosts.
- Always-active port state and blocked visibility event delivery.
- Canvas toolbar and status panel.
- Quiz Recall filling a prior answer.
- Popup rendering with an active Canvas tab, site toggle, and free-copy checks.
- Options save round-trip.
- Immediate injection after enabling a host from the popup.
- Kiosk bar inject/remove.

---

## Privacy and responsibility

StudyDock stores settings in `chrome.storage.local`. It does not create an install ID, contact an analytics service, or send page content anywhere. Quiz Recall uses the Canvas session already present in the browser.

Use StudyDock in accordance with your institution's academic-integrity and acceptable-use rules. The extension changes what a page can observe; it does not make cheating acceptable or undetectable in every environment.

---

## License and attribution

This project is distributed under the Mozilla Public License 2.0. See [`LICENSE`](LICENSE) and [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

The always-active implementation is adapted from **Always Active Window v3** by the upstream authors, licensed under MPL-2.0. The upstream source is retained in [`always-active/`](always-active) for provenance; the runtime copies live in `content/` and are noted at the top of each adapted file.
