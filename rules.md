# Project Instructions for AI Coding Assistant

## CRITICAL RULES
- **ALWAYS** create a WIP file before starting any significant work
- **NEVER** work directly on main branch - use `goal <name>` to create feature branches
- **ALWAYS** update WIP files as you progress
- **NEVER** merge without completing the WIP file (rename TODO_ to DONE_)
- **ALWAYS** use the special commands for workflow management

## Quick Reference
| User Intent | AI Action |
|-------------|-----------|
| "new goal", "new feature", "start feature", "I want to work on..." | Start new work → creates WIP + branch |
| "what's the status", "show me progress", "what's done" | Show TODO/DONE overview |
| "what's next", "what should I work on", "priority task" | Show priority task |
| "I'm done", "finish up", "complete this", "ready to merge" | Finish work → marks done + merges + cleanup |
| "what can you do", "help", "available actions" | List all available workflow actions |

## Project Structure

**Docker-based project** with `compose.yaml` as main configuration.

**Documentation**: `docs/` directory - view with `find docs -name "*.md" | sort`

**Work tracking**: `WIP/` directory with `TODO_XXX_name.md` / `DONE_XXX_name.md` files

**Check current work status:**
```bash
ls WIP/DONE_*     # Completed work
ls WIP/TODO_*     # Outstanding work  
ls -1 WIP/TODO_* | head -n 1  # Next priority task
```


## Project Scope Management

### CRITICAL: Never Expand Scope During Work
- **Assume project is working**: At the start of each piece of work, expect that the project is in a fully working state
- **Recent changes broke it**: If something breaks, it is the work since the last commit that broke it
- **Stay in scope**: Under no circumstances should you expand the scope of work to change how other aspects of the project work in an attempt to fix errors
- **Root cause is likely recent**: What seems like a fundamental error outside the current scope is most likely caused by recent changes within scope

### When Fundamental Issues Block Progress
If convinced that there is a genuine fundamental error outside the current scope of work that is blocking progress:
1. **Prepare an argument**: Document why you believe the issue is outside scope
2. **Present evidence**: Show how recent changes couldn't have caused the issue
3. **Request explicit confirmation**: Ask the user for explicit permission to expand scope
4. **Wait for approval**: Do not proceed with out-of-scope changes without user confirmation

### Scope Discipline Benefits
- **Faster debugging**: Focus on recent changes first
- **Cleaner commits**: Changes stay focused on the intended feature
- **Reduced complexity**: Avoid cascading changes across the codebase
- **Better tracking**: WIP files remain accurate to actual work done

## Common Mistakes to Avoid
- ❌ Working on main branch without WIP file
- ❌ Creating multiple TODO files for same feature  
- ❌ Forgetting to update WIP file progress
- ❌ Merging without marking WIP as DONE
- ❌ Not using feature branches for new work
- ❌ **Expanding scope when encountering errors**
- ❌ **Assuming fundamental issues without evidence**

## If Things Go Wrong
- **Lost track**: Run `status` and `explain`
- **Multiple branches**: Use `git branch` to see current state
- **WIP confusion**: Check `ls WIP/TODO_*` for active work
- **Broken build**: Check recent commits and WIP file for context

## Documentation Best Practices

### When to Update Documentation
- **`docs/` files**: Update when making changes that affect the technical architecture, API endpoints, or system behavior
- **WIP files**: Update continuously as you work on tasks

### Documentation Standards
- Keep documentation current with code changes
- Use clear, concise language suitable for developers
- Include code examples where helpful
- Cross-reference related documentation files
- Update `docs/index.md` table of contents when adding new sections

## Testing

You should do whatever you can to test your own work, and don't ask the user to do something you can just as easily do yourself.
- Use `curl` to test that an endpoint is working as expected
- Use the playwright tool to test that a frontend feature looks correct
- Restart the backend docker container if necessary
- Debug the frontend by inserting browser console log messages (console.log, console.info, console.warn, console.error, console.debug), which can be viewed by checking the backend container logs (they are all forwarded to the backend)

### Docker Commands

- To restart a specific service (e.g., `frontend` or `backend`):
  `docker-compose restart <service-name>`
- To stop all services:
  `docker-compose down`
- To start all services:
  `docker-compose up -d`

## Backend

### FastAPI Best Practices

- Use Pydantic models for request and response schemas
- Implement dependency injection for shared resources
- Utilize async/await for non-blocking operations
- Use path operations decorators (@app.get, @app.post, etc.)
- Implement proper error handling with HTTPException
- Use FastAPI's built-in OpenAPI and JSON Schema support

### Folder Structure

View current backend structure with:
```bash
find backend -type f -name "*.py" | head -10
```

Key files: `app/main.py` (FastAPI app), `app/git_service.py` (Git operations), `app/file_lock_service.py` (locking), `app/schemas.py` (Pydantic models).

### Additional Instructions
1. Use type hints for all function parameters and return values
2. Implement proper input validation using Pydantic
3. Use FastAPI's background tasks for long-running operations
4. Implement proper CORS handling
5. Use FastAPI's security utilities for authentication
6. Follow PEP 8 style guide for Python code
7. Implement comprehensive unit and integration tests

## Frontend

### NPM Commands
- Edits to the frontend should automatically apply thanks to Hot Module Reloading. Do not attempt to restart the frontend container unless you suspect it is not running, or unless you have modified its environment in some way.
- All npm commands targeting the `frontend/` directory must be executed via the `run-node.sh` script.
- This script wraps npm commands to run them inside a Docker container with the appropriate environment and volume mounts.
- **Example:** To install a package: `./run-node.sh install <package-name>`
- **Example:** To run a script: `./run-node.sh run <script-name>`
- **Example:** To build the frontend: `./run-node.sh run build`

### Technology Stack
- **Build Tool**: Vite with TypeScript
- **Styling**: Custom CSS (vanilla)
- **Markdown Editor**: Milkdown for WYSIWYG editing
- **Directory Tree**: infinite-tree for navigation
- **Package Manager**: pnpm

View current dependencies: `cat frontend/package.json | jq .dependencies`

## Debugging

### Frontend Debugging
- To debug the frontend, try to use playwright before asking the user to use the browser debugger
- If you are having difficulty debugging the UI, ask the user to try the action for you and provide a screenshot
- If you need to narrow a frontend problem down, consider implementing debug logging

#### Frontend Console Logs
Frontend console messages (console.log, console.info, console.warn, console.error, console.debug) are automatically forwarded to the backend and logged in multiple places:

**Option 1: Dedicated Frontend Log File**
```bash
# View frontend logs in real-time (recommended)
tail -f data/logs/frontend.log

# View recent frontend logs
tail -20 data/logs/frontend.log

# Alternative: Access via container
docker-compose exec backend tail -f /app/logs/frontend.log
```

**Option 2: Backend Container Logs**
```bash
# View all backend logs including frontend console messages
docker-compose logs backend --tail=20

# Follow backend logs in real-time
docker-compose logs backend -f
```

**Log Format:**
- Frontend logs include timestamp, log level, client IP, message, URL, and stack traces for errors
- All JavaScript errors (including unhandled promise rejections) are automatically captured
- Objects are properly JSON-formatted in the logs

### Backend Debugging
- Use FastAPI's automatic documentation at `/docs` endpoint
- Check container logs: `docker-compose logs backend`
- Use `curl` to test API endpoints directly
- Access container shell: `docker-compose exec backend bash`

## Development Workflow

1. **Understand the Task**: Review relevant documentation in `docs/` and existing WIP files
2. **Plan the Work**: Create or update a WIP file with requirements and implementation plan
3. **Implement Changes**: Make code changes following the established patterns
4. **Test Thoroughly**: Use appropriate testing methods (curl, playwright, manual testing)
5. **Update Documentation**: Update relevant `docs/` files and WIP files
6. **Commit Changes**: Use semantic commit messages referencing the WIP file

## Key Architecture Patterns

- **Git-First**: All content is stored and versioned in Git
- **API-Driven**: Clean separation between frontend and backend
- **Container-Based**: Consistent environments via Docker
- **File-Based Locking**: Collaborative editing protection
- **Vanilla TypeScript**: No framework dependencies on frontend
- **Turn-Based Editing**: Lock-based conflict prevention

For detailed technical information, always refer to the comprehensive documentation in the `docs/` directory.
