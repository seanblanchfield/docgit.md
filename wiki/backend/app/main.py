from fastapi import FastAPI, Depends, HTTPException
from typing import List, Optional
from . import schemas
from .schemas import TreeNode # Added for the directory tree endpoint
from .config import settings
from .git_service import GitService

# Instantiate GitService with configuration from settings
git_service = GitService(
    repo_path_str=settings.GIT_REPO_PATH,
    author_name=settings.GIT_AUTHOR_NAME,
    author_email=settings.GIT_AUTHOR_EMAIL
)

app = FastAPI(openapi_url="/api/openapi.json", docs_url="/api/docs", redoc_url="/api/redoc")

# Dependency injector for GitService
def get_git_service() -> GitService:
    return git_service

@app.get("/health")
async def health_check():
    return {"status": "ok"}

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
    gs: GitService = Depends(get_git_service)
):
    """
    Create or update a file and commit the change.
    - **file_path**: The path to the file, relative to the repository root.
    - **request_body**: JSON body with `content` and `message`.
    """
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

# Further endpoints will be added below.
