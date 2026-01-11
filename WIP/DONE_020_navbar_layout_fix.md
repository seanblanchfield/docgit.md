# TODO_020: Fix Navbar Layout Integration

## Goal
Fix the layout system to properly support navbar injection from external project. The navbar uses absolute positioning and currently overlays the UI instead of pushing it down. Need to make LAYOUT_STRATEGIES.A (body-padding) work gracefully.

## Branch
feature/navbar-layout-fix

## Problem
- External project injects navbar.js (temporarily in frontend/public/navbar.js)
- Navbar uses absolute positioning at top of page
- Current layout uses absolute positioning, causing navbar to overlay UI
- External project is using fragile CSS overrides to compensate
- Need to fix at source in this project

## Approach
1. Temporarily inject navbar into page for testing
2. Verify issue with Chrome MCP
3. Fix layout system (tree view, content area, menus, floating buttons) to work with body padding-top
4. Test navbar integration works gracefully
5. Remove temporary navbar injection

## LAYOUT_STRATEGIES.A Behavior
- Adds padding-top to body element equal to NAVBAR_HEIGHT (56px)
- Stores original padding in data attribute
- Should push content down by 56px

## Progress
- [x] Created feature branch
- [x] Created WIP file
- [x] Reviewed navbar.js implementation
- [x] Temporarily injected navbar into page
- [x] Created apps.json for navbar to load
- [x] Started Docker stack
- [x] Confirmed issue with Puppeteer MCP
- [x] Fixed layout system
- [x] Tested solution
- [x] Removed temporary navbar injection

## Files Modified
- `frontend/src/styles.css` - Layout and positioning fixes
  - Added `--navbar-height: 56px` CSS variable
  - Added `box-sizing: border-box` to body
  - Changed `#main-container`, `#tree-drawer`, `#content`, `.raw-markdown-editor` from `height: 100vh` to `height: 100%`
  - Updated mobile drawer: `top: var(--navbar-height, 56px)` and `height: calc(100vh - var(--navbar-height, 56px))`
  - Updated history drawer: `top: var(--navbar-height, 56px)` and `height: calc(100vh - var(--navbar-height, 56px))`
  - Updated `.mode-control`: `top: calc(104px + var(--navbar-height, 56px))`
  - Updated notifications: `top: calc(20px + var(--navbar-height, 56px))`
- `frontend/src/tree/eventHandlers.ts` - Prevent auto-scroll on tree interaction
  - Added `{ preventScroll: true }` to `el.focus()` calls (2 locations)
- `frontend/index.html` - Temporarily added navbar.js for testing (to be removed)
- `frontend/public/apps.json` - Created for navbar testing (temporary file)

## Solution

### Issue 1: Initial Layout Overlay
The layout used `height: 100vh` on multiple elements, which caused them to ignore the body's padding-top applied by the navbar's LAYOUT_STRATEGIES.A approach.

**Fix:**
1. Changed main layout containers from `100vh` to `100%` so they respect body padding
2. Added `box-sizing: border-box` to body so padding is included in height calculation
3. For fixed-position elements (mobile drawer, history drawer), used `calc(100vh - var(--navbar-height, 56px))` and positioned them below the navbar with `top: var(--navbar-height, 56px)`
4. Added CSS variable `--navbar-height: 56px` for consistency

### Issue 2: Mode Control Overlap
The `.mode-control` element used `position: fixed` with `top: 104px` which didn't account for the navbar height.

**Fix:**
Changed to `top: calc(104px + var(--navbar-height, 56px))` to position below navbar

### Issue 3: Content Shift on Tree Interaction
When clicking tree items (even just expanding directories), the page would scroll up and content would shift under the navbar. Root cause: `el.focus()` calls in tree event handlers were triggering browser auto-scroll behavior.

**Fix:**
Added `{ preventScroll: true }` option to all `el.focus()` calls in tree event handlers to prevent auto-scroll when tree receives focus

## Testing Results
✅ Navbar displays correctly at top of page
✅ Content (tree drawer, main area) pushed down below navbar
✅ No overlay issues
✅ Drawer toggle works correctly
✅ History drawer positioned correctly below navbar
✅ Site works correctly without navbar (when not injected)
✅ Layout responsive and functional
