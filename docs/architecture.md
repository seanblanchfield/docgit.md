# Architecture

## High-Level Architecture Diagram

```
┌──────────────────────────────────────────────────────────┐
│                  FastAPI Backend Container               │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Static Frontend (Built Vite App)                  │  │
│  │  - TypeScript Application                          │  │
│  │  - Infinite-tree (File navigation)                 │  │
│  │  - Milkdown Editor (WYSIWYG markdown)              │  │
│  │  - Responsive Drawer (Mobile-optimized)            │  │
│  └────────────────────────────────────────────────────┘  │
│                           │                               │
│                    Served via FastAPI                     │
│                           │                               │
│  ┌────────────────────────────────────────────────────┐  │
│  │  FastAPI Application (API Layer)                   │  │
│  │  - RESTful API endpoints (/api/*)                  │  │
│  │  - Static file serving (/, /assets/*)              │  │
│  │  - GitPython Integration                           │  │
│  │  - File-based Lock Storage                         │  │
│  │  - Uvicorn ASGI Server                             │  │
│  └────────────────────────────────────────────────────┘  │
│                           │                               │
│                      GitPython                            │
│                           │                               │
└───────────────────────────┼───────────────────────────────┘
                            │
                    ┌───────┴────────┐
                    │                │
            ┌───────────────┐  ┌──────────────┐
            │ Git Repository│  │ Lock Storage │
            │  (repo volume)│  │ (file-based) │
            └───────────────┘  └──────────────┘
                    │
            ┌───────────────┐
            │ Remote git?   │ (optional push)
            └───────────────┘
```

## System Components

### Single Container Architecture
The application now runs in a **single Docker container** that serves both the frontend and backend:

- **Built Frontend Static Files**: Vite-built production assets served by FastAPI
- **TypeScript Application**: Type-safe frontend code (compiled to static files)
- **Infinite-tree**: File navigation component
- **Milkdown Editor**: WYSIWYG markdown editing
- **Responsive Drawer**: Mobile-optimized navigation

### Backend (API Layer)
- **FastAPI Application**: RESTful API server + static file serving
- **GitPython Integration**: Git repository operations
- **File-based Lock Storage**: Concurrent editing protection
- **Uvicorn ASGI Server**: High-performance async server
- **Static File Serving**: Serves frontend SPA and assets

### Data Layer
- **Git Repository**: Version-controlled file storage
- **Lock Files**: Temporary editing locks
- **Optional Remote Git**: External repository synchronization

## Communication Flow

1. **User Interaction**: User interacts with the frontend UI
2. **API Requests**: Frontend makes HTTP requests to `/api/*` endpoints
3. **Git Operations**: Backend performs Git operations via GitPython
4. **File System**: Changes are persisted to the Git repository
5. **Lock Management**: File locks prevent concurrent editing conflicts
6. **Response**: Updated data is returned to the frontend

## Key Design Principles

- **Git-First**: All content is stored and versioned in Git
- **API-Driven**: Clean separation between frontend and backend
- **Container-Based**: Consistent environments via Docker
- **Mobile-Responsive**: Optimized for all device sizes
- **Conflict Prevention**: File locking prevents editing conflicts
