import { initContentEditor } from './content';
import { DirectoryTree, TreeNode } from './tree';
import { setupDrawer } from './drawer';
import { humanizeTime, humanizeFileName } from './humanize';
import { lockService } from './lock';
import './console-logger'; // Initialize console logging to server


import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/frame.css';
import './styles.css';



interface ApiFileResponse {
  content: string;
}

interface CommitDetail {
  sha: string;
  author_name: string;
  author_email: string;
  date: string; // ISO format string
  message: string;
}

// Global state for lock management
let currentFilePath: string | null = null;
let currentFileGitHash: string | null = null; // Track current file's git hash for conflict detection
let lockRefreshInterval: (() => void) | null = null;
let directoryTree: DirectoryTree | null = null;

// Use generic owner identifier for locks (authentication will be added later)
const LOCK_OWNER = 'user';

// Create dialog state
let isShowingCreateDialog = false;
let previousFilePathBeforeCreate: string | null = null;

// Lock management functions
async function acquireLockForFile(filePath: string, showNotification: boolean = true): Promise<{success: boolean, conflict?: any}> {
  try {

    
    // Check if we already own this lock implicitly
    if (await lockService.isOwnedByCurrentSession(filePath)) {

      return {success: true};
    }
    
    const result = await lockService.acquireLock(filePath, LOCK_OWNER);
    if (result.success) {

      // Start auto-refresh for this lock
      if (lockRefreshInterval) {
        lockRefreshInterval();
      }
      lockRefreshInterval = lockService.startAutoRefresh(filePath);
      
      return {success: true};
    } else if (result.conflict) {

      // Show lock conflict notification only if requested
      if (showNotification) {
        showLockConflictNotification(result.conflict);
      }
      return {success: false, conflict: result.conflict};
    }
  } catch (error) {
    console.error('Error acquiring lock:', error);
  }
  return {success: false};
}

async function releaseLockForFile(filePath: string): Promise<void> {
  try {

    const hasLock = await lockService.isOwnedByCurrentSession(filePath);

    
    // Only try to release if we actually have a lock for this file
    if (hasLock) {

      await lockService.releaseLock(filePath);
    } else {

    }
    
    // Stop auto-refresh
    if (lockRefreshInterval) {
      lockRefreshInterval();
      lockRefreshInterval = null;
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

function showLockConflictNotification(conflict: any): void {
  const message = `File is locked by ${conflict.detail.lock_info.owner}. You cannot edit this file until the lock is released.`;
  showNotification('lock-conflict', 'File Locked', message);
}

async function showDraftConflictDialog(filePath: string, baseHash?: string, currentHash?: string): Promise<boolean> {
  const fileName = filePath.split('/').pop() || filePath;
  const baseShort = baseHash?.substring(0, 8) || 'unknown';
  const currentShort = currentHash?.substring(0, 8) || 'unknown';
  
  const message = `Your local draft for "${fileName}" is based on an older version of the file.\n\n` +
    `Draft base: ${baseShort}\n` +
    `Current version: ${currentShort}\n\n` +
    `The server has newer changes. Your draft changes will be lost if you continue.\n\n` +
    `Do you want to discard your draft and load the current version?`;
  
  return confirm(message);
}

// Set up lock service callback for when locks are lost
lockService.onLockLost = (filePath: string) => {
  console.warn(`Lock lost for file: ${filePath}`);
  if (directoryTree) {
    directoryTree.updateLockStatus(filePath);
  }
  
  showNotification('lock-lost', 'Lock Expired', `Your edit lock for "${filePath}" has expired. Your changes may not be saved.`);
};

async function fetchFileContent(filePath: string): Promise<string> {
  try {
    // Encode each path segment separately to handle special characters
    const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
    const response = await fetch(`/api/files/${encodedPath}`);
    if (!response.ok) {
      console.error(`Error fetching file '${filePath}': ${response.status} ${response.statusText}`);
      return `# Error\n\nCould not load ${filePath}. Status: ${response.status}`;
    }
    const jsonData: ApiFileResponse = await response.json();
    return jsonData.content || '';
  } catch (error) {
    console.error(`Error fetching file '${filePath}':`, error);
    return `# Error\n\nCould not fetch ${filePath}.`;
  }
}

async function fetchLatestCommit(filePath: string): Promise<CommitDetail | null> {
  try {
    const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
    const response = await fetch(`/api/history/${encodedPath}?limit=1`);
    if (!response.ok) {
      console.warn(`Could not fetch commit history for '${filePath}': ${response.status} ${response.statusText}`);
      return null;
    }
    const commits: CommitDetail[] = await response.json();
    return commits.length > 0 ? commits[0]! : null;
  } catch (error) {
    console.warn(`Error fetching commit history for '${filePath}':`, error);
    return null;
  }
}

async function main() {
  
  // Function to fetch git hash for the current file when needed
  async function fetchGitHashForCurrentFile(): Promise<void> {
    if (!currentFilePath) return;
    
    try {
      console.log(`[GIT HASH] Fetching git hash for current file: ${currentFilePath}`);
      
      const response = await fetch('/api/git-hashes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([currentFilePath]),
      });
      
      if (!response.ok) {
        console.warn(`[GIT HASH] Failed to fetch git hash for ${currentFilePath}: ${response.statusText}`);
        return;
      }
      
      const gitHashes: Record<string, string | null> = await response.json();
      currentFileGitHash = gitHashes[currentFilePath] || null;
      
      console.log(`[GIT HASH] Updated current file git hash: ${currentFileGitHash?.substring(0, 8) || 'null'}`);
      
      // Also update the tree node if it exists
      if (directoryTree) {
        const node = directoryTree.tree.getNodeById(currentFilePath);
        if (node && !node.isDirectory) {
          node.gitHash = currentFileGitHash || undefined;
          directoryTree.tree.updateNode(node);
        }
      }
    } catch (error) {
      console.error(`[GIT HASH] Error fetching git hash for ${currentFilePath}:`, error);
    }
  }
  // Initialize content editor
  const draftText = document.querySelector('[data-id="draft-text"]') as HTMLElement | null;
  const saveBtn = document.querySelector('[data-id="save-btn"]') as HTMLButtonElement | null;
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.classList.add('hidden');
  }
  const discardBtn = document.querySelector('[data-id="discard-btn"]') as HTMLButtonElement | null;
  if (discardBtn) discardBtn.classList.add('hidden');

  const commitMetaEl = document.querySelector('[data-id="commit-meta"]') as HTMLElement | null;
  const overflowBtn = document.querySelector('[data-id="overflow-btn"]') as HTMLButtonElement | null;
  const overflowDropdown = document.querySelector('[data-id="overflow-dropdown"]') as HTMLElement | null;
  const historyBtn = document.querySelector('[data-id="history-btn"]') as HTMLButtonElement | null;
  const deleteBtn = document.querySelector('[data-id="delete-btn"]') as HTMLButtonElement | null;
  const historyDrawer = document.querySelector('[data-id="history-drawer"]') as HTMLElement | null;
  const historyCloseBtn = document.querySelector('[data-id="history-close"]') as HTMLButtonElement | null;
  const historyList = document.querySelector('[data-id="history-list"]') as HTMLElement | null;
  const diffView = document.querySelector('[data-id="diff-view"]') as HTMLElement | null;
  const diffBackBtn = document.querySelector('[data-id="diff-back"]') as HTMLButtonElement | null;
  const diffTitle = document.querySelector('[data-id="diff-title"]') as HTMLElement | null;
  const diffContent = document.querySelector('[data-id="diff-content"]') as HTMLElement | null;

  let currentMarkdown = '# Welcome to Markdown Wiki\n\nSelect a file from the sidebar to edit.';
  let baselineMarkdown = '';
  // Draft/dirty tracking vars declared early to avoid hoisting issues
  // Note: currentFilePath is declared globally, don't redeclare here
  const draftPrefix = 'draft:';
  const modifiedKey = 'modifiedFiles';
  const modifiedFiles = new Set<string>(JSON.parse(localStorage.getItem(modifiedKey) || '[]'));



  // Function to update commit meta display
async function updateCommitMeta(filePath: string) {
  if (!commitMetaEl) return;
  
  // Check lock status first
  const lockStatus = await lockService.checkLockStatus(filePath);
  const ownedByMe = await lockService.isOwnedByCurrentSession(filePath);
  const isLockedByOther = lockStatus.locked && !ownedByMe;

  if (isLockedByOther) {
    // Show lock status instead of commit info
    const ownerName = (lockStatus as any).owner || (lockStatus as any).lock_info?.owner || 'Another user';
    commitMetaEl.innerHTML = `<span class="editor-lock-status">${ownerName} currently editing</span>`;
    commitMetaEl.title = `This file is being edited by ${ownerName}`;
    commitMetaEl.classList.remove('hidden');
    return;
  }
  
  const commit = await fetchLatestCommit(filePath);
  if (!commit) {
    commitMetaEl.classList.add('hidden');
    commitMetaEl.textContent = '';
    commitMetaEl.title = '';
    return;
  }

  // Display "Author — relative time" format
  const relativeTime = humanizeTime(commit.date);
  commitMetaEl.textContent = `${commit.author_name} — ${relativeTime}`;

  // Set tooltip with commit message
  commitMetaEl.title = commit.message;

  commitMetaEl.classList.remove('hidden');
}

  // Function to fetch full commit history for a file
  async function fetchCommitHistory(filePath: string): Promise<CommitDetail[]> {
    try {
      const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
      const response = await fetch(`/api/history/${encodedPath}`);
      if (!response.ok) {
        console.error('Failed to fetch commit history:', response.statusText);
        return [];
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching commit history:', error);
      return [];
    }
  }

  // Function to render commit history in the drawer
  function renderCommitHistory(commits: CommitDetail[]) {
    if (!historyList) return;

    if (commits.length === 0) {
      historyList.innerHTML = '<div class="history-empty">No commit history available</div>';
      return;
    }

    const historyHTML = commits.map(commit => {
      const relativeTime = humanizeTime(commit.date);
      const shortSha = commit.sha.substring(0, 7);

      return `
        <div class="history-item" data-sha="${commit.sha}">
          <div class="commit-info">
            <div class="commit-meta">
              <span class="commit-author">${commit.author_name}</span>
              <span class="commit-time">${relativeTime}</span>
              <span class="commit-sha">${shortSha}</span>
            </div>
            <div class="commit-message">${commit.message}</div>
          </div>
        </div>
      `;
    }).join('');

    historyList.innerHTML = historyHTML;

    // Add click handlers for commit items
    const historyItems = historyList.querySelectorAll('.history-item');
    historyItems.forEach(item => {
      item.addEventListener('click', () => {
        const sha = item.getAttribute('data-sha');
        if (sha && currentFilePath) {
          openCommitDiff(currentFilePath, sha);
        }
      });
    });
  }

  // Function to fetch commit diff
  async function fetchCommitDiff(filePath: string, commitSha: string): Promise<string | null> {
    try {
      // To show what a commit changed, we need to compare it to its parent
      // Use the Git convention: commitSha^1 represents the parent of commitSha
      const parentSha = `${commitSha}^1`;
      const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
      const response = await fetch(`/api/diff/${encodedPath}?sha1=${parentSha}&sha2=${commitSha}`);
      if (!response.ok) {
        console.error('Failed to fetch commit diff:', response.statusText);
        return null;
      }
      const diffData = await response.json();
      return diffData.diff_output || '';
    } catch (error) {
      console.error('Error fetching commit diff:', error);
      return null;
    }
  }

  // Function to parse and render diff content
  function renderDiffContent(diffOutput: string) {
    if (!diffContent) return;
    
    if (!diffOutput || diffOutput.trim() === '') {
      diffContent.innerHTML = '<div class="diff-empty">No changes in this commit</div>';
      return;
    }
    
    const lines = diffOutput.split('\n');
    const diffHTML = lines.map(line => {
      let className = 'diff-line context';
      let content = line;
      
      if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('@@')) {
        className = 'diff-line header';
      } else if (line.startsWith('+')) {
        className = 'diff-line added';
        content = line.substring(1); // Remove the + prefix
      } else if (line.startsWith('-')) {
        className = 'diff-line removed';
        content = line.substring(1); // Remove the - prefix
      }
      
      return `<div class="${className}">${content}</div>`;
    }).join('');
    
    diffContent.innerHTML = diffHTML;
  }

  // Function to show diff view
  function showDiffView(filePath: string, commitSha: string, commitMessage: string) {
    if (!diffView || !diffTitle || !historyList) return;
    
    // Update diff title
    const shortSha = commitSha.substring(0, 7);
    diffTitle.textContent = `${shortSha}: ${commitMessage}`;
    
    // Hide history list and show diff view
    historyList.classList.add('hidden');
    diffView.classList.remove('hidden');
    
    // Load diff content
    loadDiffContent(filePath, commitSha);
  }

  // Function to hide diff view and return to history
  function hideDiffView() {
    if (!diffView || !historyList) return;
    
    diffView.classList.add('hidden');
    historyList.classList.remove('hidden');
  }

  // Function to load diff content
  async function loadDiffContent(filePath: string, commitSha: string) {
    if (!diffContent) return;
    
    // Show loading state
    diffContent.innerHTML = '<div class="diff-loading">Loading diff...</div>';
    
    // Fetch and render diff
    const diffOutput = await fetchCommitDiff(filePath, commitSha);
    if (diffOutput !== null) {
      renderDiffContent(diffOutput);
    } else {
      diffContent.innerHTML = '<div class="diff-empty">Failed to load diff</div>';
    }
  }

  // Function to open commit diff
  function openCommitDiff(filePath: string, commitSha: string) {
    // Find the commit message from the current history list
    const historyItems = document.querySelectorAll('.history-item');
    let commitMessage = 'Commit Details';
    
    historyItems.forEach(item => {
      if (item.getAttribute('data-sha') === commitSha) {
        const messageEl = item.querySelector('.commit-message');
        if (messageEl) {
          commitMessage = messageEl.textContent || 'Commit Details';
        }
      }
    });
    
    showDiffView(filePath, commitSha, commitMessage);
  }

  // Function to toggle history drawer
  function toggleHistoryDrawer() {
    if (!historyDrawer) return;

    const isHidden = historyDrawer.classList.contains('hidden');

    if (isHidden) {
      // Show drawer and load history for current file
      historyDrawer.classList.remove('hidden');
      if (currentFilePath) {
        loadHistoryForFile(currentFilePath);
      }
    } else {
      // Hide drawer
      historyDrawer.classList.add('hidden');
    }
  }

  // Function to load history for a specific file
  async function loadHistoryForFile(filePath: string) {
    if (!historyList) return;

    // Show loading state
    historyList.innerHTML = '<div class="history-loading">Loading commit history...</div>';

    // Fetch and render commit history
    const commits = await fetchCommitHistory(filePath);
    renderCommitHistory(commits);
  }

  function persistModified() {
    try {
      localStorage.setItem(modifiedKey, JSON.stringify([...modifiedFiles]));
    } catch (err) {
      console.warn('Failed to persist modified files set', err);
    }
  }
  let dirty = false;
  
  const contentEditor = await initContentEditor('#editor-root', currentMarkdown);

  // After editor is ready, set accurate baseline to avoid false dirty state
  baselineMarkdown = currentMarkdown;
  showDraft(false);

  // --- Unsaved indicator & local draft handling ---
  
  
  
  

  function showDraft(show: boolean) {
    if (saveBtn) {
    saveBtn.disabled = !show;
    saveBtn.classList.toggle('hidden', !show);
  }
    // Toggle pill
    if (draftText) {
      draftText.classList.toggle('hidden', !show);
    }
    // Toggle discard visibility
    if (discardBtn) {
      discardBtn.classList.toggle('hidden', !show);
    }

    // Update modified files set and class
    if (currentFilePath) {
      if (show) {
        modifiedFiles.add(currentFilePath);
      } else {
        modifiedFiles.delete(currentFilePath);
      }
      persistModified();
      const itemEl = document.querySelector(`.infinite-tree-item[data-id="${CSS.escape(currentFilePath)}"]`);
      if (itemEl) {
        itemEl.classList.toggle('modified', show);
      }
    }

  }

  function getCurrentContent(): string {
    if (currentMode === 'raw') {
      return rawTextarea.value;
    }
    return contentEditor.getMarkdown() || '';
  }

  function normalizeMarkdown(content: string): string {
    // Normalize markdown content for comparison
    // Remove trailing whitespace and ensure consistent line endings
    return (content || '').trim().replace(/\r\n/g, '\n');
  }



  function normalizeForComparison(content: string): string {
    return content
      .trim()
      .replace(/(<br\s*\/?>\n*)*$/gi, '') // Remove trailing <br> tags with optional newlines
      .replace(/(<p\s*\/?>\n*)*$/gi, '')  // Remove trailing <p> tags with optional newlines
      .trim();
  }
  // Check dirty flag every 2 s and update UI
  setInterval(() => {
    const content = getCurrentContent();
    
    // Use normalized content comparison with HTML tag stripping to avoid false positives
    const normalizedContent = normalizeForComparison(content);
    const normalizedBaseline = normalizeForComparison(baselineMarkdown);
    
    const isDirty = normalizedContent !== normalizedBaseline;
    
    dirty = isDirty;
    showDraft(dirty);
  }, 2000);

  // Auto-save draft every 10 s
  setInterval(() => {
    if (!dirty || !currentFilePath) return;
    
    // Don't save draft if we don't have the git hash yet (prevents drafts without baseCommitHash)
    if (!currentFileGitHash) {
      console.log(`[DRAFT] Skipping auto-save for ${currentFilePath} - waiting for git hash`);
      return;
    }
    
    // Only save draft if content actually differs from server content
    const currentContent = getCurrentContent();
    const currentTrimmed = currentContent.trim();
    const baselineTrimmed = baselineMarkdown.trim();
    
    if (currentTrimmed === baselineTrimmed) {
      // Content is the same as server - no need to save draft
      return;
    }
    
    try {
      // Use lockService to save draft with expiry if we have a lock
      const lockId = lockService.getCurrentLockId(currentFilePath);
      if (lockId) {
        // Calculate expiry (5 minutes from now, matching server TTL)
        const lockExpiry = new Date(Date.now() + 5 * 60 * 1000).toISOString();
        lockService.saveDraft(currentFilePath, currentContent, lockExpiry, currentFileGitHash);
      } else {
        // Save without expiry if no lock
        lockService.saveDraft(currentFilePath, currentContent, undefined, currentFileGitHash);
      }
    } catch (err) {
      console.warn('Failed to store draft:', err);
    }
  }, 10000);



  // --- Save handling ---
  async function handleSave() {
    if (!dirty || !currentFilePath) return;
    
    // Check if we have a valid lock for this file
    const currentLockId = lockService.getCurrentLockId(currentFilePath);
    
    // If we don't have a lock ID, try to acquire one
    if (!currentLockId) {
      const lockAcquired = await acquireLockForFile(currentFilePath);
      if (!lockAcquired) {
        showLockConflictNotification({
          lock_info: {
            owner: 'another user'
          }
        });
        return;
      }
    }
    
    // Double-check lock status before saving
    const lockStatus = await lockService.checkLockStatus(currentFilePath);
    const finalLockId = lockService.getCurrentLockId(currentFilePath);
    
    if (!lockStatus.locked || !finalLockId) {
      showLockConflictNotification({
        lock_info: {
          owner: lockStatus.lock_info?.owner || 'another user'
        }
      });
      return;
    }
    
    const content = getCurrentContent();
    
    try {
      // Save to backend with lock enforcement
      const encodedPath = currentFilePath.split('/').map(encodeURIComponent).join('/');
      const response = await fetch(`/api/files/${encodedPath}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Lock-ID': finalLockId || ''
        },
        body: JSON.stringify({ 
          content,
          message: `Update ${currentFilePath}` 
        })
      });
      
      if (!response.ok) {
        if (response.status === 423) {
          // Lock conflict
          const errorData = await response.json();
          showLockConflictNotification(errorData);
          return;
        }
        throw new Error(`Save failed: ${response.statusText}`);
      }
      
      // Save successful
      baselineMarkdown = content;
      if (currentFilePath) {
        localStorage.removeItem(`${draftPrefix}${currentFilePath}`);
      }
      dirty = false;
      showDraft(false);
      modifiedFiles.delete(currentFilePath);
      persistModified();
      const itemEl = document.querySelector(`.infinite-tree-item[data-id="${CSS.escape(currentFilePath)}"]`);
      if (itemEl) itemEl.classList.remove('modified');
      
      // Immediately update commit meta to show the save was successful
      await updateCommitMeta(currentFilePath);
      
      // Add green color feedback to indicate successful save
      if (commitMetaEl) {
        commitMetaEl.style.color = '#22c55e'; // Green color
        commitMetaEl.style.transition = 'color 0.3s ease';
        
        // Remove green color after 3 seconds
        setTimeout(() => {
          if (commitMetaEl) {
            commitMetaEl.style.color = '';
          }
        }, 3000);
      }
      
    } catch (error) {
      console.error('Save error:', error);
      
      showNotification('save-error', 'Save Failed', error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  // Save button click
  saveBtn?.addEventListener('click', () => {
    handleSave();
  });

  // Discard changes handler
  const discardDialog = document.querySelector('[data-id="discard-dialog"]') as HTMLDialogElement | null;
  const discardConfirmBtn = document.querySelector('[data-id="discard-confirm"]') as HTMLButtonElement | null;
  const discardCancelBtn = document.querySelector('[data-id="discard-cancel"]') as HTMLButtonElement | null;

  // Delete file handler
  const deleteDialog = document.querySelector('[data-id="delete-dialog"]') as HTMLDialogElement | null;
  const deleteFilePathEl = document.querySelector('[data-id="delete-file-path"]') as HTMLElement | null;
  const deleteCancelBtn = document.querySelector('[data-id="delete-cancel"]') as HTMLButtonElement | null;
  const deleteConfirmBtn = document.querySelector('[data-id="delete-confirm"]') as HTMLButtonElement | null;

  // Delete directory handler
  const deleteDirectoryDialog = document.querySelector('[data-id="delete-directory-dialog"]') as HTMLDialogElement | null;
  const deleteDirectoryPathEl = document.querySelector('[data-id="delete-directory-path"]') as HTMLElement | null;
  const deleteDirectoryRealPathEl = document.querySelector('[data-id="delete-directory-real-path"]') as HTMLInputElement | null;
  const deleteDirectoryCancelBtn = document.querySelector('[data-id="delete-directory-cancel"]') as HTMLButtonElement | null;
  const deleteDirectoryConfirmBtn = document.querySelector('[data-id="delete-directory-confirm"]') as HTMLButtonElement | null;

  discardBtn?.addEventListener('click', () => {
    if (!dirty || !discardDialog) return;
    discardDialog.showModal();
  });

  discardConfirmBtn?.addEventListener('click', async () => {
    try {
      // Revert editor to baseline content
      contentEditor.replaceContent(baselineMarkdown);
      rawTextarea.value = baselineMarkdown;
      currentMarkdown = baselineMarkdown;
      
      dirty = false;
      if (currentFilePath) {
        localStorage.removeItem(`${draftPrefix}${currentFilePath}`);
        modifiedFiles.delete(currentFilePath);
        persistModified();
        const itemEl = document.querySelector(`.infinite-tree-item[data-id="${CSS.escape(currentFilePath)}"]`);
        if (itemEl) itemEl.classList.remove('modified');
        
        // Release the lock since we're no longer editing
        await releaseLockForFile(currentFilePath);
      }
      showDraft(false);
      discardDialog?.close();
      
      console.log('[DISCARD] Reverted', currentFilePath, 'to baseline');
    } catch (error) {
      console.error('[DISCARD] Error:', error);
    }
  });

  discardCancelBtn?.addEventListener('click', () => {
    discardDialog?.close();
  });

  // Delete dialog event listeners
  deleteCancelBtn?.addEventListener('click', () => {
    deleteDialog?.close();
  });

  deleteConfirmBtn?.addEventListener('click', async () => {
    if (!currentFilePath || !deleteDialog) return;
    
    try {
      deleteDialog.close();
      
      const response = await fetch(`/api/files/${encodeURIComponent(currentFilePath)}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        // File deleted successfully, navigate away from deleted file
        // Clear the editor
        currentFilePath = '';
        currentMarkdown = '# Welcome to Markdown Wiki\n\nSelect a file from the sidebar to edit.';
        baselineMarkdown = '';
        
        // Update the editor content
        contentEditor.replaceContent(currentMarkdown);
        
        // Update the tree to remove the deleted file
        await directoryTree?.reloadDirectory('');
        
        // Clear any notifications or status
        showNotification('success', 'File Deleted', 'File deleted successfully');
      } else {
        const errorData = await response.json();
        showNotification('save-error', 'Delete Failed', errorData.detail || 'Unknown error occurred');
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      showNotification('save-error', 'Delete Error', 'Error deleting file');
    }
  });

  // Delete directory dialog event listeners
  deleteDirectoryCancelBtn?.addEventListener('click', () => {
    deleteDirectoryDialog?.close();
  });

  deleteDirectoryConfirmBtn?.addEventListener('click', async () => {
    if (!deleteDirectoryDialog || !deleteDirectoryRealPathEl) return;
    
    const directoryPath = deleteDirectoryRealPathEl.value;
    if (!directoryPath) return;
    
    try {
      deleteDirectoryDialog.close();
      
      const encodedPath = directoryPath.split('/').map(encodeURIComponent).join('/');
      const response = await fetch(`/api/files/${encodedPath}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete directory: ${response.statusText}`);
      }
      
      // Directory deleted successfully
      // Hide create dialog if it's showing
      if (isShowingCreateDialog) {
        hideCreateDialog();
      }
      
      // Reload the tree to remove the deleted directory
      await directoryTree?.loadPreservingExpansion();
      
      // Navigate to a default state
      currentFilePath = null;
      history.replaceState(null, '', '/');
      contentEditor.replaceContent('# Welcome to Markdown Wiki\n\nSelect a file from the sidebar to edit.');
      await updateMode('read');
      
      // Show success notification
      showNotification('success', 'Directory Deleted', 'Empty directory deleted successfully');
      
    } catch (error) {
      console.error('Error deleting directory:', error);
      showNotification('save-error', 'Delete Error', 'Failed to delete directory. Please try again.');
    }
  });

  // Overflow menu event listeners
  overflowBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    overflowDropdown?.classList.toggle('hidden');
  });

  // Close overflow menu when clicking outside
  document.addEventListener('click', (e) => {
    if (overflowDropdown && !overflowDropdown.contains(e.target as Node) && !overflowBtn?.contains(e.target as Node)) {
      overflowDropdown.classList.add('hidden');
    }
  });

  // History item event listener
  historyBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    overflowDropdown?.classList.add('hidden');
    toggleHistoryDrawer();
  });

  // Delete file event listener
  deleteBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    overflowDropdown?.classList.add('hidden');
    
    if (!currentFilePath) return;
    
    // Show delete confirmation dialog
    if (deleteDialog && deleteFilePathEl) {
      deleteFilePathEl.textContent = currentFilePath;
      deleteDialog.showModal();
    }
  });

  historyCloseBtn?.addEventListener('click', () => {
    if (historyDrawer) {
      historyDrawer.classList.add('hidden');
    }
  });

  // Diff view back button event listener
  diffBackBtn?.addEventListener('click', () => {
    hideDiffView();
  });

  // Ctrl+S manual save shortcut
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      handleSave();
    }
  });

  // Create raw textarea for Raw mode
  const rawTextarea = document.createElement('textarea');
  rawTextarea.id = 'raw-editor';
  rawTextarea.style.display = 'none';
  rawTextarea.style.width = '100%';
  // Auto height handled via autoResize function
  const editorRoot = document.querySelector('#editor-root') as HTMLElement;
  const milkdownElement = editorRoot.querySelector('.milkdown') as HTMLElement | null;

  editorRoot.appendChild(rawTextarea);

  // Auto-resize raw textarea
  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }
  rawTextarea.addEventListener('input', () => autoResize(rawTextarea));

  type Mode = 'read' | 'wysiwyg' | 'raw';
  let currentMode: Mode = (localStorage.getItem('editorMode') as Mode) || 'read';

  // Function to update button states based on lock status
  async function updateButtonStates(isLockedByOther: boolean) {
    const editButtons = document.querySelectorAll<HTMLButtonElement>('.mode-btn[data-mode="wysiwyg"], .mode-btn[data-mode="raw"]');
    
    editButtons.forEach(btn => {
      if (isLockedByOther) {
        btn.disabled = true;
        btn.title = 'File is locked by another user';
        btn.classList.add('disabled-by-lock');
      } else {
        btn.disabled = false;
        btn.title = '';
        btn.classList.remove('disabled-by-lock');
      }
    });
    
    // If currently in an edit mode and file becomes locked, switch to read mode
    if (isLockedByOther && (currentMode === 'wysiwyg' || currentMode === 'raw')) {
      await updateMode('read');
    }
  }

  async function updateMode(mode: Mode) {
    // If transitioning from read mode to an edit mode, acquire lock first
    if (currentMode === 'read' && (mode === 'wysiwyg' || mode === 'raw') && currentFilePath) {
      const lockResult = await acquireLockForFile(currentFilePath, true);
      if (!lockResult.success) {
        // Lock acquisition failed, stay in read mode

        return;
      }
      
      // After acquiring lock, ensure any existing draft has the correct git hash
      if (currentFileGitHash) {
        const existingDraft = lockService.getDraftData(currentFilePath);
        if (existingDraft && !existingDraft.baseCommitHash) {
          console.log(`[GIT HASH] Updating draft after lock acquisition for ${currentFilePath} with base commit hash: ${currentFileGitHash.substring(0, 8)}`);
          const lockId = lockService.getCurrentLockId(currentFilePath);
          const lockExpiry = lockId ? new Date(Date.now() + 5 * 60 * 1000).toISOString() : undefined;
          lockService.saveDraft(currentFilePath, existingDraft.content, lockExpiry, currentFileGitHash);
        }
      }
    }

    // If leaving RAW, push textarea content into editor
    if (currentMode === 'raw' && mode !== 'raw') {
      currentMarkdown = rawTextarea.value;
      contentEditor.replaceContent(currentMarkdown);
    }


    // Apply mode effects
    if (mode === 'read') {
      rawTextarea.style.display = 'none';
      if (milkdownElement) {
        milkdownElement.style.pointerEvents = 'none';
        milkdownElement.style.display = '';
        milkdownElement.classList.add('readonly');
      }
      contentEditor.setEditable(false);
      contentEditor.cleanupForRead();
      currentMarkdown = contentEditor.getMarkdown() || currentMarkdown;
    } else if (mode === 'raw') {
      currentMarkdown = contentEditor.getMarkdown() || currentMarkdown;
      rawTextarea.value = currentMarkdown;
      autoResize(rawTextarea);
      rawTextarea.style.display = 'block';
      contentEditor.setEditable(false);
      if (milkdownElement) {
        milkdownElement.style.pointerEvents = 'none';
        milkdownElement.style.display = 'none';
      }
    } else {
      // wysiwyg
      rawTextarea.style.display = 'none';
      if (milkdownElement) {
        milkdownElement.style.pointerEvents = '';
        milkdownElement.style.display = '';
        milkdownElement.classList.remove('readonly');
      }
      contentEditor.setEditable(true);
      currentMarkdown = contentEditor.getMarkdown() || currentMarkdown;
    }

    // Update UI and state
    currentMode = mode;
    localStorage.setItem('editorMode', mode);
    document.querySelectorAll<HTMLButtonElement>('.mode-btn').forEach((btn) => {
      btn.classList.toggle('selected', btn.dataset.mode === mode);
    });
  }

  // Attach listeners
  document.querySelectorAll<HTMLButtonElement>('.mode-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const mode = btn.dataset.mode as Mode;
      await updateMode(mode);
    });
  });

  // Keyboard shortcut Ctrl+E cycles modes
  document.addEventListener('keydown', async (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
      e.preventDefault();
      const order: Mode[] = ['read', 'wysiwyg', 'raw'];
      const idx = order.indexOf(currentMode);
      const nextMode = order[(idx + 1) % order.length] as Mode;
      await updateMode(nextMode);
    }
  });

  // Apply initial mode
  await updateMode(currentMode);

  // Find tree container
    const treeContainer = document.querySelector('[data-id="tree"]');
  if (!(treeContainer instanceof HTMLElement)) {
    console.error('[FATAL] Tree container not found or not an HTMLElement. Ensure <div id="tree-drawer" data-id="tree"> exists and script runs after DOM is ready.');
    return;
  }




  // Determine initial path from URL (deep link)
  const rawPath = window.location.pathname.slice(1);
  const initialPath = rawPath ? decodeURIComponent(rawPath) : undefined;

  // Create DirectoryTree instance
  directoryTree = new DirectoryTree({
    el: treeContainer,
    selectDefault: initialPath ? false : true,
    
    onCreateFile: async (parentPath: string, name: string, isDirectory: boolean) => {
      // Construct the full path for the new file/directory
      const fullPath = parentPath ? `${parentPath}/${name}` : name;
      
      try {
        if (isDirectory) {
          // Create directory
          const url = parentPath ? 
            `/api/directory?parent_path=${encodeURIComponent(parentPath)}` : 
            '/api/directory';
          
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: name,
              message: `Create directory ${fullPath}`
            })
          });
          
          if (!response.ok) {
            throw new Error(`Failed to create directory: ${response.statusText}`);
          }
        } else {
          // Create file with default heading from humanized filename
          const humanizedName = humanizeFileName(name);
          const defaultContent = `# ${humanizedName}\n\n`;
          
          const encodedPath = fullPath.split('/').map(encodeURIComponent).join('/');
          const response = await fetch(`/api/files/${encodedPath}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              content: defaultContent,
              message: `Create file ${fullPath}`
            })
          });
          
          if (!response.ok) {
            throw new Error(`Failed to create file: ${response.statusText}`);
          }
        }
        
        // Reload the tree to show the new file/directory while preserving expansion state
        if (isDirectory) {
          // For directories, expand the newly created directory
          await directoryTree?.loadPreservingExpansion(fullPath);
        } else {
          // For files, just preserve existing expansion state
          await directoryTree?.loadPreservingExpansion();
        }
        
        // If we created a file, select it
        if (!isDirectory) {
          setTimeout(() => {
            directoryTree?.selectPath(fullPath);
          }, 100);
        } else {
          // If we created a directory, show create dialog for the new directory
          setTimeout(() => {
            directoryTree?.showCreateDialogForDirectory(fullPath);
          }, 300);
        }
        
      } catch (error) {
        console.error('Error creating file/directory:', error);
        throw error; // Re-throw so the UI can handle it
      }
    },
    
    onFileSelect: async (node: TreeNode) => {
      // Guard: Skip content loading for create nodes
      if (node.isCreateItem) {
        return;
      }

      // If create dialog is showing, dismiss it first
      if (isShowingCreateDialog) {
        hideCreateDialog();
      }

      // Persist current draft before navigation
      if (dirty && currentFilePath) {
        try {
          // Only save draft if content actually differs from server content
          const currentContent = getCurrentContent();
          const currentTrimmed = currentContent.trim();
          const baselineTrimmed = baselineMarkdown.trim();
          
          if (currentTrimmed !== baselineTrimmed) {
            // Content differs from server - save draft
            const lockId = lockService.getCurrentLockId(currentFilePath);
            if (lockId) {
              // Calculate expiry (5 minutes from now, matching server TTL)
              const lockExpiry = new Date(Date.now() + 5 * 60 * 1000).toISOString();
              lockService.saveDraft(currentFilePath, currentContent, lockExpiry, currentFileGitHash || undefined);
            } else {
              // Save without expiry if no lock
              lockService.saveDraft(currentFilePath, currentContent, undefined, currentFileGitHash || undefined);
            }
          }
        } catch (err) {
          console.warn('Failed to store draft before navigation:', err);
        }
      }

      // Release lock on previous file if any
      if (currentFilePath && currentFilePath !== node.id) {
        await releaseLockForFile(currentFilePath);
      }

      currentFilePath = node.id;
      currentFileGitHash = node.gitHash || null; // Store git hash for conflict detection
      
      // If gitHash is not available (because we only fetch hashes for draft files),
      // fetch it now for conflict detection if needed
      if (!currentFileGitHash) {
        await fetchGitHashForCurrentFile();
      }
      
      // Update any existing draft with the correct git hash if it's missing
      if (currentFileGitHash) {
        const existingDraft = lockService.getDraftData(currentFilePath);
        if (existingDraft && !existingDraft.baseCommitHash) {
          console.log(`[GIT HASH] Updating existing draft for ${currentFilePath} with base commit hash: ${currentFileGitHash.substring(0, 8)}`);
          lockService.saveDraft(currentFilePath, existingDraft.content, existingDraft.lockExpiry, currentFileGitHash);
        }
      }
      
      // Always reset to read mode when navigating to a new file
      // This prevents unintentional lock acquisition from persisted editor mode
      await updateMode('read');
      
      // Enable edit buttons by default - lock will be acquired when user enters edit mode
      updateButtonStates(false);

      // Update browser path to current file (SPA deep link)
      try {
        const encoded = currentFilePath.split('/').map(encodeURIComponent).join('/');
        history.replaceState(null, '', `/${encoded}`);
      } catch (err) {
        console.warn('Failed to update URL', err);
      }

      // Check for draft conflicts before loading content (only if we have a git hash)
      if (currentFileGitHash) {
        const conflictResult = await lockService.checkDraftConflict(currentFilePath, currentFileGitHash);
        if (conflictResult.isStale) {
          console.log(`[CONFLICT] Draft for ${currentFilePath} is stale (base: ${conflictResult.baseHash?.substring(0, 8)}, current: ${conflictResult.currentHash?.substring(0, 8)})`);
          
          // Show conflict resolution dialog
          const discardDraft = await showDraftConflictDialog(currentFilePath, conflictResult.baseHash, conflictResult.currentHash);
          if (discardDraft) {
            lockService.discardStaleDraft(currentFilePath);
            console.log(`[CONFLICT] Discarded stale draft for ${currentFilePath}`);
          }
        }
      }

      const serverContent = await fetchFileContent(node.id);
      // Use lockService to get draft content (handles cleanup and format conversion)
      const draftData = lockService.getDraftData(currentFilePath);
      const draftContent = draftData?.content;
      const contentToLoad = draftContent ?? serverContent;
      currentMarkdown = contentToLoad;
      
      // Load content into editor
      contentEditor.replaceContent(contentToLoad);
      rawTextarea.value = contentToLoad; // keep RAW view in sync
      
      // Set baseline to the server content (not the draft content)
      baselineMarkdown = serverContent;
      
      // Only show draft mode if there's actual draft content that differs from server
      // Use normalized comparison to avoid false positives from formatting differences
      // Also ensure we have meaningful content differences, not just whitespace/formatting
      const hasDraftChanges = draftContent !== null && draftContent !== undefined &&
        draftContent.trim() !== serverContent.trim() &&
        normalizeMarkdown(draftContent) !== normalizeMarkdown(serverContent);
      dirty = hasDraftChanges;
      
      // Defer showDraft to avoid orange flash on file selection
      // Only apply modified styling if we're confident there are real changes
      setTimeout(() => {
        showDraft(hasDraftChanges);
      }, 0);
      // If this file was previously marked modified, ensure class persists
      if (modifiedFiles.has(currentFilePath)) {
        const itemEl = document.querySelector(`.infinite-tree-item[data-id="${CSS.escape(currentFilePath)}"]`);
        if (itemEl) itemEl.classList.add('modified');
      }
      // Update commit meta display for the selected file
      updateCommitMeta(currentFilePath);
    }
  });
  await directoryTree.load();

  // After tree loaded, apply deep link if any
  if (initialPath) {
    directoryTree.selectPath(initialPath);
  }

  // Apply highlight to any already-known modified files present in the DOM
  function highlightModified() {
    modifiedFiles.forEach((path) => {
      const el = document.querySelector(`.infinite-tree-item[data-id="${CSS.escape(path)}"]`);
      if (el) el.classList.add('modified');
    });
  }
  highlightModified();
  // Observe mutations in the tree to re-apply highlights when directories are expanded
  const mo = new MutationObserver(() => highlightModified());
  mo.observe(treeContainer, { subtree: true, childList: true });

  // Periodic lock status refresh for editor header and button states
  setInterval(async () => {
    if (currentFilePath) {
      await updateCommitMeta(currentFilePath);
      
      // Also update button states based on current lock status
      const lockStatus = await lockService.checkLockStatus(currentFilePath);
      const ownedByMe = await lockService.isOwnedByCurrentSession(currentFilePath);
      const isLockedByOther = lockStatus.locked && !ownedByMe;
      updateButtonStates(isLockedByOther);
    }
  }, 30000); // Refresh every 30 seconds

  // Clean up locks when the page is about to unload
  window.addEventListener('beforeunload', async () => {
    if (currentFilePath) {
      // Try to release the current lock (best effort)
      try {
        await releaseLockForFile(currentFilePath);
      } catch (error) {
        console.warn('Failed to release lock on page unload:', error);
      }
    }
  });

  // Create dialog functionality
  function showCreateDialogInContent(parentPath: string, onCreateFile: (parentPath: string, name: string, isDirectory: boolean) => Promise<void>, isEmpty: boolean = false) {
    // If a create dialog is already showing, hide it first so we can show the new one
    if (isShowingCreateDialog) {
      hideCreateDialog();
    }
    
    isShowingCreateDialog = true;
    previousFilePathBeforeCreate = currentFilePath;
    
    // Clear current file path to indicate we're not editing a file
    currentFilePath = null;
    
    // Update URL to show create state
    const pathSegment = parentPath ? `${parentPath}/` : '';
    history.replaceState(null, '', `/${pathSegment}__create__`);
    
    // Hide status bar actions and show create-specific buttons
    const statusActions = document.querySelector('.status-actions');
    const modeControl = document.querySelector('.mode-control');
    const statusMeta = document.querySelector('.status-meta');
    if (statusActions) statusActions.style.display = 'none';
    if (modeControl) modeControl.style.display = 'none';
    if (statusMeta) statusMeta.style.display = 'none';
    
    // Hide the existing editor content
    const editorRoot = document.querySelector('#editor-root') as HTMLElement;
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
          <p class="create-dialog-description">Enter a name for your new file or directory${isEmpty && parentPath ? ', or delete this empty directory' : ''}</p>
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
            <button class="btn btn-secondary create-cancel">Cancel</button>
            <button class="btn btn-primary create-submit">Create</button>
            ${isEmpty && parentPath ? '<button class="btn btn-danger create-delete">Delete Directory</button>' : ''}
          </div>
        </div>
      </div>
    `;
    
    editorRoot.appendChild(dialogElement);
    
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
      cancelCreateDialog();
    };
    
    // Handle delete directory
    const handleDelete = async () => {
      if (!isEmpty || !parentPath) {
        console.error('Delete attempted on non-empty directory or root');
        return;
      }
      
      // Show native delete directory dialog
      if (deleteDirectoryDialog && deleteDirectoryPathEl && deleteDirectoryRealPathEl) {
        deleteDirectoryPathEl.textContent = humanizedParentPath || parentPath;
        deleteDirectoryRealPathEl.value = parentPath; // Store the real path for API call
        deleteDirectoryDialog.showModal();
      }
    };
    
    // Event handlers
    dialogElement.querySelector('.create-cancel')?.addEventListener('click', handleCancel);
    dialogElement.querySelector('.create-submit')?.addEventListener('click', handleCreate);
    if (isEmpty && parentPath) {
      dialogElement.querySelector('.create-delete')?.addEventListener('click', handleDelete);
    }
    
    // Handle Enter key
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleCreate();
      }
    });
    
    // Handle Escape key
    document.addEventListener('keydown', handleEscapeKey);
    
    function handleEscapeKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && isShowingCreateDialog) {
        e.preventDefault();
        cancelCreateDialog();
      }
    }
    
    // Store the escape handler so we can remove it later
    (editorRoot as any)._escapeHandler = handleEscapeKey;
  }
  
  function hideCreateDialog() {
    if (!isShowingCreateDialog) return;
    
    isShowingCreateDialog = false;
    
    // Remove escape key handler
    const editorRoot = document.querySelector('#editor-root') as HTMLElement;
    const escapeHandler = (editorRoot as any)._escapeHandler;
    if (escapeHandler) {
      document.removeEventListener('keydown', escapeHandler);
      (editorRoot as any)._escapeHandler = null;
    }
    
    // Remove the create dialog overlay
    const dialogElement = editorRoot.querySelector('.create-dialog-overlay');
    if (dialogElement) {
      dialogElement.remove();
    }
    
    // Restore the existing editor content
    const existingChildren = Array.from(editorRoot.children);
    existingChildren.forEach(child => {
      (child as HTMLElement).style.display = '';
    });
    
    // Restore status bar visibility
    const statusActions = document.querySelector('.status-actions');
    const modeControl = document.querySelector('.mode-control');
    const statusMeta = document.querySelector('.status-meta');
    if (statusActions) statusActions.style.display = '';
    if (modeControl) modeControl.style.display = '';
    if (statusMeta) statusMeta.style.display = '';
    
    // Note: We don't restore the previous file here because hideCreateDialog 
    // is called from onFileSelect when the user clicks on a file.
    // The file selection will handle loading the content.
    
    previousFilePathBeforeCreate = null;
  }
  
  async function cancelCreateDialog() {
    if (!isShowingCreateDialog) return;
    
    // Store the previous file path before hiding the dialog
    const prevPath = previousFilePathBeforeCreate;
    
    // First hide the dialog
    hideCreateDialog();
    
    // Then restore previous file if any
    if (prevPath && directoryTree) {
      directoryTree.selectPath(prevPath);
    } else {
      // Clear editor and show welcome message
      currentFilePath = null;
      history.replaceState(null, '', '/');
      contentEditor.replaceContent('# Welcome to Markdown Wiki\n\nSelect a file from the sidebar to edit.');
      await updateMode('read');
    }
    
    // Restore focus to the tree view for keyboard navigation
    const treeContainer = document.querySelector('[data-id="tree"]') as HTMLElement;
    if (treeContainer) {
      treeContainer.focus();
    }
  }
  
  // Listen for create dialog events from tree
  document.addEventListener('showCreateDialog', (event: CustomEvent) => {
    const { parentPath, isEmpty, onCreateFile } = event.detail;
    showCreateDialogInContent(parentPath, onCreateFile, isEmpty);
  });

  // Initialize drawer toggle
  setupDrawer('#tree-drawer');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
