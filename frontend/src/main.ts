import { initContentEditor } from './components/editor';
import { DirectoryTree } from './tree';
import { TreeNode } from './tree/types';
import { setupDrawer } from './components/drawer';
import { setupHistory } from './components/history';
import { humanizeTime, humanizeFileName } from './utils/humanize';
import { lockService } from './services/lock';
import { apiService } from './services/api.service';
import { appState, setMode, setDirty, setCurrentFile } from './state/app.state';
import { EditorMode as Mode } from './state/app.state';
import { setContentEditor, setDirectoryTree } from './instances';

import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/frame.css';
import './styles.css';
import './utils/console-logger';

let directoryTree: DirectoryTree | null = null;
let modifiedFiles = new Set<string>();
let isLoadingFile = false; // Flag to prevent draft saving during file loading
let loadingContentHash = ''; // Hash of content being loaded to detect spurious changes

async function releaseLockForFile(filePath: string): Promise<void> {
  try {

    const hasLock = await lockService.isOwnedByCurrentSession(filePath);

    // Only try to release if we actually have a lock for this file
    if (hasLock) {

      await lockService.releaseLock(filePath);
    } else {

    }
    // Stop auto-refresh
    if (appState.lockRefreshInterval) {
      appState.lockRefreshInterval();
      appState.lockRefreshInterval = null;
    }
    // Update tree visual indicators
    if (directoryTree) {
      await directoryTree.updateLockStatus(filePath);
    }
  } catch (error) {
    console.error('Error releasing lock:', error);
  }
}

// Generic notification helper
function showNotification(type: 'lock-conflict' | 'lock-lost' | 'save-error' | 'success', title: string, message: string): void {
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
  }, 5000);
}

async function main() {
  function updateButtonStates() {
    const isFileOpen = !!appState.currentFilePath;
    const isDirty = appState.isDirty;

    const saveBtn = document.querySelector<HTMLButtonElement>('[data-id="save-btn"]');
    const discardBtn = document.querySelector<HTMLButtonElement>('[data-id="discard-btn"]');
    const draftText = document.querySelector<HTMLElement>('[data-id="draft-text"]');

    if (saveBtn) {
      saveBtn.classList.toggle('hidden', !isDirty);
      saveBtn.disabled = !isDirty;
    }
    if (discardBtn) {
      discardBtn.classList.toggle('hidden', !isDirty);
      discardBtn.disabled = !isDirty;
    }
    if (draftText) {
      draftText.classList.toggle('hidden', !isDirty);
    }

    const readBtn = document.querySelector<HTMLButtonElement>('[data-mode="read"]');
    if (readBtn) readBtn.disabled = !isFileOpen;

    const wysiwygBtn = document.querySelector<HTMLButtonElement>('[data-mode="wysiwyg"]');
    if (wysiwygBtn) wysiwygBtn.disabled = !isFileOpen;

    const rawBtn = document.querySelector<HTMLButtonElement>('[data-mode="raw"]');
    if (rawBtn) rawBtn.disabled = !isFileOpen;
  }

  function render() {
    // This function will be responsible for updating the UI based on appState
    // Update button states
    updateButtonStates();

    // Update mode buttons
    document.querySelector('[data-mode="wysiwyg"]')?.classList.toggle('active', appState.currentMode === 'wysiwyg');
    document.querySelector('[data-mode="raw"]')?.classList.toggle('active', appState.currentMode === 'raw');
    document.querySelector('[data-mode="read"]')?.classList.toggle('active', appState.currentMode === 'read');

    // Update draft status in tree
    if (appState.currentFilePath) {
      const el = document.querySelector(`.infinite-tree-item[data-id="${CSS.escape(appState.currentFilePath!)}"]`);
      if (el) {
        el.classList.toggle('modified', appState.isDirty);
      }
    }
  }

  // DOM elements
  const editorRoot = document.getElementById('editor-root');
  const milkdownElement = document.querySelector('.milkdown-editor') as HTMLElement;

  if (!editorRoot) {
    console.error('[FATAL] Editor root element not found. Ensure #editor-root exists.');
    return;
  }

  function saveDraftToLocalStorage() {
    if (!appState.currentFilePath || isLoadingFile) return;

    try {
      const currentContent = appState.currentMode === 'raw' ? rawTextarea.value : contentEditor.getMarkdown();
      
      // Use the same normalization as onEdit for consistent comparison
      const normalizedCurrent = normalizeContent(currentContent);
      const normalizedBaseline = normalizeContent(appState.baselineMarkdown);
      const hasChanged = normalizedCurrent !== normalizedBaseline;

      if (hasChanged) {
        const lockId = lockService.getCurrentLockId(appState.currentFilePath);
        const lockExpiry = lockId ? new Date(Date.now() + 5 * 60 * 1000).toISOString() : undefined;
        lockService.saveDraft(appState.currentFilePath, currentContent, lockExpiry, appState.currentFileGitHash ?? undefined);
      }
    } catch (err) {
      console.warn('Failed to store draft on edit:', err);
    }
  }

  // Helper function to normalize content for robust comparison
  const normalizeContent = (content: string): string => {
    return content
      // Convert HTML entities to characters (hex and decimal)
      .replace(/&#x([0-9A-Fa-f]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
      // Convert named HTML entities
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      // Normalize line endings
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Normalize whitespace characters to single spaces
      .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
      // Remove trailing HTML elements that editor might add
      .replace(/\s*<br\s*\/?>\s*$/gi, '')
      .replace(/\s*<\/?\w+[^>]*>\s*$/g, '')
      // Trim trailing and leading whitespace and newlines
      .replace(/^\s+|\s+$/g, '');
  };

  const onEdit = (markdown: string) => {
    // Skip processing if file is still loading
    if (isLoadingFile) {
      return;
    }
    
    // Normalize both contents before comparison to handle HTML entity differences
    const normalizedMarkdown = normalizeContent(markdown);
    const normalizedBaseline = normalizeContent(appState.baselineMarkdown);
    
    // Check if this matches the content we just loaded (to prevent spurious changes)
    if (loadingContentHash) {
      if (normalizedMarkdown === loadingContentHash) {
        return;
      } else {
        return; // Ignore any content that doesn't match what we just loaded
      }
    }
    
    const hasChanged = normalizedMarkdown !== normalizedBaseline;
    
    if (hasChanged) {
      setDirty(true);
      saveDraftToLocalStorage(); // Save draft on actual change
      render();
    }
  };

  const contentEditor = await initContentEditor('#editor-root', appState.currentMarkdown, onEdit);
  setContentEditor(contentEditor);
  const rawTextarea = document.createElement('textarea');
  rawTextarea.className = 'raw-markdown-editor';
  rawTextarea.style.display = 'none';
  editorRoot.appendChild(rawTextarea);

  rawTextarea.addEventListener('input', () => {
    onEdit(rawTextarea.value);
  });

  // Get initial path from URL
  const initialPath = window.location.pathname.substring(1).split('/').map(decodeURIComponent).join('/');

  function highlightModified() {
    modifiedFiles.forEach((path) => {
      const el = document.querySelector(`.infinite-tree-item[data-id="${CSS.escape(path)}"]`);
      if (el) el.classList.add('modified');
    });
  }
  highlightModified();

  async function fetchGitHashForCurrentFile() {
    if (!appState.currentFilePath) return;
    try {
      appState.currentFileGitHash = await apiService.fetchGitHash(appState.currentFilePath);
      if (appState.currentFileGitHash) {
      }
    } catch (error) {
      console.warn(`Could not fetch git hash for ${appState.currentFilePath}:`, error);
      appState.currentFileGitHash = null;
    }
  }

  async function handleSave() {
    if (!appState.currentFilePath || !appState.isDirty) return;

    const content = appState.currentMode === 'raw' ? rawTextarea.value : contentEditor.getMarkdown();
    const lockId = lockService.getCurrentLockId(appState.currentFilePath) || '';

    try {
      const result = await apiService.saveFile(appState.currentFilePath, content, lockId, `Update ${appState.currentFilePath}`);

      if (result.success) {
        appState.baselineMarkdown = content;
        setDirty(false);
        showNotification('success', 'File Saved', `${humanizeFileName(appState.currentFilePath)} has been saved.`);
        // Update commit meta after save
        updateCommitMeta(appState.currentFilePath);
        render();
      } else {
        if (result.conflict) {
          showNotification('lock-conflict', 'Save Failed - Lock Conflict', 'The file is locked by another user. Please try again later.');
        } else {
          showNotification('save-error', 'Save Failed', result.error || 'Could not save the file. Please check the console for details.');
        }
      }
    } catch (error) {
      console.error('Failed to save file:', error);
      showNotification('save-error', 'Save Failed', 'An unexpected error occurred while saving.');
    }
  }

  async function updateCommitMeta(filePath: string) {
    const metaElement = document.querySelector('[data-id="commit-meta"]');
    const commitTextElement = document.querySelector('[data-id="commit-text"]');
    if (!metaElement || !commitTextElement) return;

    try {
      const lastCommit = await apiService.fetchLatestCommit(filePath);
      if (lastCommit) {
        commitTextElement.textContent = `Last updated ${humanizeTime(lastCommit.date)} by ${lastCommit.author_name}`;
        metaElement.classList.remove('hidden');
      } else {
        commitTextElement.textContent = 'No history available for this file.';
        metaElement.classList.remove('hidden');
      }
    } catch (error) {
      console.warn('Could not fetch commit history:', error);
      commitTextElement.textContent = 'Could not load file history.';
      metaElement.classList.remove('hidden');
    }
  }

  function autoResize(textarea: HTMLTextAreaElement) {
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }

  async function updateMode(mode: Mode) {
    // If transitioning from read mode to an edit mode, acquire lock first
    if (appState.currentMode === 'read' && (mode === 'wysiwyg' || mode === 'raw') && appState.currentFilePath) {
      const lockResult = await lockService.acquireLock(appState.currentFilePath, 'user-session');
      if (!lockResult.success) {
        showNotification('lock-conflict', 'Lock Failed', 'Could not acquire lock. This file is likely being edited by someone else.');
        return; // Stay in read mode
      }

      // After acquiring lock, ensure any existing draft has the correct git hash
      if (appState.currentFileGitHash) {
        const existingDraft = lockService.getDraftData(appState.currentFilePath);
        if (existingDraft && !existingDraft.baseCommitHash && appState.currentFileGitHash) {
          const lockId = lockService.getCurrentLockId(appState.currentFilePath);
          const lockExpiry = lockId ? new Date(Date.now() + 5 * 60 * 1000).toISOString() : undefined;
          lockService.saveDraft(appState.currentFilePath, existingDraft.content, lockExpiry, appState.currentFileGitHash);
        }
      }
    }

    // If leaving RAW, push textarea content into editor
    if (appState.currentMode === 'raw' && mode !== 'raw') {
      appState.currentMarkdown = rawTextarea.value;
      contentEditor.replaceContent(appState.currentMarkdown);
    }

    // Apply mode effects
    if (mode === 'read') {
      (rawTextarea as HTMLElement).style.display = 'none';
      if (milkdownElement) {
        (milkdownElement as HTMLElement).style.pointerEvents = 'none';
        (milkdownElement as HTMLElement).style.display = 'block'; // Keep it visible for content
        (milkdownElement as HTMLElement).classList.add('readonly');
      }
      contentEditor.setEditable(false);
      contentEditor.cleanupForRead();
      appState.currentMarkdown = contentEditor.getMarkdown() || appState.currentMarkdown;
    } else if (mode === 'raw') {
      appState.currentMarkdown = contentEditor.getMarkdown() || appState.currentMarkdown;
      rawTextarea.value = appState.currentMarkdown;
      autoResize(rawTextarea);
      (rawTextarea as HTMLElement).style.display = 'block';
      contentEditor.setEditable(false);
      if (milkdownElement) {
        milkdownElement.style.pointerEvents = 'none';
        (milkdownElement as HTMLElement).style.display = 'none';
      }
    } else { // wysiwyg
      (rawTextarea as HTMLElement).style.display = 'none';
      if (milkdownElement) {
        (milkdownElement as HTMLElement).style.pointerEvents = '';
        (milkdownElement as HTMLElement).style.display = 'block';
        milkdownElement.classList.remove('readonly');
      }
      contentEditor.setEditable(true);
      appState.currentMarkdown = contentEditor.getMarkdown() || appState.currentMarkdown;
    }

    // Update UI and state
    setMode(mode);
    render();
  }


  async function handleDiscard() {
    if (!appState.currentFilePath || !appState.isDirty) return;

    // Revert editor content to baseline
    contentEditor.replaceContent(appState.baselineMarkdown);
    rawTextarea.value = appState.baselineMarkdown;

    // Clear any saved draft for this file
    lockService.discardDraft(appState.currentFilePath);

    // Reset dirty state and re-render
    setDirty(false);
    render();

    showNotification('success', 'Changes Discarded', `Your local changes to ${humanizeFileName(appState.currentFilePath)} have been discarded.`);
  }

  const editorStatusBar = document.getElementById('editor-status-bar');
  if (editorStatusBar) {
    editorStatusBar.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const button = target.closest('button');
      if (!button) return;

      const dataId = button.dataset.id;
      if (dataId === 'save-btn') {
        handleSave();
      }
      if (dataId === 'discard-btn') {
        handleDiscard();
      }
    });
  }

  document.querySelectorAll<HTMLButtonElement>('.mode-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const mode = btn.dataset.mode as Mode;
      await updateMode(mode);
    });
  });

  // Keyboard shortcut Ctrl+E cycles modes
  if (editorRoot) {
    editorRoot.addEventListener('keydown', (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        const order: Mode[] = ['read', 'wysiwyg', 'raw'];
        const idx = order.indexOf(appState.currentMode);
        const nextMode = order[(idx + 1) % order.length] as Mode;
        updateMode(nextMode);
      }
    });
  }

  // Find tree container
  const treeContainer = document.querySelector('[data-id="tree"]');
  if (!(treeContainer instanceof HTMLElement)) {
    console.error('[FATAL] Tree container not found or not an HTMLElement. Ensure <div id="tree-drawer" data-id="tree"> exists and script runs after DOM is ready.');
    return;
  }

  directoryTree = new DirectoryTree({
    el: treeContainer,
    selectDefault: false,
    onCreateFile: async (parentPath: string, name: string, isDirectory: boolean) => {
      const fullPath = parentPath ? `${parentPath}/${name}` : name;
      try {
        if (isDirectory) {
          await apiService.createDirectory(fullPath);
        } else {
          const humanizedName = humanizeFileName(name);
          const defaultContent = `# ${humanizedName}\n\n`;
          await apiService.saveFile(fullPath, defaultContent, '', `Create file ${fullPath}`);
        }

        // Reload the parent directory to show the new item
        if (parentPath) {
            await directoryTree?.load(parentPath);
        } else {
            await directoryTree?.load();
        }

        if (!isDirectory) {
          // After reloading, select the new file
          setTimeout(() => directoryTree?.selectPath(fullPath), 100);
        } else {
          // For directories, show the create dialog inside the new directory
          setTimeout(() => {
            if (directoryTree) {
              directoryTree.showCreateDialogForDirectory(fullPath);
            }
          }, 200);
        }
      } catch (error) {
        console.error('Error creating file/directory:', error);
        throw error;
      }
    },
    onDeleteDirectory: async (path: string) => {
      await apiService.deleteDirectory(path);
      const parentPath = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : '';
      
      // Clear current file state and show success message
      setCurrentFile(null, '', null);
      const humanizedPath = humanizeFileName(path.split('/').pop() || path);
      contentEditor.replaceContent(`# Directory Deleted Successfully\n\nDirectory **${humanizedPath}** has been deleted successfully.`);
      
      // Update directory tree
      if (parentPath) {
        await directoryTree?.load(parentPath);
      } else {
        await directoryTree?.load();
      }
      
      // Show success notification
      showNotification('success', 'Directory Deleted', `Directory ${humanizedPath} was deleted successfully.`);
      
      // Update URL
      history.replaceState(null, '', '/');
    },
    onFileSelect: async (node: TreeNode) => {
      if (appState.dialog.visible) {
        hideCreateDialog();
      }

      // The onEdit handler now saves drafts immediately, so this check is no longer needed before navigation.
      // Leaving this commented out as a reminder of the previous logic.
      // if (appState.isDirty) {
      //   saveDraftToLocalStorage();
      // }

      if (appState.currentFilePath && appState.currentFilePath !== node.id) {
        await releaseLockForFile(appState.currentFilePath);
      }

      isLoadingFile = true; // Prevent draft saving during file loading
      
      const serverContent = await apiService.fetchFileContent(node.id);
      const gitHash = await apiService.fetchGitHash(node.id);
      setCurrentFile(node.id, serverContent, gitHash);

      await fetchGitHashForCurrentFile();

      if (appState.currentFileGitHash) {
        const existingDraft = lockService.getDraftData(appState.currentFilePath!);
        // Only update existing drafts that have actual content changes, not just missing baseCommitHash
        if (existingDraft && !existingDraft.baseCommitHash && appState.currentFileGitHash) {
          // Check if the draft content actually differs from server content
          const hasActualChanges = existingDraft.content.trim() !== serverContent.trim() &&
            existingDraft.content.replace(/\r\n/g, '\n').trim() !== serverContent.replace(/\r\n/g, '\n').trim();
          
          if (hasActualChanges) {
            lockService.saveDraft(appState.currentFilePath!, existingDraft.content, existingDraft.lockExpiry, appState.currentFileGitHash);
          } else {
            // Draft content matches server content - discard it as it's not a real change
            lockService.discardDraft(appState.currentFilePath!);
          }
        }
      }

      await updateMode('read');
      render();

      try {
        const encoded = appState.currentFilePath!.split('/').map(encodeURIComponent).join('/');
        history.replaceState(null, '', `/${encoded}`);
      } catch (err) {
        console.warn('Failed to update URL', err);
      }

      if (appState.currentFileGitHash) {
        const conflictResult = await lockService.checkDraftConflict(appState.currentFilePath!, appState.currentFileGitHash);
        if (conflictResult.isStale) {
          console.log(`[CONFLICT] Draft for ${appState.currentFilePath} is stale (base: ${conflictResult.baseHash?.substring(0, 8)}, current: ${conflictResult.currentHash?.substring(0, 8)})`);
          lockService.discardStaleDraft(appState.currentFilePath!);
          console.log(`[CONFLICT] Automatically discarded stale draft for ${appState.currentFilePath}`);
        }
      }

      const draftData = lockService.getDraftData(appState.currentFilePath!);
      const draftContent = draftData?.content;
      const contentToLoad = draftContent ?? appState.baselineMarkdown;
      
      appState.currentMarkdown = contentToLoad;
      
      // Store normalized content hash to detect spurious editor changes
      loadingContentHash = normalizeContent(contentToLoad);
      
      // Wait for content replacement to complete before proceeding
      await contentEditor.replaceContent(contentToLoad);
      
      // Verify the editor actually has the correct content
      const editorContent = contentEditor.getMarkdown();
      
      if (normalizeContent(editorContent) !== loadingContentHash) {
        // Try to force content replacement again
        await contentEditor.replaceContent(contentToLoad);
      }
      
      rawTextarea.value = contentToLoad;

      // Use the same robust normalization for draft comparison
      const hasDraftChanges = draftContent !== null && draftContent !== undefined &&
        normalizeContent(draftContent) !== normalizeContent(appState.baselineMarkdown);
      
      
      setDirty(hasDraftChanges);

      setTimeout(() => {
        if (appState.currentFilePath) {
          const el = document.querySelector(`.infinite-tree-item[data-id="${CSS.escape(appState.currentFilePath!)}"]`);
          if (el) {
            el.classList.toggle('modified', hasDraftChanges);
          }
        }
      }, 0);

      await updateMode(appState.currentMode);
      if (appState.currentFilePath) {
        updateCommitMeta(appState.currentFilePath);
      }
      
      // Now that content replacement is complete, we can safely re-enable edit detection
      isLoadingFile = false;
      
      // Clear the content hash after a longer delay to allow all async editor callbacks to complete
      setTimeout(() => {
        loadingContentHash = '';
      }, 500);
    }
  });
  setDirectoryTree(directoryTree);
  await directoryTree.load();

  // After tree loaded, apply deep link if any, otherwise load default
  if (initialPath && initialPath !== '/') {
    await directoryTree.selectPath(initialPath);
  } else {
    await directoryTree.selectPath('01_start.md');
  }

  function hideCreateDialog() {
    const dialog = document.querySelector('.create-dialog-overlay');
    if (dialog) {
      dialog.remove();
    }

    // Restore editor content
    const existingChildren = Array.from(editorRoot!.children);
    existingChildren.forEach(child => {
      if (!(child as HTMLElement).classList.contains('create-dialog-overlay')) {
        (child as HTMLElement).style.display = '';
      }
    });

    // Restore status bar
    const statusActions = document.querySelector('.status-actions') as HTMLElement | null;
    const modeControl = document.querySelector('.mode-control') as HTMLElement | null;
    const statusMeta = document.querySelector('.status-meta') as HTMLElement | null;
    if (statusActions) statusActions.style.display = '';
    if (modeControl) modeControl.style.display = '';
    if (statusMeta) statusMeta.style.display = '';

    appState.dialog.visible = false;
  }

  // Listen for create dialog events from tree
  document.addEventListener('showCreateDialog', (event: Event) => {
    const { parentPath, isEmpty, onCreateFile, onDeleteDirectory } = (event as CustomEvent).detail;
    showCreateDialogInContent(parentPath, isEmpty, onCreateFile, onDeleteDirectory);
  });

  function showCreateDialogInContent(parentPath: string, isEmpty: boolean, onCreateFile: (parentPath: string, name: string, isDirectory: boolean) => Promise<void>, onDeleteDirectory: (path: string) => Promise<void>) {
    // If a create dialog is already showing, hide it first so we can show the new one
    if (appState.dialog.visible) {
      hideCreateDialog();
    }

    appState.dialog.visible = true;
    appState.previousFilePath = appState.currentFilePath;

    // Clear current file path to indicate we're not editing a file
    setCurrentFile(null, '', null);

    // Update URL to show create state
    const pathSegment = parentPath ? `${parentPath}/` : '';
    history.replaceState(null, '', `/${pathSegment}__create__`);
    
    // Hide status bar actions and show create-specific buttons
    const statusActions = document.querySelector('.status-actions') as HTMLElement | null;
    const modeControl = document.querySelector('.mode-control') as HTMLElement | null;
    const statusMeta = document.querySelector('.status-meta') as HTMLElement | null;
    if (statusActions) statusActions.style.display = 'none';
    if (modeControl) modeControl.style.display = 'none';
    if (statusMeta) statusMeta.style.display = 'none';
    
    // Hide the existing editor content
    if (!editorRoot) return;
    const existingChildren = Array.from(editorRoot.children);
    existingChildren.forEach(child => {
      (child as HTMLElement).style.display = 'none';
    });
    
    // Create the form content as a new element
    const dialogElement = document.createElement('div');
    dialogElement.className = 'create-dialog-overlay';
    
    // Humanize the parent path for display
    const humanizedParentPath = parentPath ? 
      humanizeFileName(parentPath.split('/').pop() || parentPath) : 
      null;
    
    dialogElement.innerHTML = `
      <div class="create-dialog-content">
        <div class="create-dialog-header">
          <h2>Create New File or Directory</h2>
          ${humanizedParentPath ? `<div class="create-dialog-location">in <span class="directory-name">${humanizedParentPath}</span></div>` : '<div class="create-dialog-location">in <span class="directory-name">Root</span></div>'}
          <p class="create-dialog-description">Enter a name for your new file or directory</p>
        </div>
        
        <div class="create-form">
          <div class="form-group">
            <label for="create-name">Name:</label>
            <input type="text" id="create-name" class="form-input" placeholder="Enter name..." />
          </div>
          
          <div class="form-group">
            <label>Type:</label>
            <div class="radio-group">
              <label class="radio-label">
                <input type="radio" name="create-type" value="file" checked />
                <span>File</span>
              </label>
              <label class="radio-label">
                <input type="radio" name="create-type" value="directory" />
                <span>Directory</span>
              </label>
            </div>
          </div>
          
          <div class="create-actions">
            <div>
              ${isEmpty ? '<button class="btn btn-danger delete-dir-btn">Delete Directory</button>' : ''}
            </div>
            <div>
              <button class="btn btn-secondary create-cancel">Cancel</button>
              <button class="btn btn-primary create-submit">Create</button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    editorRoot!.appendChild(dialogElement);
    
    // Focus name input with a small delay to ensure dialog is rendered
    const nameInput = dialogElement.querySelector('#create-name') as HTMLInputElement;
    setTimeout(() => nameInput.focus(), 50);
    
    // Handle form submission
    const handleCreate = async () => {
      const name = nameInput.value.trim();
      if (!name) {
        nameInput.focus();
        return;
      }
      
      // Validate name
      if (name.includes('/') || name.includes('\\') || name === '.' || name === '..') {
        alert('Invalid name. Names cannot contain slashes or be "." or ".."');
        nameInput.focus();
        return;
      }
      
      const typeRadio = dialogElement.querySelector('input[name="create-type"]:checked') as HTMLInputElement;
      const isDirectory = typeRadio.value === 'directory';
      
      try {
        await onCreateFile(parentPath, name, isDirectory);
        hideCreateDialog();
      } catch (error) {
        console.error('Error creating file/directory:', error);
        alert('Failed to create file/directory. Please try again.');
      }
    };
    
    // Handle cancel
    const handleCancel = () => {
      hideCreateDialog();
      // Restore previous file selection if any
      if (appState.previousFilePath) {
        directoryTree?.selectPath(appState.previousFilePath);
      } else {
        // If no previous selection, clear the editor
        contentEditor.replaceContent('# Welcome to Markdown Wiki\n\nSelect a file from the sidebar to edit.');
        appState.currentFilePath = null;
        history.replaceState(null, '', '/');
      }
    };

    dialogElement.querySelector('.create-cancel')?.addEventListener('click', handleCancel);
    dialogElement.querySelector('.create-submit')?.addEventListener('click', handleCreate);
    dialogElement.querySelector('.delete-dir-btn')?.addEventListener('click', async () => {
      if (confirm(`Are you sure you want to delete the empty directory "${parentPath}"?`)) {
        try {
          if (directoryTree) {
            await apiService.deleteDirectory(parentPath);
            const grandParentPath = parentPath.includes('/') ? parentPath.substring(0, parentPath.lastIndexOf('/')) : '';
            
            // Clear current file state and show success message
            setCurrentFile(null, '', null);
            const humanizedPath = humanizeFileName(parentPath.split('/').pop() || parentPath);
            contentEditor.replaceContent(`# Directory Deleted Successfully\n\nDirectory **${humanizedPath}** has been deleted successfully.`);
            
            // Update directory tree
            if (grandParentPath) {
              await directoryTree.load(grandParentPath);
            } else {
              await directoryTree.load();
            }
            
            // Show success notification
            showNotification('success', 'Directory Deleted', `Directory ${humanizedPath} was deleted successfully.`);
            
            // Update URL
            history.replaceState(null, '', '/');
          }
          hideCreateDialog();
        } catch (error) {
          console.error('Error deleting directory:', error);
          alert('Failed to delete directory. Please try again.');
        }
      }
    });
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleCreate();
      }
    });

    // Handle Escape key to cancel
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && appState.dialog.visible) {
        e.preventDefault();
        hideCreateDialog();
        // Restore previous file selection if any
        if (appState.previousFilePath) {
          directoryTree?.selectPath(appState.previousFilePath);
        } else {
          // If no previous selection, clear the editor
          contentEditor.replaceContent('# Welcome to Markdown Wiki\n\nSelect a file from the sidebar to edit.');
          appState.currentFilePath = null;
          history.replaceState(null, '', '/');
        }
      }
    };
    document.addEventListener('keydown', handleEscapeKey);
    // Store handler to remove it later
    if (editorRoot) {
      (editorRoot as any)._escapeHandler = handleEscapeKey;
    }
  }

  // Initialize drawer toggle
  setupDrawer('#tree-drawer');
  
  // Initialize history functionality
  setupHistory();

  // Overflow menu event listeners
  const overflowBtn = document.querySelector('[data-id="overflow-btn"]') as HTMLButtonElement | null;
  const overflowDropdown = document.querySelector('[data-id="overflow-dropdown"]') as HTMLElement | null;
  const historyBtn = document.querySelector('[data-id="history-btn"]') as HTMLButtonElement | null;
  const deleteBtn = document.querySelector('[data-id="delete-btn"]') as HTMLButtonElement | null;

  overflowBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    overflowDropdown?.classList.toggle('hidden');
  });

  document.addEventListener('click', (e) => {
    if (overflowDropdown && !overflowDropdown.contains(e.target as Node) && !overflowBtn?.contains(e.target as Node)) {
      overflowDropdown.classList.add('hidden');
    }
  });

  const historyDrawer = document.querySelector('[data-id="history-drawer"]') as HTMLElement | null;
  const historyCloseBtn = document.querySelector('[data-id="history-close"]') as HTMLButtonElement | null;

  historyBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    overflowDropdown?.classList.add('hidden');
    historyDrawer?.classList.remove('hidden');
  });

  function closeHistoryDrawer() {
    if (historyDrawer) {
      historyDrawer.classList.add('hidden');
    }
  }

  historyCloseBtn?.addEventListener('click', closeHistoryDrawer);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && historyDrawer && !historyDrawer.classList.contains('hidden')) {
      closeHistoryDrawer();
    }
  });

  // Delete file handler
  const deleteDialog = document.querySelector('[data-id="delete-dialog"]') as HTMLDialogElement | null;
  const deleteFilePathEl = document.querySelector('[data-id="delete-file-path"]') as HTMLElement | null;
  const deleteCancelBtn = document.querySelector('[data-id="delete-cancel"]') as HTMLButtonElement | null;
  const deleteConfirmBtn = document.querySelector('[data-id="delete-confirm"]') as HTMLButtonElement | null;

  deleteBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    overflowDropdown?.classList.add('hidden');
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

    // Store the file path before clearing it
    const filePathToDelete = appState.currentFilePath;
    const fileName = humanizeFileName(filePathToDelete);
    
    try {
      deleteDialog.close();
      const result = await apiService.deleteFile(filePathToDelete);
      if (result.success) {
        // Clear current file state
        setCurrentFile(null, '', null);
        
        // Show success message instead of editor content
        contentEditor.replaceContent(`# File Deleted Successfully\n\nFile **${fileName}** has been deleted successfully.`);
        
        // Update directory tree
        if (directoryTree) {
            const parentPath = filePathToDelete.includes('/') ? filePathToDelete.substring(0, filePathToDelete.lastIndexOf('/')) : '';
            await directoryTree.load(parentPath);
        }
        
        // Show success notification
        showNotification('success', 'File Deleted', `${fileName} was deleted successfully.`);
        
        history.replaceState(null, '', '/');
      } else {
        showNotification('save-error', 'Delete Failed', result.error || 'Unknown error occurred');
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      showNotification('save-error', 'Delete Error', 'An unexpected error occurred while deleting the file.');
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
