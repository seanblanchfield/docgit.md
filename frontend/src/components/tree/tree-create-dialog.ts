interface CreateResult {
  name: string;
  type: 'file' | 'directory';
}

class TreeCreateDialog {
  private getElement<T extends HTMLElement>(selector: string): T | null {
    return document.querySelector<T>(selector);
  }

  show(): Promise<CreateResult | null> {
    const dialog = this.getElement<HTMLDialogElement>('[data-id="create-item-dialog"]');
    if (!dialog) {
      return Promise.resolve(null);
    }

    const nameInput = this.getElement<HTMLInputElement>('[data-id="create-item-name"]');
    const confirmBtn = this.getElement<HTMLButtonElement>('[data-id="create-item-confirm"]');
    const cancelBtn = this.getElement<HTMLButtonElement>('[data-id="create-item-cancel"]');
    const form = dialog.querySelector('form');

    return new Promise(resolve => {
      const onConfirm = (event: Event) => {
        event.preventDefault();
        const name = nameInput?.value.trim();
        const type = this.getElement<HTMLInputElement>('input[name="item-type"]:checked')?.value as 'file' | 'directory';
        
        if (name && type) {
          cleanup();
          resolve({ name, type });
        } else {
          // Maybe show an error message if the name is empty
          nameInput?.focus();
        }
      };

      const onCancel = () => {
        cleanup();
        resolve(null);
      };

      const cleanup = () => {
        form?.removeEventListener('submit', onConfirm);
        confirmBtn?.removeEventListener('click', onConfirm); // Also listen on button click
        cancelBtn?.removeEventListener('click', onCancel);
        if (nameInput) nameInput.value = '';
        dialog.close();
      };
      
      if (!form || !confirmBtn || !cancelBtn || !nameInput) {
        return resolve(null);
      }

      // Handle form submission via enter key or create button
      form.addEventListener('submit', onConfirm);
      confirmBtn.addEventListener('click', onConfirm);
      cancelBtn.addEventListener('click', onCancel);
      
      dialog.showModal();
      nameInput.focus();
    });
  }
}

export const treeCreateDialog = new TreeCreateDialog();
