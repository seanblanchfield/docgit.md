"""
File-based lock service for concurrent editing protection.

This service manages locks using files stored in a Docker volume.
Each lock is represented by a file containing JSON metadata.
"""

import json
import os
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Optional, Any
import logging

logger = logging.getLogger(__name__)


class FileLockService:
    """Service for managing file-based locks."""
    
    def __init__(self, locks_dir: str = "/locks"):
        """Initialize the lock service.
        
        Args:
            locks_dir: Directory where lock files are stored
        """
        self.locks_dir = Path(locks_dir)
        self.locks_dir.mkdir(exist_ok=True)
        self.default_ttl_minutes = 5
        
    def _path_to_lock_filename(self, file_path: str) -> str:
        """Convert file path to safe lock filename.
        
        Args:
            file_path: Original file path (e.g., "docs/readme.md")
            
        Returns:
            Safe filename for lock file (e.g., "docs_readme.md.lock")
        """
        # Replace path separators and other problematic characters
        safe_name = file_path.replace("/", "_").replace("\\", "_")
        # Remove any remaining problematic characters
        safe_name = "".join(c for c in safe_name if c.isalnum() or c in "._-")
        return f"{safe_name}.lock"
    
    def _read_lock_file(self, lock_file: Path) -> Optional[Dict[str, Any]]:
        """Read and parse lock file.
        
        Args:
            lock_file: Path to lock file
            
        Returns:
            Lock data dictionary or None if file doesn't exist or is invalid
        """
        try:
            if not lock_file.exists():
                return None
                
            with open(lock_file, 'r') as f:
                lock_data = json.load(f)
                
            # Validate required fields
            required_fields = ['path', 'lock_id', 'owner', 'acquired_at', 'expires_at']
            if not all(field in lock_data for field in required_fields):
                logger.warning(f"Invalid lock file format: {lock_file}")
                return None
                
            return lock_data
            
        except (json.JSONDecodeError, IOError) as e:
            logger.warning(f"Failed to read lock file {lock_file}: {e}")
            return None
    
    def _write_lock_file(self, lock_file: Path, lock_data: Dict[str, Any]) -> bool:
        """Write lock data to file.
        
        Args:
            lock_file: Path to lock file
            lock_data: Lock data to write
            
        Returns:
            True if successful, False otherwise
        """
        try:
            with open(lock_file, 'w') as f:
                json.dump(lock_data, f, indent=2)
            return True
        except IOError as e:
            logger.error(f"Failed to write lock file {lock_file}: {e}")
            return False
    
    def _is_lock_expired(self, lock_data: Dict[str, Any]) -> bool:
        """Check if lock is expired.
        
        Args:
            lock_data: Lock data dictionary
            
        Returns:
            True if lock is expired
        """
        try:
            expires_at = datetime.fromisoformat(lock_data['expires_at'].replace('Z', '+00:00'))
            return datetime.utcnow().replace(tzinfo=expires_at.tzinfo) > expires_at
        except (ValueError, KeyError) as e:
            logger.warning(f"Invalid expiration time in lock data: {e}")
            return True  # Treat invalid timestamps as expired
    
    def acquire_lock(self, file_path: str, owner: str) -> Dict[str, Any]:
        """Acquire a lock for a file.
        
        Args:
            file_path: Path to file to lock
            owner: Owner identifier
            
        Returns:
            Dictionary with lock info or error info
        """
        lock_filename = self._path_to_lock_filename(file_path)
        lock_file = self.locks_dir / lock_filename
        
        # Check if lock already exists
        existing_lock = self._read_lock_file(lock_file)
        if existing_lock:
            # Check if expired
            if self._is_lock_expired(existing_lock):
                # Remove expired lock
                try:
                    lock_file.unlink()
                    logger.info(f"Removed expired lock for {file_path}")
                except OSError as e:
                    logger.error(f"Failed to remove expired lock {lock_file}: {e}")
                    return {
                        "success": False,
                        "error": "Failed to clean up expired lock",
                        "status_code": 500
                    }
            else:
                # Lock is still valid
                if existing_lock['owner'] == owner:
                    # Same owner, refresh the lock
                    return self.refresh_lock(file_path, existing_lock['lock_id'], owner)
                else:
                    # Different owner, lock conflict
                    return {
                        "success": False,
                        "error": "File is locked by another user",
                        "owner": existing_lock['owner'],
                        "expires_at": existing_lock['expires_at'],
                        "status_code": 423
                    }
        
        # Create new lock
        now = datetime.utcnow()
        expires_at = now + timedelta(minutes=self.default_ttl_minutes)
        
        lock_data = {
            "path": file_path,
            "lock_id": str(uuid.uuid4()),
            "owner": owner,
            "acquired_at": now.isoformat() + "Z",
            "expires_at": expires_at.isoformat() + "Z",
            "last_ping": now.isoformat() + "Z"
        }
        
        # Try to create lock file exclusively
        try:
            # Use 'x' mode for exclusive creation (fails if file exists)
            with open(lock_file, 'x') as f:
                json.dump(lock_data, f, indent=2)
                
            logger.info(f"Lock acquired for {file_path} by {owner}")
            return {
                "success": True,
                "lock_id": lock_data["lock_id"],
                "expires_at": lock_data["expires_at"],
                "status_code": 200
            }
            
        except FileExistsError:
            # Race condition: another process created the lock
            # Re-read and return conflict info
            existing_lock = self._read_lock_file(lock_file)
            if existing_lock and not self._is_lock_expired(existing_lock):
                return {
                    "success": False,
                    "error": "File is locked by another user",
                    "owner": existing_lock['owner'],
                    "expires_at": existing_lock['expires_at'],
                    "status_code": 423
                }
            else:
                # Expired lock found during race condition, clean it up and return error
                try:
                    lock_file.unlink()
                    logger.info(f"Cleaned up expired lock during race condition for {file_path}")
                except OSError:
                    pass
                return {
                    "success": False,
                    "error": "Lock creation failed due to race condition",
                    "status_code": 409
                }
                
        except IOError as e:
            logger.error(f"Failed to create lock file {lock_file}: {e}")
            return {
                "success": False,
                "error": "Failed to create lock",
                "status_code": 500
            }
    
    def refresh_lock(self, file_path: str, lock_id: str, owner: str) -> Dict[str, Any]:
        """Refresh an existing lock's TTL.
        
        Args:
            file_path: Path to locked file
            lock_id: Lock identifier
            owner: Owner identifier
            
        Returns:
            Dictionary with updated lock info or error info
        """
        lock_filename = self._path_to_lock_filename(file_path)
        lock_file = self.locks_dir / lock_filename
        
        existing_lock = self._read_lock_file(lock_file)
        if not existing_lock:
            return {
                "success": False,
                "error": "Lock not found",
                "status_code": 404
            }
        
        # Verify ownership
        if existing_lock['lock_id'] != lock_id or existing_lock['owner'] != owner:
            return {
                "success": False,
                "error": "Invalid lock credentials",
                "status_code": 403
            }
        
        # Check if expired
        if self._is_lock_expired(existing_lock):
            # Remove expired lock
            try:
                lock_file.unlink()
            except OSError:
                pass
            return {
                "success": False,
                "error": "Lock has expired",
                "status_code": 410
            }
        
        # Update lock with new expiration
        now = datetime.utcnow()
        expires_at = now + timedelta(minutes=self.default_ttl_minutes)
        
        existing_lock.update({
            "expires_at": expires_at.isoformat() + "Z",
            "last_ping": now.isoformat() + "Z"
        })
        
        if self._write_lock_file(lock_file, existing_lock):
            logger.info(f"Lock refreshed for {file_path} by {owner}")
            return {
                "success": True,
                "lock_id": existing_lock["lock_id"],
                "expires_at": existing_lock["expires_at"],
                "status_code": 200
            }
        else:
            return {
                "success": False,
                "error": "Failed to refresh lock",
                "status_code": 500
            }
    
    def release_lock(self, file_path: str, lock_id: str, owner: str) -> Dict[str, Any]:
        """Release a lock.
        
        Args:
            file_path: Path to locked file
            lock_id: Lock identifier
            owner: Owner identifier
            
        Returns:
            Dictionary with result info
        """
        lock_filename = self._path_to_lock_filename(file_path)
        lock_file = self.locks_dir / lock_filename
        
        existing_lock = self._read_lock_file(lock_file)
        if not existing_lock:
            return {
                "success": False,
                "error": "Lock not found",
                "status_code": 404
            }
        
        # Verify ownership
        if existing_lock['lock_id'] != lock_id or existing_lock['owner'] != owner:
            return {
                "success": False,
                "error": "Invalid lock credentials",
                "status_code": 403
            }
        
        # Remove lock file
        try:
            lock_file.unlink()
            logger.info(f"Lock released for {file_path} by {owner}")
            return {
                "success": True,
                "status_code": 200
            }
        except OSError as e:
            logger.error(f"Failed to remove lock file {lock_file}: {e}")
            return {
                "success": False,
                "error": "Failed to release lock",
                "status_code": 500
            }
    
    def check_lock(self, file_path: str) -> Optional[Dict[str, Any]]:
        """Check if a file is locked.
        
        Args:
            file_path: Path to file to check
            
        Returns:
            Lock data if locked and valid, None otherwise
        """
        lock_filename = self._path_to_lock_filename(file_path)
        lock_file = self.locks_dir / lock_filename
        
        existing_lock = self._read_lock_file(lock_file)
        if not existing_lock:
            return None
        
        # Check if expired
        if self._is_lock_expired(existing_lock):
            # Remove expired lock
            try:
                lock_file.unlink()
                logger.info(f"Removed expired lock for {file_path}")
            except OSError:
                pass
            return None
        
        return existing_lock
    
    def cleanup_expired_locks(self) -> int:
        """Clean up all expired lock files.
        
        Returns:
            Number of locks cleaned up
        """
        cleaned_count = 0
        
        try:
            for lock_file in self.locks_dir.glob("*.lock"):
                lock_data = self._read_lock_file(lock_file)
                if lock_data and self._is_lock_expired(lock_data):
                    try:
                        lock_file.unlink()
                        cleaned_count += 1
                        logger.info(f"Cleaned up expired lock: {lock_file.name}")
                    except OSError as e:
                        logger.error(f"Failed to remove expired lock {lock_file}: {e}")
                        
        except OSError as e:
            logger.error(f"Failed to scan locks directory: {e}")
        
        if cleaned_count > 0:
            logger.info(f"Cleaned up {cleaned_count} expired locks")
            
        return cleaned_count


# Global instance
lock_service = FileLockService()
