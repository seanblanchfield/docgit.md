# Project Structure

## Top-Level Directory Layout

```
.
├── docs/         # Project documentation (NEW)
├── WIP/          # Work-in-progress tasks (NEW)
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

## Root Level Files

| File | Purpose | Key Details |
|------|---------|-------------|
| `compose.yaml` | Docker Compose configuration | Defines 3 services: backend (FastAPI), frontend (Vite dev server), nginx (reverse proxy). Uses named volumes for repo data and lock storage. |
| `run-node.sh` | Node.js command runner | Shell script for running npm commands inside Docker containers during development. |
| `spec.md` | Project specification | Complete technical specification including architecture, API endpoints, frontend components, and implementation roadmap. |
| `README.md` | Project documentation | Main project documentation with setup and usage instructions. |

## Backend Directory (`backend/`)

| File | Purpose | Key Details |
|------|---------|-------------|
| `app/main.py` | FastAPI application entry point | Contains all HTTP endpoints for file operations, history, diff, and lock management. Implements background lock cleanup task. |
| `app/git_service.py` | Git operations service | Wraps GitPython for repository operations: file CRUD, history retrieval, diff generation, commit management. |
| `app/file_lock_service.py` | Concurrent editing lock system | File-based locking with JSON metadata storage. Manages lock acquisition, refresh, release, and cleanup. |
| `app/schemas.py` | Pydantic data models | Request/response schemas for all API endpoints including file operations, commits, diffs, and lock management. |
| `app/config.py` | Application configuration | Settings management using Pydantic for environment variables and defaults. |
| `requirements.txt` | Python dependencies | FastAPI, GitPython, Pydantic, and other backend dependencies. |

## Frontend Directory (`frontend/`)

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

## Docker Directory (`docker/`)

| File | Purpose | Key Details |
|------|---------|-------------|
| `backend.Dockerfile` | Backend container definition | Python 3.12 slim image with FastAPI, GitPython, and application dependencies. |
| `frontend.Dockerfile` | Frontend production build | Multi-stage build: Node.js for compilation, nginx for serving static assets. |
| `frontend.dev.Dockerfile` | Frontend development container | Vite dev server with live reload and source mounting for development. |
| `nginx.conf` | Nginx reverse proxy config | Routes `/api/*` to backend, serves frontend assets, handles CORS and static files. |

## Data Directory (`data/`)

| Directory | Purpose | Key Details |
|-----------|---------|-------------|
| `repo/` | Git repository storage | Contains the actual wiki content as markdown files in a Git repository. Mounted as Docker volume. |
| `locks/` | Lock files storage | File-based lock storage with JSON metadata. Each lock is a separate file with TTL and ownership info. |

## Documentation Directory (`docs/`)

| File | Purpose |
|------|---------|
| `index.md` | Main documentation index with table of contents |
| `overview.md` | Project overview and use cases |
| `architecture.md` | System architecture and design |
| `project-structure.md` | This file - project organization |
| `frontend.md` | Frontend implementation details |
| `backend.md` | Backend API and services |
| `docker.md` | Container and deployment setup |
| `development.md` | Development workflow and setup |
| `environment.md` | Environment configuration |
| `testing.md` | Testing strategies |
| `production.md` | Production deployment notes |
| `requirements.md` | Non-functional requirements |

## WIP Directory (`WIP/`)

Contains work-in-progress tasks and features, each in its own markdown file:

| File | Status | Description |
|------|--------|-------------|
| `TODO_200_localstorage_lock_system_fixes.md` | In Progress | LocalStorage and lock system bug fixes |
| `TODO_201_editor_modes.md` | TODO | Editor modes (View/WYSIWYG/Raw) |
| `TODO_202_stretch_goals.md` | TODO | Future enhancement features |

## Key Implementation Patterns

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
