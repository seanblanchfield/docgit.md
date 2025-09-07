"""
Service for handling file and directory reordering operations.
"""
import os
import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from .git_service import GitService
from .file_lock_service import FileLockService


class ReorderService:
    def __init__(self, git_service: GitService, lock_service: FileLockService):
        self.git_service = git_service
        self.lock_service = lock_service
        
    def reorder_item(
        self, 
        source_path: str, 
        target_parent_path: str, 
        position: int,
        is_directory: bool = False
    ) -> Dict[str, any]:
        """
        Reorder a file or directory by moving it to a new position.
        
        Args:
            source_path: Current path of the item to move
            target_parent_path: Path of the parent directory where item should be moved
            position: 0-based index position within the target directory
            is_directory: Whether the source is a directory
            
        Returns:
            Dict containing success status, new path, and any error messages
        """
        try:
            # Validate paths
            if not self._validate_paths(source_path, target_parent_path):
                return {
                    "success": False,
                    "message": "Invalid source or target path"
                }
            
            # Check if source is being moved into its own subdirectory
            if self._is_descendant_path(target_parent_path, source_path):
                return {
                    "success": False,
                    "message": "Cannot move a directory into its own subdirectory"
                }
            
            # Get the current working directory (repository root)
            repo_root = str(self.git_service.repo_path)
            source_full_path = os.path.join(repo_root, source_path.lstrip('/'))
            target_parent_full_path = os.path.join(repo_root, target_parent_path.lstrip('/'))
            
            # Check if source exists
            if not os.path.exists(source_full_path):
                return {
                    "success": False,
                    "message": f"Source path does not exist: {source_path}"
                }
            
            # Check if target parent exists
            if not os.path.exists(target_parent_full_path):
                return {
                    "success": False,
                    "message": f"Target parent directory does not exist: {target_parent_path}"
                }
            
            # Get current items in target directory
            target_items = self._get_directory_items(target_parent_full_path)
            
            # Calculate new numerical prefix
            new_prefix = self._calculate_new_prefix(target_items, position)
            
            # Generate new filename with prefix
            source_name = os.path.basename(source_path)
            new_name = self._apply_numerical_prefix(source_name, new_prefix)
            new_path = os.path.join(target_parent_path, new_name).replace('\\', '/')
            new_full_path = os.path.join(target_parent_full_path, new_name)
            
            # Check if target already exists
            if os.path.exists(new_full_path) and new_full_path != source_full_path:
                return {
                    "success": False,
                    "message": f"Target path already exists: {new_path}"
                }
            
            # Perform the move operation
            success = self._perform_move(source_full_path, new_full_path, is_directory)
            if not success:
                return {
                    "success": False,
                    "message": "Failed to move file/directory"
                }
            
            # Normalize all prefixes in the target directory to 3-digit format
            normalized_files = self._normalize_directory_prefixes(target_parent_full_path)
            
            # Commit the changes
            commit_message = f"Reorder: Move {os.path.basename(source_path)} to position {position}"
            if target_parent_path:
                commit_message += f" in {target_parent_path}"
            
            # Commit all affected files (original move + normalized files)
            files_to_commit = [source_path, new_path] + normalized_files
            # Remove duplicates and filter out non-existent files
            files_to_commit = list(set([f for f in files_to_commit if f]))
            self.git_service.commit_files(files_to_commit, commit_message)
            
            return {
                "success": True,
                "newPath": new_path,
                "message": f"Successfully moved {source_path} to {new_path}"
            }
            
        except Exception as e:
            return {
                "success": False,
                "message": f"Error during reorder operation: {str(e)}"
            }
    
    def _validate_paths(self, source_path: str, target_parent_path: str) -> bool:
        """Validate that paths are safe and within the repository."""
        # Check for path traversal attempts
        if '..' in source_path or '..' in target_parent_path:
            return False
        
        # Ensure paths are relative (not absolute)
        if os.path.isabs(source_path) or os.path.isabs(target_parent_path):
            return False
        
        return True
    
    def _is_descendant_path(self, potential_child: str, potential_parent: str) -> bool:
        """Check if potential_child is a descendant of potential_parent."""
        # Normalize paths
        child_parts = potential_child.strip('/').split('/')
        parent_parts = potential_parent.strip('/').split('/')
        
        # If parent has more parts, it can't be a parent
        if len(parent_parts) >= len(child_parts):
            return False
        
        # Check if all parent parts match the beginning of child parts
        for i, parent_part in enumerate(parent_parts):
            if i >= len(child_parts) or child_parts[i] != parent_part:
                return False
        
        return True
    
    def _get_directory_items(self, directory_path: str) -> List[str]:
        """Get list of items in directory, sorted by numerical prefix."""
        try:
            items = []
            for item in os.listdir(directory_path):
                # Skip hidden files and directories
                if not item.startswith('.'):
                    items.append(item)
            
            # Sort by numerical prefix
            return sorted(items, key=self._extract_numerical_prefix)
        except OSError:
            return []
    
    def _extract_numerical_prefix(self, filename: str) -> int:
        """Extract numerical prefix from filename, return 0 if none found."""
        match = re.match(r'^(\d+)_', filename)
        return int(match.group(1)) if match else 0
    
    def _calculate_new_prefix(self, target_items: List[str], position: int) -> int:
        """Calculate appropriate numerical prefix for the new position."""
        if not target_items or position <= 0:
            return 10
        
        if position >= len(target_items):
            # Insert at end
            last_prefix = self._extract_numerical_prefix(target_items[-1])
            return last_prefix + 10
        
        # Insert at specific position
        if position == 0:
            first_prefix = self._extract_numerical_prefix(target_items[0])
            return max(10, first_prefix - 10)
        
        prev_prefix = self._extract_numerical_prefix(target_items[position - 1])
        next_prefix = self._extract_numerical_prefix(target_items[position])
        
        # If there's enough gap, use middle value
        if next_prefix - prev_prefix > 10:
            return prev_prefix + 10
        
        # Otherwise, use next available increment
        return next_prefix + 10
    
    def _apply_numerical_prefix(self, filename: str, prefix: int) -> str:
        """Apply or update numerical prefix to filename."""
        # Remove existing prefix if present
        name_without_prefix = re.sub(r'^\d+_', '', filename)
        
        # Apply new prefix
        return f"{prefix:03d}_{name_without_prefix}"
    
    def _perform_move(self, source_path: str, target_path: str, is_directory: bool) -> bool:
        """Perform the actual file/directory move operation."""
        try:
            # Use os.rename for atomic move operation
            os.rename(source_path, target_path)
            return True
        except OSError as e:
            print(f"Error moving {source_path} to {target_path}: {e}")
            return False
    
    def _update_subsequent_prefixes(self, directory_path: str, insert_position: int, new_prefix: int) -> None:
        """Update numerical prefixes of items that come after the insertion point."""
        try:
            items = self._get_directory_items(directory_path)
            
            for i, item in enumerate(items):
                if i >= insert_position:
                    current_prefix = self._extract_numerical_prefix(item)
                    
                    # Only update if the current prefix conflicts or needs adjustment
                    if current_prefix >= new_prefix:
                        new_item_prefix = current_prefix + 10
                        old_path = os.path.join(directory_path, item)
                        new_name = self._apply_numerical_prefix(item, new_item_prefix)
                        new_path = os.path.join(directory_path, new_name)
                        
                        if old_path != new_path:
                            os.rename(old_path, new_path)
                            
        except Exception as e:
            print(f"Error updating subsequent prefixes: {e}")
    
    def _normalize_directory_prefixes(self, directory_path: str) -> List[str]:
        """
        Normalize all files in directory to have 3-digit prefixes based on lexicographical order.
        This ensures consistent ordering when user actively reorders items.
        Returns list of affected file paths for Git commit tracking.
        """
        try:
            if not os.path.exists(directory_path):
                return []
            
            # Get all items in directory
            items = []
            for item in os.listdir(directory_path):
                if not item.startswith('.'):  # Skip hidden files
                    item_path = os.path.join(directory_path, item)
                    items.append({
                        'name': item,
                        'path': item_path,
                        'is_directory': os.path.isdir(item_path)
                    })
            
            if not items:
                return []
            
            # Sort items lexicographically (this preserves current visual order)
            # Files with existing prefixes will be sorted by their full name
            items.sort(key=lambda x: x['name'].lower())
            
            # Generate new names with 3-digit prefixes
            renames = []
            for i, item in enumerate(items):
                old_name = item['name']
                old_path = item['path']
                
                # Remove any existing numerical prefix
                name_without_prefix = re.sub(r'^\d+_', '', old_name)
                
                # Generate new 3-digit prefix
                new_prefix = f"{(i + 1) * 10:03d}"
                new_name = f"{new_prefix}_{name_without_prefix}"
                new_path = os.path.join(directory_path, new_name)
                
                # Only rename if the name actually changes
                if old_name != new_name:
                    renames.append({
                        'old_path': old_path,
                        'new_path': new_path,
                        'old_name': old_name,
                        'new_name': new_name
                    })
            
            # If no renames needed, return empty list
            if not renames:
                return []
            
            # Perform all renames
            # Use a two-phase approach to avoid conflicts
            temp_renames = []
            affected_files = []
            
            # Phase 1: Rename to temporary names to avoid conflicts
            for rename in renames:
                temp_name = f"__temp_{rename['new_name']}"
                temp_path = os.path.join(directory_path, temp_name)
                os.rename(rename['old_path'], temp_path)
                temp_renames.append({
                    'temp_path': temp_path,
                    'final_path': rename['new_path'],
                    'old_name': rename['old_name'],
                    'new_name': rename['new_name']
                })
            
            # Phase 2: Rename from temporary names to final names
            for rename in temp_renames:
                os.rename(rename['temp_path'], rename['final_path'])
                print(f"Normalized: {rename['old_name']} -> {rename['new_name']}")
                # Convert absolute path to relative path for Git
                repo_root = str(self.git_service.repo_path)
                relative_path = os.path.relpath(rename['final_path'], repo_root)
                affected_files.append(relative_path)
            
            return affected_files
                
        except Exception as e:
            print(f"Error normalizing directory prefixes: {e}")
            return []
    
    def get_directory_structure(self, path: str = "") -> Dict[str, any]:
        """Get the current directory structure for verification."""
        try:
            repo_root = str(self.git_service.repo_path)
            full_path = os.path.join(repo_root, path.lstrip('/')) if path else repo_root
            
            if not os.path.exists(full_path):
                return {"error": "Path does not exist"}
            
            items = []
            for item in sorted(os.listdir(full_path)):
                if not item.startswith('.'):
                    item_path = os.path.join(full_path, item)
                    is_dir = os.path.isdir(item_path)
                    prefix = self._extract_numerical_prefix(item)
                    
                    items.append({
                        "name": item,
                        "isDirectory": is_dir,
                        "prefix": prefix,
                        "path": os.path.join(path, item).replace('\\', '/') if path else item
                    })
            
            return {
                "path": path,
                "items": items
            }
            
        except Exception as e:
            return {"error": str(e)}
