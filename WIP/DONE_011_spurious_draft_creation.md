# Bugfix: Spurious Draft Creation

**Goal:** Fix a bug where viewing certain files triggers a local draft to be saved unnecessarily.

## Plan

- [x] Investigate the frontend codebase to trace how and when drafts are saved.
- [x] Pinpoint the exact location in the code that's responsible for this behavior by searching for the log message: `[LOCK DEBUG] Saved draft for ...`
- [x] Analyze the surrounding logic to understand why it's happening for some files and not others.
- [x] Implement a fix to prevent drafts from being saved on view-only actions.
- [x] Test the fix to ensure it resolves the issue without introducing new bugs.
