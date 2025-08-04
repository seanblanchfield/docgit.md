# Environment Configuration

## Environment Variables

| Variable | Purpose | Default | Required |
|----------|---------|---------|----------|
| `GIT_REPO_PATH` | Path inside container to the git repo | `/data/repo` | Yes |
| `LOCK_STORAGE_PATH` | Path to lock files storage | `/data/locks` | Yes |
| `GIT_AUTHOR_NAME` | Name shown in Git commits | "Wiki User" | No |
| `GIT_AUTHOR_EMAIL` | Email shown in Git commits | "wiki@example.com" | No |
| `FRONTEND_URL` | CORS origin for API requests | `http://localhost` | No |

## Configuration Files

### Backend Configuration (`backend/app/config.py`)
```python
from pydantic import BaseSettings

class Settings(BaseSettings):
    git_repo_path: str = "/data/repo"
    lock_storage_path: str = "/data/locks"
    git_author_name: str = "Wiki User"
    git_author_email: str = "wiki@example.com"
    frontend_url: str = "http://localhost"
    
    class Config:
        env_file = ".env"
```

### Frontend Configuration (`frontend/vite.config.ts`)
```typescript
import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://backend:8000',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})
```

## Docker Environment

### Development Environment
```yaml
# compose.dev.yaml
services:
  backend:
    environment:
      - GIT_REPO_PATH=/data/repo
      - LOCK_STORAGE_PATH=/data/locks
      - GIT_AUTHOR_NAME=Dev User
      - GIT_AUTHOR_EMAIL=dev@localhost
      - FRONTEND_URL=http://localhost:3000
    volumes:
      - ./backend:/app/backend
      - repo_data:/data/repo
      - lock_data:/data/locks
```

### Production Environment
```yaml
# compose.prod.yaml
services:
  backend:
    environment:
      - GIT_REPO_PATH=/data/repo
      - LOCK_STORAGE_PATH=/data/locks
      - GIT_AUTHOR_NAME=${GIT_AUTHOR_NAME:-Wiki User}
      - GIT_AUTHOR_EMAIL=${GIT_AUTHOR_EMAIL:-wiki@example.com}
      - FRONTEND_URL=${FRONTEND_URL:-https://wiki.example.com}
```

## Local Development Setup

### Environment File (`.env.local`)
```bash
# Git Configuration
GIT_AUTHOR_NAME="Your Name"
GIT_AUTHOR_EMAIL="your.email@example.com"

# Development URLs
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:8000

# Storage Paths (for local development)
GIT_REPO_PATH=./data/repo
LOCK_STORAGE_PATH=./data/locks
```

### Loading Environment Variables
```bash
# Load from file
export $(cat .env.local | xargs)

# Or use with docker-compose
docker-compose --env-file .env.local up
```

## Configuration Validation

### Backend Startup Checks
- Validates Git repository path exists and is accessible
- Creates lock storage directory if it doesn't exist
- Initializes Git repository with README.md if empty
- Verifies write permissions for both directories

### Frontend Build Configuration
- API proxy configuration for development
- Build output directory and source maps
- Static asset handling and optimization

## Security Considerations

### Environment Variable Security
- Never commit `.env` files with sensitive data
- Use Docker secrets for production deployments
- Rotate credentials regularly
- Limit environment variable exposure in logs

### CORS Configuration
- Set `FRONTEND_URL` to specific domain in production
- Avoid wildcard CORS origins
- Use HTTPS in production environments

## Troubleshooting

### Common Configuration Issues

**Git Repository Access:**
```bash
# Check repository permissions
ls -la /data/repo
# Should be writable by container user
```

**Lock Storage Issues:**
```bash
# Verify lock directory exists and is writable
ls -la /data/locks
# Clear stale locks if needed
rm /data/locks/*.lock
```

**CORS Errors:**
- Verify `FRONTEND_URL` matches the actual frontend URL
- Check browser network tab for CORS preflight requests
- Ensure backend is accessible from frontend

### Environment Debugging
```bash
# Check environment variables in container
docker-compose exec backend env | grep GIT
docker-compose exec backend env | grep FRONTEND

# Validate configuration
docker-compose exec backend python -c "from app.config import Settings; print(Settings())"
```
