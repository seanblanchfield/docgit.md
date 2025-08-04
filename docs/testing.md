# Testing

## Testing Strategy

The project uses a multi-layered testing approach focusing on backend API testing, frontend functionality validation, and integration testing.

## Backend Testing

### Unit Tests
- **Framework**: pytest with httpx.AsyncClient
- **Coverage**: API endpoints, Git operations, lock management
- **Location**: `backend/tests/`

### Test Structure
```python
# backend/tests/test_api.py
import pytest
from httpx import AsyncClient
from backend.main import app

@pytest.mark.asyncio
async def test_file_operations():
    async with AsyncClient(app=app, base_url="http://test") as client:
        # Test file creation
        response = await client.put("/api/files/test.md", 
                                   json={"content": "# Test", "message": "Create test file"})
        assert response.status_code == 200
        
        # Test file retrieval
        response = await client.get("/api/files/test.md")
        assert response.status_code == 200
        assert "# Test" in response.text
```

### Running Backend Tests
```bash
# With Docker
docker compose exec backend pytest

# Local development
cd backend && pytest

# With coverage
pytest --cov=app tests/

# Specific test file
pytest tests/test_api.py -v
```

## Frontend Testing

### Manual Testing Approach
The frontend primarily uses manual testing with browser developer tools due to its vanilla TypeScript architecture.

### Browser Console Debugging
- Console logs are forwarded to backend container logs
- Use `console.log()`, `console.error()`, etc. for debugging
- View logs: `docker compose logs backend`

### Testing Checklist
- [ ] File tree navigation and expansion
- [ ] File creation, editing, and deletion
- [ ] Lock acquisition and conflict handling
- [ ] Auto-save functionality
- [ ] History and diff viewing
- [ ] Responsive drawer behavior
- [ ] Keyboard navigation

### Playwright Integration (When Needed)
```bash
# Install Playwright
./run-node.sh install @playwright/test

# Run browser tests
./run-node.sh run test:e2e
```

## Integration Testing

### API Testing with curl
```bash
# Test file tree endpoint
curl -X GET http://localhost:8000/api/files/tree

# Test file operations
curl -X PUT http://localhost:8000/api/files/test.md \
  -H "Content-Type: application/json" \
  -d '{"content": "# Test File", "message": "Create test"}'

# Test lock operations
curl -X POST http://localhost:8000/api/lock/test.md \
  -H "Content-Type: application/json" \
  -d '{"owner": "test-user"}'
```

### Git Operations Testing
```bash
# Verify Git repository state
docker compose exec backend git -C /data/repo log --oneline

# Check file contents
docker compose exec backend cat /data/repo/test.md

# Verify lock files
docker compose exec backend ls -la /data/locks/
```

## Test Data Management

### Test Repository Setup
```python
# backend/tests/conftest.py
import pytest
import tempfile
import shutil
from git import Repo

@pytest.fixture
def temp_repo():
    """Create temporary Git repository for testing"""
    temp_dir = tempfile.mkdtemp()
    repo = Repo.init(temp_dir)
    
    # Create initial commit
    readme_path = os.path.join(temp_dir, "README.md")
    with open(readme_path, "w") as f:
        f.write("# Test Repository")
    
    repo.index.add(["README.md"])
    repo.index.commit("Initial commit")
    
    yield temp_dir
    shutil.rmtree(temp_dir)
```

### Lock Testing
```python
# Test lock acquisition and conflicts
@pytest.mark.asyncio
async def test_lock_conflicts():
    async with AsyncClient(app=app, base_url="http://test") as client:
        # User A acquires lock
        response = await client.post("/api/lock/test.md", 
                                   json={"owner": "user-a"})
        assert response.status_code == 200
        lock_id = response.json()["lock_id"]
        
        # User B tries to acquire same lock
        response = await client.post("/api/lock/test.md", 
                                   json={"owner": "user-b"})
        assert response.status_code == 423  # Locked
        
        # User A can save with lock
        response = await client.put("/api/files/test.md",
                                  json={"content": "Updated", "message": "Update"},
                                  headers={"X-Lock-ID": lock_id})
        assert response.status_code == 200
```

## Performance Testing

### Load Testing
```bash
# Simple load test with curl
for i in {1..100}; do
  curl -s http://localhost:8000/api/files/tree > /dev/null &
done
wait
```

### Performance Benchmarks
- Tree fetch ≤ 150ms for 2,000 files
- File save operations ≤ 500ms
- Lock acquisition ≤ 100ms
- History retrieval ≤ 300ms

## Accessibility Testing

### Manual Accessibility Checks
- [ ] Keyboard navigation works throughout the interface
- [ ] Screen reader compatibility (ARIA labels)
- [ ] Focus management and visual indicators
- [ ] Color contrast meets WCAG guidelines
- [ ] Mobile touch targets are appropriately sized

### Automated Accessibility Testing
```javascript
// Using axe-core for accessibility testing
import { injectAxe, checkA11y } from 'axe-playwright';

test('accessibility check', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await injectAxe(page);
  await checkA11y(page);
});
```

## Mobile Testing

### Responsive Design Testing
- [ ] Drawer behavior on mobile (≤700px)
- [ ] Touch interactions work properly
- [ ] Soft keyboard handling
- [ ] Viewport scaling and safe areas
- [ ] Performance on mobile devices

### Testing Tools
- Browser developer tools device emulation
- Physical device testing
- BrowserStack for cross-device testing

## Continuous Integration

### GitHub Actions (Example)
```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.12'
      - run: pip install -r backend/requirements.txt
      - run: pytest backend/tests/

  frontend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci --prefix frontend
      - run: npm run lint --prefix frontend
      - run: npm run build --prefix frontend
```

## Test Environment Setup

### Docker Test Environment
```yaml
# compose.test.yaml
services:
  backend-test:
    build: { context: ., dockerfile: docker/backend.Dockerfile }
    environment:
      - GIT_REPO_PATH=/tmp/test-repo
      - LOCK_STORAGE_PATH=/tmp/test-locks
    command: pytest tests/ -v
    
  frontend-test:
    build: { context: ., dockerfile: docker/frontend.dev.Dockerfile }
    command: npm run test
```

### Running Test Suite
```bash
# Run all tests
docker compose -f compose.test.yaml up --build

# Run specific test suite
docker compose -f compose.test.yaml run backend-test
docker compose -f compose.test.yaml run frontend-test
```

## Debugging Tests

### Backend Test Debugging
```bash
# Run tests with verbose output
pytest -v -s tests/

# Debug specific test
pytest tests/test_api.py::test_file_operations -v -s --pdb

# Run with coverage report
pytest --cov=app --cov-report=html tests/
```

### Frontend Test Debugging
```bash
# Run with browser visible (Playwright)
./run-node.sh run test:e2e --headed

# Debug mode
./run-node.sh run test:e2e --debug
```
