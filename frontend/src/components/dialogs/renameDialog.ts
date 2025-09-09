import { TreeNode } from '../../tree/types';

export interface RenameDialogOptions {
  onConfirm: (node: TreeNode, newName: string) => Promise<void>;
  onCancel?: () => void;
}

export class RenameDialog {
  private dialog: HTMLElement | null = null;
  private overlay: HTMLElement | null = null;
  private currentNode: TreeNode | null = null;
  private options: RenameDialogOptions;

  constructor(options: RenameDialogOptions) {
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
    this.overlay.style.zIndex = '10002';
    this.overlay.style.display = 'flex';
    this.overlay.style.alignItems = 'center';
    this.overlay.style.justifyContent = 'center';

    // Create dialog
    this.dialog = document.createElement('div');
    this.dialog.className = 'rename-dialog';
    this.dialog.style.backgroundColor = 'white';
    this.dialog.style.borderRadius = '8px';
    this.dialog.style.padding = '24px';
    this.dialog.style.minWidth = '400px';
    this.dialog.style.maxWidth = '500px';
    this.dialog.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';

    // Create title
    const title = document.createElement('h3');
    title.textContent = 'Rename Item';
    title.style.margin = '0 0 16px 0';
    title.style.fontSize = '18px';
    title.style.fontWeight = '600';
    this.dialog.appendChild(title);

    // Create current name display
    const currentNameLabel = document.createElement('div');
    currentNameLabel.textContent = 'Current name:';
    currentNameLabel.style.fontSize = '14px';
    currentNameLabel.style.color = '#666';
    currentNameLabel.style.marginBottom = '4px';
    this.dialog.appendChild(currentNameLabel);

    const currentNameValue = document.createElement('div');
    currentNameValue.textContent = this.currentNode.name;
    currentNameValue.style.fontSize = '14px';
    currentNameValue.style.fontWeight = '500';
    currentNameValue.style.marginBottom = '16px';
    currentNameValue.style.padding = '8px';
    currentNameValue.style.backgroundColor = '#f5f5f5';
    currentNameValue.style.borderRadius = '4px';
    this.dialog.appendChild(currentNameValue);

    // Create input label
    const inputLabel = document.createElement('label');
    inputLabel.textContent = 'New name:';
    inputLabel.style.display = 'block';
    inputLabel.style.fontSize = '14px';
    inputLabel.style.fontWeight = '500';
    inputLabel.style.marginBottom = '8px';
    this.dialog.appendChild(inputLabel);

    // Create input field
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'rename-input';
    input.value = this.extractEditableName(this.currentNode.name);
    input.style.width = '100%';
    input.style.padding = '8px 12px';
    input.style.border = '1px solid #ddd';
    input.style.borderRadius = '4px';
    input.style.fontSize = '14px';
    input.style.marginBottom = '8px';
    input.style.boxSizing = 'border-box';

    // Create validation message
    const validationMessage = document.createElement('div');
    validationMessage.className = 'validation-message';
    validationMessage.style.fontSize = '12px';
    validationMessage.style.color = '#e74c3c';
    validationMessage.style.marginBottom = '16px';
    validationMessage.style.minHeight = '16px';
    this.dialog.appendChild(validationMessage);

    // Input validation
    input.addEventListener('input', () => {
      const newName = input.value.trim();
      const validation = this.validateName(newName);
      validationMessage.textContent = validation.error || '';
      
      if (validation.isValid) {
        input.style.borderColor = '#ddd';
        validationMessage.style.color = '#e74c3c';
      } else {
        input.style.borderColor = '#e74c3c';
      }
    });

    this.dialog.appendChild(input);

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

    // Create confirm button
    const confirmButton = document.createElement('button');
    confirmButton.textContent = 'Rename';
    confirmButton.style.padding = '8px 16px';
    confirmButton.style.border = 'none';
    confirmButton.style.borderRadius = '4px';
    confirmButton.style.backgroundColor = '#007bff';
    confirmButton.style.color = 'white';
    confirmButton.style.cursor = 'pointer';
    confirmButton.style.fontSize = '14px';

    const handleConfirm = async () => {
      const newName = input.value.trim();
      const validation = this.validateName(newName);
      
      if (!validation.isValid) {
        validationMessage.textContent = validation.error ?? 'Invalid name';
        return;
      }

      if (this.currentNode && newName !== this.extractEditableName(this.currentNode.name)) {
        try {
          confirmButton.disabled = true;
          confirmButton.textContent = 'Renaming...';
          
          const finalName = this.constructFinalName(this.currentNode.name, newName);
          await this.options.onConfirm(this.currentNode, finalName);
          this.hide();
        } catch (error) {
          confirmButton.disabled = false;
          confirmButton.textContent = 'Rename';
          validationMessage.textContent = error instanceof Error ? error.message : 'Failed to rename item';
        }
      } else {
        this.hide();
      }
    };

    confirmButton.addEventListener('click', handleConfirm);

    // Handle Enter key
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirm();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.hide();
      }
    });

    buttonContainer.appendChild(cancelButton);
    buttonContainer.appendChild(confirmButton);
    this.dialog.appendChild(buttonContainer);

    // Add dialog to overlay
    this.overlay.appendChild(this.dialog);

    // Add to DOM and focus input
    document.body.appendChild(this.overlay);
    
    // Ensure dialog is above all other elements
    this.overlay.style.pointerEvents = 'auto';
    this.dialog.style.pointerEvents = 'auto';
    
    input.focus();
    input.select();

    // Handle overlay click
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.hide();
      }
    });
  }

  private extractEditableName(fullName: string): string {
    // Extract the editable part after numerical prefix
    // e.g., "001_my_document.md" -> "my_document.md"
    const match = fullName.match(/^(\d+_)(.+)$/);
    return match?.[2] ?? fullName;
  }

  private constructFinalName(originalName: string, newEditableName: string): string {
    // Preserve numerical prefix if it exists
    const match = originalName.match(/^(\d+_)(.+)$/);
    return match ? `${match[1]}${newEditableName}` : newEditableName;
  }

  private validateName(name: string): { isValid: boolean; error?: string } {
    if (!name) {
      return { isValid: false, error: 'Name cannot be empty' };
    }

    // Check for invalid characters
    const invalidChars = ['/', '\\', ':', '*', '?', '"', '<', '>', '|'];
    const foundInvalidChar = invalidChars.find(char => name.includes(char));
    if (foundInvalidChar) {
      return { 
        isValid: false, 
        error: `Invalid character "${foundInvalidChar}". Cannot contain: ${invalidChars.join(', ')}` 
      };
    }

    // Check for reserved names (Windows)
    const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
    const nameWithoutExt = name.split('.')[0]?.toUpperCase() ?? '';
    if (reservedNames.includes(nameWithoutExt)) {
      return { isValid: false, error: `"${name}" is a reserved name` };
    }

    return { isValid: true };
  }
}
