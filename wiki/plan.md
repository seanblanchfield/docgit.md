# Git-Backed Markdown Wiki: Workplan

## Phase 1: Basic Stack Setup & "Hello World" - COMPLETE
*Goal: Get all core components (Frontend, Backend, Nginx, Docker) running together in a minimal way.*

- [x] **1. Project Directory Structure:**
    - [x] Create top-level directories: `wiki/`, `frontend/`, `backend/`, `docker/`, and `data/repo/`.
- [x] **2. Backend (FastAPI):**
    - [x] Initialize a minimal FastAPI application in `backend/main.py`.
    - [x] Add a basic health check endpoint (e.g., `GET /health` returning `{"status": "ok"}`).
    - [x] Create `backend/requirements.txt` with `fastapi` and `uvicorn`.
- [x] **3. Frontend (React + Vite):**
    - [x] Create `wiki/run-node.sh` utility script to run npm commands via Docker.
    - [x] Make `run-node.sh` executable.
    - [x] Use `run-node.sh` to bootstrap a new Vite React + TypeScript application in `frontend/` (command: `create vite@latest . -- --template react-ts`).
    - [x] Run `npm install` using `run-node.sh`.
    - [x] Modify the default `App.tsx` to display a simple "Hello Wiki" message.
- [x] **4. Dockerization & Orchestration:**
    - [x] Create `docker/backend.Dockerfile` for the FastAPI app.
    - [x] Create `docker/frontend.Dockerfile` for the Vite/React app (multi-stage build for serving static assets).
    - [x] Create `docker/nginx.conf` to serve frontend static assets and reverse proxy API calls to the backend.
    - [x] Create `compose.yaml` to define and run the `backend`, `frontend` (served by Nginx), and `nginx` services.
- [x] **5. Initialize Git Data Repository:**
    - [x] Initialize a Git repository in `data/repo/`.
- [x] **Testing Point 1:**
    - [x] Run `docker compose up --build`. (Adding `--build` to ensure images are built)
    - [x] Verify the frontend (e.g., at `http://localhost`) displays "Hello Wiki".
    - [x] Verify the backend health check (e.g., `http://localhost/api/health`) is accessible and returns a success status.

## Phase 2: Core Backend API - Git Operations & File Management
*Goal: Implement backend logic for managing Markdown files in the Git repository.*
- [in-progress] **1. Git Service (`backend/git_service.py`):**
    - [x] Create `backend/app/git_service.py`.
    - [ ] Implement functions for basic Git operations:
        - [x] `init_repo(path)` (idempotent, handled by `GitService` constructor)
        - [ ] `commit_changes(message, author_name, author_email)` (placeholder `commit_files` added)
        - [x] `get_file_content(file_path)` (implemented)
        - [x] `save_file_content(file_path, content, message, author_name, author_email)` (implemented, uses `commit_files`)
        - [x] `list_files(directory_path)` (recursive, include type: file/folder) (implemented)
        - [x] `get_file_history(file_path)` (implemented)
        - [x] `get_file_diff(file_path, commit_a, commit_b)` (implemented)
    - [x] Use `GitPython` library (imported, basic use in constructor).
    - [x] Add environment variables for `GIT_REPO_PATH`, `GIT_AUTHOR_NAME`, `GIT_AUTHOR_EMAIL` to backend (integrated via `config.py` and Pydantic `Settings`).
    - [x] Ensure `git_service.py` initializes the repo at `GIT_REPO_PATH` if not already initialized (handled by `GitService` constructor).
- [ ] **2. FastAPI Endpoints & Schemas (`backend/main.py`, `backend/schemas.py`):**
    - [ ] Define Pydantic models for request/response data (`backend/app/schemas.py` created).
    - [ ] Implement API endpoints for:
        - [x] `GET /api/files`: List files and folders (implemented).
        - [x] `GET /api/files/{path:path}`: Get content of a specific file (implemented).
        - [x] `PUT /api/files/{path:path}`: Create or update a file (triggers a git commit) (implemented).
        - [x] `DELETE /api/files/{path:path}`: Delete a file or folder (triggers a git commit) (implemented).
        - [x] `POST /api/files/move`: Rename or move a file/folder (triggers a git commit) (implemented).
- [ ] **Testing Point 2:**
    - [ ] Use a tool like `curl` or Postman to test these API endpoints directly.
    - [ ] Verify that operations result in corresponding commits in the `data/repo` Git repository.

## Phase 3: Frontend - Displaying File Tree & File Content
*Goal: Enable users to browse the wiki's file structure and view Markdown file content.*
- [ ] **1. Frontend API Integration:**
    - [ ] Set up utility functions or custom hooks in React to communicate with the backend API.
- [ ] **2. File Tree Display (`react-arborist`):**
    - [ ] Integrate `react-arborist` into the frontend.
    - [ ] Fetch the file/folder list from `GET /api/files` and display it using `react-arborist`.
    - [ ] Initially, this can be a read-only tree.
- [ ] **3. File Content Display:**
    - [ ] When a file is selected in the tree, fetch its content using `GET /api/files/{path:path}`.
    - [ ] Display the raw Markdown content in a designated area of the UI.
- [ ] **Testing Point 3:**
    - [ ] Navigate the application in a browser.
    - [ ] Verify the file tree correctly reflects the structure in `data/repo`.
    - [ ] Verify that selecting a Markdown file displays its raw content.

## Phase 4: Frontend - Markdown Editor Integration (Milkdown)
*Goal: Allow users to edit Markdown files using a WYSIWYG editor.*
- [ ] **1. Integrate Milkdown Editor:**
    - [ ] Add Milkdown and its React recipe to the frontend project.
    - [ ] Configure a basic Milkdown editor instance.
- [ ] **2. Load & Save Functionality:**
    - [ ] When a file is selected and its content loaded, populate the Milkdown editor with this content.
    - [ ] Implement a "Save" mechanism: on save, get the Markdown content from Milkdown and send it to the backend via `PUT /api/files/{path:path}`.
- [ ] **Testing Point 4:**
    - [ ] Open a Markdown file; its content should appear in the Milkdown editor.
    - [ ] Edit the content in Milkdown.
    - [ ] Save the changes and verify they are persisted (check raw content display and git history if possible).

## Phase 5: Frontend - UI for File Operations
*Goal: Provide a user interface for creating, renaming, moving, and deleting files/folders.*
- [ ] **1. UI for File Management:**
    - [ ] Enhance the `react-arborist` tree or add other UI elements (buttons, context menus) to trigger:
        - [ ] New file/folder creation.
        - [ ] Rename/move operations.
        - [ ] Delete operations.
- [ ] **2. Connect UI to API:**
    - [ ] Link these UI actions to the corresponding backend API endpoints created in Phase 2.
- [ ] **Testing Point 5:**
    - [ ] Use the frontend UI to create, rename, move, and delete files and folders.
    - [ ] Verify these operations are reflected in the file tree and persisted in the backend Git repository.

## Phase 6: Version Control Features - History & Diffs
*Goal: Allow users to view the commit history and diffs for pages.*
- [ ] **1. Backend API for History/Diffs:**
    - [ ] Extend `backend/git_service.py` to support:
        - [x] Fetching commit history for a specific file (implemented in `git_service.py` and `GET /api/history/{path:path}`).
        - [x] Generating diffs between two versions of a file (implemented in `git_service.py` and `GET /api/diff/{path:path}`).
    - [x] Add new FastAPI endpoints (e.g., `GET /api/history/{path:path}` (implemented), `GET /api/diff/{path:path}` (implemented)).
- [ ] **2. Frontend UI for History/Diffs:**
    - [ ] Create UI components to display the commit history for a selected file.
    - [ ] Allow users to select commits and view a diff.
- [ ] **Testing Point 6:**
    - [ ] Select a file and view its commit history.
    - [ ] Select two versions of a file and view the differences.

## Phase 7: Enhancements, Polish & Non-Functionals
*Goal: Refine the application, implement auto-save, and address non-functional requirements.*
- [ ] **1. Auto-save:** Implement auto-save functionality for the Milkdown editor.
- [ ] **2. Styling & UX (Tailwind CSS, shadcn/ui):**
    - [ ] Apply styling using Tailwind CSS.
    - [ ] Utilize `shadcn/ui` components (e.g., Sheet for drawer, Buttons, ScrollArea) as per `spec.md`.
    - [ ] Ensure responsive design and good mobile UX.
- [ ] **3. CORS & Security:**
    - [ ] Properly configure CORS on the backend.
    - [ ] Review security considerations (though JWT auth is deferred in the spec for MVP).
- [ ] **4. Local Development Workflow:**
    - [ ] Set up `pre-commit` hooks (black, ruff, prettier).
    - [ ] Prepare for unit tests (`pytest`, `httpx.AsyncClient` for backend; Jest/React Testing Library for frontend).
- [ ] **5. Address NFRs:** Review and address non-functional requirements (performance, accessibility) as time permits.
- [ ] **Testing Point 7:**
    - [ ] Conduct thorough end-to-end testing of all features.
    - [ ] Evaluate usability, performance, and responsiveness.
