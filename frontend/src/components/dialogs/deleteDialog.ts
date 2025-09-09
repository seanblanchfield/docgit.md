import { TreeNode } from '../../tree/types';

export interface DeleteDialogOptions {
  onConfirm: (node: TreeNode) => Promise<void>;
  onCancel?: () => void;
}

export class DeleteDialog {
  private dialog: HTMLElement | null = null;
  private overlay: HTMLElement | null = null;
  private currentNode: TreeNode | null = null;
  private options: DeleteDialogOptions;

  constructor(options: DeleteDialogOptions) {
    this.options = options;
  }

  public show(node: TreeNode): void {
    this.currentNode = node;
    this.createDialog();
  }

  public hide(): void {
    // Restore pointer events when dialog closes
    document.body.style.pointerEvents = '';
    
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    if (this.dialog) {
      this.dialog.remove();
      this.dialog = null;
    }
    this.currentNode = null;
  }

  private createDialog(): void {
    if (!this.currentNode) return;

    // Create overlay
    this.overlay = document.createElement('div');
    this.overlay.className = 'dialog-overlay';
    this.overlay.style.position = 'fixed';
    this.overlay.style.top = '0';
    this.overlay.style.left = '0';
    this.overlay.style.width = '100%';
    this.overlay.style.height = '100%';
    this.overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    this.overlay.style.zIndex = '10003';
    this.overlay.style.display = 'flex';
    this.overlay.style.alignItems = 'center';
    this.overlay.style.justifyContent = 'center';

    // Create dialog
    this.dialog = document.createElement('div');
    this.dialog.className = 'delete-dialog';
    this.dialog.style.backgroundColor = 'white';
    this.dialog.style.borderRadius = '8px';
    this.dialog.style.padding = '24px';
    this.dialog.style.minWidth = '400px';
    this.dialog.style.maxWidth = '500px';
    this.dialog.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';

    // Create title
    const title = document.createElement('h3');
    title.textContent = `Delete ${this.currentNode.isDirectory ? 'Directory' : 'File'}`;
    title.style.margin = '0 0 16px 0';
    title.style.fontSize = '18px';
    title.style.fontWeight = '600';
    title.style.color = '#dc3545';
    this.dialog.appendChild(title);

    // Create warning message
    const warningMessage = document.createElement('div');
    warningMessage.style.marginBottom = '16px';
    warningMessage.style.padding = '12px';
    warningMessage.style.backgroundColor = '#fff3cd';
    warningMessage.style.border = '1px solid #ffeaa7';
    warningMessage.style.borderRadius = '4px';
    warningMessage.style.fontSize = '14px';

    const itemType = this.currentNode.isDirectory ? 'directory' : 'file';
    warningMessage.innerHTML = `
      <div style="display: flex; align-items: flex-start; gap: 8px;">
        <span style="color: #856404; font-size: 16px;">⚠️</span>
        <div>
          <strong>Are you sure you want to delete this ${itemType}?</strong><br>
          <span style="font-family: monospace; background: rgba(0,0,0,0.1); padding: 2px 4px; border-radius: 2px;">${this.currentNode.name}</span>
          ${this.currentNode.isDirectory ? '<br><em>This will delete the directory and all its contents.</em>' : ''}
          <br><br>
          <strong>This action cannot be undone.</strong> The ${itemType} will be permanently removed and the change will be committed to Git.
        </div>
      </div>
    `;
    this.dialog.appendChild(warningMessage);

    // Create button container
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '12px';
    buttonContainer.style.justifyContent = 'flex-end';

    // Create cancel button
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.style.padding = '8px 16px';
    cancelButton.style.border = '1px solid #ddd';
    cancelButton.style.borderRadius = '4px';
    cancelButton.style.backgroundColor = 'white';
    cancelButton.style.cursor = 'pointer';
    cancelButton.style.fontSize = '14px';

    cancelButton.addEventListener('click', () => {
      this.hide();
      if (this.options.onCancel) {
        this.options.onCancel();
      }
    });

    // Create delete button
    const deleteButton = document.createElement('button');
    deleteButton.textContent = `Delete ${this.currentNode.isDirectory ? 'Directory' : 'File'}`;
    deleteButton.style.padding = '8px 16px';
    deleteButton.style.border = 'none';
    deleteButton.style.borderRadius = '4px';
    deleteButton.style.backgroundColor = '#dc3545';
    deleteButton.style.color = 'white';
    deleteButton.style.cursor = 'pointer';
    deleteButton.style.fontSize = '14px';

    const handleDelete = async () => {
      if (this.currentNode) {
        try {
          deleteButton.disabled = true;
          deleteButton.textContent = 'Deleting...';
          deleteButton.style.backgroundColor = '#c82333';
          
          await this.options.onConfirm(this.currentNode);
          this.hide();
        } catch (error) {
          deleteButton.disabled = false;
          deleteButton.textContent = `Delete ${this.currentNode.isDirectory ? 'Directory' : 'File'}`;
          deleteButton.style.backgroundColor = '#dc3545';
          
          // Show error message
          const errorDiv = document.createElement('div');
          errorDiv.style.color = '#dc3545';
          errorDiv.style.fontSize = '12px';
          errorDiv.style.marginTop = '8px';
          errorDiv.textContent = error instanceof Error ? error.message : 'Failed to delete item';
          buttonContainer.parentNode?.insertBefore(errorDiv, buttonContainer);
        }
      }
    };

    deleteButton.addEventListener('click', handleDelete);

    // Handle keyboard events
    this.overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.hide();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleDelete();
      }
    });

    buttonContainer.appendChild(cancelButton);
    buttonContainer.appendChild(deleteButton);
    this.dialog.appendChild(buttonContainer);

    // Add dialog to overlay
    this.overlay.appendChild(this.dialog);

    // Add to DOM and focus
    document.body.appendChild(this.overlay);
    
    // Ensure dialog is above all other elements
    this.overlay.style.pointerEvents = 'auto';
    this.dialog.style.pointerEvents = 'auto';
    
    deleteButton.focus();

    // Handle overlay click
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.hide();
      }
    });
  }
}
