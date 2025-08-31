export interface DraftData {
  content: string;
  lastModified: string; // ISO timestamp
  lockExpiry?: string;   // ISO timestamp when associated lock expires
  baseCommitHash?: string; // Git commit hash when draft was created
}

class DraftService {
  private draftPrefix = 'draft:';
  private cleanupInterval: number | null = null;

  constructor() {
    this.startPeriodicCleanup();
    this.cleanupExpiredDrafts();
  }

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
          
          let draft: DraftData;
          try {
            draft = JSON.parse(draftItem);
            if (typeof draft === 'string') {
              draft = {
                content: draft,
                lastModified: new Date().toISOString()
              };
            }
          } catch {
            draft = {
              content: draftItem,
              lastModified: new Date().toISOString()
            };
          }
          
          if (draft.lockExpiry && draft.lockExpiry < now) {
            console.log(`[DRAFT DEBUG] Cleaning up expired draft for: ${filePath}`);
            localStorage.removeItem(key);
            expiredPaths.push(filePath);
          }
        } catch (error) {
          console.warn(`[DRAFT DEBUG] Error processing draft ${key}, removing:`, error);
          localStorage.removeItem(key);
          expiredPaths.push(filePath);
        }
      }
    }
    
    if (expiredPaths.length > 0) {
      this.updateModifiedFiles(expiredPaths);
    }
    
    return expiredPaths;
  }

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
        console.log(`[DRAFT DEBUG] Updated modifiedFiles, removed expired: ${expiredPaths.join(', ')}`);
      }
    } catch (error) {
      console.warn('[DRAFT DEBUG] Error updating modifiedFiles:', error);
    }
  }

  hasDraftForFile(filePath: string): boolean {
    this.cleanupExpiredDrafts();
    return localStorage.getItem(this.draftPrefix + filePath) !== null;
  }

  getDraftData(filePath: string): DraftData | null {
    const draftItem = localStorage.getItem(this.draftPrefix + filePath);
    if (!draftItem) return null;
    
    try {
      const draft = JSON.parse(draftItem);
      if (typeof draft === 'string') {
        return {
          content: draft,
          lastModified: new Date().toISOString()
        };
      }
      return draft as DraftData;
    } catch {
      return {
        content: draftItem,
        lastModified: new Date().toISOString()
      };
    }
  }

  saveDraft(filePath: string, content: string, lockExpiry?: string, baseCommitHash?: string): void {
    const draftData: DraftData = {
      content,
      lastModified: new Date().toISOString(),
      lockExpiry,
      baseCommitHash
    };
    
    localStorage.setItem(this.draftPrefix + filePath, JSON.stringify(draftData));
    console.log(`[DRAFT DEBUG] Saved draft for ${filePath}${lockExpiry ? ` with expiry ${lockExpiry}` : ''}${baseCommitHash ? ` with base commit ${baseCommitHash.substring(0, 8)}` : ''}`);
  }

  async checkDraftConflict(filePath: string, currentGitHash?: string): Promise<{ isStale: boolean; currentHash?: string; baseHash?: string }> {
    const draft = this.getDraftData(filePath);
    if (!draft || !draft.baseCommitHash) {
      return { isStale: false };
    }

    if (!currentGitHash) {
      console.warn('[DRAFT DEBUG] checkDraftConflict called without currentGitHash - cannot determine staleness');
      return { isStale: false };
    }

    const isStale = draft.baseCommitHash !== currentGitHash;
    return {
      isStale,
      currentHash: currentGitHash,
      baseHash: draft.baseCommitHash
    };
  }

  discardStaleDraft(filePath: string): void {
    localStorage.removeItem(this.draftPrefix + filePath);
    console.log(`[DRAFT DEBUG] Discarded stale draft for ${filePath}`);
    
    this.updateModifiedFiles([filePath]);
  }

  private startPeriodicCleanup(): void {
    this.cleanupInterval = window.setInterval(() => {
      const expiredCount = this.cleanupExpiredDrafts().length;
      if (expiredCount > 0) {
        console.log(`[DRAFT DEBUG] Periodic cleanup removed ${expiredCount} expired drafts`);
      }
    }, 2 * 60 * 1000);
  }

  stopPeriodicCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

export const draftService = new DraftService();
