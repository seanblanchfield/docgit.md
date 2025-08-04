# Development Workflow

## Local Development Setup

### Prerequisites
- Docker and Docker Compose
- Node.js 20+ (for local frontend development)
- Python 3.12+ (for local backend development)

### Quick Start with Docker
```bash
# Clone repository
git clone <repository-url>
cd wiki-project

# Start all services
docker compose up -d

# Access application
# Frontend: http://localhost:3000 (development) or http://localhost (production)
# Backend API: http://localhost:8000
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

### Using Docker for npm Commands
All npm commands targeting the `frontend/` directory must be executed via the `run-node.sh` script:

```bash
# Install packages
./run-node.sh install <package-name>

# Run scripts
./run-node.sh run build
./run-node.sh run dev
./run-node.sh run lint
```

### Hot Module Reloading
- Frontend changes automatically apply thanks to Vite's HMR
- No need to restart the frontend container unless environment changes
- Backend changes require container restart: `docker compose restart backend`

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
```bash
# Start all services
docker compose up -d

# Start with rebuild
docker compose up --build

# Restart specific service
docker compose restart backend
docker compose restart frontend

# Stop all services
docker compose down

# View logs
docker compose logs -f backend
docker compose logs -f frontend
```

### Development vs Production
- **Development**: Uses `frontend.dev.Dockerfile` with Vite dev server
- **Production**: Uses `frontend.Dockerfile` with nginx static serving

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
- `frontend/vite.config.ts`: Vite build configuration
- `backend/app/config.py`: Backend settings
- `.env.local`: Local environment overrides (not committed)

## Troubleshooting

### Common Issues
1. **Port Conflicts**: Ensure ports 80, 3000, 8000 are available
2. **Volume Permissions**: Check Docker volume mount permissions
3. **Node Modules**: Clear and reinstall if issues persist
4. **Git Repository**: Ensure `/data/repo` is properly initialized

### Reset Development Environment
```bash
# Stop all services
docker compose down

# Remove volumes (WARNING: deletes all data)
docker compose down -v

# Rebuild and restart
docker compose up --build
```
