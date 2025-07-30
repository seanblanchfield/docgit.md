from pydantic import BaseModel
from typing import List, Optional, Literal

class FileListItem(BaseModel):
    name: str
    path: str # Relative to repo root
    type: Literal["file", "folder"]

class FileContentResponse(BaseModel):
    path: str # Relative to repo root
    content: Optional[str]

class SaveFileRequest(BaseModel):
    content: str
    message: str

class SaveFileResponse(BaseModel):
    path: str # Relative to repo root
    commit_sha: Optional[str]

class CommitDetail(BaseModel):
    sha: str
    author_name: str
    author_email: str
    date: str  # ISO format string
    message: str

class FileDiffResponse(BaseModel):
    path: str # Relative to repo root
    commit_sha1: str
    commit_sha2: str
    diff_output: Optional[str]


class DeleteItemResponse(BaseModel):
    message: str
    commit_sha: Optional[str]
    path: str # Path of the deleted item, relative to repo root

class MoveItemRequest(BaseModel):
    source_path: str # Relative to repo root
    destination_path: str # Relative to repo root
    message: str

class MoveItemResponse(BaseModel):
    message: str
    commit_sha: Optional[str]
    source_path: str
    destination_path: str


# Schema for the directory tree structure expected by the frontend
class TreeNode(BaseModel):
    id: str  # Typically the full path relative to the repo root
    name: str  # The file or folder name
    children: Optional[List['TreeNode']] = None # Recursive definition for children
    gitHash: Optional[str] = None  # Git commit hash for this file (files only, not directories)

# If you need to update models for self-referencing Pydantic models in older Pydantic versions
# you might need `TreeNode.update_forward_refs()` after the class definition.
# However, with Pydantic v1.8+ (FastAPI often uses this or newer), string type hints
# for forward references usually work out of the box.


# Lock-related schemas for file-based locking system
class AcquireLockRequest(BaseModel):
    owner: str  # User identifier

class LockResponse(BaseModel):
    lock_id: str
    expires_at: str  # ISO format timestamp

class LockConflictResponse(BaseModel):
    error: str
    owner: str  # Current lock owner
    expires_at: str  # When current lock expires

class RefreshLockResponse(BaseModel):
    expires_at: str  # New expiration timestamp


# File operations schemas
class CreateDirectoryRequest(BaseModel):
    name: str  # Directory name
    message: Optional[str] = None  # Optional commit message

class CreateDirectoryResponse(BaseModel):
    path: str  # Full path of created directory
    message: str
    commit_sha: Optional[str]

class MoveFileRequest(BaseModel):
    destination_path: str  # New path for the file
    message: Optional[str] = None  # Optional commit message

class MoveFileResponse(BaseModel):
    source_path: str
    destination_path: str
    message: str
    commit_sha: Optional[str]

class MoveDirectoryRequest(BaseModel):
    destination_path: str  # New path for the directory
    message: Optional[str] = None  # Optional commit message

class MoveDirectoryResponse(BaseModel):
    source_path: str
    destination_path: str
    message: str
    commit_sha: Optional[str]


# Console logging schemas for forwarding browser console messages to server
class ConsoleMessage(BaseModel):
    level: Literal["log", "info", "warn", "error", "debug"]  # Console log level
    message: str  # The actual log message
    timestamp: str  # ISO format timestamp from frontend
    url: Optional[str] = None  # Current page URL when logged
    user_agent: Optional[str] = None  # Browser user agent
    stack_trace: Optional[str] = None  # Stack trace for errors

class ConsoleLogResponse(BaseModel):
    status: str  # Success/failure status
    logged_at: str  # Server timestamp when logged
