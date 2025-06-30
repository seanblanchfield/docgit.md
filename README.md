# mdcanvas

**mdcanvas** is a lightweight, self-hosted wiki where every page is a Markdown file stored and versioned in a Git repository.

## Project Overview

This project provides a simple and effective way to create and manage a personal or team wiki. All content is stored in Markdown files, making it easy to edit and version control with Git. The web interface provides a user-friendly way to browse, edit, and track changes to the wiki pages.

### Key Features

*   **Markdown-based:** All pages are written in Markdown, a simple and intuitive markup language.
*   **Git-backed:** Every change is committed to a Git repository, providing a complete history of all modifications.
*   **Web-based interface:** A user-friendly web interface allows for easy browsing, editing, and management of wiki pages.
*   **File/folder management:** Create, rename, move, and delete files and folders directly from the web interface.
*   **Commit history and diffs:** View the commit history and see the differences between versions of a page.
*   **Dockerized:** The entire application is containerized with Docker, making it easy to set up and run in any environment.

## Technical Stack

*   **Frontend:** Vite, TypeScript, and [infinite-tree](https://github.com/cheton/infinite-tree) for file navigation.
*   **Backend:** Python, FastAPI, and [GitPython](https://gitpython.readthedocs.io/en/stable/) for Git operations.
*   **Database:** The filesystem itself, with versioning managed by Git.
*   **Containerization:** Docker and Docker Compose for development and production environments.

## Getting Started

To get started with **mdcanvas**, you will need to have Docker and Docker Compose installed.

1.  Clone the repository:

    ```bash
    git clone https://github.com/your-username/mdcanvas.git
    ```

2.  Navigate to the `wiki` directory:

    ```bash
    cd mdcanvas/wiki
    ```

3.  Start the application:

    ```bash
    docker compose up --build
    ```

The application will be available at `http://localhost:8080`.

## Architecture

The application consists of three main components:

*   **Frontend:** A Vite and TypeScript-based single-page application that provides the user interface.
*   **Backend:** A FastAPI application that handles business logic, file operations, and Git versioning.
*   **Nginx:** A reverse proxy that serves the frontend and forwards API requests to the backend.

The following diagram illustrates the high-level architecture:

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

## Getting Started

To get started with **mdcanvas**, you will need to have Docker and Docker Compose installed.

1.  Clone the repository:

    ```bash
    git clone https://github.com/your-username/mdcanvas.git
    ```

2.  Navigate to the `wiki` directory:

    ```bash
    cd mdcanvas/wiki
    ```

3.  Start the application:

    ```bash
    docker compose up --build
    ```

The application will be available at `http://localhost:8080`.

## Development

For local development, the project is set up to provide a hot-reloading environment for both the frontend and backend.

### Local Development Workflow

1.  **Set up the environment:**

    ```bash
    # one time
    python -m venv .venv && source .venv/bin/activate
    pip install -r backend/requirements.txt
    npm i --prefix frontend
    ```

2.  **Run the development servers:**

    ```bash
    # run
    uvicorn backend.main:app --reload
    npm run dev --prefix frontend
    ```

### API Endpoints

The backend provides the following API endpoints:

| Endpoint                   | Method | Payload / Query        | Purpose                                    |
| -------------------------- | ------ | ---------------------- | ------------------------------------------ |
| `/api/tree`                | GET    | `?depth` (opt)         | JSON list of files + dirs.                 |
| `/api/file/{path:path}`    | GET    | –                      | Raw Markdown.                              |
| `/api/file`                | POST   | `{ path, content }`    | Create new file & commit.                  |
| `/api/file/{path:path}`    | PUT    | `{ content, message }` | Update file & commit.                      |
| `/api/history/{path:path}` | GET    | `?limit`               | Commit meta list (sha, author, date, msg). |
| `/api/diff/{path:path}`    | GET    | `?sha1&sha2`           | Unified diff for two commits.              |

### Configuration

The application can be configured using environment variables.

| Var                                   | Purpose                               | Default                                                     |
| ------------------------------------- | ------------------------------------- | ----------------------------------------------------------- |
| `GIT_REPO_PATH`                       | Path inside container to the git repo | `/data/repo`                                                |
| `GIT_AUTHOR_NAME`, `GIT_AUTHOR_EMAIL` | Shown in commits                      | “Wiki User” / “[wiki@example.com](mailto:wiki@example.com)” |
| `FRONTEND_URL`                        | CORS origin                           | `http://localhost`                                          |

For more detailed information, please refer to the `spec.md` file.
