# Docker & Deployment

## Overview

The project uses Docker and Docker Compose for consistent development and production environments. The system consists of three main services: backend (FastAPI), frontend (Vite/nginx), and shared data volumes.

## Docker Services

### Backend Service

**Dockerfile:** `docker/backend.Dockerfile`

```dockerfile
FROM python:3.12-slim AS base
WORKDIR /app
COPY backend/ ./backend
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
CMD ["uvicorn","backend.main:app","--host","0.0.0.0","--port","8000"]
```

**Features:**
- Python 3.12 slim base image
- FastAPI with Uvicorn ASGI server
- GitPython for repository operations
- Mounted data volumes for persistence

### Frontend Service

**Production Dockerfile:** `docker/frontend.Dockerfile`

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

**Development Dockerfile:** `docker/frontend.dev.Dockerfile`
- Vite dev server with hot module reloading
- Source code mounting for live development
- Port 3000 for development access

**Features:**
- Multi-stage build for production
- Nginx reverse proxy configuration
- Static asset serving
- API routing to backend

### Nginx Configuration

**File:** `docker/nginx.conf`

```nginx
server {
    listen 80;
    
    # API routes to backend
    location /api/ {
        proxy_pass http://backend:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # Frontend static files
    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
    }
}
```

## Docker Compose Configuration

**File:** `compose.yaml`

```yaml
version: "3.9"
services:
  backend:
    build: { context: ., dockerfile: docker/backend.Dockerfile }
    volumes:
      - repo_data:/data/repo
      - lock_data:/data/locks
    environment:
      - GIT_REPO_PATH=/data/repo
      - LOCK_STORAGE_PATH=/data/locks
    ports: [ "8000:8000" ]

  frontend:
    build: { context: ., dockerfile: docker/frontend.Dockerfile }
    depends_on: [ backend ]
    ports: [ "80:80" ]

  # Development override
  frontend-dev:
    build: { context: ., dockerfile: docker/frontend.dev.Dockerfile }
    volumes:
      - ./frontend:/app
    ports: [ "3000:3000" ]

volumes:
  repo_data:    # Git repository storage
  lock_data:    # File-based lock storage
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
```bash
# Start all services
docker compose up -d

# Start with rebuild
docker compose up --build

# Development mode with hot reload
docker compose -f compose.yaml -f compose.dev.yaml up
```

### Service Management
```bash
# Restart specific service
docker compose restart backend
docker compose restart frontend

# View logs
docker compose logs -f backend
docker compose logs -f frontend

# Stop all services
docker compose down
```

### Frontend Development
```bash
# Run npm commands via Docker
./run-node.sh install <package-name>
./run-node.sh run build
./run-node.sh run dev
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
- **Port conflicts**: Ensure ports 80, 3000, 8000 are available
- **Volume permissions**: Check Docker volume mount permissions
- **Build failures**: Clear Docker cache with `docker system prune`
- **Lock conflicts**: Restart backend to clear stale locks

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
