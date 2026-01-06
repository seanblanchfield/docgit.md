# Docker & Deployment

## Overview

The project uses Docker and Docker Compose with two modes:
- **Development Mode**: Hot Module Reloading (HMR) with separate frontend container
- **Production Mode**: Single container with FastAPI serving both API and static frontend

## Architecture Modes

### Production Mode (Default)

**Dockerfile:** `backend/Dockerfile`

Multi-stage build that creates a single container:

```dockerfile
# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /frontend
RUN npm install -g pnpm@8.15.9
COPY ./frontend/package.json ./frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY ./frontend ./
RUN pnpm run build

# Stage 2: Backend with built frontend
FROM python:3.12-slim AS backend
WORKDIR /app
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*
COPY ./backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt
COPY ./backend /app
COPY --from=frontend-builder /frontend/dist /app/static
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Features:**
- Single optimized container
- Frontend built during image creation
- FastAPI serves both API and static files
- No nginx required

### Development Mode

**Frontend Dockerfile:** `frontend/Dockerfile`

Separate container for Vite dev server:

```dockerfile
FROM node:20-alpine
WORKDIR /app
RUN npm install -g pnpm
COPY frontend/package.json frontend/pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile
COPY frontend/ ./
CMD ["pnpm", "run", "start"]
```

**Features:**
- Vite dev server with HMR
- FastAPI proxies frontend requests to Vite
- Source code mounted for live development
- Port 5173 for Vite dev server

## Docker Compose Configuration

### Production Configuration

**File:** `compose.yaml`

```yaml
services:
  backend:
    build:
      context: .
      dockerfile: ./backend/Dockerfile
    ports:
      - "8080:8000"
    volumes:
      - ./data/repo:/data/repo
      - lock_data:/locks
      - ./data/logs:/app/logs
    environment:
      - GIT_REPO_PATH=/data/repo

volumes:
  lock_data:
    driver: local
    driver_opts:
      type: 'none'
      o: 'bind'
      device: './data/locks'
```

### Development Override

**File:** `compose.override.yaml` (automatically loaded)

```yaml
services:
  backend:
    environment:
      - VITE_DEV_SERVER=http://frontend:5173
    depends_on:
      - frontend

  frontend:
    build:
      context: .
      dockerfile: ./frontend/Dockerfile
    ports:
      - "5173:5173"
    volumes:
      - ./frontend:/app
      - frontend_node_modules:/app/node_modules

volumes:
  frontend_node_modules:
```

## Data Volumes

### Repository Volume (`repo_data`)
- **Purpose**: Persistent Git repository storage
- **Mount Point**: `/data/repo` in backend container
- **Contents**: All wiki markdown files and Git history
- **Persistence**: Survives container restarts and rebuilds

### Lock Volume (`lock_data`)
- **Purpose**: File-based lock storage for collaborative editing
- **Mount Point**: `/data/locks` in backend container
- **Contents**: JSON lock files with metadata
- **Cleanup**: Automatic cleanup of expired locks

## Development Workflow

### Starting Services

**Development Mode (default):**
```bash
# Start with HMR (loads compose.override.yaml automatically)
docker compose up -d

# Access at http://localhost:8080
```

**Production Mode:**
```bash
# Build and start production container
docker compose -f compose.yaml build
docker compose -f compose.yaml up -d
```

### Service Management
```bash
# Development mode
docker compose restart backend    # Restart backend
docker compose restart frontend   # Restart Vite dev server
docker compose logs -f backend    # View backend logs
docker compose logs -f frontend   # View Vite logs

# Production mode
docker compose -f compose.yaml restart backend
docker compose -f compose.yaml logs -f backend

# Stop services
docker compose down
```

### Frontend Development
```bash
# Frontend changes apply automatically in dev mode (HMR)
# Just save your file and refresh the browser

# For production, rebuild the image
docker compose -f compose.yaml build --no-cache
```

## Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `GIT_REPO_PATH` | Path to Git repository | `/data/repo` |
| `LOCK_STORAGE_PATH` | Path to lock files | `/data/locks` |
| `GIT_AUTHOR_NAME` | Git commit author name | "Wiki User" |
| `GIT_AUTHOR_EMAIL` | Git commit author email | "wiki@example.com" |
| `FRONTEND_URL` | CORS origin for API | `http://localhost` |

## Production Deployment

### Requirements
- Docker and Docker Compose installed
- Sufficient disk space for Git repository
- Network access for container communication

### Deployment Steps
1. Clone repository to production server
2. Configure environment variables
3. Run `docker compose up -d --build`
4. Access application at configured port (default: 80)

### Monitoring
- Health check endpoint: `GET /health`
- Container logs via `docker compose logs`
- Volume usage monitoring for repository growth

## Security Considerations

- **Network**: Services communicate via Docker internal network
- **Volumes**: Data persisted in named Docker volumes
- **CORS**: Configured for specific frontend origin
- **Authentication**: Currently open for MVP (JWT planned)

## Troubleshooting

### Common Issues
- **Port conflicts**: Ensure port 8080 is available (and 5173 for dev mode)
- **Volume permissions**: Check Docker volume mount permissions
- **Build failures**: Clear Docker cache with `docker system prune`
- **Lock conflicts**: Restart backend to clear stale locks
- **Frontend not loading**: Check if `VITE_DEV_SERVER` env var is set correctly in dev mode

### Debug Commands
```bash
# Check service status
docker compose ps

# Inspect volumes
docker volume inspect <volume_name>

# Access container shell
docker compose exec backend bash
docker compose exec frontend sh
```
