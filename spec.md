## WIP
Current phase: Status Bar Last-Commit Meta Display  
✅ **Completed Task:** Item 4 - Last-Commit Meta Display

_Completed tasks:_
- ✅ Backend `/api/history/{path}` endpoint exists and returns CommitDetail schema
- ✅ Implement frontend logic to fetch latest commit for current file
- ✅ Display "Author — relative time" text in status bar
- ✅ Add tooltip with full SHA + commit message
- ✅ Handle cases where file has no commit history

🔄 **Next Task:** Item 6 - History Drawer


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
