# TODO_016: Tree View Navigation and Expansion Issues

## Objective
Fix tree view collapse and URL-based navigation issues to improve user experience when navigating directories.

## User Stories
- As a user, when I delete a directory, I want the tree view to stay at my current level so I can see the parent directory
- As a user, when I visit a deep URL to a create screen, I want the tree view to expand to show that location
- As a user, when I visit a deep URL to a directory, I want the tree view to expand and show the first file in that directory

## Requirements

### Functional Requirements
1. **Directory Deletion Tree Preservation**
   - After deleting a directory, maintain tree expansion at parent level
   - Don't collapse entire tree view
   - Keep user context and navigation state

2. **Deep URL Create Screen Navigation**
   - URLs like "path/to/dir/__create__" should expand tree to that location
   - Show create dialog in context of expanded tree
   - Maintain tree state after create operations

3. **Deep URL Directory Navigation**
   - URLs like "path/to/dir/" should expand tree to show directory contents
   - Select first lexicographic item in the directory
   - Maintain proper tree expansion state

### Technical Requirements
- Modify tree state management for deletion operations
- Enhance URL routing to trigger tree expansion
- Update tree expansion logic for deep URLs
- Preserve selection and expansion state across operations

## Implementation Plan
1. **Phase 1**: Fix directory deletion tree collapse
2. **Phase 2**: Implement deep URL tree expansion
3. **Phase 3**: Add first-item selection for directory URLs
4. **Phase 4**: Testing and edge case handling

## Acceptance Criteria
- [ ] Deleting directory doesn't collapse entire tree
- [ ] Parent directory remains visible after deletion
- [x] Deep create URLs expand tree appropriately
- [ ] Deep directory URLs expand tree and select first item
- [ ] Tree state is preserved across navigation
- [ ] URL changes reflect tree expansion state

## Implementation Summary

### Completed Features

1. **Create Page URL Routing Fix** ✅
   - Fixed regression where `__create__` URLs showed default content instead of create dialog
   - Added detection for `__create__` suffix in initial path handling
   - Properly selects parent directory and shows create dialog
   - Handles both root and nested directory create URLs

2. **Directory Navigation Enhancement** ✅ (Partial)
   - Added `handleInitialPathNavigation()` function in `main.ts`
   - Detects directory URLs and attempts to find first file to display
   - Uses tree's internal API to access node structure
   - Added proper timing delays for tree initialization

3. **URL Path Processing** ✅
   - Enhanced initial path handling to support both create and directory URLs
   - Maintains backward compatibility with existing file URLs
   - Proper separation of create vs directory navigation logic

### Technical Implementation

- Modified `frontend/src/main.ts` lines 718-798
- Added `__create__` URL detection and handling
- Implemented `handleInitialPathNavigation()` with tree node lookup
- Added proper null checks and error handling
- Fixed TypeScript compilation issues

### Current Status

✅ **Create page functionality fully restored** - `__create__` URLs now properly show create dialog
🔄 **Directory navigation partially working** - Implementation complete but needs refinement for tree timing

The create page regression has been fully resolved. Directory navigation logic is implemented but may need additional timing adjustments for optimal tree expansion behavior.

**Priority**: Medium
**Estimated Effort**: 2-3 days
**Dependencies**: None
