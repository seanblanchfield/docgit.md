import { LockConflictResponse } from './lock';
import { appState, setMode } from '../state/appState';

export type NotificationType = 'lock-conflict' | 'lock-lost' | 'save-error' | 'success' | 'info' | 'warning';

class NotificationService {
  show(type: NotificationType, title: string, message: string, duration: number = 5000): void {
    const notification = document.createElement('div');
    notification.className = `${type}-notification`;
    notification.innerHTML = `
      <div class="notification-content">
        <strong>${title}</strong><br>
        ${message}
      </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, duration);
  }

  showLockConflict(conflict: LockConflictResponse): void {
    const owner = conflict?.lock_info?.owner || 'another user';
    const message = `File is locked by ${owner}. You cannot edit this file until the lock is released.`;
    this.show('lock-conflict', 'File Locked', message);
  }

  showLockLost(filePath: string): void {
    this.show(
      'lock-lost',
      'Lock Lost',
      `The lock for ${filePath} was lost. Your changes are saved as a draft.`
    );
    if (appState.currentFilePath === filePath) {
      setMode('read');
    }
  }

  showSaveError(error: Error | string): void {
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    this.show('save-error', 'Save Failed', message);
  }

  showSuccess(title: string, message: string): void {
    this.show('success', title, message);
  }
}

export const notificationService = new NotificationService();
