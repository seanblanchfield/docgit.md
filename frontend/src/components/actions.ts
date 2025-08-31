import { appState, setDirty } from '../state/app.state';
import { lockService } from '../services/lock';
import { apiService } from '../services/api.service';
import { contentEditor } from '../instances';
import { notificationService } from '../services/notification.service';

let saveBtn: HTMLButtonElement | null;
let draftText: HTMLElement | null;
let discardBtn: HTMLButtonElement | null;

function showDraft(show: boolean) {
  if (saveBtn) {
    saveBtn.disabled = !show;
    saveBtn.classList.toggle('hidden', !show);
  }
  if (draftText) {
    draftText.classList.toggle('hidden', !show);
  }
  if (discardBtn) {
    discardBtn.classList.toggle('hidden', !show);
  }

  // Update modified class on tree item
  if (appState.currentFilePath) {
    const itemEl = document.querySelector(`.infinite-tree-item[data-id="${CSS.escape(appState.currentFilePath)}"]`);
    if (itemEl) {
      itemEl.classList.toggle('modified', show);
    }
  }
}

function normalizeForComparison(content: string): string {
  return content
    .trim()
    .replace(/(<br\s*\/?>\n*)*$/gi, '')
    .replace(/(<p\s*\/?>\n*)*$/gi, '')
    .trim();
}

async function handleSave() {
  if (!appState.currentFilePath) return;

  const owner = 'user'; // Or get from a user session
  const lockResult = await lockService.acquireLock(appState.currentFilePath, owner);

  if (!lockResult.success || !lockResult.lock_id) {
    if (lockResult.conflict) {
      notificationService.showLockConflict(lockResult.conflict);
    }
    return;
  }

  const content = contentEditor.getMarkdown();

  try {
    const saveResponse = await apiService.saveFile(appState.currentFilePath, content, lockResult.lock_id, `Update ${appState.currentFilePath}`);

    if (!saveResponse.ok) {
      if (saveResponse.status === 423) {
        const errorData = await saveResponse.json();
        notificationService.showLockConflict(errorData);
      } else {
        const errorText = await saveResponse.text();
        throw new Error(`Save failed: ${saveResponse.status} ${errorText}`);
      }
      return; // Stop execution if save failed
    }

    appState.baselineMarkdown = content;
    setDirty(false);
    notificationService.showSuccess('File Saved', 'Your changes have been saved.');

  } catch (error) {
    console.error('Error saving file:', error);
    notificationService.show('save-error', 'Save Error', 'Error saving file');
  } finally {
    // Always try to release the lock
    await lockService.releaseLock(appState.currentFilePath);
  }
}

export function setupActions() {
  saveBtn = document.querySelector('[data-id="save-btn"]');
  draftText = document.querySelector('[data-id="draft-text"]');
  discardBtn = document.querySelector('[data-id="discard-btn"]');

  saveBtn?.addEventListener('click', handleSave);

  // Dirty checking interval
  setInterval(() => {
    const content = contentEditor.getMarkdown();
    const normalizedContent = normalizeForComparison(content);
    const normalizedBaseline = normalizeForComparison(appState.baselineMarkdown);
    const isDirty = normalizedContent !== normalizedBaseline;
    setDirty(isDirty);
    showDraft(isDirty);
  }, 2000);

  // Auto-save draft interval
  setInterval(() => {
    if (!appState.isDirty || !appState.currentFilePath || !appState.currentFileGitHash) return;

    const currentContent = contentEditor.getMarkdown();
    if (currentContent.trim() === appState.baselineMarkdown.trim()) return;

    try {
      const lockId = lockService.getCurrentLockId(appState.currentFilePath);
      if (lockId) {
        const lockExpiry = new Date(Date.now() + 5 * 60 * 1000).toISOString();
        lockService.saveDraft(appState.currentFilePath, currentContent, lockExpiry, appState.currentFileGitHash);
      } else {
        lockService.saveDraft(appState.currentFilePath, currentContent, undefined, appState.currentFileGitHash);
      }
    } catch (err) {
      console.warn('Failed to store draft:', err);
    }
  }, 10000);

  // Ctrl+S shortcut
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      handleSave();
    }
  });
}
