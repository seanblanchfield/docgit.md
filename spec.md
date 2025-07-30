## WIP
Current phase: Local Draft/Server Conflict Handling Strategy
🔄 **Current Task:** Design robust local draft/server conflict detection and resolution

### Problem Analysis: Local Draft vs Server State Conflicts

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

### Selected Approach: Git Commit Hash-Based Conflict Detection

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
  gitHash?: string; // Current HEAD commit hash for this file
}
```

**Conflict Detection Logic:**
1. When user starts editing, store current HEAD commit hash as `baseCommitHash` in draft
2. Directory tree API includes current `gitHash` for each file
3. On file selection, compare draft's `baseCommitHash` with current server `gitHash`
4. If hashes differ → draft is stale → **discard draft** (no merge/diff for now)
5. If hashes match → draft is current → safe to resume editing

**Key Design Decisions:**
- **No merge/diff capability**: If server has advanced, user's local changes are discarded
- **Simple conflict resolution**: "Your changes are outdated and will be lost"
- **Accurate modified indicators**: Only show file as modified if draft exists AND is based on current server version
- **Robust auto-save**: Only save drafts if trimmed content differs from server's trimmed content
- **Timer management**: Cancel all auto-save timers immediately when user discards changes

### Implementation Priority [COMPLETED]
1. ✅ Design chosen conflict detection mechanism (Git commit hash-based approach)
2. ✅ **COMPLETED:** Implement chosen conflict detection mechanism
3. ✅ Create conflict resolution UI/UX
4. ✅ Update localStorage draft structure
5. ✅ Modify file selection logic to check for conflicts
6. ✅ Add server API endpoints for metadata queries
7. ✅ Comprehensive testing of conflict scenarios

### Implementation Details [COMPLETED]:
- ✅ **Updated localStorage draft structure** to include `baseCommitHash` field
- ✅ **Modified file tree API** to include git hash for each file in TreeNode schema
- ✅ **Implemented conflict detection logic** comparing draft baseCommitHash vs current gitHash
- ✅ **Created conflict resolution UI** with confirmation dialog for stale drafts
- ✅ **Enhanced auto-save logic** to only save drafts when content differs from server
- ✅ **Comprehensive testing** - All conflict scenarios tested and validated

### Key Features Implemented:
- **Git commit hash-based conflict detection**: Drafts store the base commit hash when created
- **Automatic stale draft detection**: Compares stored base hash with current file git hash
- **User-friendly conflict resolution**: Clear dialog explaining the conflict with commit hash details
- **Robust auto-save**: Only saves meaningful changes to prevent unnecessary draft storage
- **Graceful handling**: Legacy drafts without base commit hash are handled safely
- **Performance optimized**: Conflict detection only runs when git hashes are available

---

**COMPLETED PHASES:**

✅ **Previous Task:** COMPLETED - Directory deletion for empty directories

_Implementation Steps:_
- ✅ Update spec.md Work in Progress section with new directory deletion task
- ✅ Examine current tree.ts implementation to understand create nodes
- ✅ Modify create node to show plus/minus symbols for empty directories
- ✅ Update create dialog to include delete option for empty directories
- ✅ Implement directory deletion functionality
- ✅ Test directory deletion feature end-to-end

**Implementation Summary:**
- Successfully enhanced create nodes to display both plus (+) and minus (−) symbols for empty directories
- Modified `tree.ts` to detect empty directories and set `isEmpty` flag on create nodes
- Updated create dialog to conditionally show "Delete Directory" button for empty directories only
- Implemented directory deletion workflow with confirmation dialog and proper error handling
- Directory deletion uses existing backend API endpoint `DELETE /api/files/{path}` which supports both files and directories
- After successful deletion, tree refreshes, navigation returns to welcome state, and success notification displays
- Feature preserves all existing functionality while adding the new delete capability only where appropriate

**Feature Requirements Met:**
- ✅ Empty directories show create node with both plus (+) and minus (−) symbols  
- ✅ Clicking create node for empty directory opens dialog with delete option
- ✅ Delete option only appears when directory is empty and conditionally displayed
- ✅ Successfully deleting directory removes it from tree and updates file system
- ✅ Non-empty directories continue to show only plus (+) symbol as before
- ✅ Native confirmation dialog prevents accidental deletions (consistent with app's other dialogs)
- ✅ Proper error handling and user feedback throughout the workflow
- ✅ **Dialog UX Fix**: Replaced system `confirm()` dialog with native app dialog matching existing design patterns
- ✅ **Path Resolution Fix**: Fixed backend API path issue where directory deletion was using display name instead of full filesystem path

---

**COMPLETED PHASE: File Deletion with Overflow Menu**
✅ **Previous Task:** COMPLETED - File deletion with overflow menu

_Implementation Steps:_
- ✅ Examine current history button implementation
- ✅ Design overflow menu component to replace history button  
- ✅ Implement confirmation dialog for file deletion
- ✅ Add backend API endpoint for file deletion (already existed)
- ✅ Test file deletion functionality end-to-end

**Implementation Summary:**
- Successfully replaced history button with overflow menu (⋮) containing "View History" and "Delete File" options
- Overflow menu dropdown shows on click with proper styling and positioning
- Confirmation dialog displays file path and requires user confirmation before deletion
- File deletion calls DELETE `/api/files/{path}` endpoint and handles success/error responses
- After successful deletion, user is redirected to default content and tree refreshes to remove deleted file
- Success notification confirms deletion completion
- History functionality remains fully operational through the overflow menu

_Implementation Steps:_
- ✅ Create feature branch: `feature/create-dialog-content-area`
- ✅ Analyze current create dialog implementation in tree.ts
- ✅ Design new content area dialog approach
- ✅ Implement content area create dialog UI
- ✅ Update create dialog functionality to use content area
- ✅ Test the new create dialog implementation
- ✅ **Bug Fix:** Fixed create dialog blocking file selection issue

**Implementation Summary:**
- Successfully moved create dialog from modal popover to content area
- Create dialog now displays as overlay in `#editor-root` instead of replacing content
- Maintains same functionality with improved UX
- Hides status bar actions during create process
- Properly handles cancellation and file creation with state restoration
- API integration working with file and directory creation
- Fixed critical bug where dialog prevented file selection after opening

**Bug Fix Details:**
- **Issue:** Create dialog replaced editor content entirely, breaking file selection
- **Root Cause:** `innerHTML` replacement destroyed Milkdown editor DOM structure
- **Solution:** Changed to overlay approach that preserves editor structure
- **Implementation:** Hide existing content, add overlay element, restore on dismiss
- **Testing:** Verified file selection works during and after create dialog interaction

_Remaining Features to Implement:_
- ⏳ **Search Functionality:** Full-text search across markdown files
- ⏳ **User Authentication:** Basic user management and auth system
- ⏳ **Theme Support:** Light/dark mode toggle with preference persistence
- ⏳ **Performance Optimization:** Tree virtualization for large file sets
- ⏳ **Advanced Editor Features:** Syntax highlighting, table editing, image upload
- ⏳ **Backup & Sync:** Remote git repository integration
- ⏳ **Plugin System:** Extensible architecture for custom functionality
- ⏳ **Mobile Improvements:** Touch gestures, mobile-optimized editing
- ⏳ **Collaborative Features:** Real-time multi-user editing (beyond current locking)
- ⏳ **Export Options:** PDF, HTML, and other format exports
- ⏳ **Create Dialog UX Improvement:** Move create node dialog from popover to content area for simplified UI

Implementation roadmap (🔄 = in progress). *Stop after each **Checkpoint** and ask the user for approval before moving on.*

| # | Work Item | Description / Deliverables | Checkpoint |
|---|-----------|----------------------------|------------|



# Project Specification – "Git-Backed Markdown Wiki"

## Table of Contents

1. [Overview](#1-overview)
2. [Primary Use-Cases](#2-primary-use-cases)
3. [Architecture Diagram](#3-architecture-diagram-high-level)
4. [Top-Level Directory Layout](#4-top-level-directory-layout)
5. [Project File Overview](#5-project-file-overview)
6. [Frontend Specification](#6-frontend-specification)
   - [6.1 Tree Drawer UX](#61-tree-drawer-ux-done)
   - [6.7 Editor Modes](#67-editor-modes-view--wysiwyg--raw)
   - [6.8 Auto-Save & Concurrency](#68-auto-save--concurrency-turn-based-editing)
   - [6.9 Status Bar & Editor Controls](#69-status-bar--editor-controls-done)
   - [6.10 History & Diff Viewer](#610-history--diff-viewer-done)
   - [6.11 Lock Management & Conflict Resolution](#611-lock-management--conflict-resolution-done)
   - [6.12 File Tree Operations](#612-file-tree-operations-done)
7. [Backend Specification](#7-backend-specification-fastapi)
8. [Docker & Compose](#8-docker--compose)
9. [Environment Variables](#9-environment-variables)
10. [Local Dev Workflow](#10-local-dev-workflow)
11. [Production Notes](#11-production-notes)
12. [Non-functional Requirements](#12-non-functional-requirements)
13. [Stretch Goals](#13-stretch-goals)

---

## 1  Overview

Build a lightweight self-hosted wiki where every page is a Markdown file stored and versioned in a Git repository.

* **Frontend**: Vite + TypeScript with custom CSS
* **Markdown Editor**: Milkdown with WYSIWYG editing
* **Directory Tree**: Infinite-tree for file navigation
* **Backend** : Python 3.12, FastAPI, GitPython for VCS, Uvicorn ASGI.
* **Containerisation** : Docker & Compose for parity between local dev and prod. ([FastAPI][4])

---

## 2  Primary Use-Cases

| ID | Description                                           |
| -- | ----------------------------------------------------- |
| U1 | Browse wiki pages and folder hierarchy.               |
| U2 | Create, rename, move, delete Markdown files/folders.  |
| U3 | Edit pages with Milkdown, auto-save or manual save.   |
| U4 | View commit history & diffs for any page.             |
| U5 | Run entirely from `docker compose up` in dev or prod. |

---

## 3  Architecture Diagram (high-level)

```
┌──────────────┐           HTTP             ┌────────────────┐
│      UI      │  ───────→ /api/*  ───────→ │  FastAPI app   │──┐
│ (Vite dev)   │                            └────────────────┘  │
└──────────────┘                                │GitPython       │
        ▲                                    repo volume         │
        │                                         │              │
   infinite-tree                              commits           │
   Milkdown editor                                              Git
        │                                                       │
Mobile/desktop ▲                                        ┌──────────────┐
responsive drawer│                                        │ Remote git? │ (optional push)
                                                         └──────────────┘
                                                                │
                                                         ┌──────────────┐
                                                         │ Lock Storage │
                                                         │ (file-based) │
                                                         └──────────────┘
```

---

## 4  Top-Level Directory Layout

```
.
├── docker/
│   ├── backend.Dockerfile
│   ├── frontend.Dockerfile
│   ├── frontend.dev.Dockerfile
│   └── nginx.conf
├── compose.yaml
├── run-node.sh   # Script for running npm commands in Docker
├── frontend/     # Vite TypeScript app (vanilla, not React)
├── backend/      # FastAPI service
├── data/
│   ├── locks/    # File-based lock storage
│   └── repo/     # Git repository (mounted volume for persistence)
├── spec.md       # Project specification
├── README.md     # Project documentation
├── .gitignore
└── .dockerignore
```

---

## 5  Project File Overview

This section provides a detailed overview of the main files and directories in the project, designed to help AI agents quickly understand the codebase structure and functionality.

### 5.1 Root Level Files

| File | Purpose | Key Details |
|------|---------|-------------|
| `compose.yaml` | Docker Compose configuration | Defines 3 services: backend (FastAPI), frontend (Vite dev server), nginx (reverse proxy). Uses named volumes for repo data and lock storage. |
| `run-node.sh` | Node.js command runner | Shell script for running npm commands inside Docker containers during development. |
| `spec.md` | Project specification | Complete technical specification including architecture, API endpoints, frontend components, and implementation roadmap. |
| `README.md` | Project documentation | Main project documentation with setup and usage instructions. |

### 5.2 Backend Directory (`backend/`)

| File | Purpose | Key Details |
|------|---------|-------------|
| `app/main.py` | FastAPI application entry point | Contains all HTTP endpoints for file operations, history, diff, and lock management. Implements background lock cleanup task. |
| `app/git_service.py` | Git operations service | Wraps GitPython for repository operations: file CRUD, history retrieval, diff generation, commit management. |
| `app/file_lock_service.py` | Concurrent editing lock system | File-based locking with JSON metadata storage. Manages lock acquisition, refresh, release, and cleanup. |
| `app/schemas.py` | Pydantic data models | Request/response schemas for all API endpoints including file operations, commits, diffs, and lock management. |
| `app/config.py` | Application configuration | Settings management using Pydantic for environment variables and defaults. |
| `requirements.txt` | Python dependencies | FastAPI, GitPython, Pydantic, and other backend dependencies. |

### 5.3 Frontend Directory (`frontend/`)

| File | Purpose | Key Details |
|------|---------|-------------|
| `src/main.ts` | Application entry point | Initializes editor, tree, drawer, and lock management. Handles file selection, mode switching, and save operations. |
| `src/content.ts` | Markdown editor integration | Wraps Milkdown editor with custom configuration for WYSIWYG markdown editing. |
| `src/tree.ts` | Directory tree component | Implements file tree using infinite-tree library with create/edit functionality and lock status indicators. |
| `src/drawer.ts` | Sidebar drawer functionality | Handles resizable drawer with persistence, mobile behavior, and toggle functionality. |
| `src/lock.ts` | Lock service client | Frontend lock management: acquisition, refresh, release, status checking, and conflict handling. |
| `src/humanize.ts` | Time/name formatting utilities | Humanizes timestamps and file names for better UX. |
| `src/styles.css` | Application styles | Complete CSS for layout, components, editor modes, lock states, and responsive design. |
| `index.html` | HTML template | Single-page application shell with editor container, tree drawer, and status elements. |
| `package.json` | Node.js configuration | Vite, TypeScript, Milkdown, infinite-tree, and other frontend dependencies. Uses pnpm package manager. |

### 5.4 Docker Directory (`docker/`)

| File | Purpose | Key Details |
|------|---------|-------------|
| `backend.Dockerfile` | Backend container definition | Python 3.12 slim image with FastAPI, GitPython, and application dependencies. |
| `frontend.Dockerfile` | Frontend production build | Multi-stage build: Node.js for compilation, nginx for serving static assets. |
| `frontend.dev.Dockerfile` | Frontend development container | Vite dev server with live reload and source mounting for development. |
| `nginx.conf` | Nginx reverse proxy config | Routes `/api/*` to backend, serves frontend assets, handles CORS and static files. |

### 5.5 Data Directory (`data/`)

| Directory | Purpose | Key Details |
|-----------|---------|-------------|
| `repo/` | Git repository storage | Contains the actual wiki content as markdown files in a Git repository. Mounted as Docker volume. |
| `locks/` | Lock files storage | File-based lock storage with JSON metadata. Each lock is a separate file with TTL and ownership info. |

### 5.6 Key Implementation Patterns

**Lock Management:**
- Backend: File-based locks in `/locks` directory with JSON metadata
- Frontend: Auto-refresh every 2 minutes, conflict detection, graceful fallback to read-only
- Integration: Lock enforcement on save operations, visual indicators in UI

**Editor Architecture:**
- Three modes: Read (rendered), WYSIWYG (Milkdown), Raw (textarea)
- Auto-save drafts to localStorage every 10 seconds
- Dirty detection via baseline comparison every 2 seconds
- Mode persistence in localStorage

**Git Integration:**
- All file operations automatically create Git commits
- History and diff endpoints for version control features
- GitPython wraps Git operations with error handling

**Frontend State Management:**
- No framework - vanilla TypeScript with custom state management
- Lock state synchronized between components
- File modification tracking with visual indicators

**API Design:**
- RESTful endpoints with proper HTTP status codes
- Comprehensive error handling and validation
- Lock enforcement via HTTP headers

This architecture provides a robust, git-backed markdown wiki with collaborative editing protection and a modern web interface.

---

## 6  Frontend Specification

### 6.1  Tree Drawer UX  [DONE]

A collapsible left-hand drawer hosts the directory tree.

* **Collapsed / Expanded** – Single-click on the chevron toggle collapses or expands the drawer.
* **Manual Resize** – On screens wider than 700 px users can drag the right border or the textured 12 px `drawer-resizer` strip to resize width between 200 px and 50 % of viewport.
* **Width Persistence** – Chosen width is stored in `localStorage.drawerWidth` and restored on page reload / when re-expanded.
* **Double-Click Snap** – Double-click anywhere in the drawer (background, border, resizer, or toggle) toggles between:
  * the initial *default* width (captured on first load) and
  * the *maximum* width (≈50 vw).
* **Mobile Behaviour** – At ≤700&nbsp;px dragging is disabled. When expanded the drawer slides over the content; when collapsed it shifts left by `calc(-100% + 16px)` leaving a 16&nbsp;px border strip (with chevron) visible so the user can reopen it. No overlay scrim is used.
* **Cursor & Handle** – `ew-resize` cursor on resizer/border; resizer has matching border & diagonal texture.
* **Accessibility** – Resizer marked with `aria-hidden="true"`; toggle button has `aria-label` "Toggle drawer".
* **Keyboard Navigation** – Full keyboard navigation support:
  * **Arrow Keys**: Up/Down arrows navigate between visible tree items
  * **Right Arrow**: Expands closed directories; moves to first child if already open
  * **Left Arrow**: Collapses open directories; moves to parent if already closed
  * **Focus Management**: Tree container is focusable (tabindex="0"); auto-selects first item on focus
  * **Click Focus**: Tree gains focus automatically when clicked
  * **Selection Persistence**: Maintains selection state across directory expand/collapse operations

| Topic                        | Details                                                                                                                                                                                                                                                            |                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| **Bootstrapping**            | `npm create vite@latest wiki-frontend -- --template vanilla-ts` |
| **Styling**                  | Custom CSS with vanilla styling |
| **State/Data fetch**         | Native `fetch` API for data fetching |
| **6.2 Milkdown Integration** | Using `@milkdown/crepe` for WYSIWYG markdown editing |
| **6.3 Directory Tree**       | Using `infinite-tree` for file navigation |
| **6.4 Tree Data model**      | `{ id: string, name: string, children?: TreeNodeData[] }` from `/api/files/tree` |
| **6.5 Creating files**       | Create row implementation with virtual nodes for file/directory creation |
| **6.6 Responsive behaviour** | Drawer slides over content on mobile; docks on desktop with resizable width |

---

### 6.7 Editor Modes (View / WYSIWYG / Raw)

* **Modes**
  * **View** – Rendered HTML (read-only) via `markdown-it` (lightweight) or Milkdown in readOnly.
  * **WYSIWYG** – Milkdown in full editing mode.
  * **Raw** – Plain textarea (or CodeMirror later) for direct Markdown editing.
* **Switch UI** – Segmented control in status bar (`View | WYSIWYG | Raw`). Active mode is highlighted; preference stored in `localStorage.editorMode`.
* **Sync Rules**
  * Switching *to Raw* loads current markdown string (from Milkdown `getMarkdown()` or cached draft).
  * Switching *to WYSIWYG* parses Raw textarea value into Milkdown; caret resets to start.
  * Switching *to View* renders markdown string; no editing events fired.
* **Unsaved Detection** – Common store (currentMarkdown) updated on change events from either editor; diff vs baseline to compute "unsaved" flag.
* **Keyboard Shortcut** – `Ctrl+E` cycles modes.

### 6.8 Auto-Save & Concurrency (Turn-Based Editing) [DONE]

* **Local Drafts** – Editor serializes markdown to `localStorage.draft:<file>` every 10 s along with `base_sha`.
* **Edit Lock API** – `POST /api/lock/{path}` obtains a lock (returns `lock_id`, TTL 5 min, refreshed on activity). If lock exists, server returns `423 Locked` with lock owner info; client enters read-only mode and displays banner.
* **Auto-Save Commit Flow**
  1. Client triggers save (manual or 5-min idle timer) with payload `{ content, base_sha, lock_id, message:"Auto-save" }`.
  2. Server verifies `lock_id`.
  3. If `base_sha == HEAD`, run `git commit --amend --author <user>` to squash autosaves from same author.
  4. On success, server releases lock and returns new `sha`.
* **Conflict Handling** – Because locks enforce turn-based editing, true merge conflicts should be rare. If client somehow loses lock (expired) and HEAD moved, server returns `409`; client refreshes view and discards unsaved buffer (future AI merge assistance planned).
* **History Hygiene** – `--amend` keeps one commit per editing turn. Long idle gaps naturally create new commits, giving meaningful snapshots.
* **Future Enhancements** – Replace locking with real-time CRDT + AI-assisted merge & commit-message generation.

### 6.9 Status Bar & Editor Controls [DONE]

* **Status Bar Layout** – Fixed 40px container with flex layout containing mode controls, unsaved indicator, commit metadata, and action buttons.
* **Unsaved Indicator** – Orange "Unsaved" pill displayed when content differs from baseline; persists across page reloads via localStorage.
* **Save Controls** – Manual save button (Ctrl+S shortcut) and discard button with confirmation dialog.
* **Commit Metadata Display** – Shows "Author — relative time" format for last commit with tooltip containing full commit message.
* **Lock Status Integration** – Status bar shows lock owner when file is locked by another user instead of commit info.

### 6.10 History & Diff Viewer [DONE]

* **History Drawer** – Collapsible side panel listing complete commit history for current file.
* **Commit List** – Each entry shows author, relative time, short SHA, and commit message with click-to-view-diff functionality.
* **Diff View** – Unified diff display with syntax highlighting for additions, deletions, and context lines.
* **Navigation** – Back button to return from diff view to history list; integrated with main history button in status bar.
* **API Integration** – Uses `/api/history/{path}` for commit list and `/api/diff/{path}?sha1=parent&sha2=commit` for diff content.

### 6.11 Lock Management & Conflict Resolution [DONE]

* **Visual Lock Indicators** – Tree items show lock status; editor header displays current lock owner information.
* **Automatic Lock Acquisition** – Locks acquired on file selection (with notification suppression on page load).
* **Lock Refresh** – Auto-refresh every 2 minutes to maintain lock during active editing sessions.
* **Conflict Handling** – Graceful fallback to read-only mode when locks conflict; edit buttons disabled with tooltips.
* **Lock Release** – Automatic cleanup on file navigation and page unload; manual release via API.
* **User Feedback** – Slide-out notifications for lock conflicts and expiration with 5-second auto-dismiss.

### 6.12 File Tree Operations [DONE]

* **Create Row Implementation** – Virtual create nodes at end of each directory using data-driven approach.
* **Optimistic Updates** – Tree state updates immediately on file operations with rollback on API errors.
* **State Persistence** – Tree expansion state and file modification indicators persist in localStorage.
* **Lock Status Display** – Visual indicators in tree for files currently locked by users.
* **Deep Linking** – URL path synchronization for direct file navigation and bookmarking.

---

## 7  Backend Specification (FastAPI)

### 7.1 Core API Endpoints

| Endpoint                   | Method | Payload / Query        | Purpose                                    |
| -------------------------- | ------ | ---------------------- | ------------------------------------------ |
| `/health`                  | GET    | –                      | Health check endpoint.                     |
| `/api/files`               | GET    | `?path` (opt)          | List files and directories in repository.  |
| `/api/files/tree`          | GET    | –                      | Get complete directory tree structure.     |
| `/api/files/{path:path}`   | GET    | –                      | Get file content.                          |
| `/api/files/{path:path}`   | PUT    | `{ content, message }` | Update file & commit.                      |
| `/api/files/{path:path}`   | DELETE | `?commit_message` (opt)| Delete file/directory & commit.            |
| `/api/files/move`          | POST   | `{ source_path, destination_path, message }` | Move/rename file or directory. |
| `/api/history/{path:path}` | GET    | `?limit` (opt)         | Commit history for file.                   |
| `/api/diff/{path:path}`    | GET    | `?sha1&sha2`           | Unified diff between two commits.          |

### 7.2 File Operations API

| Endpoint                         | Method | Payload / Query        | Purpose                                    |
| -------------------------------- | ------ | ---------------------- | ------------------------------------------ |
| `/api/directory`                 | POST   | `{ name, message? }, ?parent_path` | Create new directory.         |
| `/api/file/{path:path}`          | DELETE | `?commit_message` (opt)| Delete specific file.                      |
| `/api/directory/{path:path}`     | DELETE | `?commit_message` (opt)| Delete specific directory.                 |
| `/api/file/{path:path}/move`     | PUT    | `{ destination_path, message? }` | Move/rename file.               |
| `/api/directory/{path:path}/move`| PUT    | `{ destination_path, message? }` | Move/rename directory.          |

### 7.3 Lock Management API

| Endpoint                   | Method | Headers | Payload | Purpose                                    |
| -------------------------- | ------ | ------- | ------- | ------------------------------------------ |
| `/api/lock/{path:path}`    | POST   | –       | `{ owner }` | Acquire lock for file.                 |
| `/api/lock/{path:path}`    | GET    | –       | –       | Check lock status.                         |
| `/api/lock/{path:path}/ping`| PUT   | `X-Lock-ID` | –   | Refresh lock TTL.                          |
| `/api/lock/{path:path}`    | DELETE | `X-Lock-ID` | –   | Release lock.                              |

**7.4 Git layer**

```python
from git import Repo
repo = Repo(os.getenv("GIT_REPO_PATH", "/data/repo"))
index = repo.index
index.add([full_path])
index.commit(message, author=Actor(user, email))
```

(See GitPython quick-start.) ([gitpython.readthedocs.io][5])
Handle first-run: if repo empty, create `README.md` commit.

**7.5 Service structure**

```
backend/
├── app/
│   ├── main.py           # FastAPI app with all API endpoints
│   ├── git_service.py    # GitPython wrapper for repository operations
│   ├── file_lock_service.py # File-based lock management service
│   ├── schemas.py        # Pydantic models for requests/responses
│   └── config.py         # Pydantic-based configuration settings
└── requirements.txt      # Python dependencies
```

**7.6 CORS & Auth**

* CORS allow origin from `<FRONTEND_URL>`.
* Add optional JWT bearer auth later; endpoints currently open for MVP.

**7.7 File-Based Lock System** [DONE]

A robust concurrent editing protection system using file-based locks stored in a dedicated Docker volume.

**Architecture Overview:**
- **Lock Storage**: JSON files in `/locks` directory (Docker volume `lock_data`)
- **Lock Format**: One `.lock` file per locked path containing metadata
- **TTL Management**: 5-minute default expiration with refresh capability
- **Background Cleanup**: Automatic removal of expired locks every 60 seconds
- **Multi-process Safe**: Atomic file operations handle race conditions

**Lock File Structure:**
```json
{
  "path": "docs/example.md",
  "lock_id": "uuid4-string",
  "owner": "user-identifier",
  "acquired_at": "2025-07-07T21:24:56.817678Z",
  "expires_at": "2025-07-07T21:29:56.817678Z",
  "last_ping": "2025-07-07T21:26:56.817678Z"
}
```

**API Endpoints:**
| Endpoint | Method | Headers | Purpose |
|----------|--------|---------|----------|
| `/api/lock/{path:path}` | POST | - | Acquire lock for file |
| `/api/lock/{path:path}` | GET | - | Check lock status |
| `/api/lock/{path:path}/ping` | PUT | `X-Lock-ID` | Refresh lock TTL |
| `/api/lock/{path:path}` | DELETE | `X-Lock-ID` | Release lock |

**Lock Enforcement:**
- `PUT /api/files/{path}` requires valid `X-Lock-ID` header if file is locked
- Returns HTTP 423 (Locked) with owner info on conflicts
- Lock ownership verified for all operations

**Background Cleanup:**
```python
# Runs every 60 seconds via FastAPI startup event
async def cleanup_expired_locks_task():
    while True:
        cleaned_count = lock_service.cleanup_expired_locks()
        await asyncio.sleep(60)
```

**Race Condition Handling:**
- Multiple cleanup workers can run safely (catches FileNotFoundError)
- Atomic file operations prevent corruption
- Graceful error handling for concurrent access
- Persistent across container restarts via Docker volume

**Implementation Files:**
- `backend/app/file_lock_service.py` - Core lock service
- `backend/app/main.py` - API endpoints and background task
- `backend/app/schemas.py` - Pydantic models for requests/responses
- `compose.yaml` - Docker volume configuration
- `frontend/src/lock.ts` - Frontend lock service and API integration
- `frontend/src/main.ts` - Lock UI integration and conflict handling

**7.8 Complete Locking System Architecture** [DONE]

A comprehensive collaborative editing protection system with both backend file-based locks and frontend UX integration.

**Backend Lock Implementation:**

*Lock Storage & Format:*
```json
// Example: /locks/docs_readme.md.lock
{
  "path": "docs/readme.md",
  "lock_id": "550e8400-e29b-41d4-a716-446655440000",
  "owner": "user@example.com",
  "acquired_at": "2024-01-15T10:30:00Z",
  "expires_at": "2024-01-15T10:35:00Z",
  "last_ping": "2024-01-15T10:32:00Z"
}
```

*API Endpoints:*
- `POST /api/lock/{file_path}` - Acquire or refresh lock
  - Returns: `{"lock_id": "uuid", "expires_at": "iso_timestamp"}` on success
  - Returns: HTTP 423 with `{"locked": true, "owner": "user", "expires_at": "timestamp"}` on conflict
- `GET /api/lock/{file_path}` - Check lock status
  - Returns: `{"locked": boolean, "owner": "user", "expires_at": "timestamp"}`
- `DELETE /api/lock/{file_path}` - Release lock (requires `X-Lock-ID` header)

*Lock Enforcement:*
- All `PUT /api/files/{file_path}` requests require `X-Lock-ID` header
- Middleware validates lock ownership before allowing saves
- Returns HTTP 423 on lock conflicts with owner information

*Background Cleanup:*
```python
# Automatic cleanup every 60 seconds
async def cleanup_expired_locks_task():
    while True:
        cleaned_count = lock_service.cleanup_expired_locks()
        await asyncio.sleep(60)
```

**Frontend Lock Integration:**

*Lock Service (`frontend/src/lock.ts`):*
```typescript
class LockService {
  async acquireLock(filePath: string, owner: string): Promise<LockResult>
  async refreshLock(filePath: string): Promise<boolean>
  async releaseLock(filePath: string): Promise<boolean>
  async checkLockStatus(filePath: string): Promise<LockStatus>

  // Internal state management
  private currentLocks: Map<string, string> // filePath -> lockId
  private refreshIntervals: Map<string, number> // Auto-refresh timers
}
```

*Lock Acquisition Flow:*
1. User selects file → `acquireLockForFile(path, suppressNotification=false)`
2. If successful → Enable edit/markdown buttons, start auto-refresh (every 2 minutes)
3. If conflict → Show lock owner in editor header, disable edit buttons
4. On file change → Release previous lock, acquire new lock

*Lock Conflict Handling:*
- **Editor Header**: Shows "[Owner] currently editing" in red when locked by others
- **Button States**: Edit and markdown mode buttons disabled when locked by others
- **Notifications**: Slide-out notifications for lock conflicts (suppressed on page load)
- **Auto-Switch**: Switches to read-only mode when lock is lost

*UX Features:*
- **Suppressed Redundancy**: No lock conflict notification on file load (status shown in header)
- **Visual Feedback**: Disabled buttons with tooltips, grayed-out appearance
- **Periodic Refresh**: Lock status and button states updated every 30 seconds
- **Graceful Degradation**: Read-only mode when locks unavailable

*Integration Points:*
- **File Selection**: Updates lock status and button states immediately
- **Save Operations**: Enforces lock ownership, handles conflicts gracefully
- **Page Unload**: Automatically releases locks on browser close/refresh
- **Error Recovery**: Handles network failures and stale lock states

**Lock Workflow Examples:**

*Successful Collaboration:*
1. User A opens `docs/readme.md` → Acquires lock, can edit
2. User B opens same file → Sees "User A currently editing", read-only mode
3. User A saves changes → Lock maintained, auto-refreshed
4. User A closes file → Lock released automatically
5. User B refreshes → Can now acquire lock and edit

*Conflict Resolution:*
1. User attempts save without lock → HTTP 423 response
2. Frontend shows notification: "File is locked by [Owner]"
3. Editor switches to read-only mode, edit buttons disabled
4. User can view content but cannot modify until lock is released

*Lock Expiration:*
1. Lock expires after 5 minutes of inactivity
2. Background cleanup removes expired lock files
3. Next user can acquire lock immediately
4. Previous user gets lock-lost notification if still active

This system ensures robust collaborative editing with clear user feedback and graceful conflict resolution.

---

## 8  Docker & Compose

**8.1 backend.Dockerfile**

```dockerfile
FROM python:3.12-slim AS base
WORKDIR /app
COPY backend/ ./backend
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
CMD ["uvicorn","backend.main:app","--host","0.0.0.0","--port","8000"]
```

**8.2 frontend.Dockerfile**

```dockerfile
# build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY frontend/ .
RUN npm ci && npm run build
# runtime
FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
```

**8.3 compose.yaml**

```yaml
version: "3.9"
services:
  backend:
    build: { context: ., dockerfile: docker/backend.Dockerfile }
    volumes:
      - repo:/data/repo
    environment:
      - GIT_REPO_PATH=/data/repo
    ports: [ "8000:8000" ]

  frontend:
    build: { context: ., dockerfile: docker/frontend.Dockerfile }
    depends_on: [ backend ]
    ports: [ "80:80" ]

volumes:
  repo:
```

Developers run `docker compose up --build`.

---

## 9  Environment Variables

| Var                                   | Purpose                               | Default                                                     |
| ------------------------------------- | ------------------------------------- | ----------------------------------------------------------- |
| `GIT_REPO_PATH`                       | Path inside container to the git repo | `/data/repo`                                                |
| `GIT_AUTHOR_NAME`, `GIT_AUTHOR_EMAIL` | Shown in commits                      | “Wiki User” / “[wiki@example.com](mailto:wiki@example.com)” |
| `FRONTEND_URL`                        | CORS origin                           | `http://localhost`                                          |

---

## 10  Local Dev Workflow

```bash
# one time
python -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt
npm i --prefix frontend

# run
uvicorn backend.main:app --reload
npm run dev --prefix frontend
```

* Use `pre-commit` hooks (black, ruff, prettier).
* Unit tests with `pytest` + `httpx.AsyncClient`.

---

## 11  Production Notes

* TLS termination handled by upstream reverse-proxy (e.g. Caddy or Traefik).
* Enable read-only filesystem except for mounted repo volume.
* Consider pushing commits to a remote bare origin if `REMOTE_URL` env-var is set (`repo.remote().push()`).

---

## 12  Non-functional Requirements

| Category        | Target                                                                                        |
| --------------- | --------------------------------------------------------------------------------------------- |
| Performance     | Tree fetch ≤ 150 ms for 2 000 files (virtualised list).                                       |
| Accessibility   | Milkdown & tree view fully keyboard-navigable, ARIA roles.                                    |
| Mobile UX       | Drawer slides with 300 ms ease-in-out; editor fills viewport; soft-keyboard safe-area insets. |
| Browser support | Last 2 versions of Chrome, Firefox, Safari, Edge.                                             |

---

## 13  Stretch Goals

* Live-collaboration via Milkdown’s Y.js bridge.
* Full-text search (use ripgrep + WASM on backend).

---

### 3rd-Party Components Selected

| Need                | Library                                                                                                                                                                | Why it fits |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| **Tree view**       | **infinite-tree** – Lightweight tree view component for file navigation. ([GitHub](https://github.com/cheton/infinite-tree))                                           |             |
| **Markdown editor** | **Milkdown** – Plugin-driven, CommonMark compliance, themable. ([milkdown.dev](https://milkdown.dev/))                                                                 |             |

---

This specification is intentionally exhaustive: a code-generation model with no internet access can wire every dependency, configure Milkdown, implement file navigation with infinite-tree, talk to FastAPI, initialise/commit files with GitPython, and run everything through Docker/Compose using nothing beyond what's written above.

[1]: https://milkdown.dev/ "Milkdown - Markdown Editor"
[2]: https://github.com/cheton/infinite-tree "GitHub - cheton/infinite-tree: Infinite Tree: A JavaScript library for efficiently rendering a tree view of HTML list elements that can handle large number of tree nodes."
[4]: https://fastapi.tiangolo.com/deployment/docker/?utm_source=chatgpt.com "FastAPI in Containers - Docker - FastAPI - tiangolo"
[5]: https://gitpython.readthedocs.io/en/stable/quickstart.html?utm_source=chatgpt.com "GitPython Quick Start Tutorial — GitPython 3.1.44 documentation"
