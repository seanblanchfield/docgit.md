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
