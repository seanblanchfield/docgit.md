# Backend Specification (FastAPI)

## Overview

The backend is built with FastAPI and Python 3.12, providing a RESTful API for file operations, Git integration, and collaborative editing features through a file-based locking system.

## Core API Endpoints

| Endpoint                   | Method | Payload / Query        | Purpose                                    |
| -------------------------- | ------ | ---------------------- | ------------------------------------------ |
| `/health`                  | GET    | –                      | Health check endpoint.                     |
| `/api/files`               | GET    | `?path` (opt)          | List files and directories in repository.  |
| `/api/files/tree`          | GET    | –                      | Get complete directory tree structure.     |
| `/api/files/{path:path}`   | GET    | –                      | Get file content.                          |
| `/api/files/{path:path}`   | PUT    | `{ content, message }` | Update file & commit.                      |
| `/api/files/{path:path}`   | DELETE | `?commit_message` (opt)| Delete file/directory & commit.            |
| `/api/files/move`          | POST   | `{ source_path, destination_path, message }` | Move/rename file or directory. |
| `/api/history/{path:path}` | GET    | `?limit` (opt)         | Commit history for file.                   |
| `/api/diff/{path:path}`    | GET    | `?sha1&sha2`           | Unified diff between two commits.          |

## File Operations API

| Endpoint                         | Method | Payload / Query        | Purpose                                    |
| -------------------------------- | ------ | ---------------------- | ------------------------------------------ |
| `/api/directory`                 | POST   | `{ name, message? }, ?parent_path` | Create new directory.         |
| `/api/file/{path:path}`          | DELETE | `?commit_message` (opt)| Delete specific file.                      |
| `/api/directory/{path:path}`     | DELETE | `?commit_message` (opt)| Delete specific directory.                 |
| `/api/file/{path:path}/move`     | PUT    | `{ destination_path, message? }` | Move/rename file.               |
| `/api/directory/{path:path}/move`| PUT    | `{ destination_path, message? }` | Move/rename directory.          |

## Lock Management API

| Endpoint                   | Method | Headers | Payload | Purpose                                    |
| -------------------------- | ------ | ------- | ------- | ------------------------------------------ |
| `/api/lock/{path:path}`    | POST   | –       | `{ owner }` | Acquire lock for file.                 |
| `/api/lock/{path:path}`    | GET    | –       | –       | Check lock status.                         |
| `/api/lock/{path:path}/ping`| PUT   | `X-Lock-ID` | –   | Refresh lock TTL.                          |
| `/api/lock/{path:path}`    | DELETE | `X-Lock-ID` | –   | Release lock.                              |

## Git Integration

**GitPython Implementation:**
```python
from git import Repo
repo = Repo(os.getenv("GIT_REPO_PATH", "/data/repo"))
index = repo.index
index.add([full_path])
index.commit(message, author=Actor(user, email))
```

**Features:**
- All file operations automatically create Git commits
- Complete commit history tracking
- Diff generation between any two commits
- First-run initialization with README.md commit

## Service Structure

```
backend/
├── app/
│   ├── main.py           # FastAPI app with all API endpoints
│   ├── git_service.py    # GitPython wrapper for repository operations
│   ├── file_lock_service.py # File-based lock management service
│   ├── schemas.py        # Pydantic models for requests/responses
│   └── config.py         # Pydantic-based configuration settings
└── requirements.txt      # Python dependencies
```

## File-Based Lock System [DONE]

A robust concurrent editing protection system using file-based locks stored in a dedicated Docker volume.

### Architecture Overview
- **Lock Storage**: JSON files in `/locks` directory (Docker volume `lock_data`)
- **Lock Format**: One `.lock` file per locked path containing metadata
- **TTL Management**: 5-minute default expiration with refresh capability
- **Background Cleanup**: Automatic removal of expired locks every 60 seconds
- **Multi-process Safe**: Atomic file operations handle race conditions

### Lock File Structure
```json
{
  "path": "docs/example.md",
  "lock_id": "uuid4-string",
  "owner": "user-identifier",
  "acquired_at": "2025-07-07T21:24:56.817678Z",
  "expires_at": "2025-07-07T21:29:56.817678Z",
  "last_ping": "2025-07-07T21:26:56.817678Z"
}
```

### Lock Enforcement
- `PUT /api/files/{path}` requires valid `X-Lock-ID` header if file is locked
- Returns HTTP 423 (Locked) with owner info on conflicts
- Lock ownership verified for all operations

### Background Cleanup
```python
# Runs every 60 seconds via FastAPI startup event
async def cleanup_expired_locks_task():
    while True:
        cleaned_count = lock_service.cleanup_expired_locks()
        await asyncio.sleep(60)
```

### Race Condition Handling
- Multiple cleanup workers can run safely (catches FileNotFoundError)
- Atomic file operations prevent corruption
- Graceful error handling for concurrent access
- Persistent across container restarts via Docker volume

## Lock Workflow Examples

### Successful Collaboration
1. User A opens `docs/readme.md` → Acquires lock, can edit
2. User B opens same file → Sees "User A currently editing", read-only mode
3. User A saves changes → Lock maintained, auto-refreshed
4. User A closes file → Lock released automatically
5. User B refreshes → Can now acquire lock and edit

### Conflict Resolution
1. User attempts save without lock → HTTP 423 response
2. Frontend shows notification: "File is locked by [Owner]"
3. Editor switches to read-only mode, edit buttons disabled
4. User can view content but cannot modify until lock is released

### Lock Expiration
1. Lock expires after 5 minutes of inactivity
2. Background cleanup removes expired lock files
3. Next user can acquire lock immediately
4. Previous user gets lock-lost notification if still active

## CORS & Authentication

- CORS allow origin from `<FRONTEND_URL>`
- Optional JWT bearer auth planned for future; endpoints currently open for MVP

## Implementation Files

- `backend/app/file_lock_service.py` - Core lock service
- `backend/app/main.py` - API endpoints and background task
- `backend/app/schemas.py` - Pydantic models for requests/responses
- `compose.yaml` - Docker volume configuration

## FastAPI Best Practices

- Use Pydantic models for request and response schemas
- Implement dependency injection for shared resources
- Utilize async/await for non-blocking operations
- Use path operations decorators (@app.get, @app.post, etc.)
- Implement proper error handling with HTTPException
- Use FastAPI's built-in OpenAPI and JSON Schema support
