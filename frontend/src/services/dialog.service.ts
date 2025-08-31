class DialogService {
  alert(message: string): Promise<void> {
    return new Promise(resolve => {
      this.confirm(message, ['OK']).then(() => resolve());
    });
  }

  confirm(message: string, buttonLabels: string[] = ['OK', 'Cancel']): Promise<string> {
    const dialog = this.getElement<HTMLDialogElement>('[data-id="generic-dialog"]');
    const messageEl = this.getElement<HTMLElement>('[data-id="dialog-message"]');
    const buttonsEl = this.getElement<HTMLElement>('[data-id="dialog-buttons"]');

    if (!dialog || !messageEl || !buttonsEl) {
      return Promise.reject('Dialog elements not found');
    }

    messageEl.textContent = message;
    buttonsEl.innerHTML = '';

    return new Promise(resolve => {
      const handlers: (() => void)[] = [];

      const cleanup = () => {
        handlers.forEach(h => h());
        dialog.close();
      };

      buttonLabels.forEach(label => {
        const button = document.createElement('button');
        button.textContent = label;
        button.classList.add('btn-secondary');
        if (label.toLowerCase() === 'delete' || label.toLowerCase() === 'discard') {
            button.classList.replace('btn-secondary', 'btn-danger');
        }
        if (label.toLowerCase() === 'save' || label.toLowerCase() === 'confirm' || label.toLowerCase() === 'ok') {
            button.classList.replace('btn-secondary', 'btn-primary');
        }

        const handler = () => {
          cleanup();
          resolve(label);
        };
        
        button.addEventListener('click', handler);
        buttonsEl.appendChild(button);
        handlers.push(() => button.removeEventListener('click', handler));
      });

      dialog.showModal();
    });
  }

  private getElement<T extends HTMLElement>(selector: string): T | null {
    return document.querySelector<T>(selector);
  }

  async confirmDiscard(): Promise<boolean> {
    const dialog = this.getElement<HTMLDialogElement>('[data-id="discard-dialog"]');
    if (!dialog) return false;

    return new Promise(resolve => {
      const confirmBtn = this.getElement<HTMLButtonElement>('[data-id="discard-confirm"]');
      const cancelBtn = this.getElement<HTMLButtonElement>('[data-id="discard-cancel"]');

      const onConfirm = () => {
        cleanup();
        resolve(true);
      };

      const onCancel = () => {
        cleanup();
        resolve(false);
      };

      const cleanup = () => {
        confirmBtn?.removeEventListener('click', onConfirm);
        cancelBtn?.removeEventListener('click', onCancel);
        dialog.close();
      };

      confirmBtn?.addEventListener('click', onConfirm, { once: true });
      cancelBtn?.addEventListener('click', onCancel, { once: true });

      dialog.showModal();
    });
  }

  async confirmDeleteFile(filePath: string): Promise<boolean> {
    const dialog = this.getElement<HTMLDialogElement>('[data-id="delete-dialog"]');
    const filePathEl = this.getElement<HTMLElement>('[data-id="delete-file-path"]');
    if (!dialog || !filePathEl) return false;

    filePathEl.textContent = filePath;

    return new Promise(resolve => {
      const confirmBtn = this.getElement<HTMLButtonElement>('[data-id="delete-confirm"]');
      const cancelBtn = this.getElement<HTMLButtonElement>('[data-id="delete-cancel"]');

      const onConfirm = () => {
        cleanup();
        resolve(true);
      };

      const onCancel = () => {
        cleanup();
        resolve(false);
      };

      const cleanup = () => {
        confirmBtn?.removeEventListener('click', onConfirm);
        cancelBtn?.removeEventListener('click', onCancel);
        dialog.close();
      };

      confirmBtn?.addEventListener('click', onConfirm, { once: true });
      cancelBtn?.addEventListener('click', onCancel, { once: true });

      dialog.showModal();
    });
  }

  async confirmDeleteDirectory(directoryPath: string): Promise<boolean> {
    const dialog = this.getElement<HTMLDialogElement>('[data-id="delete-directory-dialog"]');
    const pathEl = this.getElement<HTMLElement>('[data-id="delete-directory-path"]');
    const realPathEl = this.getElement<HTMLInputElement>('[data-id="delete-directory-real-path"]');

    if (!dialog || !pathEl || !realPathEl) return false;

    pathEl.textContent = directoryPath;
    realPathEl.value = directoryPath;

    return new Promise(resolve => {
      const confirmBtn = this.getElement<HTMLButtonElement>('[data-id="delete-directory-confirm"]');
      const cancelBtn = this.getElement<HTMLButtonElement>('[data-id="delete-directory-cancel"]');

      const onConfirm = () => {
        cleanup();
        resolve(true);
      };

      const onCancel = () => {
        cleanup();
        resolve(false);
      };

      const cleanup = () => {
        confirmBtn?.removeEventListener('click', onConfirm);
        cancelBtn?.removeEventListener('click', onCancel);
        dialog.close();
      };

      confirmBtn?.addEventListener('click', onConfirm, { once: true });
      cancelBtn?.addEventListener('click', onCancel, { once: true });

      dialog.showModal();
    });
  }
}

export const dialogService = new DialogService();
