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

export class LockService {
  private currentLocks = new Map<string, string>(); // path -> lock_id

  /**
   * Check if a file is locked
   */
  async checkLockStatus(filePath: string): Promise<LockResponse> {
    try {
      const response = await fetch(`/api/lock/${encodeURIComponent(filePath)}`);
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
      const response = await fetch(`/api/lock/${encodeURIComponent(filePath)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ owner }),
      });

      if (response.ok) {
        const data = await response.json();
        this.currentLocks.set(filePath, data.lock_id);
        return { success: true, lock_id: data.lock_id };
      } else if (response.status === 423) {
        const conflict: LockConflictResponse = await response.json();
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
      const response = await fetch(`/api/lock/${encodeURIComponent(filePath)}/ping`, {
        method: 'PUT',
        headers: {
          'X-Lock-ID': lockId,
        },
      });

      if (response.ok) {
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
      const response = await fetch(`/api/lock/${encodeURIComponent(filePath)}`, {
        method: 'DELETE',
        headers: {
          'X-Lock-ID': lockId,
        },
      });

      if (response.ok) {
        this.currentLocks.delete(filePath);
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
}

// Global lock service instance
export const lockService = new LockService();
