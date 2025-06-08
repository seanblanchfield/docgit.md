## WIP
Current step: Implementing simplified file tree navigation using infinite-tree

Bullet list containing work that has been performed:
- [x] Analyzed current infinite-tree implementation against documentation
- [x] Designed simplified node data structure with only essential fields
- [ ] Implement simplified tree renderer with minimal styling
- [ ] Add event handlers for node selection and toggling
- [ ] Integrate with backend API for lazy loading of directory contents
- [ ] Ensure proper state management for open/selected nodes

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
│   React UI   │  ───────→ /api/*  ───────→ │  FastAPI app   │──┐
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
