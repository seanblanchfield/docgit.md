# Architecture

## High-Level Architecture Diagram

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

## System Components

### Frontend (UI Layer)
- **Vite Development Server**: Hot module reloading for development
- **TypeScript Application**: Type-safe frontend code
- **Infinite-tree**: File navigation component
- **Milkdown Editor**: WYSIWYG markdown editing
- **Responsive Drawer**: Mobile-optimized navigation

### Backend (API Layer)
- **FastAPI Application**: RESTful API server
- **GitPython Integration**: Git repository operations
- **File-based Lock Storage**: Concurrent editing protection
- **Uvicorn ASGI Server**: High-performance async server

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
