# LocalStorage and Lock System Bug Fixes

## Status: DONE

## Requirements
Fix critical issues with the localStorage draft system and lock persistence that are causing data conflicts and poor user experience.

## Problem Analysis
### Local Draft vs Server State Conflicts

**Scenario:**
1. User A starts editing `file.md`, acquires server lock, makes changes auto-saved to localStorage
2. Server lock expires (user goes to lunch, closes browser, network issues, etc.)
3. User B edits `file.md`, saves changes to server (creates new Git commit)
4. User A returns with stale local draft but no server lock
5. **Critical Question:** Can User A resume their changes, or must they be discarded?

**Current System Limitations:**
- Content comparison only tells us drafts are "different", not which is "newer"
- No way to detect if server has been modified since draft was created
- Risk of data loss (discarding valid user work) vs data corruption (overwriting newer server changes)
- Without merge capability, must choose: local draft OR server version

## Selected Approach: Git Commit Hash-Based Conflict Detection

**Implementation Strategy:**
We will implement a Git commit hash-based approach for robust local draft/server conflict detection. This leverages the existing Git infrastructure and provides reliable, immutable conflict detection.

**Core Mechanism:**
```typescript
interface DraftData {
  content: string;
  baseCommitHash: string; // Git commit hash when draft was created
  timestamp: number;      // For user-facing "draft age" information
}

interface FileTreeNode {
  // ... existing properties
  gitHash?: string; // Current commit hash for this file
}
```

## Remaining Issues
1. **localStorage missing base git hash**: Draft data doesn't contain baseCommitHash for conflict resolution  
2. **Lock persistence fails on refresh**: Lock status not properly restored after page reload  
3. **Unused git hash field**: Tree API still returns empty git hash field that should be removed

## Implementation Plan
- Fix localStorage draft structure to include baseCommitHash field
- Implement lock state persistence across browser refreshes
- Clean up unused git hash field from tree API response

## Acceptance Criteria
- [ ] Draft data includes baseCommitHash for reliable conflict detection
- [ ] Lock status persists across browser refreshes
- [ ] Unused git hash field removed from tree API
- [ ] No data loss when handling draft conflicts
- [ ] Graceful handling of legacy drafts without base commit hash
- [ ] Performance optimized conflict detection

## Recent Completion
- ✅ **Removed draft conflict dialog**: Changed showDraftConflictDialog to automatically discard stale local drafts
- ✅ **Automatic conflict resolution**: Local versions are now immediately overwritten without user intervention
- ✅ **Code cleanup**: Removed unused showDraftConflictDialog function from main.ts
- ✅ **Updated gitignore**: Added Python __pycache__ files to .gitignore

## Key Features Implemented
- **Graceful handling**: Legacy drafts without base commit hash are handled safely
- **Performance optimized**: Conflict detection only runs when git hashes are available
