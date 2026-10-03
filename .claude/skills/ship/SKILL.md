---
name: ship
description: Build a requested feature end to end and ship it. Finds the right code, implements the change, checks it (typecheck, lint, build, a real browser run), commits, pushes, and republishes the matching Claude artifact if there is one. Use when the user types /ship or asks to "ship" something.
argument-hint: "<what to build or change>"
---

# Ship

The user wants the thing in their request built, checked and delivered, not just planned.

## 0. Show up in the Agent View
The user watches /ship runs live in the Agent View artifact
(https://claude.ai/artifact/PvgSpsCuhcmTZfCdCjd3Nq, source `agent-view.html` next to this file).
When the `set_session_tags` tool (claude-code-remote) is available, tag this session `ship`
first: call `get_session` with no `session_id` to get your id, then `set_session_tags` with
`add: ["ship"]`. Skip this silently if the tools are missing. The view also picks up sessions
whose title contains "ship".

## 1. Find the code
- Look at the current branch first. If the project the user names (for example a website)
  is not there, check the other remote branches (`git fetch origin` then
  `git ls-tree -r --name-only <branch>`) and the user's artifacts (Artifact `list`).
- If the work lives on another branch, bring it onto your working branch
  (fast-forward or merge, never a rebase of someone else's branch).

## 2. Plan it
- Hand the request to the `planner` subagent (Agent tool, `subagent_type: "planner"`),
  passing the user's request word for word plus which branch the code is on.
  It writes a spec to `specs/<feature-slug>.md`.
- Read the spec. If it lists open questions that block the work, ask the user; otherwise
  build from it, and treat its acceptance criteria and checks as the definition of done.
- Skip this stage for a one-line fix or a pure content edit.

## 3. Build it
- Follow the spec. Match the project's stack, file layout, naming and styling.
- Keep the change focused on what was asked. Put editable content where the project
  already keeps it (for example a data file the README points to).
- If the feature needs a secret (API key) or a server, make it degrade gracefully
  without one, and document the setup in the README.

## 4. Check it
Run whatever the project has, and fix what fails before going on:
- install (`npm ci`), typecheck, lint (no new warnings in files you touched), build
- for anything visual, open it in Chromium with Playwright at desktop (1280px) and
  phone (375px) widths, click through the new feature, check for console errors and
  horizontal scroll, and look at the screenshots
- say plainly what you could not test and why

## 5. Deliver it
- Commit the spec with the code, with a clear message, and push to the session's designated branch.
- Do not open a pull request unless the user asks.
- If a Claude artifact is a published build of this project, rebuild it in the same
  shape it was published (read it first), and republish to the same URL so the user
  can try the change right away.

## 6. Report
A short summary: what was built, where to try it (artifact link), what was tested,
anything the user must do (API keys, deploy settings), and the branch it is on.
