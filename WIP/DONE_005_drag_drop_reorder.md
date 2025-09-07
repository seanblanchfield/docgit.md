# Drag & Drop Page/Directory Reordering

## Product Requirements Document (PRD)

### Overview
Implement drag-and-drop functionality to allow users to reorder pages and directories within the tree view by dragging items to new positions.

### User Stories
- As a user, I want to long-press on any tree item to enter drag mode
- As a user, I want to drag items between other items to reorder them
- As a user, I want visual feedback showing where the item will be dropped
- As a user, I want collapsed directories to auto-expand after hovering for 1+ seconds
- As a user, I want to confirm moves before they are executed
- As a user, I want to cancel dragging with Escape or by dragging outside the tree

### Functional Requirements
1. **Drag Initiation**: Long press (>500ms) on tree item enters drag mode
2. **Visual Feedback**: 
   - Item becomes semi-transparent while dragging
   - Horizontal line shows drop position
   - Cursor changes to indicate drag state
3. **Auto-expand**: Collapsed directories expand after 1 second hover
4. **Drop Zones**: Items can be dropped between other items or into directories
5. **Cancellation**: Escape key or dragging outside tree cancels operation
6. **Confirmation**: Modal dialog confirms move with from/to locations
7. **Backend Integration**: API call performs the actual file/directory move

### Non-Functional Requirements
- Smooth drag animations (60fps)
- Responsive feedback (<100ms)
- Works on touch and mouse devices
- Maintains accessibility standards

## Technical Specification

### Frontend Components

#### 1. Drag State Management
```typescript
interface DragState {
  isDragging: boolean;
  draggedItem: TreeNode | null;
  dragStartPosition: { x: number; y: number };
  currentDropTarget: TreeNode | null;
  dropPosition: 'before' | 'after' | 'inside';
  expandTimer: number | null;
}
```

#### 2. Event Handlers
- `onLongPress`: Initiate drag mode
- `onDragMove`: Update drop target and position
- `onDragEnd`: Show confirmation dialog
- `onDragCancel`: Reset drag state
- `onKeyDown`: Handle Escape key

#### 3. Visual Components
- **Drag Ghost**: Semi-transparent copy of dragged item
- **Drop Indicator**: Horizontal line showing drop position
- **Confirmation Dialog**: Modal with move details and confirm/cancel buttons

#### 4. Tree Integration
Modify existing infinite-tree component to support:
- Long press detection
- Drag state visualization
- Drop target calculation
- Auto-expand on hover

### Backend API

#### Endpoint: `POST /api/reorder`
```typescript
interface ReorderRequest {
  source: {
    path: string;
    type: 'file' | 'directory';
  };
  target: {
    parentPath: string;
    position: number; // 0-based index in target directory
  };
}

interface ReorderResponse {
  success: boolean;
  message?: string;
  newPath?: string;
}
```

#### Implementation Logic
1. Validate source and target paths exist
2. Check permissions for both locations
3. Calculate new numerical prefix based on position
4. Update prefixes of subsequent items (+10 increments)
5. Move file/directory with Git operations
6. Return new path structure

### File Structure Changes

#### Frontend Files to Modify/Create
- `frontend/src/components/tree/TreeNode.ts` - Add drag functionality
- `frontend/src/components/tree/DragManager.ts` - New: Drag state management
- `frontend/src/components/tree/DropIndicator.ts` - New: Visual drop feedback
- `frontend/src/components/dialogs/ConfirmMoveDialog.ts` - New: Confirmation modal
- `frontend/src/styles/drag-drop.css` - New: Drag-related styles

#### Backend Files to Modify/Create
- `backend/app/reorder_service.py` - New: Reordering logic
- `backend/app/main.py` - Add reorder endpoint
- `backend/app/schemas.py` - Add reorder request/response models

## Implementation Plan

### Phase 1: Core Drag Detection (Day 1)
1. **Setup drag state management**
   - Create DragManager class
   - Implement drag state interface
   - Add drag state to tree component

2. **Implement long press detection**
   - Add touch/mouse event handlers
   - Implement 500ms long press timer
   - Visual feedback on drag start

3. **Basic drag movement**
   - Track mouse/touch position
   - Update dragged item position
   - Handle drag outside tree bounds

### Phase 2: Drop Target Detection (Day 2)
1. **Calculate drop targets**
   - Implement hit testing for tree nodes
   - Determine drop position (before/after/inside)
   - Handle edge cases (empty directories, root level)

2. **Visual drop indicators**
   - Create horizontal line component
   - Position indicator at drop location
   - Style dragged item as semi-transparent

3. **Auto-expand functionality**
   - Detect hover over collapsed directories
   - Implement 1-second timer
   - Expand directory and update tree state

### Phase 3: Confirmation & Cancellation (Day 3)
1. **Drag cancellation**
   - Handle Escape key press
   - Detect drag outside tree bounds
   - Reset all drag state on cancel

2. **Confirmation dialog**
   - Create modal dialog component
   - Show source and destination paths
   - Handle confirm/cancel actions

3. **Integration testing**
   - Test all drag scenarios
   - Verify visual feedback
   - Test accessibility features

### Phase 4: Backend Integration (Day 4)
1. **Create reorder API endpoint**
   - Implement POST /api/reorder
   - Add request/response schemas
   - Handle validation and errors

2. **Implement reordering logic**
   - File/directory move operations
   - Numerical prefix calculation
   - Git integration for tracking

3. **Frontend API integration**
   - Call reorder API on confirmation
   - Handle success/error responses
   - Update tree state after successful move

### Phase 5: Testing & Polish (Day 5)
1. **Comprehensive testing**
   - Test all drag scenarios
   - Verify backend operations
   - Test error handling

2. **Performance optimization**
   - Optimize drag rendering
   - Reduce unnecessary re-renders
   - Improve responsiveness

3. **Documentation updates**
   - Update relevant docs
   - Add usage examples
   - Document API endpoints

## Acceptance Criteria

### Frontend
- [ ] Long press initiates drag mode
- [ ] Visual feedback during drag (transparency, cursor)
- [ ] Horizontal drop indicator shows correct position
- [ ] Directories auto-expand after 1 second hover
- [ ] Escape key cancels drag operation
- [ ] Dragging outside tree cancels operation
- [ ] Confirmation dialog shows before/after paths
- [ ] Tree updates after successful move

### Backend
- [ ] POST /api/reorder endpoint accepts reorder requests
- [ ] Files/directories move to correct locations
- [ ] Numerical prefixes maintain proper order
- [ ] Git operations track all changes
- [ ] Error handling for invalid operations
- [ ] Proper validation of paths and permissions

### Integration
- [ ] Frontend and backend communicate correctly
- [ ] Tree state updates after successful moves
- [ ] Error messages display appropriately
- [ ] No data loss during operations
- [ ] Undo capability (via Git history)

## Risk Mitigation

### Technical Risks
- **Performance**: Optimize drag rendering, use RequestAnimationFrame
- **Browser Compatibility**: Test across major browsers, provide fallbacks
- **Touch Devices**: Ensure proper touch event handling
- **File System Errors**: Comprehensive error handling and rollback

### User Experience Risks  
- **Accidental Moves**: Confirmation dialog prevents unintended operations
- **Complex Hierarchies**: Clear visual feedback for nested operations
- **Large Trees**: Optimize rendering for performance

## Success Metrics
- Drag operations complete in <2 seconds
- 0% data loss during moves  
- Intuitive UX (minimal user training needed)
- Accessible to keyboard and screen reader users

---

## Progress Log
- [x] Phase 1: Core Drag Detection - COMPLETED
  - ✅ Drag state management implemented
  - ✅ Long press detection (500ms threshold)
  - ✅ Drag initiation and movement tracking
  - ✅ Visual drag ghost and transparency effects

- [x] Phase 2: Drop Target Detection - COMPLETED
  - ✅ Drop target calculation and positioning
  - ✅ Visual drop indicators (before/after/inside)
  - ✅ Auto-expand directories on hover (1s delay)
  - ✅ Drop target highlighting

- [x] Phase 3: Confirmation & Cancellation - COMPLETED
  - ✅ Escape key cancellation
  - ✅ Confirmation dialog with move details
  - ✅ Accessible keyboard navigation
  - ✅ Move cancellation handling

- [x] Phase 4: Backend Integration - COMPLETED
  - ✅ ReorderService backend implementation

- [x] Phase 5: Testing & Polish - COMPLETED
  - ✅ API testing with curl commands
  - ✅ Cross-directory move verification
  - ✅ Within-directory reorder verification
  - ✅ Git commit tracking confirmed
  - ✅ Error handling and validation

**Started**: 2025-09-07
**Completed**: 2025-09-07
**Status**: MOSTLY COMPLETED 

## Known Issues & Future Improvements

### Issues to Address in Current Feature:
- [ ] **Cannot drag files into subdirectories** - "inside" drop position not working
- [ ] **URL numbering conflicts** - URLs contain numerical prefixes that change when files are reordered, breaking bookmarks/links
- [ ] **Clean up debug console output** - Remove temporary debug logging added during development