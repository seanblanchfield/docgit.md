# Project Structure

## Top-Level Directory Layout

```
.
├── docs/                  # Project documentation
├── WIP/                   # Work-in-progress tasks
├── compose.yaml           # Production Docker Compose config
├── compose.override.yaml  # Development Docker Compose overrides
├── run-node.sh            # Script for running npm commands in Docker
├── frontend/              # Vite TypeScript app (vanilla, not React)
│   └── Dockerfile         # Frontend dev server (Vite with HMR)
├── backend/               # FastAPI service
│   └── Dockerfile         # Production multi-stage build (frontend + backend)
├── data/
│   ├── locks/             # File-based lock storage
│   └── repo/              # Git repository (mounted volume for persistence)
├── spec.md                # Project specification
├── README.md              # Project documentation
├── .gitignore
└── .dockerignore
```

## Root Level Files

| File | Purpose | Key Details |
|------|---------|-------------|
| `compose.yaml` | Production Docker Compose config | Defines backend service with multi-stage build. Single container serves both API and frontend. |
| `compose.override.yaml` | Development overrides | Automatically loaded by Docker Compose. Adds frontend service with Vite dev server for HMR. |
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

The frontend source code in `src/` is organized into the following subdirectories based on functionality:

| Directory | Purpose |
|-----------|---------|
| `components/` | Reusable UI components. |
| `services/` | Modules for communicating with external APIs (e.g., the backend). |
| `tree/` | The self-contained, modular directory tree component. |
| `types/` | Global TypeScript type definitions. |
| `utils/` | General-purpose utility functions. |

### Key Files

| File | Purpose | Key Details |
|------|---------|-------------|
| `src/main.ts` | Application entry point | Initializes all components, services, and event listeners. |
| `src/components/editor.ts` | Markdown editor component | Wraps the Milkdown editor for WYSIWYG markdown editing. Formerly `content.ts`. |
| `src/components/drawer.ts` | Sidebar drawer component | Handles the resizable and collapsible sidebar drawer. |
| `src/services/lock.ts` | Lock service client | Manages file locking by communicating with the backend API. |
| `src/utils/humanize.ts` | Formatting utilities | Provides functions to humanize file names and timestamps. |
| `src/types/infinite-tree.d.ts` | Type definitions | Contains TypeScript type declarations for the `infinite-tree` library. |
| `src/tree/` | Directory tree component | Modular directory tree implementation. See details below. |
| `src/styles.css` | Application styles | Global CSS for layout, components, and responsive design. |
| `index.html` | HTML template | The single-page application shell. |
| `package.json` | Node.js configuration | Defines dependencies and build scripts. Uses pnpm. |

### Tree Module Directory (`frontend/src/tree/`)

| File | Purpose | Key Details |
|------|---------|-------------|
| `index.ts` | Main `DirectoryTree` class | Orchestrates the tree modules, exposing a clean public API. |
| `data.ts` | Data fetching and processing | Handles loading directory data from the backend and preparing it for the tree. |
| `renderer.ts` | Custom row rendering | Generates the HTML for each tree node, including icons and state indicators. |
| `eventHandlers.ts` | DOM event handling | Manages all user interactions with the tree, such as clicks and keyboard navigation. |
| `state.ts` | State management | Manages the tree's internal state, like expanded and selected nodes. |
| `lock.ts` | File lock integration | Handles visual indicators for locked files within the tree. |
| `createItem.ts` | Create-item logic | Manages the temporary "create file/folder" nodes in the tree. |
| `types.ts` | Type definitions | Contains all TypeScript interfaces and types for the tree module. |

## Dockerfiles

| File | Purpose | Key Details |
|------|---------|-------------|
| `backend/Dockerfile` | Production multi-stage build | Stage 1: Builds frontend with Node.js/pnpm. Stage 2: Python backend with built frontend static files. Single optimized container. |
| `frontend/Dockerfile` | Development Vite server | Runs Vite dev server with HMR. Used only in development mode via `compose.override.yaml`. |

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

### WIP File Standards

All WIP files should follow this structure:

```markdown
# TODO_XXX: [Feature Name]

## Objective
[Clear description of what needs to be accomplished]

## User Stories
[User-focused requirements]

## Requirements
[Functional and technical requirements]

## Implementation Plan
[Step-by-step approach]

## Known Issues & Future Improvements
[Bug reports and enhancement ideas discovered during development]

### Bugs Discovered During Development
[Use bug report template from bug-workflow.md]

### Future Enhancements
[List potential improvements identified during work]

### Technical Debt
[Note any shortcuts or temporary solutions that need future attention]

## Acceptance Criteria
[Checkboxes for completion requirements]

**Priority**: High/Medium/Low
**Estimated Effort**: [Time estimate]
**Dependencies**: [Other TODOs or external requirements]
```

For bug reporting within WIP files, see the [Bug Recording Workflow](bug-workflow.md) documentation.

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
