# Development Workflow

## Local Development Setup

### Prerequisites
- Docker and Docker Compose
- Node.js 20+ (for local frontend development)
- Python 3.12+ (for local backend development)

### Quick Start with Docker

#### Development Mode (with HMR)
```bash
# Clone repository
git clone <repository-url>
cd wiki-project

# Start development environment
# This automatically loads compose.override.yaml
docker compose up -d

# Access application
# Application (Frontend + API): http://localhost:8080
# Frontend dev server (direct): http://localhost:5173
# API endpoints: http://localhost:8080/api/*
# API documentation: http://localhost:8080/api/docs
```

#### Production Mode
```bash
# Build production image (frontend compiled to static files)
docker compose -f compose.yaml build

# Start production container (no override file)
docker compose -f compose.yaml up -d

# Access application
# Application: http://localhost:8080
```

### Local Development (without Docker)
```bash
# Backend setup
python -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt

# Frontend setup
npm i --prefix frontend

# Run services
uvicorn backend.main:app --reload
npm run dev --prefix frontend
```

## Frontend Development

### Development Mode with HMR

By default, `docker compose up` loads `compose.override.yaml` which:
- Starts a Vite dev server container with Hot Module Reloading
- FastAPI proxies frontend requests to Vite (via `VITE_DEV_SERVER` env var)
- Frontend changes reflect immediately without rebuilding

```bash
# Start development environment
docker compose up -d

# Frontend changes are automatically detected
# Just save your file and refresh the browser

# View frontend container logs
docker compose logs -f frontend

# Restart frontend container if needed
docker compose restart frontend
```

**How it works:**
1. `compose.override.yaml` adds a `frontend` service running Vite dev server
2. Backend detects `VITE_DEV_SERVER=http://frontend:5173` environment variable
3. FastAPI proxies all non-API requests to Vite using httpx
4. Vite serves files with HMR enabled

### Production Build

For production deployment, frontend is compiled to static files:

```bash
# Build production image (no override file)
docker compose -f compose.yaml build --no-cache

# Start production container
docker compose -f compose.yaml up -d
```

**Production build process:**
1. Multi-stage Dockerfile builds frontend using Node.js
2. `pnpm run build` compiles TypeScript to optimized JavaScript
3. Built files copied to `/app/static` in backend container
4. FastAPI serves static files directly (no proxy)

See [Production Build Documentation](./production-build.md) for details.

### Development Tools
- **Vite**: Build tool with fast HMR
- **TypeScript**: Type checking and IntelliSense
- **ESLint**: Code linting
- **Prettier**: Code formatting

## Backend Development

### FastAPI Development Server
```bash
# With auto-reload
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000

# With Docker
docker compose restart backend
```

### Code Quality Tools
- **Black**: Code formatting
- **Ruff**: Fast Python linter
- **pytest**: Unit testing framework
- **pre-commit**: Git hooks for code quality

### Testing
```bash
# Run tests
pytest backend/tests/

# With coverage
pytest --cov=backend backend/tests/

# Test specific endpoint
pytest backend/tests/test_api.py::test_file_operations
```

## Docker Development Commands

### Service Management

#### Development Mode
```bash
# Start with HMR (loads docker-compose.override.yml automatically)
docker compose up -d

# Restart services
docker compose restart backend
docker compose restart frontend

# Stop all services
docker compose down

# View logs
docker compose logs -f backend
docker compose logs -f frontend

# Rebuild frontend container (if Dockerfile changes)
docker compose build frontend
```

#### Production Mode
```bash
# Build production image
docker compose -f compose.yaml build

# Start production container
docker compose -f compose.yaml up -d

# Stop production container
docker compose -f compose.yaml down
```

### Architecture Modes

**Development Mode** (default with `docker compose up`):
- Backend container + Frontend container (Vite dev server)
- FastAPI proxies to Vite for HMR
- Frontend changes apply immediately
- Port 8080 serves everything (proxied through backend)

**Production Mode** (with `-f compose.yaml` flag):
- Single backend container with built frontend
- FastAPI serves static files directly
- Optimized JavaScript bundles
- Port 8080 serves everything (static files + API)

## Testing Strategy

### Backend Testing
- **Unit Tests**: Test individual functions and classes
- **Integration Tests**: Test API endpoints with `httpx.AsyncClient`
- **Git Operations**: Test repository operations with temporary repos

### Frontend Testing
- **Manual Testing**: Use browser developer tools
- **Playwright**: Automated browser testing (when needed)
- **Console Logging**: Debug via browser console (logs forwarded to backend)

### Testing Commands
```bash
# Backend tests
docker compose exec backend pytest

# Frontend debugging
# Check backend container logs for console.log output
docker compose logs backend
```

## Debugging

### Frontend Debugging
1. **Browser DevTools**: Primary debugging method
2. **Console Logging**: Add `console.log()` statements (forwarded to backend logs)
3. **Playwright**: For automated UI testing
4. **Network Tab**: Monitor API requests and responses

### Backend Debugging
1. **FastAPI Docs**: Visit `/docs` for interactive API documentation
2. **Logs**: Use `docker compose logs backend`
3. **curl Testing**: Test endpoints directly
4. **Python Debugger**: Use `pdb` or IDE debugging

### Common Debug Scenarios
```bash
# Test API endpoint
curl -X GET http://localhost:8000/api/files/tree

# Check file locks
curl -X GET http://localhost:8000/api/lock/example.md

# View container logs
docker compose logs -f backend

# Access container shell
docker compose exec backend bash
```

## Code Quality

### Pre-commit Hooks
```bash
# Install pre-commit
pip install pre-commit

# Install hooks
pre-commit install

# Run manually
pre-commit run --all-files
```

### Linting and Formatting
```bash
# Backend
black backend/
ruff backend/

# Frontend
./run-node.sh run lint
./run-node.sh run format
```

## Git Workflow

### Branch Strategy
- `main`: Production-ready code
- `feature/*`: Feature development branches
- `bugfix/*`: Bug fix branches

### Commit Guidelines
- Use conventional commit messages
- Include relevant issue numbers
- Keep commits focused and atomic

### Development Flow
1. Create feature branch from `main`
2. Make changes and test locally
3. Run code quality checks
4. Submit pull request
5. Merge after review

## Environment Configuration

### Development Environment Variables
```bash
# Backend
GIT_REPO_PATH=/data/repo
LOCK_STORAGE_PATH=/data/locks
GIT_AUTHOR_NAME="Dev User"
GIT_AUTHOR_EMAIL="dev@example.com"

# Frontend
VITE_API_BASE_URL=http://localhost:8000
```

### Configuration Files
- `compose.yaml`: Docker services configuration
- `compose.override.yaml`: Development overrides (auto-loaded)
- `frontend/vite.config.ts`: Vite build configuration
- `backend/app/config.py`: Backend settings
- `.env.local`: Local environment overrides (not committed)

## Troubleshooting

### Common Issues
1. **Port Conflicts**: Ensure port 8080 is available
2. **Volume Permissions**: Check Docker volume mount permissions
3. **Frontend Changes Not Showing (Dev)**: Check Vite logs with `docker compose logs -f frontend`
4. **Frontend Changes Not Showing (Prod)**: Rebuild the Docker image with `docker compose build --no-cache`
5. **Git Repository**: Ensure `/data/repo` is properly initialized

### Reset Development Environment
```bash
# Stop all services
docker compose down

# Remove volumes (WARNING: deletes all data)
docker compose down -v

# Rebuild and restart
docker compose up --build
```
