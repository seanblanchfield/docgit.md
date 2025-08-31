export type NotificationType = 'lock-conflict' | 'lock-lost' | 'save-error' | 'success' | 'error' | 'info';

interface LockConflict {
  detail: {
    lock_info: {
      owner: string;
    }
  }
}

class NotificationService {
  private notificationContainer: HTMLElement | null = null;

  init(): void {
    const containerId = 'notification-container';
    if (document.getElementById(containerId)) return;

    const container = document.createElement('div');
    container.id = containerId;
    container.className = containerId;
    document.body.appendChild(container);
    this.notificationContainer = container;
  }

  showNotification(type: NotificationType, title: string, message: string): void {
    if (!this.notificationContainer) {
      this.init();
    }

    const notification = document.createElement('div');
    notification.className = `notification ${type}-notification`;
    notification.innerHTML = `
      <div class="notification-content">
        <strong>${title}</strong><br>
        ${message}
      </div>
    `;

    this.notificationContainer!.appendChild(notification);

    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 5000);
  }

  showError(title: string, message: string): void {
    this.showNotification('error', title, message);
  }

  showLockConflictNotification(conflict: LockConflict): void {
    const message = `File is locked by ${conflict.detail.lock_info.owner}. You cannot edit this file until the lock is released.`;
    this.showNotification('lock-conflict', 'File Locked', message);
  }
}

export const notificationService = new NotificationService();
