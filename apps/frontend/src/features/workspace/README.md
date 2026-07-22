# DevArena — Coding Workspace

Dashboard, problem explorer, problem details, and the Monaco-based coding
workspace. Battle UI, voice, analytics and the AI panel are **out of scope**.

## Layout

```
features/
  dashboard/components/   progress · problem card lists · activity · leaderboard
  problems/components/    filter-bar · problem-row · problem-list · pagination
  workspace/
    components/  workspace-shell · code-editor · editor-toolbar · problem-panel
                 console-panel · testcase-panel · output-panel · result-panel
                 submission-history · verdict-badge · verdict-meta
    hooks/       use-workspace-actions · use-autosave · use-submission-polling
    monaco-theme.ts
store/
  slices/  editor · workspace · problem · submission
  api/     problem-api · execution-api · submission-api
pages/     dashboard-page · problems-page · problem-workspace-page
```

## Decisions worth knowing

**Drafts are keyed per (problem, language).** Switching from Python to C++ and
back must not destroy either buffer — the single most annoying failure mode in
this kind of editor. Autosave is debounced (one write per pause, not per
keystroke) and flushed on unmount so navigating away mid-edit still saves.

**A saved draft always beats the server's starter code.** Hydration only fills
an empty slot, so a returning user's work is never silently replaced.

**Monaco owns no application state.** Code arrives as a prop and leaves through
`onChange`. An editor that owns its own buffer can't be reset, restored from
storage, or re-seeded on language change.

**Run and Submit are different operations.** Running is a throwaway sandbox call
against sample or custom input with no verdict and no history. Submitting is
judged and permanent. Conflating them would either pollute a user's record with
experiments or make experimenting slow.

**Submission is asynchronous.** The API answers 202 with an id, so the workspace
polls until the verdict is terminal, with a hard timeout so a silent judge
produces a clear message rather than an endless spinner. Polling rather than a
socket keeps this module independent of the realtime layer.

**Verdicts get plain language.** Every verdict carries a full label *and* an
explanation — "MLE" means nothing to a beginner, "Memory Limit Exceeded / your
solution used more memory than allowed" is actionable. A test asserts no verdict
is missing either.

**The result panel leads with the failing case.** A verdict without "which case,
and what went wrong" is a scoreboard, not a tool. Hidden cases show pass/fail and
timing only — their inputs stay hidden, which is the point of a hidden test.

**Hints reveal one at a time.** A hint you didn't ask for isn't a hint, and
dumping all of them removes the ladder that makes them useful. The editorial is
gated the same way.

## Performance

| Technique | Where |
|---|---|
| Code splitting | Monaco, workspace, explorer and dashboard are separate chunks |
| Lazy loading | `React.lazy` per route + a nested lazy boundary for the editor |
| Virtualization | `@tanstack/react-virtual` in the results list |
| Memoization | `ProblemRow` is memoized — filter keystrokes re-render the list otherwise |
| Debouncing | Search input (300ms) and draft autosave (800ms) |
| Cache granularity | RTK Query tags are per-problem-id, so one bookmark doesn't refetch the catalogue |

Verified in the build output: the workspace and editor land in their own chunks
rather than the entry bundle.

## Error handling

Execution failures and network failures are normalized by the shared error layer
and rendered in place — a failed run is a normal outcome of writing code, not an
exception the UI should crash on. The editor sits behind its **own** error
boundary with a custom fallback that reassures the user their code is saved
(it is: Redux plus localStorage) and offers a reload of just the editor, leaving
the problem statement and console intact.

## Accessibility

Console and problem panels are real tab widgets — `role="tab"`, `aria-selected`,
`aria-controls`, roving `tabIndex`, arrow-key navigation. Resize handles come
from `react-resizable-panels`, which gives them genuine keyboard support. Solved
state, bookmark state and pass/fail are announced in text, never by colour alone.
Progress bars carry `aria-valuenow`/`max`.

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl/⌘ + Enter` | Run |
| `Ctrl/⌘ + Shift + Enter` | Submit |
| `Ctrl/⌘ + Shift + F` | Format document |

## Tests — 50 in this module (122 total)

- **slices** — per-language draft isolation, hydration not clobbering work, font
  clamping, filter changes resetting pagination, run/submit lifecycles
- **console** — tab semantics, arrow-key navigation, collapse, custom input,
  stdout/stderr separation, compile-error block, failure alerts
- **result** — accepted summary, first-failing-case surfacing, progressbar wiring
- **explorer** — row semantics, empty state recovery, pagination ranges and
  bounds, debounced search, filter toggles
- **autosave** — debounce behaviour, unmount flush, per-language separation
- **formatters** — unit thresholds and relative time

## Backend contract

`GET /problems` (search, difficulty, tags, companies, status, sort, page) ·
`GET /problems/:idOrSlug` · `GET /problems/facets` ·
`POST|DELETE /problems/:id/bookmark` · `GET /me/dashboard` ·
`POST /execute` · `POST /submission` · `GET /submission/:id` ·
`GET /submission/history`

All wrapped in the standard `{ success, data }` envelope.
