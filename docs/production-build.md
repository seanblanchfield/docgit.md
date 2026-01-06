# Production Build Process

## Overview

The production build creates a single Docker container with:
1. **Frontend**: TypeScript compiled to optimized JavaScript bundle
2. **Backend**: FastAPI serving both static files and API endpoints

## Building for Production

### Step 1: Build the Docker Image

The production Dockerfile (`backend/Dockerfile`) uses a multi-stage build:

```bash
# Build the production image
docker compose build

# Or with no cache (recommended for clean builds)
docker compose build --no-cache
```

**What happens during the build:**

1. **Stage 1 (Frontend Builder)**:
   - Uses `node:20-alpine` image
   - Installs pnpm package manager
   - Installs frontend dependencies from `package.json`
   - Runs `pnpm run build` to create production bundle
   - Output: `/frontend/dist` directory with optimized static files

2. **Stage 2 (Backend)**:
   - Uses `python:3.12-slim` image
   - Installs Python dependencies
   - Copies backend application code
   - **Copies built frontend from Stage 1** to `/app/static`
   - Result: Single container with both frontend and backend

### Step 2: Run the Production Container

```bash
# Start production container
docker compose up -d

# Access the application
# http://localhost:8080
```

## Frontend Build Details

### Vite Build Process

The frontend build is triggered by `pnpm run build` which:

1. **TypeScript Compilation**: Converts `.ts` files to JavaScript
2. **Module Bundling**: Combines modules using Rollup
3. **Code Splitting**: Creates optimized chunks for lazy loading
4. **Minification**: Reduces file sizes
5. **Asset Optimization**: Processes CSS, images, and other assets
6. **Hash Generation**: Adds content hashes to filenames for cache busting

### Build Output Structure

```
frontend/dist/
├── index.html           # Entry point
├── assets/
│   ├── index-[hash].js  # Main JavaScript bundle
│   ├── index-[hash].css # Compiled styles
│   └── [other-assets]   # Images, fonts, etc.
└── vite.svg            # Static assets
```

### Build Configuration

The build is configured in `frontend/vite.config.ts`:

```typescript
export default defineConfig({
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,  // Set to true for debugging
    minify: 'esbuild',
    rollupOptions: {
      // Custom chunking strategy if needed
    }
  }
})
```

## FastAPI Static File Serving

In production mode (no `VITE_DEV_SERVER` environment variable):

1. FastAPI mounts `/app/static/assets` at `/assets/*`
2. Catch-all route serves `index.html` for SPA routing
3. Direct file requests (e.g., `/vite.svg`) are served from `/app/static`

## Production Deployment Checklist

- [ ] Ensure all frontend dependencies are in `package.json`
- [ ] Test frontend build locally: `cd frontend && pnpm run build`
- [ ] Verify no `VITE_DEV_SERVER` environment variable is set
- [ ] Build Docker image: `docker compose build --no-cache`
- [ ] Test production container: `docker compose up`
- [ ] Verify frontend loads at `http://localhost:8080`
- [ ] Verify API endpoints work at `http://localhost:8080/api/*`
- [ ] Check browser console for errors
- [ ] Test application functionality

## Troubleshooting Production Builds

### Frontend Not Loading

```bash
# Check if static files exist in container
docker compose exec backend ls -la /app/static

# Expected output:
# drwxr-xr-x  assets/
# -rw-r--r--  index.html
# -rw-r--r--  vite.svg
```

### Build Failures

```bash
# Check build logs
docker compose build 2>&1 | tee build.log

# Common issues:
# - Missing dependencies in package.json
# - TypeScript compilation errors
# - Vite configuration issues
```

### Testing Production Build Locally

```bash
# Build and test in one command
docker compose build && docker compose up

# Access application
curl http://localhost:8080/

# Should return HTML content with script tags
```

## CI/CD Integration

### Example GitHub Actions Workflow

```yaml
name: Build Production Image

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build Docker image
        run: docker compose build
      
      - name: Test production container
        run: |
          docker compose up -d
          sleep 5
          curl -f http://localhost:8080/ || exit 1
          curl -f http://localhost:8080/health || exit 1
      
      - name: Push to registry
        run: |
          docker tag docgitmd-backend registry.example.com/app:latest
          docker push registry.example.com/app:latest
```

## Performance Optimization

### Frontend Bundle Size

Monitor bundle size after builds:

```bash
# Build and check sizes
cd frontend
pnpm run build

# Output shows chunk sizes:
# dist/assets/index-abc123.js  150.23 kB
# dist/assets/index-def456.css  12.45 kB
```

### Optimization Tips

1. **Code Splitting**: Use dynamic imports for large components
2. **Tree Shaking**: Remove unused code (automatic with Vite)
3. **Asset Optimization**: Compress images before committing
4. **Lazy Loading**: Load routes/components on demand
5. **CDN**: Consider serving static assets from CDN in production

## Environment Variables

Production-specific environment variables:

```bash
# Backend
GIT_REPO_PATH=/data/repo
GIT_AUTHOR_NAME="Production User"
GIT_AUTHOR_EMAIL="prod@example.com"

# Frontend (build-time)
# Set in vite.config.ts or .env.production
VITE_API_BASE_URL=/api
```

## Updating Production

```bash
# 1. Pull latest changes
git pull origin main

# 2. Rebuild image
docker compose build --no-cache

# 3. Restart container
docker compose down
docker compose up -d

# 4. Verify deployment
curl http://localhost:8080/health
```
