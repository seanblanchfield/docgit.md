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

export interface DraftData {
  content: string;
  lastModified: string; // ISO timestamp
  lockExpiry?: string;   // ISO timestamp when associated lock expires
}

export class LockService {
  private currentLocks = new Map<string, string>(); // path -> lock_id
  private draftPrefix = 'draft:';
  private cleanupInterval: number | null = null;

  constructor() {
    // Start periodic cleanup every 2 minutes
    this.startPeriodicCleanup();
    
    // Clean up on page load
    this.cleanupExpiredDrafts();
  }

  /**
   * Clean up expired drafts from localStorage
   */
  private cleanupExpiredDrafts(): string[] {
    const now = new Date().toISOString();
    const expiredPaths: string[] = [];
    
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith(this.draftPrefix)) {
        const filePath = key.substring(this.draftPrefix.length);
        try {
          const draftItem = localStorage.getItem(key);
          if (!draftItem) continue;
          
          // Try to parse as enhanced draft format first
          let draft: DraftData;
          try {
            draft = JSON.parse(draftItem);
            // If it's a string (old format), convert it
            if (typeof draft === 'string') {
              draft = {
                content: draft,
                lastModified: new Date().toISOString()
              };
            }
          } catch {
            // Invalid JSON, treat as old string format
            draft = {
              content: draftItem,
              lastModified: new Date().toISOString()
            };
          }
          
          // Check if draft has expired
          if (draft.lockExpiry && draft.lockExpiry < now) {
            console.log(`[LOCK DEBUG] Cleaning up expired draft for: ${filePath}`);
            localStorage.removeItem(key);
            expiredPaths.push(filePath);
          }
        } catch (error) {
          console.warn(`[LOCK DEBUG] Error processing draft ${key}, removing:`, error);
          localStorage.removeItem(key);
          expiredPaths.push(filePath);
        }
      }
    }
    
    // Update modifiedFiles list to remove expired drafts
    if (expiredPaths.length > 0) {
      this.updateModifiedFiles(expiredPaths);
    }
    
    return expiredPaths;
  }

  /**
   * Update modifiedFiles localStorage to remove expired draft paths
   */
  private updateModifiedFiles(expiredPaths: string[]): void {
    try {
      const modifiedFiles = new Set<string>(JSON.parse(localStorage.getItem('modifiedFiles') || '[]'));
      let changed = false;
      
      for (const path of expiredPaths) {
        if (modifiedFiles.has(path)) {
          modifiedFiles.delete(path);
          changed = true;
        }
      }
      
      if (changed) {
        localStorage.setItem('modifiedFiles', JSON.stringify([...modifiedFiles]));
        console.log(`[LOCK DEBUG] Updated modifiedFiles, removed expired: ${expiredPaths.join(', ')}`);
      }
    } catch (error) {
      console.warn('[LOCK DEBUG] Error updating modifiedFiles:', error);
    }
  }

  /**
   * Check if current browser has a draft for the given file path
   */
  private hasDraftForFile(filePath: string): boolean {
    // Clean up expired drafts first
    this.cleanupExpiredDrafts();
    return localStorage.getItem(this.draftPrefix + filePath) !== null;
  }

  /**
   * Get draft data for a file, or null if no valid draft exists
   */
  getDraftData(filePath: string): DraftData | null {
    const draftItem = localStorage.getItem(this.draftPrefix + filePath);
    if (!draftItem) return null;
    
    try {
      const draft = JSON.parse(draftItem);
      // If it's a string (old format), convert it
      if (typeof draft === 'string') {
        return {
          content: draft,
          lastModified: new Date().toISOString()
        };
      }
      return draft as DraftData;
    } catch {
      // Invalid JSON, treat as old string format
      return {
        content: draftItem,
        lastModified: new Date().toISOString()
      };
    }
  }

  /**
   * Save draft data with expiry information
   */
  saveDraft(filePath: string, content: string, lockExpiry?: string): void {
    const draftData: DraftData = {
      content,
      lastModified: new Date().toISOString(),
      lockExpiry
    };
    
    localStorage.setItem(this.draftPrefix + filePath, JSON.stringify(draftData));
    console.log(`[LOCK DEBUG] Saved draft for ${filePath}${lockExpiry ? ` with expiry ${lockExpiry}` : ''}`);
  }

  /**
   * Check if a file is locked
   */
  async checkLockStatus(filePath: string): Promise<LockResponse> {
    try {
      // Encode each path segment separately to handle special characters
      const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
      const response = await fetch(`/api/lock/${encodedPath}`);
      if (response.ok) {
        return await response.json();
      } else if (response.status === 404) {
        return { locked: false };
      } else {
        console.error(`Failed to check lock status for ${filePath}:`, response.statusText);
        return { locked: false };
      }
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
      // Encode each path segment separately to handle special characters
      const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
      const response = await fetch(`/api/lock/${encodedPath}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ owner }),
      });

      if (response.ok) {
        const data = await response.json();
        this.currentLocks.set(filePath, data.lock_id);
        
        // Update any existing draft with lock expiry information
        const existingDraft = this.getDraftData(filePath);
        if (existingDraft) {
          this.saveDraft(filePath, existingDraft.content, data.expires_at);
        }
        
        return { success: true, lock_id: data.lock_id };
      } else if (response.status === 423) {
        const rawConflict = await response.json();
        // Handle nested detail structure from backend
        const conflict: LockConflictResponse = rawConflict.detail || rawConflict;
        return { success: false, conflict };
      } else {
        console.error(`Failed to acquire lock for ${filePath}:`, response.statusText);
        return { success: false };
      }
    } catch (error) {
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
      // Encode each path segment separately to handle special characters
      const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
      const response = await fetch(`/api/lock/${encodedPath}/ping`, {
        method: 'PUT',
        headers: {
          'X-Lock-ID': lockId,
        },
      });

      if (response.ok) {
        // Update draft expiry when lock is refreshed
        const existingDraft = this.getDraftData(filePath);
        if (existingDraft) {
          // Calculate new expiry (5 minutes from now, matching server TTL)
          const newExpiry = new Date(Date.now() + 5 * 60 * 1000).toISOString();
          this.saveDraft(filePath, existingDraft.content, newExpiry);
        }
        return true;
      } else {
        console.error(`Failed to refresh lock for ${filePath}:`, response.statusText);
        this.currentLocks.delete(filePath);
        return false;
      }
    } catch (error) {
      console.error(`Error refreshing lock for ${filePath}:`, error);
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
      // Encode each path segment separately to handle special characters
      const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
      const response = await fetch(`/api/lock/${encodedPath}`, {
        method: 'DELETE',
        headers: {
          'X-Lock-ID': lockId,
        },
      });

      if (response.ok) {
        this.currentLocks.delete(filePath);
        
        // Clear lock expiry from draft when lock is released (keep the draft but remove expiry)
        const existingDraft = this.getDraftData(filePath);
        if (existingDraft) {
          const updatedDraft: DraftData = {
            ...existingDraft,
            lockExpiry: undefined
          };
          localStorage.setItem(this.draftPrefix + filePath, JSON.stringify(updatedDraft));
        }
        
        return true;
      } else if (response.status === 404) {
        // Lock doesn't exist, which is fine - clean up our local state
        this.currentLocks.delete(filePath);
        
        // Also clear lock expiry from draft
        const existingDraft = this.getDraftData(filePath);
        if (existingDraft) {
          const updatedDraft: DraftData = {
            ...existingDraft,
            lockExpiry: undefined
          };
          localStorage.setItem(this.draftPrefix + filePath, JSON.stringify(updatedDraft));
        }
        
        return true;
      } else {
        console.error(`Failed to release lock for ${filePath}:`, response.statusText);
        return false;
      }
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
    if (lockStatus.locked && this.hasDraftForFile(filePath)) {
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
    if (lockStatus.locked && this.hasDraftForFile(filePath)) {
      // File is locked and we have a draft - we must own the lock
      // Add to our local tracking for future reference
      if (lockStatus.lock_info?.lock_id) {
        this.currentLocks.set(filePath, lockStatus.lock_info.lock_id);
      }
      return true;
    }
    
    return false;
  }

  /**
   * Start periodic cleanup of expired drafts
   */
  private startPeriodicCleanup(): void {
    // Clean up every 2 minutes
    this.cleanupInterval = window.setInterval(() => {
      const expiredCount = this.cleanupExpiredDrafts().length;
      if (expiredCount > 0) {
        console.log(`[LOCK DEBUG] Periodic cleanup removed ${expiredCount} expired drafts`);
      }
    }, 2 * 60 * 1000);
  }

  /**
   * Stop periodic cleanup (for cleanup when service is destroyed)
   */
  stopPeriodicCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Global lock service instance
export const lockService = new LockService();
