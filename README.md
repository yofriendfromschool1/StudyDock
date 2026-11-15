# StudyDock

**StudyDock** is a free, local-first Chromium extension for Canvas study sessions. It combines an always-active tab engine, a Canvas privacy guard, quiz answer recall, a movable on-page status toolbar, and an optional kiosk-style frame in one extension.

StudyDock has no account system, no subscription, no trial, no usage limit, and no backend.

---

## Highlights

- **Always-active tabs** — keeps selected pages in the visible and focused state while their tab is in the background.
- **Canvas Privacy Guard** — suppresses Canvas focus/visibility signals on course pages and cleans hidden attention-detector spans.
- **Quiz Recall** — reads your own prior Canvas quiz submissions and fills the best known answer when you hover a question.
- **On-page toolbar** — shows the live protection state on Canvas course pages.
- **Kiosk bar** — opens a Canvas page inside a StudyDock kiosk-style frame.
- **Per-site control** — enable protection for one host, a wildcard, or every website, with exclusions and per-host policies.
- **Local-only settings** — stored with `chrome.storage.local`; nothing is sent to a StudyDock server.

---

## Requirements

- A Chromium-based browser with Manifest V3 support: Chrome, Chromium, Edge, Brave, or Opera.
- Chrome/Chromium **111 or newer** is recommended.
- Quiz Recall requires Canvas classic quiz pages with prior submissions and Canvas API access.

---

## Installation

StudyDock is loaded as an unpacked extension. There is no build step and no package installation.

1. Download or clone this repository.
2. Open your browser's extension page:
   - Chrome/Chromium: `chrome://extensions`
   - Edge: `edge://extensions`
   - Brave: `brave://extensions`
   - Opera: `opera://extensions`
3. Turn on **Developer mode**.
4. Choose **Load unpacked**.
5. Select the project directory containing `manifest.json`.
6. Pin **StudyDock** to the toolbar for quick access.

### Updating

Replace the files in the same directory, then click **Reload** on the StudyDock card in the extensions page. Open tabs pick up content-script changes after a reload.

### Permissions

| Permission | Why it is needed |
| --- | --- |
| `storage` | Saves settings, host lists, and feature switches locally. |
| `scripting` | Registers and applies the page guards on matching tabs. |
| `activeTab` | Reads the current tab when you open the popup or toggle a site. |
| `*://*/*` host access | Supports any Canvas institution and any website you explicitly enable. |

StudyDock does not request access to a remote StudyDock service because none exists.

---

## First run

1. Open the StudyDock popup.
2. Canvas course pages (`/courses/<id>/...`) are protected automatically when **Privacy Guard** is on.
3. On any other website, click **Enable always-active here** to protect that host.
4. To protect every website, enable **Always active everywhere**.
5. Open **Settings** for host lists, exclusions, blocked hosts, event options, and policies.

The toolbar badge shows `ON` or `OFF` for the current site. Clicking the StudyDock toolbar button opens the popup.

---

## How to use

### Popup

The popup is the quick-control surface for the current tab.

| Control | What it does |
| --- | --- |
| **Current site status** | Shows whether the site is always-active, Canvas-protected, excluded, skipped, or not protected. |
| **Enable/disable always-active here** | Adds or removes the current host from the always-active list. If the all-sites wildcard is on, disabling adds a host exclusion. |
| **Reload tab** | Appears when a protection change needs a page reload to finish applying. |
| **Always active everywhere** | Adds the `*` wildcard, enabling always-active behavior on every website. |
| **StudyDock enabled** | Master switch. Turning it off unloads new page guards and disables Quiz Recall. |
| **Quiz Recall** | Enables or disables automatic answer recall on Canvas quiz pages. |
| **Privacy Guard** | Enables or disables Canvas focus/visibility suppression and automatic Canvas protection. |
| **On-page toolbar** | Shows or hides the Canvas status toolbar. |
| **Kiosk bar** | Injects or removes the kiosk-style frame on the current Canvas page. |
| **Settings** | Opens the full options page. |

### Always-active tabs

Always-active behavior can be configured in three ways:

1. **Single site** — enable the current host from the popup.
2. **Host list / wildcard** — add hosts such as `example.edu` or `*.example.edu` in Settings.
3. **All websites** — enable the `*` wildcard.

Canvas course pages are automatically covered when Privacy Guard is on, even if the host is not in the always-active list.

The always-active engine:

- reports `document.visibilityState` as `visible`;
- reports `document.hidden` as `false`;
- reports `document.hasFocus()` as `true`;
- blocks focus, blur, visibility, pagehide/pageshow, mouseleave/mouseout, and lost-pointer-capture events;
- can block hidden-page redirects;
- can preserve fullscreen state while the tab is hidden;
- supports per-host event policies for sites that need specific events left alone.

### Canvas Privacy Guard

Privacy Guard activates automatically on Canvas course pages that match `/courses/<id>/...`.

On those pages, StudyDock:

- blocks Canvas focus/visibility event delivery used by quiz UIs;
- removes hidden accessibility spans that can act as simple attention detectors;
- applies the always-active engine while the tab is in the background;
- exposes its status in the on-page toolbar.

Privacy Guard can be disabled in the popup or Settings without uninstalling the extension.

### Quiz Recall

Quiz Recall runs only on Canvas quiz take pages matching:

```text
/courses/<course-id>/quizzes/<quiz-id>/take
```

When you hover a question, StudyDock:

1. Reads your own prior submission history through the Canvas API.
2. Finds the best-scoring attempt for each question.
3. Fills the answer into the quiz form.
4. Leaves the answer editable.
5. Never submits the quiz.

Supported question types include multiple choice, true/false, multiple answers, matching, fill-in-the-blank, multiple blanks, numerical, calculated, and essay questions where Canvas exposes the corresponding form fields.

Quiz Recall is enabled by default and can be turned off in the popup or Settings. It does not send quiz data anywhere except the same-origin Canvas API request.

### On-page toolbar

On Canvas course pages, StudyDock adds a small movable toolbar.

- Click the `i` button to open the protection panel.
- The panel reports Always-active tab, Privacy Guard, Quiz Recall, and detector cleanup state.
- Drag the toolbar or panel header to reposition it.
- Click `×` to hide the toolbar for the current page load.
- Click **Settings** in the panel to open the options page.

The toolbar can be disabled globally with **On-page toolbar** in the popup or Settings.

### Kiosk bar

On a Canvas page with the page guard active:

1. Open the popup.
2. Click **Inject** under **Kiosk bar**.
3. The current Canvas page opens inside a StudyDock frame.
4. Use **Restart** to reload the framed page.
5. Use **Exit kiosk** or the popup's **Remove** button to close it.

The kiosk bar is a visual session tool. It does not bypass a real lockdown browser or third-party proctoring software.

### Settings page

The options page contains the full configuration.

| Section | Options |
| --- | --- |
| **Always-active tab** | Master switch, all-sites wildcard, host list, excluded hosts. |
| **Event blocking** | Visibility, focus, blur, mouseleave, mouseout, lostpointercapture, hidden-page redirects, fullscreen. |
| **Per-host policies** | JSON object mapping hostnames to event names that should not be blocked. |
| **Canvas tools** | Privacy Guard, Quiz Recall, on-page toolbar, badge display. |
| **Skip hosts** | Hosts where StudyDock should not inject page guards or Quiz Recall. |
| **Save / Reset** | Save settings or restore defaults. |

#### Host list syntax

One host per line or comma-separated:

```text
example.com
*.example.edu
docs.example.org
```

- `example.com` also covers `www.example.com`.
- `*.example.edu` covers `example.edu` and any subdomain.
- `*` enables always-active on every website.
- Invalid or duplicate entries are removed when saved.

#### Excluded hosts

Excluded hosts keep always-active off even when the `*` wildcard is enabled. They do not disable Quiz Recall or the on-page toolbar.

#### Skip hosts

Skip hosts prevent StudyDock from injecting page guards or Quiz Recall on those hosts. This is the strongest per-host opt-out.

#### Per-host policies

Example:

```json
{
  "docs.example.com": ["blur", "mouseout"],
  "calendar.example.com": ["visibility"]
}
```

Listed events are not blocked on that host. Valid event names are `visibility`, `focus`, `blur`, `mouseleave`, `mouseout`, `pointercapture`, `redirect`, and `fullscreen`.

---

## Privacy

StudyDock is designed to keep data local.

- Settings and host lists are stored in `chrome.storage.local`.
- There is no install ID, account, analytics endpoint, remote configuration, or telemetry.
- There are no remote stylesheets, fonts, images, or scripts.
- The only network request is the same-origin Canvas API request used by Quiz Recall.
- Quiz Recall reads only the current user's own submission history from the Canvas instance already open in the browser.

---

## How it works

StudyDock uses two script worlds per page:

- **MAIN world** — applies page-visible changes such as visibility/focus spoofing, event blocking, detector cleanup, and the toolbar DOM.
- **ISOLATED world** — reads `chrome.storage.local`, computes host/site state, and publishes it to the MAIN world through a hidden shared port element.

The MAIN and ISOLATED worlds share the hidden `#studydock-port` element. This lets the always-active engine and the Canvas guard read the same state without duplicating the visibility/focus implementation.

### Dynamic page guards

The service worker registers page guards for:

- Canvas course pages: `*://*/courses/*`
- Every host in the always-active list
- All sites when `*` is enabled
- Blocked hosts as exclusions

When a site is enabled from the popup, StudyDock also injects the guards into the current tab immediately, without waiting for a reload.

### Quiz Recall script

Quiz Recall is a static content script that matches only:

```text
*://*/courses/*/quizzes/*/take*
```

It checks the master switch, the Quiz Recall switch, and the skip-host list before running.

### File map

```text
manifest.json                 MV3 manifest and permissions
background.js                 settings, registration, badge, messaging
popup.html/.css/.js           current-site and quick feature controls
options.html/.css/.js         full settings page
styles.css                    shared UI styles
content/
  always-active-page.js       MAIN-world always-active engine
  always-active-isolated.js   ISOLATED-world settings/state bridge
  canvas-guard-page.js        Canvas event guard, cleanup, toolbar
  canvas-guard-isolated.js    kiosk frame, settings shortcut, UI visibility
  quiz-loader.js              Canvas Quiz Recall
icons/                        StudyDock mark and extension icons
always-active/                upstream MPL-2.0 source for provenance
```

---

## Troubleshooting

### StudyDock does not activate on a website

- Open the popup and check whether the site is **Excluded** or **Skipped**.
- Click **Enable always-active here**.
- Or enable **Always active everywhere**.
- Reload the tab if the content scripts were not present when the setting changed.

### Canvas page is not protected

- Confirm **Privacy Guard** is enabled.
- Confirm the page URL contains `/courses/<id>/`.
- Confirm the host is not in the skip list.
- Reload the page after changing settings.

### On-page toolbar is missing

- Confirm you are on a Canvas course page.
- Enable **On-page toolbar** in the popup or Settings.
- Confirm the master switch is on.
- Reload the page.

### Quiz Recall does not fill answers

- Confirm the page is a quiz take page.
- Confirm Quiz Recall is enabled and the host is not skipped.
- Confirm you have at least one prior submission for that quiz.
- Classic Canvas quizzes with accessible submission history work best.
- Reload the quiz page after changing the setting.

### A website behaves incorrectly with always-active mode

- Add the host to **Excluded hosts** in Settings.
- Or add it to **Skip hosts** to stop all StudyDock injection there.
- Use per-host policies to leave specific events unblocked.
- Disable Privacy Guard if the issue is limited to Canvas.

### Kiosk bar is unavailable

- Confirm the page is a Canvas course page.
- Confirm the page guard is active for the tab.
- Reload the page and reopen the popup.

### Badge shows OFF

The current host is not covered by the always-active list and is not an automatically protected Canvas course page. Enable the site or turn on the all-sites wildcard.

---

## Limitations

- **Chromium MV3 only.** Firefox and Safari would need separate packaging.
- **Page-level protection only.** StudyDock changes page-visible state; it cannot control browser throttling, OS focus, screenshots, network telemetry, or third-party proctoring software.
- **Quiz Recall depends on Canvas APIs and prior submissions.** New Quizzes, restricted API access, or courses without prior attempts may not return usable data.
- **Kiosk mode is visual.** It does not bypass a real lockdown browser or proctoring agent.
- **Some changes require a reload.** Page-world overrides cannot be fully uninstalled from an already-running document.
- **Settings are local to the browser profile.** There is no cloud sync.
- **Some sites may dislike visibility spoofing.** Use exclusions, skip hosts, or per-host policies.

Use StudyDock in accordance with your institution's academic-integrity and acceptable-use rules.

---

## Development

There is no build step. The extension runs directly from this directory.

Useful checks:

```bash
for f in background.js popup.js options.js content/*.js; do
  node --check "$f"
done
jq . manifest.json
```

To verify changes:

1. Reload the extension from `chrome://extensions`.
2. Reload a Canvas-shaped test page.
3. Open the popup and confirm the current-site status.
4. Open the on-page toolbar and confirm the four status rows.
5. Test Quiz Recall on a quiz take page with prior submissions.

---

## License and attribution

StudyDock is distributed under the Mozilla Public License 2.0. See [`LICENSE`](LICENSE) and [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

The always-active implementation is adapted from **Always Active Window v3**, licensed under MPL-2.0. The upstream source is retained in [`always-active/`](always-active) for provenance; runtime copies live in `content/` and carry source notes at the top of each adapted file.
