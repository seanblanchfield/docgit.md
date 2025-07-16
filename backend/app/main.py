from fastapi import FastAPI, Depends, HTTPException, Header, BackgroundTasks, Request
from typing import List, Optional
import asyncio
import logging
from datetime import datetime
from . import schemas
from .schemas import TreeNode # Added for the directory tree endpoint
from .config import settings
from .git_service import GitService
from .file_lock_service import lock_service

logger = logging.getLogger(__name__)

# Instantiate GitService with configuration from settings
git_service = GitService(
    repo_path_str=settings.GIT_REPO_PATH,
    author_name=settings.GIT_AUTHOR_NAME,
    author_email=settings.GIT_AUTHOR_EMAIL
)

app = FastAPI(openapi_url="/api/openapi.json", docs_url="/api/docs", redoc_url="/api/redoc")

# Background task for cleaning up expired locks
async def cleanup_expired_locks_task():
    """Background task that runs every 60 seconds to clean up expired locks."""
    while True:
        try:
            cleaned_count = lock_service.cleanup_expired_locks()
            if cleaned_count > 0:
                logger.info(f"Background cleanup removed {cleaned_count} expired locks")
        except Exception as e:
            logger.error(f"Error in background lock cleanup: {e}")
        
        # Wait 60 seconds before next cleanup
        await asyncio.sleep(60)

# Startup event to begin background cleanup task
@app.on_event("startup")
async def startup_event():
    """Start background tasks when the application starts."""
    logger.info("Starting background lock cleanup task")
    asyncio.create_task(cleanup_expired_locks_task())

# Dependency injector for GitService
def get_git_service() -> GitService:
    return git_service

@app.get("/health")
async def health_check():
    return {"status": "ok"}

@app.post("/api/console-log", response_model=schemas.ConsoleLogResponse)
async def log_console_message(console_msg: schemas.ConsoleMessage, request: Request):
    """
    Receive console messages from frontend and log them on the server.
    This allows browser console messages to appear in docker logs alongside server logs.
    """
    # Get client IP and user agent from request
    client_ip = request.client.host if request.client else "unknown"
    user_agent = console_msg.user_agent or request.headers.get("user-agent", "unknown")
    
    # Create structured log message
    log_prefix = f"[BROWSER-CONSOLE] [{console_msg.level.upper()}] [{client_ip}]"
    log_message = f"{log_prefix} {console_msg.message}"
    
    # Add additional context if available
    if console_msg.url:
        log_message += f" | URL: {console_msg.url}"
    if console_msg.stack_trace:
        log_message += f" | Stack: {console_msg.stack_trace}"
    
    # Log to server console based on level
    if console_msg.level in ["error"]:
        logger.error(log_message)
    elif console_msg.level in ["warn"]:
        logger.warning(log_message)
    elif console_msg.level in ["info", "log"]:  # Treat console.log as info level
        logger.info(log_message)
    else:  # debug or other levels
        logger.debug(log_message)
    
    # Return response with server timestamp
    return schemas.ConsoleLogResponse(
        status="logged",
        logged_at=datetime.utcnow().isoformat() + "Z"
    )

@app.get("/api/files", response_model=List[schemas.FileListItem])
async def list_repository_files(
    path: Optional[str] = None, # Query parameter for path, defaults to root
    gs: GitService = Depends(get_git_service)
):
    """
    List files and folders in the repository.
    - **path**: Optional path relative to the repository root. If not provided, lists from the root.
    """
    directory_to_list = path if path else "."
    try:
        files = gs.list_files(directory_path_relative_to_repo=directory_to_list)
        return files
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")


@app.get("/api/files/tree", response_model=List[TreeNode])
async def get_directory_tree_endpoint(
    gs: GitService = Depends(get_git_service)
):
    """
    Get the entire directory tree structure of the repository.
    Returns a list of TreeNode objects, where each node can have children.
    """
    try:
        tree_data = gs.get_directory_tree(relative_path=".") # Get tree from repo root
        return tree_data
    except RuntimeError as e:
        # This might occur if the repo isn't initialized, though get_git_service should handle it.
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        # Catch any other unexpected errors from the tree building logic
        print(f"Unexpected error in get_directory_tree_endpoint: {type(e).__name__} - {e}")
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred while building the directory tree: {str(e)}")

@app.get("/api/files/{file_path:path}", response_model=schemas.FileContentResponse)
async def get_file_contents(
    file_path: str, # Path parameter
    gs: GitService = Depends(get_git_service)
):
    """
    Get the content of a specific file.
    - **file_path**: The path to the file, relative to the repository root.
    """
    try:
        content = gs.get_file_content(file_path_relative_to_repo=file_path)
        if content is None:
            raise HTTPException(status_code=404, detail=f"File not found: {file_path}")
        return schemas.FileContentResponse(path=file_path, content=content)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")

@app.put("/api/files/{file_path:path}", response_model=schemas.SaveFileResponse)
async def save_file_contents(
    file_path: str, # Path parameter
    request_body: schemas.SaveFileRequest,
    gs: GitService = Depends(get_git_service),
    x_lock_id: Optional[str] = Header(None, alias="X-Lock-ID")
):
    """
    Create or update a file and commit the change.
    - **file_path**: The path to the file, relative to the repository root.
    - **request_body**: JSON body with `content` and `message`.
    - **X-Lock-ID**: Optional lock identifier in request header for concurrent editing protection.
    """
    # Check if file is locked and enforce lock if present
    existing_lock = lock_service.check_lock(file_path)
    if existing_lock:
        if not x_lock_id or existing_lock["lock_id"] != x_lock_id:
            raise HTTPException(
                status_code=423,
                detail={
                    "error": "File is locked by another user",
                    "owner": existing_lock["owner"],
                    "expires_at": existing_lock["expires_at"]
                }
            )
    
    try:
        commit_sha = gs.save_file_content(
            file_path_relative_to_repo=file_path,
            content=request_body.content,
            message=request_body.message
        )
        if commit_sha is None:
            raise HTTPException(status_code=500, detail="Failed to save file or commit changes. Commit SHA was not returned.")
        
        return schemas.SaveFileResponse(path=file_path, commit_sha=commit_sha)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        print(f"Unexpected error in save_file_contents: {type(e).__name__} - {e}")
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred while saving the file: {str(e)}")

@app.delete("/api/files/{file_path:path}", response_model=schemas.DeleteItemResponse)
async def delete_repository_item(
    file_path: str, # Path parameter
    commit_message: Optional[str] = None, # Query parameter for commit message
    gs: GitService = Depends(get_git_service)
):
    """
    Delete a file or folder from the repository and commit the change.
    - **file_path**: The path to the file or folder, relative to the repository root.
    - **commit_message**: Optional commit message. Defaults to "Deleted [file_path]".
    """
    message = commit_message if commit_message else f"Deleted {file_path}"
    
    try:
        commit_sha = gs.delete_item(
            item_path_relative_to_repo=file_path,
            message=message
        )
        
        if commit_sha is None:
            absolute_item_path = (gs.repo_path / file_path).resolve()
            # Check if the item still exists in the working tree or is tracked by Git
            # gs.repo.git.ls_files(file_path) returns the path if tracked, empty string otherwise
            item_exists_in_working_tree = absolute_item_path.exists()
            item_is_tracked = bool(gs.repo.git.ls_files(file_path))

            # If delete_item returned None, it could be because:
            # 1. Item was not found initially (delete_item handles this and returns None)
            # 2. An error occurred during git operation (delete_item handles this, returns None)
            # 3. No changes were made (e.g., item was untracked and deleted, or already deleted)

            # If it doesn't exist now and wasn't tracked before (or was tracked but delete_item failed to commit a removal)
            # This logic is tricky because delete_item itself tries to handle 'not found'.
            # We rely on delete_item's print statements for 'not found' and assume if it returns None, an issue occurred.
            # A more robust way would be for delete_item to raise specific exceptions.
            # For now, if commit_sha is None, we assume failure or item not found as handled by delete_item's logging.
            
            # Let's refine the check: if delete_item returned None, it means either not found or error.
            # If it was 'not found', gs.delete_item would have printed it. 
            # If it was an error, gs.delete_item also prints it.
            # The key is that if commit_sha is None, the operation wasn't fully successful as expected by API contract.
            raise HTTPException(status_code=500, detail=f"Failed to delete item '{file_path}'. It might not have existed or an error occurred. Check server logs.")

        return schemas.DeleteItemResponse(
            message=f"Successfully deleted '{file_path}' and committed.",
            commit_sha=commit_sha,
            path=file_path
        )
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        print(f"Unexpected error in delete_repository_item: {type(e).__name__} - {e}")
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred while deleting '{file_path}': {str(e)}")

@app.post("/api/files/move", response_model=schemas.MoveItemResponse)
async def move_repository_item(
    request_body: schemas.MoveItemRequest,
    gs: GitService = Depends(get_git_service)
):
    """
    Move or rename a file or folder in the repository and commit the change.
    - **request_body**: JSON body with `source_path`, `destination_path`, and `message`.
    """
    try:
        commit_sha = gs.move_item(
            source_path_relative_to_repo=request_body.source_path,
            destination_path_relative_to_repo=request_body.destination_path,
            message=request_body.message
        )
        
        if commit_sha is None:
            raise HTTPException(status_code=400, detail=f"Failed to move item from '{request_body.source_path}' to '{request_body.destination_path}'. Source might not exist, destination might exist, or an error occurred. Check server logs.")

        return schemas.MoveItemResponse(
            message=f"Successfully moved '{request_body.source_path}' to '{request_body.destination_path}' and committed.",
            commit_sha=commit_sha,
            source_path=request_body.source_path,
            destination_path=request_body.destination_path
        )
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        print(f"Unexpected error in move_repository_item: {type(e).__name__} - {e}")
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred while moving item: {str(e)}")

@app.get("/api/history/{file_path:path}", response_model=List[schemas.CommitDetail])
async def get_file_commit_history(
    file_path: str, # Path parameter
    gs: GitService = Depends(get_git_service)
):
    """
    Get the commit history for a specific file.
    - **file_path**: The path to the file, relative to the repository root.
    """
    try:
        history = gs.get_file_history(file_path_relative_to_repo=file_path)
        if not history:
            absolute_file_path = (gs.repo_path / file_path).resolve()
            if not absolute_file_path.is_file() and not gs.repo.git.ls_files(file_path):
                 raise HTTPException(status_code=404, detail=f"File not found: {file_path}")
        
        return [schemas.CommitDetail(**commit_data) for commit_data in history]
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        print(f"Unexpected error in get_file_commit_history: {type(e).__name__} - {e}")
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred while fetching history for '{file_path}': {str(e)}")

@app.get("/api/diff/{file_path:path}", response_model=schemas.FileDiffResponse)
async def get_file_diff_content(
    file_path: str, # Path parameter
    sha1: str,      # Query parameter for the first commit SHA or 'WORKING_TREE'
    sha2: str,      # Query parameter for the second commit SHA or 'WORKING_TREE'
    gs: GitService = Depends(get_git_service)
):
    """
    Get the diff for a specific file between two versions (commit SHAs or 'WORKING_TREE').
    - **file_path**: The path to the file, relative to the repository root.
    - **sha1**: The first commit SHA (or 'WORKING_TREE').
    - **sha2**: The second commit SHA (or 'WORKING_TREE').
    """
    try:
        if not sha1 or not sha2:
            raise HTTPException(status_code=400, detail="Both 'sha1' and 'sha2' query parameters are required.")

        diff_content = gs.get_file_diff(
            file_path_relative_to_repo=file_path,
            commit_sha1=sha1,
            commit_sha2=sha2
        )

        if diff_content is None:
            raise HTTPException(
                status_code=404, 
                detail=f"Could not generate diff for '{file_path}' between '{sha1}' and '{sha2}'. File may not exist in specified commits, or SHAs may be invalid. Check server logs."
            )

        return schemas.FileDiffResponse(
            path=file_path,
            commit_sha1=sha1,
            commit_sha2=sha2,
            diff_output=diff_content
        )
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        print(f"Unexpected error in get_file_diff_content: {type(e).__name__} - {e}")
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred while generating diff for '{file_path}': {str(e)}")

# Lock management endpoints for concurrent editing protection

@app.post("/api/lock/{file_path:path}")
async def acquire_lock(
    file_path: str,
    request_body: schemas.AcquireLockRequest
):
    """
    Acquire a lock for a file to enable concurrent editing protection.
    - **file_path**: The path to the file, relative to the repository root.
    - **request_body**: JSON body with `owner` identifier.
    """
    result = lock_service.acquire_lock(file_path, request_body.owner)
    
    if result["success"]:
        return schemas.LockResponse(
            lock_id=result["lock_id"],
            expires_at=result["expires_at"]
        )
    else:
        status_code = result["status_code"]
        if status_code == 423:
            # Lock conflict - format to match frontend expectations
            raise HTTPException(
                status_code=423,
                detail={
                    "detail": result["error"],
                    "lock_info": {
                        "owner": result["owner"],
                        "expires_at": result["expires_at"]
                    }
                }
            )
        else:
            raise HTTPException(status_code=status_code, detail=result["error"])

@app.put("/api/lock/{file_path:path}/ping")
async def refresh_lock(
    file_path: str,
    x_lock_id: Optional[str] = Header(None, alias="X-Lock-ID")
):
    """
    Refresh a lock's TTL to extend its expiration time.
    - **file_path**: The path to the locked file, relative to the repository root.
    - **X-Lock-ID**: Lock identifier in request header.
    """
    if not x_lock_id:
        raise HTTPException(status_code=400, detail="X-Lock-ID header is required")
    
    # For refresh, we need the owner. For simplicity, we'll extract it from the existing lock
    # In a real system, you might want to include owner in the request or use session-based auth
    existing_lock = lock_service.check_lock(file_path)
    if not existing_lock:
        raise HTTPException(status_code=404, detail="Lock not found")
    
    if existing_lock["lock_id"] != x_lock_id:
        raise HTTPException(status_code=403, detail="Invalid lock credentials")
    
    result = lock_service.refresh_lock(file_path, x_lock_id, existing_lock["owner"])
    
    if result["success"]:
        return schemas.RefreshLockResponse(expires_at=result["expires_at"])
    else:
        raise HTTPException(status_code=result["status_code"], detail=result["error"])

@app.delete("/api/lock/{file_path:path}")
async def release_lock(
    file_path: str,
    x_lock_id: Optional[str] = Header(None, alias="X-Lock-ID")
):
    """
    Release a lock for a file.
    - **file_path**: The path to the locked file, relative to the repository root.
    - **X-Lock-ID**: Lock identifier in request header.
    """
    if not x_lock_id:
        raise HTTPException(status_code=400, detail="X-Lock-ID header is required")
    
    # Get existing lock to verify ownership
    existing_lock = lock_service.check_lock(file_path)
    if not existing_lock:
        raise HTTPException(status_code=404, detail="Lock not found")
    
    if existing_lock["lock_id"] != x_lock_id:
        raise HTTPException(status_code=403, detail="Invalid lock credentials")
    
    result = lock_service.release_lock(file_path, x_lock_id, existing_lock["owner"])
    
    if result["success"]:
        return {"message": "Lock released successfully"}
    else:
        raise HTTPException(status_code=result["status_code"], detail=result["error"])

@app.get("/api/lock/{file_path:path}")
async def check_lock_status(
    file_path: str
):
    """
    Check if a file is currently locked.
    - **file_path**: The path to the file, relative to the repository root.
    """
    lock_data = lock_service.check_lock(file_path)
    
    if lock_data:
        return {
            "locked": True,
            "owner": lock_data["owner"],
            "expires_at": lock_data["expires_at"],
            "acquired_at": lock_data["acquired_at"]
        }
    else:
        return {"locked": False}


# File operations endpoints

@app.post("/api/directory", response_model=schemas.CreateDirectoryResponse)
async def create_directory(
    request_body: schemas.CreateDirectoryRequest,
    parent_path: Optional[str] = None,  # Query parameter for parent directory
    gs: GitService = Depends(get_git_service)
):
    """
    Create a new directory in the repository.
    - **request_body**: JSON body with directory name and optional commit message.
    - **parent_path**: Optional parent directory path. Defaults to repository root.
    """
    try:
        # Validate directory name
        if not request_body.name or not request_body.name.strip():
            raise HTTPException(status_code=400, detail="Directory name cannot be empty")
        
        # Remove any path separators from name to prevent path traversal
        clean_name = request_body.name.strip().replace("/", "").replace("\\", "")
        if not clean_name:
            raise HTTPException(status_code=400, detail="Invalid directory name")
        
        # Build full directory path
        if parent_path:
            full_path = f"{parent_path.rstrip('/')}/{clean_name}"
        else:
            full_path = clean_name
        
        # Check if directory already exists
        dir_absolute_path = gs.repo_path / full_path
        if dir_absolute_path.exists():
            raise HTTPException(status_code=409, detail=f"Directory '{full_path}' already exists")
        
        # Create directory
        dir_absolute_path.mkdir(parents=True, exist_ok=False)
        
        # Create a placeholder file to ensure the directory is tracked by Git
        placeholder_file = dir_absolute_path / ".gitkeep"
        placeholder_file.touch()
        
        # Commit the change
        commit_message = request_body.message or f"Create directory '{full_path}'"
        commit_sha = gs.commit_files([f"{full_path}/.gitkeep"], commit_message)
        
        return schemas.CreateDirectoryResponse(
            path=full_path,
            message=commit_message,
            commit_sha=commit_sha
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating directory '{request_body.name}': {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create directory: {str(e)}")


@app.delete("/api/file/{file_path:path}", response_model=schemas.DeleteItemResponse)
async def delete_file(
    file_path: str,
    commit_message: Optional[str] = None,  # Query parameter for commit message
    gs: GitService = Depends(get_git_service)
):
    """
    Delete a file from the repository.
    - **file_path**: The path to the file, relative to the repository root.
    - **commit_message**: Optional commit message. Defaults to "Delete [file_path]".
    """
    try:
        # Check if file exists
        file_absolute_path = gs.repo_path / file_path
        if not file_absolute_path.exists():
            raise HTTPException(status_code=404, detail=f"File '{file_path}' not found")
        
        if not file_absolute_path.is_file():
            raise HTTPException(status_code=400, detail=f"'{file_path}' is not a file")
        
        # Use default commit message if not provided
        message = commit_message or f"Delete '{file_path}'"
        
        # Delete the file using GitService
        commit_sha = gs.delete_item(file_path, message)
        
        if commit_sha is None:
            raise HTTPException(status_code=500, detail="Failed to delete file")
        
        return schemas.DeleteItemResponse(
            message=message,
            commit_sha=commit_sha,
            path=file_path
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting file '{file_path}': {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete file: {str(e)}")


@app.delete("/api/directory/{dir_path:path}", response_model=schemas.DeleteItemResponse)
async def delete_directory(
    dir_path: str,
    commit_message: Optional[str] = None,  # Query parameter for commit message
    gs: GitService = Depends(get_git_service)
):
    """
    Delete a directory from the repository.
    - **dir_path**: The path to the directory, relative to the repository root.
    - **commit_message**: Optional commit message. Defaults to "Delete [dir_path]".
    """
    try:
        # Check if directory exists
        dir_absolute_path = gs.repo_path / dir_path
        if not dir_absolute_path.exists():
            raise HTTPException(status_code=404, detail=f"Directory '{dir_path}' not found")
        
        if not dir_absolute_path.is_dir():
            raise HTTPException(status_code=400, detail=f"'{dir_path}' is not a directory")
        
        # Use default commit message if not provided
        message = commit_message or f"Delete directory '{dir_path}'"
        
        # Delete the directory using GitService
        commit_sha = gs.delete_item(dir_path, message)
        
        if commit_sha is None:
            raise HTTPException(status_code=500, detail="Failed to delete directory")
        
        return schemas.DeleteItemResponse(
            message=message,
            commit_sha=commit_sha,
            path=dir_path
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting directory '{dir_path}': {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete directory: {str(e)}")


@app.put("/api/file/{file_path:path}/move", response_model=schemas.MoveFileResponse)
async def move_file(
    file_path: str,
    request_body: schemas.MoveFileRequest,
    gs: GitService = Depends(get_git_service)
):
    """
    Move or rename a file in the repository.
    - **file_path**: The current path to the file, relative to the repository root.
    - **request_body**: JSON body with destination path and optional commit message.
    """
    try:
        # Check if source file exists
        source_absolute_path = gs.repo_path / file_path
        if not source_absolute_path.exists():
            raise HTTPException(status_code=404, detail=f"File '{file_path}' not found")
        
        if not source_absolute_path.is_file():
            raise HTTPException(status_code=400, detail=f"'{file_path}' is not a file")
        
        # Validate destination path
        destination_path = request_body.destination_path.strip()
        if not destination_path:
            raise HTTPException(status_code=400, detail="Destination path cannot be empty")
        
        # Check if destination already exists
        dest_absolute_path = gs.repo_path / destination_path
        if dest_absolute_path.exists():
            raise HTTPException(status_code=409, detail=f"Destination '{destination_path}' already exists")
        
        # Prevent moving to same location
        if file_path == destination_path:
            raise HTTPException(status_code=400, detail="Source and destination paths are the same")
        
        # Use default commit message if not provided
        message = request_body.message or f"Move '{file_path}' to '{destination_path}'"
        
        # Move the file using GitService
        commit_sha = gs.move_item(file_path, destination_path, message)
        
        if commit_sha is None:
            raise HTTPException(status_code=500, detail="Failed to move file")
        
        return schemas.MoveFileResponse(
            source_path=file_path,
            destination_path=destination_path,
            message=message,
            commit_sha=commit_sha
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error moving file '{file_path}' to '{request_body.destination_path}': {e}")
        raise HTTPException(status_code=500, detail=f"Failed to move file: {str(e)}")


@app.put("/api/directory/{dir_path:path}/move", response_model=schemas.MoveDirectoryResponse)
async def move_directory(
    dir_path: str,
    request_body: schemas.MoveDirectoryRequest,
    gs: GitService = Depends(get_git_service)
):
    """
    Move or rename a directory in the repository.
    - **dir_path**: The current path to the directory, relative to the repository root.
    - **request_body**: JSON body with destination path and optional commit message.
    """
    try:
        # Check if source directory exists
        source_absolute_path = gs.repo_path / dir_path
        if not source_absolute_path.exists():
            raise HTTPException(status_code=404, detail=f"Directory '{dir_path}' not found")
        
        if not source_absolute_path.is_dir():
            raise HTTPException(status_code=400, detail=f"'{dir_path}' is not a directory")
        
        # Validate destination path
        destination_path = request_body.destination_path.strip()
        if not destination_path:
            raise HTTPException(status_code=400, detail="Destination path cannot be empty")
        
        # Check if destination already exists
        dest_absolute_path = gs.repo_path / destination_path
        if dest_absolute_path.exists():
            raise HTTPException(status_code=409, detail=f"Destination '{destination_path}' already exists")
        
        # Prevent moving to same location
        if dir_path == destination_path:
            raise HTTPException(status_code=400, detail="Source and destination paths are the same")
        
        # Prevent moving directory into itself
        if destination_path.startswith(dir_path + "/"):
            raise HTTPException(status_code=400, detail="Cannot move directory into itself")
        
        # Use default commit message if not provided
        message = request_body.message or f"Move directory '{dir_path}' to '{destination_path}'"
        
        # Move the directory using GitService
        commit_sha = gs.move_item(dir_path, destination_path, message)
        
        if commit_sha is None:
            raise HTTPException(status_code=500, detail="Failed to move directory")
        
        return schemas.MoveDirectoryResponse(
            source_path=dir_path,
            destination_path=destination_path,
            message=message,
            commit_sha=commit_sha
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error moving directory '{dir_path}' to '{request_body.destination_path}': {e}")
        raise HTTPException(status_code=500, detail=f"Failed to move directory: {str(e)}")
