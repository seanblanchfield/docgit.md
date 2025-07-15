import { initContentEditor } from './content';
import { DirectoryTree, TreeNode } from './tree';
import { setupDrawer } from './drawer';
import { humanizeTime } from './humanize';
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
let lockRefreshInterval: (() => void) | null = null;
let directoryTree: DirectoryTree | null = null;

// Lock management functions
async function acquireLockForFile(filePath: string, showNotification: boolean = true): Promise<{success: boolean, conflict?: any}> {
  try {
    const result = await lockService.acquireLock(filePath, 'user');
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
    await lockService.releaseLock(filePath);
    
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
function showNotification(type: 'lock-conflict' | 'lock-lost' | 'save-error', title: string, message: string): void {
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
    const response = await fetch(`/api/files/${filePath}`);
    if (!response.ok) {
      console.error(`Error fetching file '${filePath}': ${response.status} ${response.statusText}`);
      return `# Error\n\nCould not load ${filePath}. Status: ${response.status}`;
    }
    const jsonData: ApiFileResponse = await response.json();
    return jsonData.content || '';``
  } catch (error) {
    console.error(`Error fetching file '${filePath}':`, error);
    return `# Error\n\nCould not fetch ${filePath}.`;
  }
}

async function fetchLatestCommit(filePath: string): Promise<CommitDetail | null> {
  try {
    const response = await fetch(`/api/history/${filePath}?limit=1`);
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
  const historyBtn = document.querySelector('[data-id="history-btn"]') as HTMLAnchorElement | null;
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
  const ownedByMe = lockService.hasLock(filePath);
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
      const response = await fetch(`/api/history/${encodeURIComponent(filePath)}`);
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
      const response = await fetch(`/api/diff/${encodeURIComponent(filePath)}?sha1=${parentSha}&sha2=${commitSha}`);
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
  baselineMarkdown = contentEditor.getMarkdown() || currentMarkdown;
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

  // Check dirty flag every 2 s and update UI
  setInterval(() => {
    const content = getCurrentContent();
    dirty = content !== baselineMarkdown;
    showDraft(dirty);
  }, 2000);

  // Auto-save draft every 10 s
  setInterval(() => {
    if (!dirty || !currentFilePath) return;
    const key = `${draftPrefix}${currentFilePath}`;
    try {
      localStorage.setItem(key, getCurrentContent());
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
      const response = await fetch(`/api/files/${currentFilePath}`, {
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

  discardBtn?.addEventListener('click', () => {
    if (!dirty || !discardDialog) return;
    discardDialog.showModal();
  });

  discardConfirmBtn?.addEventListener('click', () => {
    // Revert to baseline
    contentEditor.replaceContent(baselineMarkdown);
    rawTextarea.value = baselineMarkdown;
    dirty = false;
    if (currentFilePath) {
      localStorage.removeItem(`${draftPrefix}${currentFilePath}`);
      modifiedFiles.delete(currentFilePath);
      persistModified();
      const itemEl = document.querySelector(`.infinite-tree-item[data-id="${CSS.escape(currentFilePath)}"]`);
      if (itemEl) itemEl.classList.remove('modified');
    }
    showDraft(false);
  });

  discardCancelBtn?.addEventListener('click', () => {
    discardDialog?.close();
  });

  // History link event listener
  historyBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleHistoryDrawer();
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
  function updateButtonStates(isLockedByOther: boolean) {
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
      updateMode('read');
    }
  }

  function updateMode(mode: Mode) {
  

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
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode as Mode;
      updateMode(mode);
    });
  });

  // Keyboard shortcut Ctrl+E cycles modes
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
      e.preventDefault();
      const order: Mode[] = ['read', 'wysiwyg', 'raw'];
      const idx = order.indexOf(currentMode);
      const nextMode = order[(idx + 1) % order.length] as Mode;
      updateMode(nextMode);
    }
  });

  // Apply initial mode
  updateMode(currentMode);

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
    
    onCreateFile: async (_parentPath: string, _name: string, _isDirectory: boolean) => {
      // TODO: Implement API call to create file/directory
    },
    
    onFileSelect: async (node: TreeNode) => {
      // Guard: Skip content loading for create nodes
      if (node.isCreateItem) {
        return;
      }

      // Persist current draft before navigation
      if (dirty && currentFilePath) {
        try {
          localStorage.setItem(`${draftPrefix}${currentFilePath}`, getCurrentContent());
        } catch (err) {
          console.warn('Failed to store draft before navigation:', err);
        }
      }

      // Release lock on previous file if any
      if (currentFilePath && currentFilePath !== node.id) {
        await releaseLockForFile(currentFilePath);
      }

      currentFilePath = node.id;
      
      // Always reset to read mode when navigating to a new file
      // This prevents unintentional lock acquisition from persisted editor mode
      updateMode('read');
      
      // Try to acquire lock for the selected file (suppress notification on file load)
      const lockResult = await acquireLockForFile(currentFilePath, false);
      if (!lockResult.success) {

        updateButtonStates(true); // Disable edit buttons
      } else {

        updateButtonStates(false); // Enable edit buttons
      }

      // Update browser path to current file (SPA deep link)
      try {
        const encoded = currentFilePath.split('/').map(encodeURIComponent).join('/');
        history.replaceState(null, '', `/${encoded}`);
      } catch (err) {
        console.warn('Failed to update URL', err);
      }

      const draftKey = `${draftPrefix}${currentFilePath}`;
      const serverContent = await fetchFileContent(node.id);
      baselineMarkdown = serverContent;
      const draftContent = localStorage.getItem(draftKey);
      const contentToLoad = draftContent ?? serverContent;
      currentMarkdown = contentToLoad;
      contentEditor.replaceContent(contentToLoad);
      rawTextarea.value = contentToLoad; // keep RAW view in sync
      dirty = draftContent !== null && draftContent !== serverContent;
      showDraft(dirty);
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
      const ownedByMe = lockService.hasLock(currentFilePath);
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

  // Initialize drawer toggle
  setupDrawer('#tree-drawer');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
