# TODO_014: File and Directory Renaming Feature

## Objective
Implement comprehensive file and directory renaming functionality with multiple interaction methods.

## User Stories
- As a user, I want to rename files from an overflow menu so I can easily change file names
- As a user, I want to rename files via long press in the tree view for quick access
- As a user, I want to rename directories using the same methods as files for consistency
- As a user, I want the renaming to preserve numerical prefixes for proper ordering

## Requirements

### Functional Requirements
1. **Overflow Menu Rename**
   - Add "Rename" option to file/directory context menus
   - Show rename dialog with current name pre-filled
   - Validate new names (no invalid characters, duplicates)

2. **Long Press Rename**
   - Alternative long press action for rename (vs drag)
   - Distinguish between drag intent and rename intent
   - Inline editing or dialog-based rename

3. **Directory Renaming**
   - Same rename functionality for directories as files
   - Update all child paths in backend
   - Handle Git tracking of directory renames

4. **Prefix Preservation**
   - Maintain numerical prefixes during rename
   - Only rename the descriptive part after underscore
   - Ensure ordering is preserved

### Technical Requirements
- Backend API endpoint for rename operations
- Frontend UI components for rename dialogs
- Git integration for tracking renames
- Path validation and conflict detection
- Tree view refresh after rename

## Implementation Plan
1. **Phase 1**: Backend rename service
2. **Phase 2**: Frontend overflow menu integration
3. **Phase 3**: Long press rename detection
4. **Phase 4**: Directory rename handling
5. **Phase 5**: Testing and polish

## Acceptance Criteria
- [ ] Files can be renamed via overflow menu
- [ ] Files can be renamed via long press
- [ ] Directories can be renamed using same methods
- [ ] Numerical prefixes are preserved
- [ ] Git tracks renames properly
- [ ] Tree view updates after rename
- [ ] No duplicate names allowed
- [ ] Invalid characters rejected

**Priority**: Medium
**Estimated Effort**: 2-3 days
**Dependencies**: None
