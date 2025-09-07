import { TreeNode } from '../../tree/types';

export interface MoveConfirmationData {
  sourceNode: TreeNode;
  targetNode: TreeNode;
  dropPosition: 'before' | 'after' | 'inside';
}

export class ConfirmMoveDialog {
  private dialog: HTMLElement | null = null;
  private onConfirm: ((data: MoveConfirmationData) => void) | null = null;
  private onCancel: (() => void) | null = null;

  public show(
    data: MoveConfirmationData,
    onConfirm: (data: MoveConfirmationData) => void,
    onCancel: () => void
  ): void {
    this.onConfirm = onConfirm;
    this.onCancel = onCancel;
    
    this.createDialog(data);
    this.attachEventListeners();
    document.body.appendChild(this.dialog!);
    
    // Focus the dialog for accessibility
    this.dialog!.focus();
  }

  private createDialog(data: MoveConfirmationData): void {
    const { sourceNode, targetNode, dropPosition } = data;
    
    // Create dialog container
    this.dialog = document.createElement('div');
    this.dialog.className = 'confirm-move-dialog-overlay';
    this.dialog.setAttribute('role', 'dialog');
    this.dialog.setAttribute('aria-modal', 'true');
    this.dialog.setAttribute('aria-labelledby', 'confirm-move-title');
    this.dialog.setAttribute('tabindex', '-1');

    // Generate move description
    const moveDescription = this.generateMoveDescription(sourceNode, targetNode, dropPosition);
    const sourcePath = this.formatPath(sourceNode.id);

    this.dialog.innerHTML = `
      <div class="confirm-move-dialog">
        <div class="confirm-move-header">
          <h3 id="confirm-move-title">Confirm Move</h3>
          <button class="confirm-move-close" aria-label="Close dialog">&times;</button>
        </div>
        
        <div class="confirm-move-content">
          <div class="move-description">
            <p>${moveDescription}</p>
          </div>
          
          <div class="move-details">
            <div class="move-detail-row">
              <span class="move-detail-label">From:</span>
              <span class="move-detail-path">${sourcePath}</span>
            </div>
            <div class="move-detail-row">
              <span class="move-detail-label">To:</span>
              <span class="move-detail-path">${this.getTargetDescription(targetNode, dropPosition)}</span>
            </div>
          </div>
          
          <div class="move-warning">
            <div class="warning-icon">⚠️</div>
            <div class="warning-text">
              This action will move the ${sourceNode.isDirectory ? 'directory' : 'file'} and update its position in the tree. 
              This change will be tracked in Git.
            </div>
          </div>
        </div>
        
        <div class="confirm-move-actions">
          <button class="confirm-move-cancel">Cancel</button>
          <button class="confirm-move-confirm">Move ${sourceNode.isDirectory ? 'Directory' : 'File'}</button>
        </div>
      </div>
    `;
  }

  private generateMoveDescription(sourceNode: TreeNode, targetNode: TreeNode, dropPosition: 'before' | 'after' | 'inside'): string {
    const itemType = sourceNode.isDirectory ? 'directory' : 'file';
    const sourceName = `<strong>${sourceNode.name}</strong>`;
    const targetName = `<strong>${targetNode.name}</strong>`;

    switch (dropPosition) {
      case 'before':
        return `Move ${itemType} ${sourceName} to appear before ${targetName}`;
      case 'after':
        return `Move ${itemType} ${sourceName} to appear after ${targetName}`;
      case 'inside':
        return `Move ${itemType} ${sourceName} into directory ${targetName}`;
      default:
        return `Move ${itemType} ${sourceName}`;
    }
  }

  private getTargetDescription(targetNode: TreeNode, dropPosition: 'before' | 'after' | 'inside'): string {
    const targetPath = this.formatPath(targetNode.id);
    
    switch (dropPosition) {
      case 'before':
        return `Before ${targetPath}`;
      case 'after':
        return `After ${targetPath}`;
      case 'inside':
        return `Inside ${targetPath}/`;
      default:
        return targetPath;
    }
  }

  private formatPath(path: string): string {
    // Remove leading slash and make it more readable
    return path.startsWith('/') ? path.substring(1) : path;
  }

  private attachEventListeners(): void {
    if (!this.dialog) return;

    // Close button
    const closeButton = this.dialog.querySelector('.confirm-move-close') as HTMLElement;
    closeButton?.addEventListener('click', () => this.handleCancel());

    // Cancel button
    const cancelButton = this.dialog.querySelector('.confirm-move-cancel') as HTMLElement;
    cancelButton?.addEventListener('click', () => this.handleCancel());

    // Confirm button
    const confirmButton = this.dialog.querySelector('.confirm-move-confirm') as HTMLElement;
    confirmButton?.addEventListener('click', () => this.handleConfirm());

    // Overlay click (close on click outside)
    this.dialog.addEventListener('click', (event) => {
      if (event.target === this.dialog) {
        this.handleCancel();
      }
    });

    // Keyboard navigation
    this.dialog.addEventListener('keydown', (event) => {
      switch (event.key) {
        case 'Escape':
          event.preventDefault();
          this.handleCancel();
          break;
        case 'Enter':
          event.preventDefault();
          this.handleConfirm();
          break;
        case 'Tab':
          this.handleTabNavigation(event);
          break;
      }
    });
  }

  private handleTabNavigation(event: KeyboardEvent): void {
    if (!this.dialog) return;

    const focusableElements = this.dialog.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as NodeListOf<HTMLElement>;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (!firstElement || !lastElement) return;

    if (event.shiftKey) {
      // Shift + Tab (backward)
      if (document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }
    } else {
      // Tab (forward)
      if (document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }
  }

  private handleConfirm(): void {
    if (this.onConfirm) {
      // Get the data from the dialog (we'll need to store it)
      const data = (this.dialog as any)?._moveData;
      if (data) {
        this.onConfirm(data);
      }
    }
    this.close();
  }

  private handleCancel(): void {
    if (this.onCancel) {
      this.onCancel();
    }
    this.close();
  }

  private close(): void {
    if (this.dialog && this.dialog.parentNode) {
      this.dialog.parentNode.removeChild(this.dialog);
    }
    this.dialog = null;
    this.onConfirm = null;
    this.onCancel = null;
  }

  // Store the move data with the dialog for later retrieval
  public setMoveData(data: MoveConfirmationData): void {
    if (this.dialog) {
      (this.dialog as any)._moveData = data;
    }
  }
}
