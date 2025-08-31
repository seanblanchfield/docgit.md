import { directoryTree, contentEditor } from '../instances';
import { appState, setCurrentFile } from '../state/app.state';
import { lockService } from '../services/lock';
import { apiService } from '../services/api.service';
import { notificationService } from '../services/notification.service';

export function setupDialogs() {
  // Discard dialog
  const discardDialog = document.querySelector('[data-id="discard-dialog"]') as HTMLDialogElement | null;
  const discardConfirmBtn = document.querySelector('[data-id="discard-confirm"]') as HTMLButtonElement | null;
  const discardCancelBtn = document.querySelector('[data-id="discard-cancel"]') as HTMLButtonElement | null;

  document.querySelector('[data-id="discard-btn"]')?.addEventListener('click', () => {
    if (!appState.isDirty || !discardDialog) return;
    discardDialog.showModal();
  });

  discardConfirmBtn?.addEventListener('click', async () => {
    if (!appState.currentFilePath) return;
    try {
      contentEditor.replaceContent(appState.baselineMarkdown);
      // Also update raw textarea if it exists
      const rawTextarea = document.getElementById('raw-editor') as HTMLTextAreaElement;
      if (rawTextarea) rawTextarea.value = appState.baselineMarkdown;

      await lockService.releaseLock(appState.currentFilePath);
      
      setCurrentFile(appState.currentFilePath, appState.baselineMarkdown, appState.currentFileGitHash);
      
      // Clean up draft from local storage via lockService
      // This assumes lockService has a method to clear drafts.
      // We may need to add this.
      
      discardDialog?.close();
      console.log('[DISCARD] Reverted', appState.currentFilePath, 'to baseline');
    } catch (error) {
      console.error('[DISCARD] Error:', error);
    }
  });

  discardCancelBtn?.addEventListener('click', () => {
    discardDialog?.close();
  });

  // Delete file dialog
  const deleteDialog = document.querySelector('[data-id="delete-dialog"]') as HTMLDialogElement | null;
  const deleteFilePathEl = document.querySelector('[data-id="delete-file-path"]') as HTMLElement | null;
  const deleteCancelBtn = document.querySelector('[data-id="delete-cancel"]') as HTMLButtonElement | null;
  const deleteConfirmBtn = document.querySelector('[data-id="delete-confirm"]') as HTMLButtonElement | null;

  document.querySelector('[data-id="delete-btn"]')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelector('[data-id="overflow-dropdown"]')?.classList.add('hidden');
    if (!appState.currentFilePath) return;
    if (deleteDialog && deleteFilePathEl) {
      deleteFilePathEl.textContent = appState.currentFilePath;
      deleteDialog.showModal();
    }
  });

  deleteCancelBtn?.addEventListener('click', () => {
    deleteDialog?.close();
  });

  deleteConfirmBtn?.addEventListener('click', async () => {
    if (!appState.currentFilePath || !deleteDialog) return;
    
    try {
      deleteDialog.close();
      const response = await apiService.deleteFile(appState.currentFilePath);
      
      if (response.ok) {
        notificationService.showSuccess('File Deleted', 'File deleted successfully');
        setCurrentFile(null, '# Welcome to Markdown Wiki\n\nSelect a file from the sidebar to edit.', null);
        contentEditor.replaceContent(appState.currentMarkdown);
        const parentDir = appState.currentFilePath.substring(0, appState.currentFilePath.lastIndexOf('/'));
        await directoryTree.loadPreservingExpansion(parentDir);
      } else {
        const errorData = await response.json();
        notificationService.show('save-error', 'Delete Failed', errorData.detail || 'Unknown error occurred');
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      notificationService.show('save-error', 'Delete Error', 'Error deleting file');
    }
  });

  // Delete directory dialog
  const deleteDirectoryDialog = document.querySelector('[data-id="delete-directory-dialog"]') as HTMLDialogElement | null;
    const deleteDirectoryRealPathEl = document.querySelector('[data-id="delete-directory-real-path"]') as HTMLInputElement | null;
  const deleteDirectoryCancelBtn = document.querySelector('[data-id="delete-directory-cancel"]') as HTMLButtonElement | null;
  const deleteDirectoryConfirmBtn = document.querySelector('[data-id="delete-directory-confirm"]') as HTMLButtonElement | null;

  deleteDirectoryCancelBtn?.addEventListener('click', () => {
    deleteDirectoryDialog?.close();
  });

  deleteDirectoryConfirmBtn?.addEventListener('click', async () => {
    if (!deleteDirectoryDialog || !deleteDirectoryRealPathEl) return;
    
    const directoryPath = deleteDirectoryRealPathEl.value;
    if (!directoryPath) return;
    
    try {
      deleteDirectoryDialog.close();
      const response = await apiService.deleteDirectory(directoryPath);
      
      if (!response.ok) {
        throw new Error(`Failed to delete directory: ${response.statusText}`);
      }
      
      notificationService.showSuccess('Directory Deleted', 'Empty directory deleted successfully');
      
      // Reset UI
      if (appState.isShowingCreateDialog) {
        // Need a way to hide create dialog from here
      }
      await directoryTree?.loadPreservingExpansion();
      setCurrentFile(null, '# Welcome to Markdown Wiki\n\nSelect a file from the sidebar to edit.', null);
      history.replaceState(null, '', '/');
      contentEditor.replaceContent(appState.currentMarkdown);

    } catch (error) {
      console.error('Error deleting directory:', error);
      notificationService.show('save-error', 'Delete Error', 'Failed to delete directory. Please try again.');
    }
  });
}
