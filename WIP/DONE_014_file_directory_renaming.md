# TODO_014: File and Directory Renaming Feature

## Objective
Implement comprehensive file and directory renaming functionality using a unified long-press overflow menu approach in the tree view.

## User Stories
- As a user, I want to long-press files/directories in the tree view to access a context menu with management actions
- As a user, I want to rename files and directories from this tree context menu for consistency
- As a user, I want drag functionality available as a menu option to maintain existing workflow
- As a user, I want the renaming to preserve numerical prefixes for proper ordering
- As a user, I want directories to have the same management interface as files

## UX Design Decision
**Long-Press Overflow Menu Approach**: Modify the current long-press behavior to show a context menu instead of immediately starting drag mode. This provides:
- Unified management interface for both files and directories
- Clear separation: tree view = file/directory management, content view = content-specific actions
- Familiar mobile UX pattern (long-press = context menu)
- Extensible for future management actions

## Requirements

### Functional Requirements
1. **Long-Press Context Menu**
   - Replace immediate drag activation with context menu
   - Include "Enter Drag Mode" as first menu option for discoverability
   - Add "Rename" option for both files and directories
   - Add "Delete" option (moving it from content overflow menu)
   - Menu appears next to the tree item

2. **Rename Functionality**
   - Show rename dialog with current name pre-filled
   - Validate new names (no invalid characters, duplicates)
   - Preserve numerical prefixes during rename
   - Only rename the descriptive part after underscore

3. **Directory Management**
   - Same context menu functionality for directories as files
   - Update all child paths in backend during rename
   - Handle Git tracking of directory renames

4. **Action Separation**
   - Tree view context menu: rename, move (drag), delete
   - Content view overflow menu: history and content-specific actions only

### Technical Requirements
- Modify DragManager to show context menu on long-press
- Backend API endpoint for rename operations
- Frontend rename dialog component
- Git integration for tracking renames
- Path validation and conflict detection
- Tree view refresh after operations

## Implementation Plan
1. **Phase 1**: Backend rename service and API endpoint
2. **Phase 2**: Create tree context menu component
3. **Phase 3**: Modify DragManager long-press behavior
4. **Phase 4**: Implement rename dialog and validation
5. **Phase 5**: Directory rename handling and Git integration
6. **Phase 6**: Update content overflow menu (remove delete)
7. **Phase 7**: Testing and polish

## Acceptance Criteria
- [x] Long-press shows context menu with rename, delete, and drag options
- [x] Files can be renamed via tree context menu
- [x] Directories can be renamed via tree context menu
- [x] "Enter Drag Mode" option maintains existing drag workflow
- [x] Numerical prefixes are preserved during rename
- [x] Git tracks renames properly
- [x] Tree view updates after rename operations
- [x] No duplicate names allowed
- [x] Invalid characters rejected
- [x] Delete option moved from content overflow to tree context menu
- [x] Content overflow menu focuses on content-specific actions only

## Implementation Summary

### Backend Implementation
- **Git Service**: Added `rename_item()` method in `git_service.py` that leverages existing `move_item()` functionality
- **API Endpoint**: Created `/api/rename/{item_path}` PUT endpoint in `main.py` with validation
- **Schemas**: Added `RenameRequest` and `RenameResponse` models in `schemas.py`
- **Validation**: Implemented filename validation (invalid characters, reserved names, empty names)

### Frontend Implementation
- **TreeContextMenu**: Created context menu component with rename, delete, and drag options
- **RenameDialog**: Implemented modal dialog with validation and numerical prefix preservation
- **RenameService**: Created service for API communication
- **DragManager Integration**: Modified long-press behavior to show context menu instead of immediate drag

### Key Features
- **Numerical Prefix Preservation**: Automatically preserves `001_`, `002_` etc. prefixes during rename
- **Validation**: Client and server-side validation for invalid characters and empty names
- **Git Integration**: All renames are properly tracked and committed to Git
- **UX Consistency**: Long-press context menu provides unified interface for file/directory management

### Testing Results
- Backend API endpoint tested successfully with curl commands
- File rename functionality working correctly with Git commit tracking
- All validation rules properly enforced
- Services restart correctly and pick up new functionality

**Priority**: Medium
**Estimated Effort**: 3-4 days
**Dependencies**: None
