# Overview

## Project Description

Build a lightweight self-hosted wiki where every page is a Markdown file stored and versioned in a Git repository.

## Technology Stack

* **Frontend**: Vite + TypeScript with custom CSS
* **Markdown Editor**: Milkdown with WYSIWYG editing
* **Directory Tree**: Infinite-tree for file navigation
* **Backend**: Python 3.12, FastAPI, GitPython for VCS, Uvicorn ASGI
* **Containerisation**: Docker & Compose for parity between local dev and prod

## Primary Use-Cases

| ID | Description                                           |
| -- | ----------------------------------------------------- |
| U1 | Browse wiki pages and folder hierarchy.               |
| U2 | Create, rename, move, delete Markdown files/folders.  |
| U3 | Edit pages with Milkdown, auto-save or manual save.   |
| U4 | View commit history & diffs for any page.             |
| U5 | Run entirely from `docker compose up` in dev or prod. |

## Key Features

- **Git-based Version Control**: Every change is tracked and versioned
- **WYSIWYG Editing**: Rich markdown editing with Milkdown
- **File Management**: Complete file and folder operations
- **Collaboration**: Turn-based editing with file locking
- **History & Diffs**: View complete commit history and changes
- **Responsive Design**: Mobile-optimized interface
- **Docker Deployment**: Consistent development and production environments
