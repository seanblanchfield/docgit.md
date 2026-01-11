# TODO_021: Sticky Toolbar Layout Restructure

## Goal
Restructure the layout architecture to use a sticky toolbar instead of fixed-position mode controls. This will improve semantic correctness, simplify CSS, and provide better UX with an always-visible toolbar.

## Branch
feature/sticky-toolbar-restructure

## Problem
Current layout has architectural issues:
1. `.mode-control` is a child of `#editor-status-bar` but uses `position: fixed` (breaks out of parent flow)
2. Status bar is inside scrollable `#content`, so it scrolls out of view
3. Fixed elements (history drawer) triggered by scrollable UI (overflow menu in status bar)
4. Can't use `position: sticky` because parent `#content` has `overflow: auto`
5. Complex CSS with `calc()` for positioning fixed elements

## Current Structure
```
#main-container
├── #tree-drawer (scrollable)
└── #content (scrollable, overflow: auto)
    ├── #editor-status-bar (scrolls away)
    │   ├── .status-right (overflow menu, save/discard buttons)
    │   └── .mode-control (position: fixed, breaks out!)
    └── #editor-root (editor content)
```

## Proposed Structure
```
#main-container
├── #tree-drawer (scrollable)
└── #content-wrapper (no overflow, just container)
    ├── #editor-toolbar (position: sticky, top: 0)
    │   ├── .toolbar-left (commit info, overflow menu)
    │   ├── .toolbar-center (draft/save/discard)
    │   └── .toolbar-right (mode-control buttons)
    └── #content (scrollable, overflow: auto)
        └── #editor-root (editor content)
```

## Benefits
1. **Semantic correctness**: All toolbar elements are siblings within toolbar
2. **Sticky toolbar**: Uses `position: sticky` (simpler than fixed)
3. **Always visible**: Toolbar sticks to top when scrolling
4. **Consistent UI**: Fixed elements triggered by sticky/fixed elements
5. **Simpler CSS**: No complex `calc()` for toolbar positioning
6. **Better maintainability**: Clear separation of concerns

## Implementation Plan
- [x] Create feature branch
- [x] Create WIP file
- [x] Add `#content-wrapper` div in HTML
- [x] Rename `#editor-status-bar` to `#editor-toolbar`
- [x] Move `.mode-control` to be sibling of other toolbar sections
- [x] Update CSS: remove fixed positioning from `.mode-control`
- [x] Add `position: sticky` to `#editor-toolbar`
- [x] Update `#content` to be child of `#content-wrapper`
- [x] Remove `overflow: auto` from old parent, add to new `#content`
- [x] Test toolbar sticks correctly when scrolling
- [x] Test with and without navbar injection
- [x] Update any JavaScript that references changed elements
- [x] Commit changes
- [x] Ready for merge approval

## Files to Modify
- `frontend/index.html` - HTML structure changes
- `frontend/src/styles.css` - Layout and positioning updates
- `frontend/src/main.ts` - Update element references if needed

## Testing Checklist
- [ ] Toolbar visible on page load
- [ ] Toolbar sticks to top when scrolling editor content
- [ ] Mode control buttons work correctly
- [ ] Save/discard buttons work correctly
- [ ] Overflow menu works correctly
- [ ] History drawer opens correctly
- [ ] Layout works with navbar injection (--body-top-padding)
- [ ] Layout works without navbar
- [ ] Mobile responsive behavior maintained
- [ ] No visual regressions
