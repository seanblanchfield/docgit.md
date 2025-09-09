# TODO_018: TypeScript Module Naming Convention Standardization

## Objective
Standardize all TypeScript file names to use consistent camelCase naming convention, following canonical TypeScript/JavaScript practices.

## Current State Analysis
The codebase currently uses inconsistent naming conventions:

### camelCase (Target Convention)
- `createItem.ts`
- `eventHandlers.ts` 
- `reorderService.ts`
- `humanize.ts`

### TitleCase/PascalCase
- `DragManager.ts` → `dragManager.ts`
- `ConfirmMoveDialog.ts` → `confirmMoveDialog.ts`

### kebab-case
- `console-logger.ts` → `consoleLogger.ts`

### Dot Notation
- `api.service.ts` → `apiService.ts`
- `notification.service.ts` → `notificationService.ts`
- `app.state.ts` → `appState.ts`
- `vite-env.d.ts` → `viteEnv.d.ts`

## Rationale
**camelCase** is the canonical TypeScript/JavaScript convention because:
- Matches JavaScript variable naming conventions
- Consistent with TypeScript official style guide
- Aligns with most popular TypeScript projects
- Easier to import (no need for quotes in dynamic imports)
- Better tooling support and autocomplete

## Requirements

### Functional Requirements
1. **File Renaming**
   - Rename all TypeScript files to use camelCase
   - Update all import statements to reference new file names
   - Ensure no broken imports after refactoring

2. **Import Statement Updates**
   - Update relative imports: `./DragManager` → `./dragManager`
   - Update absolute imports if any exist
   - Verify all dynamic imports still work

3. **Build System Compatibility**
   - Ensure Vite build still works after renaming
   - Verify TypeScript compilation succeeds
   - Check that file watching still functions

### Technical Requirements
- Git tracking of file renames (use `git mv` for proper history)
- Update any configuration files that reference specific file names
- Maintain existing export/import structure
- No functional changes to code logic

## Implementation Plan
1. **Phase 1**: Audit all TypeScript files and create rename mapping
2. **Phase 2**: Use `git mv` to rename files (preserves Git history)
3. **Phase 3**: Update all import statements across the codebase
4. **Phase 4**: Verify build and test functionality
5. **Phase 5**: Update any documentation references

## Files to Rename
```
DragManager.ts → dragManager.ts
ConfirmMoveDialog.ts → confirmMoveDialog.ts
console-logger.ts → consoleLogger.ts
api.service.ts → apiService.ts
notification.service.ts → notificationService.ts
app.state.ts → appState.ts
vite-env.d.ts → viteEnv.d.ts
```

## Acceptance Criteria
- [x] All TypeScript files use camelCase naming
- [x] All import statements updated to match new file names
- [x] No broken imports or build errors
- [x] Git history preserved for renamed files
- [x] Vite development server works correctly
- [x] TypeScript compilation succeeds
- [x] All existing functionality preserved

**Priority**: Low
**Estimated Effort**: 1-2 hours
**Dependencies**: None

## Notes
- This is a pure refactoring task with no functional changes
- Should be done when no other active development is happening
- Consider doing this as part of a larger code organization effort
