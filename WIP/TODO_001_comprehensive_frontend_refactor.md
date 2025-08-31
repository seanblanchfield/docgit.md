# Comprehensive Frontend Refactor - main.ts and tree.ts Modularization

## PRD (Product Requirements Document)

This task consolidates the frontend refactoring efforts to break down both `main.ts` and `tree.ts` into smaller, focused modules while reorganizing the directory structure. The refactoring will improve code organization, maintainability, testability, and scalability. This builds on confirmed working code patterns from previous refactoring attempts.

## Objectives

1. **Modularize main.ts**: Break down the large `main.ts` file into focused service modules
2. **Modularize tree.ts**: Split the complex `tree.ts` into specialized modules  
3. **Reorganize directory structure**: Implement a clean directory structure grouping files by type
4. **Preserve functionality**: Ensure all existing features continue to work, including the merged create dialog content area feature

## Plan

### Phase 1: Directory Structure Setup
1. **[ ] Create new directory structure:**
   ```bash
   mkdir -p frontend/src/services
   mkdir -p frontend/src/components  
   mkdir -p frontend/src/tree
   mkdir -p frontend/src/utils
   mkdir -p frontend/src/types
   ```

### Phase 2: Extract Services from main.ts
2. **[ ] Create `services/api.service.ts`:**
   - Move all `fetch` calls and API communication logic
   - Centralize HTTP request handling

3. **[ ] Create `services/notification.service.ts`:**
   - Move UI notification logic
   - Handle success/error message display

4. **[ ] Create `services/dialog.service.ts`:**
   - Move dialog management logic
   - Handle modal creation and lifecycle

5. **[ ] Create `services/lock.service.ts`:**
   - Move file locking logic
   - Handle lock acquisition and release

6. **[ ] Create `services/draft.service.ts`:**
   - Move draft management functionality
   - Handle draft saving and restoration

7. **[ ] Create `services/state.service.ts`:**
   - Move global state management
   - Centralize application state

### Phase 3: Modularize tree.ts
8. **[ ] Create `tree/tree-types.ts`:**
   - Move all type definitions and interfaces from `tree.ts`
   - Define TreeNode, TreeOptions, and related types

9. **[ ] Create `tree/tree-renderer.ts`:**
   - Move DOM manipulation and row rendering functions
   - Handle visual tree representation

10. **[ ] Create `tree/tree-data.service.ts`:**
    - Move asynchronous data fetching logic
    - Handle git operations and file system interactions
    - Manage tree data loading and caching

11. **[ ] Create `tree/tree-navigation.ts`:**
    - Move keyboard navigation logic
    - Handle tree traversal and selection
    - Manage focus and event handling

12. **[ ] Create `tree/tree-create-dialog.ts`:**
    - Move file/directory creation dialog helpers
    - Handle create dialog integration with tree

13. **[ ] Create `tree/directory-tree.ts`:**
    - Main orchestrator class that wires together all tree modules
    - Public interface for the DirectoryTree component
    - Import and coordinate all tree-related modules

### Phase 4: Update Main Application
14. **[ ] Refactor `main.ts`:**
    - Update to use new service modules
    - Import `DirectoryTree` from `tree/directory-tree.ts`
    - Transform into thin orchestrator that wires services together
    - Remove direct function calls that moved to modules

15. **[ ] Move utility files:**
    - Move utility functions to `utils/` directory
    - Update import paths accordingly

16. **[ ] Move component files:**
    - Move component-related files to `components/` directory
    - Update import paths accordingly

### Phase 5: Cleanup and Integration
17. **[ ] Update all import paths:**
    - Update imports across entire codebase to reflect new structure
    - Ensure all modules can find their dependencies

18. **[ ] Delete old files:**
    ```bash
    git rm frontend/src/tree.ts
    ```

19. **[ ] Test and validate:**
    - Run build: `./run-node.sh run build`
    - Fix any TypeScript or import errors
    - Test directory tree functionality
    - Test file creation and navigation
    - Verify create dialog content area feature works
    - Test all existing functionality

20. **[ ] Update documentation:**
    - Update architecture documentation to reflect new structure
    - Document new service interfaces and module responsibilities

## Technical Details

### Service Architecture
- **ApiService**: Centralized HTTP client with error handling
- **NotificationService**: Toast/alert system for user feedback  
- **DialogService**: Modal dialog lifecycle management
- **LockService**: File locking coordination
- **DraftService**: Draft persistence and restoration
- **StateService**: Global application state management

### Tree Module Architecture
- **tree-types.ts**: Type definitions and interfaces
- **tree-renderer.ts**: DOM manipulation and rendering
- **tree-data.service.ts**: Data fetching and git operations
- **tree-navigation.ts**: Keyboard and mouse navigation
- **tree-create-dialog.ts**: File/directory creation helpers
- **directory-tree.ts**: Main orchestrator and public API

### Directory Structure (Target)
```
frontend/src/
├── services/
│   ├── api.service.ts
│   ├── notification.service.ts
│   ├── dialog.service.ts
│   ├── lock.service.ts
│   ├── draft.service.ts
│   └── state.service.ts
├── tree/
│   ├── tree-types.ts
│   ├── tree-renderer.ts
│   ├── tree-data.service.ts
│   ├── tree-navigation.ts
│   ├── tree-create-dialog.ts
│   └── directory-tree.ts
├── components/
│   └── (component files)
├── utils/
│   └── (utility files)
├── types/
│   └── (type definition files)
└── main.ts (refactored)
```

## Progress

- **2025-08-31**: Consolidated plan created from TODOs 002, 003, and 004
- Previous work confirmed that service extraction patterns work correctly
- Create dialog content area feature has been successfully merged and needs integration

## Notes

- This refactoring builds on confirmed working patterns from previous attempts
- The create dialog content area feature must be preserved and properly integrated
- All existing functionality must continue to work after refactoring
- TypeScript strict mode compliance must be maintained
- Hot module reloading should continue to work during development
