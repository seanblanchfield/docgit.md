import { apiService } from './api.service';
import { draftService } from './draft.service';

// Lock management service for frontend
export interface LockInfo {
  path: string;
  lock_id: string;
  owner: string;
  acquired_at: string;
  expires_at: string;
}

export interface LockResponse {
  locked: boolean;
  lock_info?: LockInfo;
}

export interface LockConflictResponse {
  detail: string;
  lock_info: LockInfo;
}

class LockService {
  private currentLocks = new Map<string, string>();

  /**
   * Check if a file is locked
   */
  async checkLockStatus(filePath: string): Promise<LockResponse> {
    try {
      return await apiService.checkLockStatus(filePath);
    } catch (error) {
      console.error(`Error checking lock status for ${filePath}:`, error);
      return { locked: false };
    }
  }

  /**
   * Acquire a lock for a file
   */
  async acquireLock(filePath: string, owner: string): Promise<{ success: boolean; lock_id?: string; conflict?: LockConflictResponse }> {
    try {
      const data = await apiService.acquireLock(filePath, owner);
      this.currentLocks.set(filePath, data.lock_id);
      
      const existingDraft = draftService.getDraftData(filePath);
      if (existingDraft) {
        draftService.saveDraft(filePath, existingDraft.content, data.expires_at, existingDraft.baseCommitHash);
      }
      
      return { success: true, lock_id: data.lock_id };
    } catch (error: any) {
      if (error.status === 423) {
        const conflict: LockConflictResponse = error.data.detail || error.data;
        return { success: false, conflict };
      }
      console.error(`Error acquiring lock for ${filePath}:`, error);
      return { success: false };
    }
  }

  /**
   * Refresh an existing lock
   */
  async refreshLock(filePath: string): Promise<boolean> {
    const lockId = this.currentLocks.get(filePath);
    if (!lockId) {
      console.warn(`No lock ID found for ${filePath}`);
      return false;
    }

    try {
      await apiService.refreshLock(filePath, lockId);
      const existingDraft = draftService.getDraftData(filePath);
      if (existingDraft) {
        const newExpiry = new Date(Date.now() + 5 * 60 * 1000).toISOString();
        draftService.saveDraft(filePath, existingDraft.content, newExpiry, existingDraft.baseCommitHash);
      }
      return true;
    } catch (error) {
      console.error(`Error refreshing lock for ${filePath}:`, error);
      this.currentLocks.delete(filePath);
      return false;
    }
  }

  /**
   * Release a lock
   */
  async releaseLock(filePath: string): Promise<boolean> {
    const lockId = this.currentLocks.get(filePath);
    if (!lockId) {
      console.warn(`No lock ID found for ${filePath}`);
      return false;
    }

    try {
      await apiService.releaseLock(filePath, lockId);
      this.currentLocks.delete(filePath);

      const existingDraft = draftService.getDraftData(filePath);
      if (existingDraft) {
        draftService.saveDraft(filePath, existingDraft.content, undefined, existingDraft.baseCommitHash);
      }
      return true;
    } catch (error) {
      console.error(`Error releasing lock for ${filePath}:`, error);
      return false;
    }
  }

  /**
   * Check if we own the lock for a file
   * Uses implicit detection: if file is locked and we have a local draft, we own it
   */
  async hasLockImplicit(filePath: string): Promise<boolean> {
    // First check explicit tracking
    if (this.currentLocks.has(filePath)) {
      return true;
    }
    
    // Check implicit ownership via localStorage draft
    const lockStatus = await this.checkLockStatus(filePath);
    if (lockStatus.locked && draftService.hasDraftForFile(filePath)) {
      // File is locked and we have a draft - we must own the lock
      return true;
    }
    
    return false;
  }

  /**
   * Check if we own the lock for a file (synchronous version for backward compatibility)
   */
  hasLock(filePath: string): boolean {
    return this.currentLocks.has(filePath);
  }

  /**
   * Start auto-refresh for a lock (call every 4 minutes to keep 5-minute TTL)
   */
  startAutoRefresh(filePath: string): () => void {
    const interval = setInterval(async () => {
      const success = await this.refreshLock(filePath);
      if (!success) {
        clearInterval(interval);
        this.onLockLost?.(filePath);
      }
    }, 4 * 60 * 1000); // 4 minutes

    return () => clearInterval(interval);
  }

  /**
   * Callback for when a lock is lost (expired or released by server)
   */
  onLockLost?: (filePath: string) => void;

  /**
   * Get the current lock ID for a file
   */
  getCurrentLockId(filePath: string): string | null {
    return this.currentLocks.get(filePath) || null;
  }

  /**
   * Check if a locked file is owned by current session (with implicit detection)
   */
  async isOwnedByCurrentSession(filePath: string): Promise<boolean> {
    // First check explicit tracking
    if (this.currentLocks.has(filePath)) {
      return true;
    }
    
    // Check implicit ownership via localStorage draft
    const lockStatus = await this.checkLockStatus(filePath);
    if (lockStatus.locked && draftService.hasDraftForFile(filePath)) {
      // File is locked and we have a draft - we must own the lock
      // Add to our local tracking for future reference
      if (lockStatus.lock_info?.lock_id) {
        this.currentLocks.set(filePath, lockStatus.lock_info.lock_id);
      }
      return true;
    }
    
    return false;
  }
}

// Global lock service instance
export const lockService = new LockService();
