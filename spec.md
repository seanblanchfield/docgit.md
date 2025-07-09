## WIP
Current phase: Frontend File Operations UI Implementation
🔄 **Current Task:** Create Row UI/UX Improvements

_Progress on create row functionality:_
- ✅ **Data-Driven Create Row Implementation:**
  - ✅ Implemented robust data-driven approach using virtual create nodes
  - ✅ Fixed duplication bug - each folder now shows exactly one create item
  - ✅ Deep cloning and single-pass recursive processing eliminates timing issues
  - ✅ Create items properly positioned at end of each directory and root level
  - ✅ Stable tree structure with no recursion conflicts

_Completed bug fixes:_
- ✅ **Debug Output:** Removed verbose console.log statements
- ✅ **Tree Expansion:** Tree defaults to collapsed state on refresh
- ✅ **Rendering Timing:** No visible delay in create row rendering
- ✅ **DOM Structure:** Proper sibling positioning achieved
- ✅ **Duplication Bug:** Fixed duplicate create items in directories

_Next UI/UX improvements:_
- 🔄 **Create Row Polish:**
  - 🔄 Update create row text from "+ Add file or folder" to just "+"
  - 🔄 Style create rows: light grey that turns dark bold on hover
  - 🔄 Connect create row click to show new file/folder dialog
- 🔄 **Integration:**
  - 🔄 Integrate create dialog with backend APIs
  - 🔄 Add error handling and user feedback for create operations
- 🔄 **Remaining File Operations UI:**
  - 🔄 Add menu button to file header with delete option
  - 🔄 Implement delete confirmation modal
  - 🔄 Add drag and drop functionality to tree view
  - 🔄 Add visual feedback for drag/drop operations
- 🔄 **Testing and Polish:**
  - 🔄 Test complete file operations workflow
  - 🔄 Add comprehensive error handling and user feedback
  - 🔄 Verify optimistic updates and rollback functionality

## Completed Work

**✅ File Operations Specification:** [DONE]
- Detailed UI/UX specifications for creating, deleting, and moving files
- Complete API endpoint definitions and validation rules
- Error handling and user feedback strategies
- Integration with existing tree view and editor components

**✅ Backend File Operations API:** [DONE]
- POST /api/directory endpoint with validation and Git tracking
- DELETE /api/file/{path} and DELETE /api/directory/{path} endpoints
- PUT /api/file/{path}/move and PUT /api/directory/{path}/move endpoints
- Comprehensive validation (conflict detection, path safety, empty checks)
- Proper error handling with HTTP status codes (400, 404, 409, 500)
- Git integration with customizable commit messages
- All endpoints tested successfully with curl

**✅ Lock System Complete:** [DONE]
- Backend file-based lock system with Docker volume storage
- Frontend lock integration with visual indicators and conflict handling
- Complete lock workflow: acquire, refresh, release, cleanup
- Lock enforcement on save operations with graceful error handling

**✅ History and Diff System:** [DONE]
- Backend `/api/history/{path}` and `/api/diff/{path}` endpoints
- Frontend history drawer with commit list and diff view
- Fixed diff comparison logic to show actual changes
- Complete history workflow with proper UI styling

**✅ Editor Improvements:** [DONE]
- Fixed editor mode persistence bug (always open files in view mode)
- Improved save feedback with instant header updates
- Enhanced lock conflict resolution and user experience
- Comprehensive CSS styling for all lock states

Implementation roadmap (✅ = done, 🔄 = in progress). *Stop after each **Checkpoint** and ask the user for approval before moving on.*

| # | Work Item | Description / Deliverables | Checkpoint |
|---|-----------|----------------------------|------------|
| 1 | **Status-Bar Skeleton** [DONE] | • Add fixed container (flex, 40 px) in `Editor.tsx`.<br>• Add placeholder slots for mode control, unsaved pill, commit meta, history & revert buttons.<br>• Basic styling in `styles.css`. | UI screenshot + a11y audit. |
| 2 | **Mode Switch Control** [DONE] | • Segmented control `View | WYSIWYG | Raw`.<br>• Wire to Milkdown `readOnly` and raw `<textarea>` views.<br>• Persist choice in `localStorage.editorMode`.<br>• Shortcut `Ctrl+E` cycles modes. | Demo switching between modes with sample doc. |
| 3 | **Unsaved Indicator & Local Drafts** [DONE] | • Compute dirty flag via baseline SHA diff.<br>• Auto-save buffer to `localStorage.draft:<path>` every 10 s.<br>• Show orange "Unsaved" pill when dirty. | Refresh page → pill persists; user confirmation. |
| 4 | **Last-Commit Meta Display** | • Call `/api/history/{path}?limit=1`.<br>• Show "Author — relative time" text.<br>• Tooltip with full SHA + message. | Demo with file having recent commit. |
| 5 | **Revert/Discard Local Draft** [DONE] | • "Revert" icon clears draft key & reloads from backend.<br>• Confirmation dialog. | Confirm that dirty pill disappears after revert. |
| 6 | **History Drawer** | • Side panel listing commits (reuse `/api/history`).<br>• Clicking entry opens diff (`/api/diff`). | Walkthrough diff view. |
| 7 | **Edit-Lock Backend** | • Endpoint `POST /api/lock/{path}` (lock_id, TTL 5 min).<br>• Middleware to enforce lock for PUT/auto-save.<br>• Auto-refresh lock ping every 60 s. | Unit tests + curl demo acquiring/denying lock. |
| 8 | **Lock UI Integration** | • On 423 response show red banner "Sean is editing…".<br>• Disable editing; allow View mode. | Simulate double-tab scenario; banner appears. |
| 9 | **Backend Auto-Save Commit (+amend)** | • PUT `/api/file/{path}` accepts `lock_id` & `base_sha`.<br>• If `base_sha==HEAD` and author matches, `git commit --amend` else new commit.<br>• Release lock on success. | Run auto-save; inspect git log (single commit). |
|10 | **Client Auto-Save Trigger** | • 5-min inactivity or manual save button.<br>• Payload includes `lock_id` & `base_sha`.<br>• On success clear draft, refresh baseline SHA. | Demo end-to-end save cycle. |
|11 | **Preference Persistence** | • Store collapsed state, drawer widths, etc. | UX persists across reload. |
|12 | **User Acceptance Regression** | • Run full E2E test script (Puppeteer).<br>• Collect feedback, adjust UI polish. | Green-light from user. |

---

### Simplified Tree Implementation Details

#### Data Structure
```typescript
interface TreeNode {
  id: string;          // Full path
  name: string;        // Display name
  isDirectory: boolean;
  children?: TreeNode[];
  state?: {
    depth?: number;
    open?: boolean;
    selected?: boolean;
    loading?: boolean;
  };
}
```

#### Key Features
- Simplified to show only folder/file names
- Lazy loading of directory contents
- Basic expand/collapse functionality
- Visual indicators for directories and files
- Loading states for async operations

#### Backend Integration
- GET `/api/files/tree` - Initial tree structure
- GET `/api/files/{path}` - Lazy load directory contents
- Uses standard HTTP status codes for error handling

---

# Project Specification – “Git-Backed Markdown Wiki”

#### 1  Overview

Build a lightweight self-hosted wiki where every page is a Markdown file stored and versioned in a Git repository.

* **Frontend**: Vite + TypeScript with custom CSS
* **Markdown Editor**: Milkdown with WYSIWYG editing
* **Directory Tree**: Infinite-tree for file navigation
* **Backend** : Python 3.12, FastAPI, GitPython for VCS, Uvicorn ASGI.
* **Containerisation** : Docker & Compose for parity between local dev and prod. ([FastAPI][4])

---

#### 2  Primary Use-Cases

| ID | Description                                           |
| -- | ----------------------------------------------------- |
| U1 | Browse wiki pages and folder hierarchy.               |
| U2 | Create, rename, move, delete Markdown files/folders.  |
| U3 | Edit pages with Milkdown, auto-save or manual save.   |
| U4 | View commit history & diffs for any page.             |
| U5 | Run entirely from `docker compose up` in dev or prod. |

---

#### 3  Top-Level Directory Layout

```
wiki/
├── docker/
│   ├── backend.Dockerfile
│   ├── frontend.Dockerfile
│   └── nginx.conf
├── compose.yaml
├── frontend/     # Vite React app
├── backend/      # FastAPI service
└── data/
    └── repo/.git  (mounted volume for persistence)
```

---

#### 4  Architecture Diagram (high-level)

```
┌──────────────┐           HTTPS            ┌────────────────┐
│      UI      │  ───────→ /api/*  ───────→ │  FastAPI app   │──┐
│ (Vite build) │  Static  │                 └────────────────┘  │
└──────────────┘  assets  │                     │GitPython       │
        ▲                Nginx                 repo volume       │
        │                                         │              │
   infinite-tree                              commits           │
   Milkdown editor                                              Git
        │                                                       │
Mobile/desktop ▲                                        ┌──────────────┐
responsive drawer│                                        │ Remote git? │ (optional push)
```

---

#### 5  Frontend Specification

##### 5.1  Tree Drawer UX  [DONE]

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

| Topic                        | Details                                                                                                                                                                                                                                                            |                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| **Bootstrapping**            | `npm create vite@latest wiki-frontend -- --template vanilla-ts` |
| **Styling**                  | Custom CSS with vanilla styling |
| **State/Data fetch**         | Native `fetch` API for data fetching |
| **5.1 Milkdown Integration** | Using `@milkdown/crepe` for WYSIWYG markdown editing |
| **5.2 Directory Tree**       | Using `infinite-tree` for file navigation |
| **5.3 Tree Data model**      | `{ id: string, name: string, children?: TreeNodeData[] }` from `/api/files/tree` |
| **5.5 Creating files**       | “New Page” button in drawer footer → prompt path → POST `/api/file` → optimistic tree update → open editor with stub front-matter.                                                                                                                                 |                                                        |
| **5.6 Responsive behaviour** | On xs screens, Sheet slides over content; on ≥md screens it docks (`md:static md:translate-x-0`).                                                                                                                                                                  |                                                        |

---

##### 5.7 Editor Modes (View / WYSIWYG / Raw)

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

##### 5.8 Auto-Save & Concurrency (Turn-Based Editing)

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

---

#### 6  Backend Specification (FastAPI)

| Endpoint                   | Method | Payload / Query        | Purpose                                    |
| -------------------------- | ------ | ---------------------- | ------------------------------------------ |
| `/api/tree`                | GET    | `?depth` (opt)         | JSON list of files + dirs (see §5.3).      |
| `/api/file/{path:path}`    | GET    | –                      | Raw Markdown.                              |
| `/api/file`                | POST   | `{ path, content }`    | Create new file & commit.                  |
| `/api/file/{path:path}`    | PUT    | `{ content, message }` | Update file & commit.                      |
| `/api/history/{path:path}` | GET    | `?limit`               | Commit meta list (sha, author, date, msg). |
| `/api/diff/{path:path}`    | GET    | `?sha1&sha2`           | Unified diff for two commits.              |

**6.1 Git layer**

```python
from git import Repo
repo = Repo(os.getenv("GIT_REPO_PATH", "/data/repo"))
index = repo.index
index.add([full_path])
index.commit(message, author=Actor(user, email))
```

(See GitPython quick-start.) ([gitpython.readthedocs.io][5])
Handle first-run: if repo empty, create `README.md` commit.

**6.2 Service structure**

```
backend/
├── main.py           # FastAPI app / routers
├── git_service.py    # thin wrapper around GitPython
├── schemas.py        # Pydantic models
└── settings.py       # Pydantic-based config
```

**6.3 CORS & Auth**

* CORS allow origin from `<FRONTEND_URL>`.
* Add optional JWT bearer auth later; endpoints currently open for MVP.

**6.4 File-Based Lock System** [DONE]

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
  "expires_at": "2025-07-07T21:29:56.817678Z"
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

**6.5 Complete Locking System Architecture** [DONE]

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

#### 7  Docker & Compose

**7.1 backend.Dockerfile**

```dockerfile
FROM python:3.12-slim AS base
WORKDIR /app
COPY backend/ ./backend
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
CMD ["uvicorn","backend.main:app","--host","0.0.0.0","--port","8000"]
```

**7.2 frontend.Dockerfile**

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

**7.3 compose.yaml**

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

#### 8  Environment Variables

| Var                                   | Purpose                               | Default                                                     |
| ------------------------------------- | ------------------------------------- | ----------------------------------------------------------- |
| `GIT_REPO_PATH`                       | Path inside container to the git repo | `/data/repo`                                                |
| `GIT_AUTHOR_NAME`, `GIT_AUTHOR_EMAIL` | Shown in commits                      | “Wiki User” / “[wiki@example.com](mailto:wiki@example.com)” |
| `FRONTEND_URL`                        | CORS origin                           | `http://localhost`                                          |

---

#### 9  Local Dev Workflow

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

#### 10  Production Notes

* TLS termination handled by upstream reverse-proxy (e.g. Caddy or Traefik).
* Enable read-only filesystem except for mounted repo volume.
* Consider pushing commits to a remote bare origin if `REMOTE_URL` env-var is set (`repo.remote().push()`).

---

#### 11  Non-functional Requirements

| Category        | Target                                                                                        |
| --------------- | --------------------------------------------------------------------------------------------- |
| Performance     | Tree fetch ≤ 150 ms for 2 000 files (virtualised list).                                       |
| Accessibility   | Milkdown & tree view fully keyboard-navigable, ARIA roles.                                    |
| Mobile UX       | Drawer slides with 300 ms ease-in-out; editor fills viewport; soft-keyboard safe-area insets. |
| Browser support | Last 2 versions of Chrome, Firefox, Safari, Edge.                                             |

---

#### 12  Stretch Goals

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
