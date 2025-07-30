import os
import shutil
from pathlib import Path
from typing import List, Optional, Dict

import git
from git import Repo, GitCommandError, Actor, DiffIndex
from git.exc import NoSuchPathError, BadName

from .schemas import TreeNode # Added for directory tree structure



class GitService:
    def __init__(self, repo_path_str: str, author_name: str, author_email: str):
        self.repo_path = Path(repo_path_str).resolve()
        self.author_name = author_name  # Store for potential future use
        self.author_email = author_email  # Store for potential future use
        self.author = Actor(author_name, author_email) # Use passed-in values
        self.repo: Optional[Repo] = None
        self._initialize_repo()

    def _initialize_repo(self):
        """
        Initializes the Git repository.
        - If repo_path doesn't exist, creates it and initializes a new repo.
        - If repo_path exists and is a valid repo, loads it.
        - If repo_path exists but is not a valid repo (e.g., an empty directory or a file),
          it attempts to initialize a new repo. This might fail if the directory is not empty
          and not a repo. A more robust error handling or cleanup might be needed for production.
        - Ensures an initial commit exists if the repo is new/empty.
        """
        try:
            # Configure Git to trust this repository directory (fixes Docker ownership issues)
            import subprocess
            subprocess.run(['git', 'config', '--global', '--add', 'safe.directory', str(self.repo_path)], 
                          check=False, capture_output=True)
            if not self.repo_path.exists():
                self.repo_path.mkdir(parents=True, exist_ok=True)
                self.repo = Repo.init(self.repo_path)
                print(f"Initialized new repository at {self.repo_path}")
            elif not (self.repo_path / ".git").is_dir():
                # Path exists but doesn't seem to be a git repo.
                # Attempt to initialize. This could fail if dir is not empty.
                print(f"Path {self.repo_path} exists but is not a Git repository. Attempting to initialize.")
                self.repo = Repo.init(self.repo_path)
            else:
                self.repo = Repo(self.repo_path)
                print(f"Loaded existing repository at {self.repo_path}")

            # Ensure there's at least one commit if the repo is new/empty.
            # GitPython operations can fail on a repo with no commits.
            if not self.repo.head.is_valid(): # No valid HEAD, likely no commits
                # Create an initial empty commit
                readme_path = self.repo_path / ".initial_commit_marker"
                created_marker = False
                if not readme_path.exists():
                    readme_path.touch()
                    created_marker = True
                
                self.repo.index.add([str(readme_path)])
                # Check if there's anything to commit (e.g. if marker was already there and committed)
                # Check if there are staged changes or if we just created the marker
                try:
                    has_staged_changes = bool(self.repo.index.diff(self.repo.head.commit))
                except GitCommandError:
                    # If we can't diff against HEAD, assume we need to commit
                    has_staged_changes = True
                if has_staged_changes or created_marker:
                    self.repo.index.commit("Initial repository setup", author=self.author, committer=self.author)
                    print(f"Created initial commit in repository at {self.repo_path}.")
                if created_marker:
                    # We can choose to remove the marker file after the initial commit
                    # readme_path.unlink() 
                    pass


        except GitCommandError as e:
            print(f"Git command error during repository initialization at {self.repo_path}: {e}")
            raise  # Re-raise for now, to be handled by calling code
        except Exception as e:
            print(f"An unexpected error occurred during repository initialization at {self.repo_path}: {e}")
            raise # Re-raise

    # Placeholder for other methods - to be implemented iteratively
    def commit_files(self, file_paths_relative_to_repo: List[str], message: str) -> Optional[str]:
        """
        Adds specified files and commits them.
        File paths should be relative to the repository root.
        Returns commit SHA if successful, None otherwise.
        """
        if not self.repo:
            raise RuntimeError("Repository is not initialized.")
        
        full_file_paths = [str(self.repo_path / p) for p in file_paths_relative_to_repo]
        
        # Check if files exist before adding
        for fp_abs in full_file_paths[:]: # Iterate over a copy for safe removal
            if not Path(fp_abs).exists():
                print(f"Warning: File {fp_abs} does not exist and will not be committed.")
                full_file_paths.remove(fp_abs) 

        if not full_file_paths:
            print("No valid files provided to commit.")
            return None

        try:
            self.repo.index.add(full_file_paths)
            if self.repo.index.diff(self.repo.head.commit if self.repo.head.is_valid() else None): # Diff against HEAD or empty tree
                commit = self.repo.index.commit(message, author=self.author, committer=self.author)
                print(f"Committed {len(full_file_paths)} file(s): {commit.hexsha}")
                return commit.hexsha
            else:
                print("No changes to commit.")
                return None
        except GitCommandError as e:
            print(f"Error committing files: {e}")
            # Attempt to reset HEAD if commit failed to avoid broken state
            if self.repo.head.is_valid():
                self.repo.index.reset(self.repo.head.commit, working_tree=False)
            return None

    def get_file_content(self, file_path_relative_to_repo: str) -> Optional[str]:
        """
        Reads the content of a file from the repository.
        File path should be relative to the repository root.
        Returns file content as a string, or None if the file does not exist.
        """
        if not self.repo:
            raise RuntimeError("Repository is not initialized.")

        absolute_file_path = self.repo_path / file_path_relative_to_repo
        
        if not absolute_file_path.is_file():
            print(f"File not found: {absolute_file_path}")
            return None
        
        try:
            with open(absolute_file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            return content
        except Exception as e:
            print(f"Error reading file {absolute_file_path}: {e}")
            return None # Or re-raise depending on desired error handling

    def save_file_content(self, file_path_relative_to_repo: str, content: str, message: str) -> Optional[str]:
        """
        Saves content to a file in the repository and commits the change.
        File path should be relative to the repository root.
        Creates parent directories if they don't exist.
        Returns commit SHA if successful, None otherwise.
        """
        if not self.repo:
            raise RuntimeError("Repository is not initialized.")

        absolute_file_path = self.repo_path / file_path_relative_to_repo
        
        try:
            # Ensure parent directory exists
            absolute_file_path.parent.mkdir(parents=True, exist_ok=True)
            
            with open(absolute_file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            
            # Commit the change
            # commit_files expects a list of paths relative to repo
            commit_sha = self.commit_files(file_paths_relative_to_repo=[file_path_relative_to_repo], message=message)
            return commit_sha
        except Exception as e:
            print(f"Error saving file {absolute_file_path}: {e}")
            # Potentially clean up created file if commit fails, or handle in commit_files
            return None


    def delete_item(self, item_path_relative_to_repo: str, message: str) -> Optional[str]:
        """
        Deletes a file or directory from the repository and commits the change.
        - item_path_relative_to_repo: Path to the item (file or directory) relative to the repo root.
        - message: Commit message.
        Returns commit SHA if successful, None otherwise.
        """
        if not self.repo:
            raise RuntimeError("Repository is not initialized.")

        absolute_item_path = (self.repo_path / item_path_relative_to_repo).resolve()

        if not absolute_item_path.exists():
            print(f"Item not found: {absolute_item_path}")
            return None

        try:
            if absolute_item_path.is_file():
                self.repo.index.remove([str(absolute_item_path)], working_tree=True)
                print(f"Removed file: {absolute_item_path}")
            elif absolute_item_path.is_dir():
                # Use git rm -r for directories to handle tracked files correctly
                self.repo.git.rm('-r', str(absolute_item_path))
                print(f"Removed directory and its contents: {absolute_item_path}")
            else:
                # This case should ideally not be reached if .exists() is true
                print(f"Item is not a recognizable file or directory: {absolute_item_path}")
                return None

            # Check if there are changes to commit
            head_commit = self.repo.head.commit if self.repo.head.is_valid() else None
            if self.repo.index.diff(head_commit): # Diff against HEAD or empty tree
                commit = self.repo.index.commit(message, author=self.author, committer=self.author)
                print(f"Committed deletion of {item_path_relative_to_repo}: {commit.hexsha}")
                return commit.hexsha
            else:
                print(f"No changes to commit after attempting to delete {item_path_relative_to_repo}.")
                return None # Or indicate that item was not tracked/already deleted

        except GitCommandError as e:
            print(f"Git command error during deletion of {item_path_relative_to_repo}: {e}")
            # Attempt to reset index to avoid a partially staged deletion if commit fails
            if self.repo.head.is_valid():
                try:
                    self.repo.index.reset(self.repo.head.commit, working_tree=False)
                except GitCommandError as reset_e:
                    print(f"Failed to reset index after deletion error: {reset_e}")
            return None
        except Exception as e:
            print(f"An unexpected error occurred during deletion of {item_path_relative_to_repo}: {e}")
            return None


    def move_item(self, source_path_relative_to_repo: str, destination_path_relative_to_repo: str, message: str) -> Optional[str]:
        """
        Moves or renames a file or directory within the repository and commits the change.
        - source_path_relative_to_repo: Current path of the item relative to the repo root.
        - destination_path_relative_to_repo: New path for the item relative to the repo root.
        - message: Commit message.
        Returns commit SHA if successful, None otherwise.
        """
        if not self.repo:
            raise RuntimeError("Repository is not initialized.")

        absolute_source_path = (self.repo_path / source_path_relative_to_repo).resolve()
        absolute_destination_path = (self.repo_path / destination_path_relative_to_repo).resolve()

        if not absolute_source_path.exists():
            print(f"Source item not found: {absolute_source_path}")
            return None

        if absolute_destination_path.exists():
            print(f"Destination path already exists: {absolute_destination_path}")
            return None # Or decide on overwrite/merge strategy, for now, fail

        # Ensure parent directory of destination exists for git mv
        absolute_destination_path.parent.mkdir(parents=True, exist_ok=True)

        try:
            # Use repo.git.mv() for direct git command execution
            # This handles both files and directories, and stages the changes.
            self.repo.git.mv(str(absolute_source_path), str(absolute_destination_path))
            print(f"Moved item from {absolute_source_path} to {absolute_destination_path}")

            # Commit the staged changes
            # Check if there are changes to commit (git mv stages the move)
            head_commit = self.repo.head.commit if self.repo.head.is_valid() else None
            if self.repo.index.diff(head_commit):
                commit = self.repo.index.commit(message, author=self.author, committer=self.author)
                print(f"Committed move of {source_path_relative_to_repo} to {destination_path_relative_to_repo}: {commit.hexsha}")
                return commit.hexsha
            else:
                # This case might occur if source and destination are effectively the same after normalization,
                # or if the item wasn't tracked.
                print(f"No changes to commit after attempting to move {source_path_relative_to_repo}.")
                return None

        except GitCommandError as e:
            print(f"Git command error during move of {source_path_relative_to_repo}: {e}")
            # Attempt to revert or clean up if possible, though git mv is usually atomic or handles its state.
            # A simple reset might not be appropriate if the move partially succeeded in the working tree.
            # For now, just log and return None.
            return None
        except Exception as e:
            print(f"An unexpected error occurred during move of {source_path_relative_to_repo}: {e}")
            return None


    def get_file_diff(self, file_path_relative_to_repo: str, commit_sha1: str, commit_sha2: str) -> Optional[str]:
        """
        Generates a diff for a specific file between two commit SHAs.
        - file_path_relative_to_repo: Path to the file relative to the repo root.
        - commit_sha1: The first commit SHA (or 'WORKING_TREE').
        - commit_sha2: The second commit SHA (or 'WORKING_TREE').
        Returns the diff content as a string, or None if an error occurs.
        """
        if not self.repo:
            raise RuntimeError("Repository is not initialized.")

        # Construct the file path relative to the repository for git commands
        # Git commands usually expect paths relative to the repo root if CWD is repo root.
        # Here, absolute_file_path is used with '--' which makes git treat it as a path from repo root.
        # However, it's often safer to pass relative paths to git commands when in repo root.
        # For `git diff -- <path>`, path should be relative to repo root.

        args = []
        # Special handling for diffing against the working tree or HEAD
        # Note: GitPython's repo.commit('HEAD') can be used for HEAD.
        # For working tree, diffing against HEAD shows staged and unstaged changes.
        # Diffing against a specific commit shows changes since that commit.

        # To diff a file between two commits: git diff <sha1> <sha2> -- <file>
        # To diff a file between a commit and working tree: git diff <sha1> -- <file>
        # To diff a file between a commit and staged (index): git diff --cached <sha1> -- <file>

        if commit_sha1 == "WORKING_TREE" and commit_sha2 == "WORKING_TREE":
            print("Cannot diff working tree against itself.")
            return "" # Or None, depending on desired behavior for no diff

        path_arg = file_path_relative_to_repo # Use relative path for git diff command

        if commit_sha1 == "WORKING_TREE":
            # Diff between working tree and commit_sha2. Shows changes in working tree *not* in commit_sha2.
            # `git diff <commit_sha2> -- <file_path>`
            args = [commit_sha2, '--', path_arg]
        elif commit_sha2 == "WORKING_TREE":
            # Diff between commit_sha1 and working tree. Shows changes in working tree *since* commit_sha1.
            # `git diff <commit_sha1> -- <file_path>`
            args = [commit_sha1, '--', path_arg]
        else:
            # Diff between two commits
            # `git diff <commit_sha1> <commit_sha2> -- <file_path>`
            args = [commit_sha1, commit_sha2, '--', path_arg]
            
        try:
            diff_output = self.repo.git.diff(*args)
            return diff_output
        except GitCommandError as e:
            print(f"Git command error during diff for {file_path_relative_to_repo} between '{commit_sha1}' and '{commit_sha2}': {e}")
            if "bad revision" in str(e).lower() or "unknown revision" in str(e).lower():
                 print(f"Invalid commit SHA provided: {commit_sha1} or {commit_sha2}")
            # Git diff returns non-zero exit code (1) if there are differences, which GitPython treats as an error.
            # It also returns specific error messages if paths are not found, etc.
            # We need to distinguish actual errors from "found differences".
            # A common way is to check the stdout/stderr from the command if GitPython exposes it directly,
            # or rely on specific error messages.
            # If e.status == 1 and e.stdout is not empty, it's likely a valid diff.
            # However, self.repo.git.diff() should return the diff content directly on success.
            # The GitCommandError here likely means a more fundamental issue (bad sha, file not in commit).
            return None
        except Exception as e:
            print(f"An unexpected error occurred during diff for {file_path_relative_to_repo}: {e}")
            return None

    def list_files(self, directory_path_relative_to_repo: str = ".") -> List[Dict[str, str]]:
        """
        Lists all files and folders within the specified directory in the repository, recursively.
        Paths are relative to the repository root.
        Excludes the .git directory.
        Returns a list of dictionaries, each with 'name', 'path', and 'type' ('file' or 'folder').
        If directory_path_relative_to_repo is ".", it lists from the repository root.
        """
        if not self.repo:
            raise RuntimeError("Repository is not initialized.")

        # Normalize directory_path_relative_to_repo to handle "." or empty string for repo root
        if directory_path_relative_to_repo == "" or directory_path_relative_to_repo == ".":
            start_dir_in_repo = Path() # Represents the repo root itself for path calculations
        else:
            start_dir_in_repo = Path(directory_path_relative_to_repo)

        absolute_start_path = (self.repo_path / start_dir_in_repo).resolve()

        if not absolute_start_path.is_dir():
            print(f"Directory not found or not a directory: {absolute_start_path}")
            return []

        results: List[Dict[str, str]] = []

        for root, dirs, files in os.walk(absolute_start_path, topdown=True):
            # Exclude .git directory from traversal
            if '.git' in dirs:
                dirs.remove('.git')
            
            current_dir_absolute = Path(root)
            # Path of the current directory being walked, relative to the repo root
            current_dir_relative_to_repo_root = current_dir_absolute.relative_to(self.repo_path)

            for dirname in dirs:
                # Full path of this subdirectory, relative to repo root
                dir_path_relative_to_repo_root = current_dir_relative_to_repo_root / dirname
                results.append({
                    "name": dirname,
                    "path": str(dir_path_relative_to_repo_root),
                    "type": "folder"
                })
            
            for filename in files:
                # Full path of this file, relative to repo root
                file_path_relative_to_repo_root = current_dir_relative_to_repo_root / filename
                results.append({
                    "name": filename,
                    "path": str(file_path_relative_to_repo_root),
                    "type": "file"
                })
                
        return results

    def get_file_history(self, file_path_relative_to_repo: str) -> List[Dict[str, str]]:
        """
        Retrieves the commit history for a specific file.
        File path should be relative to the repository root.
        Returns a list of commit details (sha, author, date, message).
        """
        if not self.repo:
            raise RuntimeError("Repository is not initialized.")

        absolute_file_path = self.repo_path / file_path_relative_to_repo
        
        if not absolute_file_path.exists(): # Check if file exists at all, even if not a file (e.g. a dir)
            print(f"Path does not exist: {absolute_file_path}")
            return [] # Or raise an error if path must be a file

        history = []
        try:
            # Note: iter_commits for a path will list commits where this path was modified.
            # If the file doesn't exist in the current HEAD but existed before, this will still list its history.
            commits = list(self.repo.iter_commits(paths=str(absolute_file_path)))
            for commit in commits:
                history.append({
                    "sha": commit.hexsha,
                    "author_name": commit.author.name,
                    "author_email": commit.author.email,
                    "date": commit.authored_datetime.isoformat(),
                    "message": commit.message.strip(), # Strip newlines from message
                })
        except GitCommandError as e:
            print(f"Error retrieving history for file {absolute_file_path}: {e}")
            # Depending on the error, you might want to return partial history or an empty list
            return [] 
        except Exception as e: # Catch other potential errors, e.g. if path is a directory
            print(f"Unexpected error retrieving history for file {absolute_file_path}: {e}")
            return []
            
        return history

    def get_file_diff(self, file_path_relative_to_repo: str, commit_sha1: str, commit_sha2: str) -> Optional[str]:
        """
        Gets the diff for a file between two versions (commits or WORKING_TREE).
        - file_path_relative_to_repo: Path to the file relative to the repo root.
        - commit_sha1: The first commit SHA or 'WORKING_TREE' (state A).
        - commit_sha2: The second commit SHA or 'WORKING_TREE' (state B).
        Returns the diff content showing changes from state A to state B.
        """
        if not self.repo:
            raise RuntimeError("Repository is not initialized.")

        try:
            paths_arg = [file_path_relative_to_repo]
            diff_items: DiffIndex

            if commit_sha1 == "WORKING_TREE" and commit_sha2 == "WORKING_TREE":
                print(f"Diffing WORKING_TREE against WORKING_TREE for '{file_path_relative_to_repo}'. This is ambiguous, returning empty.")
                return ""
            elif commit_sha1 == "WORKING_TREE":
                # Diff from working tree (A) to commit_sha2 (B)
                # This is equivalent to reversing the diff from commit_sha2 to working tree.
                commit_b_obj = self.repo.commit(commit_sha2)
                # commit_b_obj.diff(None) shows changes from commit_b to working tree.
                # R=True reverses this, showing working tree to commit_b.
                diff_items = commit_b_obj.diff(None, paths=paths_arg, create_patch=True, R=True)
            elif commit_sha2 == "WORKING_TREE":
                # Diff from commit_sha1 (A) to working tree (B)
                commit_a_obj = self.repo.commit(commit_sha1)
                diff_items = commit_a_obj.diff(None, paths=paths_arg, create_patch=True)
            else:
                # Diff from commit_sha1 (A) to commit_sha2 (B)
                commit_a_obj = self.repo.commit(commit_sha1)
                commit_b_obj = self.repo.commit(commit_sha2)
                diff_items = commit_a_obj.diff(commit_b_obj, paths=paths_arg, create_patch=True)

            if not diff_items:
                return ""  # No textual changes, or file is binary and no textual diff is available

            # Ensure diff.diff is not None (can happen for binary files or certain types of changes)
            diff_text_parts = [diff.diff.decode('utf-8', 'ignore') for diff in diff_items if diff.diff is not None]
            return "\n".join(diff_text_parts)

        except BadName as e: # Catches invalid commit SHAs
            print(f"Invalid commit SHA provided for diff ('{commit_sha1}' or '{commit_sha2}'): {e}")
            return None
        except NoSuchPathError: # GitPython can raise this if path not in commit
             print(f"File path '{file_path_relative_to_repo}' may not exist in one of the specified commits for diff.")
             return None
        except GitCommandError as e: # General Git errors
            print(f"Git command error during diff for '{file_path_relative_to_repo}': {e}")
            return None
        except Exception as e: # Catch-all for other unexpected issues
            print(f"An unexpected error occurred during diff for '{file_path_relative_to_repo}': {e}")
            return None


    def get_directory_tree(self, relative_path: str = ".") -> List[TreeNode]:
        """
        Builds a hierarchical tree of files and folders from the specified path in the repository.
        Paths are relative to the repository root.
        Excludes the .git directory.
        Returns a list of TreeNode objects.
        """
        if not self.repo:
            raise RuntimeError("Repository is not initialized.")

        start_node_path_in_repo = Path() if relative_path == "." or not relative_path else Path(relative_path)
        absolute_start_path = (self.repo_path / start_node_path_in_repo).resolve()

        if not absolute_start_path.is_dir():
            print(f"Path for directory tree is not a directory or does not exist: {absolute_start_path}")
            return []

        return self._build_tree_recursive(absolute_start_path, self.repo_path)

    def _build_tree_recursive(self, current_absolute_path: Path, repo_root_path: Path) -> List[TreeNode]:
        """
        Helper method to recursively build the tree structure.
        Returns a list of TreeNode objects for the contents of current_absolute_path.
        """
        tree_nodes: List[TreeNode] = []
        
        if not current_absolute_path.is_dir() or not str(current_absolute_path).startswith(str(repo_root_path)):
            return []

        # Sort items for consistent order: directories first, then files, then alphabetically by name
        items_in_directory = sorted(
            current_absolute_path.iterdir(),
            key=lambda p: (not p.is_dir(), p.name.lower())
        )

        for item_path in items_in_directory:
            if item_path.name == ".git":
                continue

            item_relative_path_to_repo = item_path.relative_to(repo_root_path)
            
            children_nodes: Optional[List[TreeNode]] = None
            if item_path.is_dir():
                children_nodes = self._build_tree_recursive(item_path, repo_root_path)
                # If a folder is empty, children_nodes will be an empty list.
                # For the TreeNode schema (Optional[List['TreeNode']] = None),
                # an empty list is valid. If we want to explicitly use None for empty folders:
                # if not children_nodes:
                #     children_nodes = None

            # Get git hash for files (not directories)
            git_hash = None
            if item_path.is_file():
                git_hash = self._get_file_git_hash(str(item_relative_path_to_repo))

            node = TreeNode(
                id=str(item_relative_path_to_repo),
                name=item_path.name,
                children=children_nodes,
                gitHash=git_hash
            )
            tree_nodes.append(node)
            
        return tree_nodes

    def _get_file_git_hash(self, file_path_relative_to_repo: str) -> Optional[str]:
        """
        Get the latest commit hash for a specific file.
        Returns the SHA of the latest commit that modified this file.
        """
        if not self.repo:
            return None
            
        try:
            # Get the most recent commit that modified this file
            commits = list(self.repo.iter_commits(paths=file_path_relative_to_repo, max_count=1))
            if commits:
                return commits[0].hexsha
            return None
        except (GitCommandError, Exception) as e:
            print(f"Error getting git hash for file {file_path_relative_to_repo}: {e}")
            return None

    # All core Git operations for Phase 2 backend API implemented.
