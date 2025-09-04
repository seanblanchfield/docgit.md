# Bugfix: Prevent Incomplete Drafts

**Goal:** Fix the root cause of incomplete drafts being saved by preventing them from being written without a `baseCommitHash`.

## Plan

- [x] Identify the race condition causing incomplete drafts.
- [x] Modify `saveDraftToLocalStorage` to only save drafts when the `currentFileGitHash` is available.
- [x] Remove the now-redundant 'draft upgrade' logic from `onFileSelect` and `updateMode`.
- [x] Test the fix.
- [x] Merge the branch.
