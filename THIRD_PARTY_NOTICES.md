# Third-Party Notices

StudyDock is distributed under the MIT License. See [`LICENSE`](LICENSE).

## Always Active Window / Always Active Tab v3

The always-active engine in `content/always-active-page.js` and the state bridge in `content/always-active-isolated.js` are adapted from the Always Active Window v3 source bundled in [`always-active/v3`](always-active/v3).

- Upstream license: Mozilla Public License 2.0 (`always-active/LICENSE`)
- Upstream files used:
  - `always-active/v3/data/inject/main.js`
  - `always-active/v3/data/inject/isolated.js`
  - `always-active/v3/worker.js` (behavioral reference for host registration and state handling)
- Modifications: wrapped in IIFEs, rebranded log prefixes and port name, merged host/private-guard state into the StudyDock settings model, removed upstream FAQ/donation/update-page behavior, and added the shared StudyDock port.

The upstream source tree remains in this repository for provenance and license compliance. It is not loaded by the extension at runtime.

## Quiz Recall logic

The quiz-loading logic is implemented in `content/quiz-loader.js`.

Modifications include:

- Wrapped in an IIFE with a duplicate-injection guard.
- Added a strict Canvas quiz URL guard.
- Added settings checks, blocked-host checks, request/response error handling, and a question-DOM wait.
- Added null/undefined guards around Canvas's submission and question DOM shapes.
- Added `studyDockFilled` markers so user edits are preserved.

The quiz loader makes same-origin Canvas API requests from the Canvas page and has no external runtime dependency.

## Runtime dependencies

None. The extension uses only browser-provided APIs and local files. There are no npm packages, CDNs, remote fonts, analytics SDKs, or payment libraries loaded at runtime.
