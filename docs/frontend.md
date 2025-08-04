# Frontend Specification

## Overview

The frontend is built with Vite + TypeScript using vanilla JavaScript (no React/Vue framework). It provides a responsive, mobile-optimized interface for editing markdown files with real-time collaboration features.

## Core Components

### Tree Drawer UX [DONE]

A collapsible left-hand drawer hosts the directory tree.

**Features:**
* **Collapsed / Expanded** – Single-click on the chevron toggle collapses or expands the drawer
* **Manual Resize** – On screens wider than 700px users can drag the right border to resize width between 200px and 50% of viewport
* **Width Persistence** – Chosen width is stored in `localStorage.drawerWidth` and restored on page reload
* **Double-Click Snap** – Double-click toggles between default width and maximum width (≈50vw)
* **Mobile Behaviour** – At ≤700px dragging is disabled. Drawer slides over content when expanded
* **Cursor & Handle** – `ew-resize` cursor on resizer/border with diagonal texture
* **Accessibility** – Resizer marked with `aria-hidden="true"`; toggle button has `aria-label`

**Keyboard Navigation:**
* **Arrow Keys**: Up/Down arrows navigate between visible tree items
* **Right Arrow**: Expands closed directories; moves to first child if already open
* **Left Arrow**: Collapses open directories; moves to parent if already closed
* **Focus Management**: Tree container is focusable (tabindex="0"); auto-selects first item on focus
* **Click Focus**: Tree gains focus automatically when clicked
* **Selection Persistence**: Maintains selection state across directory expand/collapse operations

### Editor Modes (View / WYSIWYG / Raw)

**Three Editor Modes:**
* **View** – Rendered HTML (read-only) via `markdown-it` or Milkdown in readOnly
* **WYSIWYG** – Milkdown in full editing mode (current default)
* **Raw** – Plain textarea for direct Markdown editing

**Mode Switching:**
* Segmented control in status bar (`View | WYSIWYG | Raw`)
* Active mode is highlighted; preference stored in `localStorage.editorMode`
* **Keyboard Shortcut** – `Ctrl+E` cycles modes

**Sync Rules:**
* Switching *to Raw* loads current markdown string from Milkdown or cached draft
* Switching *to WYSIWYG* parses Raw textarea value into Milkdown; caret resets to start
* Switching *to View* renders markdown string; no editing events fired
* Common store (currentMarkdown) updated on change events from either editor

### Auto-Save & Concurrency (Turn-Based Editing) [DONE]

**Local Drafts:**
* Editor serializes markdown to `localStorage.draft:<file>` every 10 seconds
* Includes `base_sha` for conflict detection

**Edit Lock System:**
* `POST /api/lock/{path}` obtains a lock (returns `lock_id`, TTL 5 min)
* If lock exists, server returns `423 Locked`; client enters read-only mode
* Auto-refresh every 2 minutes to maintain lock during active editing

**Auto-Save Flow:**
1. Client triggers save with payload `{ content, base_sha, lock_id, message:"Auto-save" }`
2. Server verifies `lock_id`
3. If `base_sha == HEAD`, run `git commit --amend` to squash autosaves
4. On success, server releases lock and returns new `sha`

**Conflict Handling:**
* Turn-based editing via locks prevents most conflicts
* If client loses lock and HEAD moved, server returns `409`
* Client refreshes view and discards unsaved buffer

### Status Bar & Editor Controls [DONE]

**Layout:**
* Fixed 40px container with flex layout
* Contains mode controls, unsaved indicator, commit metadata, and action buttons

**Features:**
* **Unsaved Indicator** – Orange "Unsaved" pill when content differs from baseline
* **Save Controls** – Manual save button (Ctrl+S shortcut) and discard button
* **Commit Metadata** – Shows "Author — relative time" format for last commit
* **Lock Status** – Shows lock owner when file is locked by another user

### History & Diff Viewer [DONE]

**History Drawer:**
* Collapsible side panel listing complete commit history for current file
* Each entry shows author, relative time, short SHA, and commit message
* Click-to-view-diff functionality

**Diff View:**
* Unified diff display with syntax highlighting
* Shows additions, deletions, and context lines
* Back button to return from diff view to history list

**API Integration:**
* Uses `/api/history/{path}` for commit list
* Uses `/api/diff/{path}?sha1=parent&sha2=commit` for diff content

### Lock Management & Conflict Resolution [DONE]

**Visual Indicators:**
* Tree items show lock status
* Editor header displays current lock owner information

**Lock Lifecycle:**
* Automatic lock acquisition on file selection
* Auto-refresh every 2 minutes during active editing
* Automatic cleanup on file navigation and page unload
* Manual release via API

**Conflict Handling:**
* Graceful fallback to read-only mode when locks conflict
* Edit buttons disabled with tooltips
* Slide-out notifications for lock conflicts (5-second auto-dismiss)

### File Tree Operations [DONE]

**Create Operations:**
* Virtual create nodes at end of each directory
* Data-driven approach for file/directory creation

**State Management:**
* Optimistic updates with rollback on API errors
* Tree expansion state persists in localStorage
* File modification indicators persist across sessions

**Features:**
* Lock status display in tree
* Deep linking with URL path synchronization
* Direct file navigation and bookmarking support

## Technical Stack

| Component | Technology | Details |
|-----------|------------|---------|
| **Build Tool** | Vite | `npm create vite@latest wiki-frontend -- --template vanilla-ts` |
| **Styling** | Custom CSS | Vanilla styling with responsive design |
| **Data Fetching** | Native `fetch` API | RESTful API communication |
| **Markdown Editor** | `@milkdown/crepe` | WYSIWYG markdown editing |
| **Directory Tree** | `infinite-tree` | File navigation component |
| **Package Manager** | pnpm | Efficient package management |

## Data Models

**Tree Node Structure:**
```typescript
interface TreeNodeData {
  id: string;
  name: string;
  children?: TreeNodeData[];
}
```

**API Endpoints:**
* `/api/files/tree` - Get directory tree structure
* `/api/lock/{path}` - Lock management
* `/api/history/{path}` - File history
* `/api/diff/{path}` - File diffs

## Responsive Design

**Desktop (>700px):**
* Resizable drawer docked to left side
* Manual resize with drag handle
* Width persistence in localStorage

**Mobile (≤700px):**
* Drawer slides over content
* No resize functionality
* 16px border strip remains visible when collapsed
