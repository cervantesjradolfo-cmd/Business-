---
name: ship
description: Build a requested feature end to end and ship it. Finds the right code, implements the change, checks it (typecheck, lint, build, a real browser run), commits, pushes, and republishes the matching Claude artifact if there is one. Use when the user types /ship or asks to "ship" something.
argument-hint: "<what to build or change>"
---

# Ship

The user wants the thing in their request built, checked and delivered, not just planned.

## 0. Report to the Agent View (ARC)
The user watches /ship runs live, often from their phone, in the ARC artifact
(https://claude.ai/artifact/PvgSpsCuhcmTZfCdCjd3Nq, source `agent-view.html` next to this file).
Their organization blocks the page from reading sessions directly, so you report to it:
- If `set_session_tags` (claude-code-remote) is available, tag this session `ship`
  (`get_session` with no `session_id` gives your id, then `add: ["ship"]`).
- Write events into ARC's store with the `ArtifactData` tool: `action: "batch"` (or `"set"`),
  `url` = the ARC link above, `collection: "events"`, a new `doc_id` per event of the form
  `<session id>-<UTC yyyymmddThhmmssZ>-<nn>`, and these fields:
  - always: `session` (your session id, or a short slug if you have none), `at` (UTC ISO time), `kind`
  - first event of a run also: `title` ("Ship <feature in 2-4 words>"), `repo`, `branch`
  - `kind: "you"` + `text`: the user's request, word for word
  - `kind: "status"` + `status` (`working` | `needs` | `done` | `failed`) + `text` (one line)
    + `title`. Use `needs` whenever you stop to wait for the user, with exactly what they must do.
  - `kind: "start"` + `crew` (`planner` | `coder` | `tester` | `reviewer`) + `text`: a stage begins
  - `kind: "done"` + `crew` + `text`: that stage's result (spec path, `Status: PASS`,
    `VERDICT: SHIP`, …), plus `error: true` if it failed
  - `kind: "step"` + `text` (+ `crew`, `tool`): optional notable step (build, browser check, push)
  - `kind: "end"` + `status` (`done` | `failed`) when the run finishes
- Report at least: the request, each crew start and done, every `needs`, and the end.
  Creates need no `if_version`. If the tool is missing or a write fails, carry on without it.
## 1. Find the code
- Look at the current branch first. If the project the user names (for example a website)
  is not there, check the other remote branches (`git fetch origin` then
  `git ls-tree -r --name-only <branch>`) and the user's artifacts (Artifact `list`).
- If the work lives on another branch, bring it onto your working branch
  (fast-forward or merge, never a rebase of someone else's branch).

## 2. Plan it
- Hand the request to the `planner` subagent (Agent tool, `subagent_type: "planner"`),
  passing the user's request word for word. It writes the spec to `.pipeline/spec.md`.
- If the spec starts with OPEN QUESTIONs, ask the user before building. Otherwise build
  exactly what the spec says.
- Skip this stage for a one-line fix or a pure content edit.

## 3. Build it
- Hand off to the `coder` subagent (Agent tool, `subagent_type: "coder"`). It implements
  `.pipeline/spec.md` and writes a summary to `.pipeline/changes.md`.
- If the coder stops on OPEN QUESTIONS, ask the user, then run it again.
- Read `.pipeline/changes.md`; it tells the Check stage where to focus.
- For a one-line fix or a pure content edit that skipped planning, make the change yourself,
  matching the project's stack and styling and keeping editable content where the project
  keeps it (for example `src/data/site.ts`).
- If the feature needs a secret (API key) or a server, it must degrade gracefully without
  one and the setup must be documented in the README.

## 4. Test it
- Hand off to the `tester` subagent (Agent tool, `subagent_type: "tester"`). It writes tests
  for `.pipeline/changes.md`, runs `npm test`, and reports in `.pipeline/test-results.md`.
- Whether it reports PASS or FAIL, go on to Check and Review. Do not fix code here: a
  failure is for the Reviewer to judge.

## 5. Check it
Run the project's other checks and record them in `.pipeline/checks.md` (what ran, what
passed, what failed, what you could not test and why). Do not fix code here either.
- install (`npm ci`), typecheck (`npx tsc -b`), lint (note any new warnings in touched files), build
- for anything visual, open it in Chromium with Playwright at desktop (1280px) and
  phone (375px) widths, click through the new feature, check for console errors and
  horizontal scroll, and look at the screenshots

## 6. Review it
- Hand off to the `reviewer` subagent (Agent tool, `subagent_type: "reviewer"`). It reads
  everything in `.pipeline/`, the diff and the tests, and writes `.pipeline/review.md`,
  whose first line is the verdict.
- **VERDICT: SHIP** → go to Deliver.
- **VERDICT: NEEDS WORK** → run the `coder` again, telling it to fix exactly the Fix list in
  `.pipeline/review.md` and nothing else, then repeat Test, Check and Review. Do this at
  most twice; if it still is not SHIP, stop and report.
- **VERDICT: BLOCK** → stop. Do not commit. Report the Reviewer's findings to the user.

## 7. Deliver it (only after SHIP)
- Commit the code and the tests with a clear message, and push to the session's
  designated branch. This is not the release: the user signs off on the branch.
- Do not open a pull request or merge unless the user asks.
- If a Claude artifact is a published build of this project, rebuild it in the same
  shape it was published (read it first), and republish to the same URL so the user
  can try the change right away.

## 8. Report
A short summary for the user's sign-off: the Reviewer's verdict and notes, what was built,
where to try it (artifact link), what was tested, how many review rounds it took, anything
the user must do (API keys, deploy settings), and the branch it is on. When the pipeline
stopped (OPEN QUESTIONS, BLOCK, or still NEEDS WORK after two rounds), say so first and
quote what needs the user's decision.
