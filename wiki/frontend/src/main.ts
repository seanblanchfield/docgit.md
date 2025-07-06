import { initContentEditor } from './content';
import { DirectoryTree, TreeNode } from './tree';
import { setupDrawer } from './drawer';
import { humanizeTime } from './humanize';


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

  let currentMarkdown = '# Welcome to Markdown Wiki\n\nSelect a file from the sidebar to edit.';
  let baselineMarkdown = '';
  // Draft/dirty tracking vars declared early to avoid hoisting issues
  let currentFilePath = '';
  const draftPrefix = 'draft:';
  const modifiedKey = 'modifiedFiles';
  const modifiedFiles = new Set<string>(JSON.parse(localStorage.getItem(modifiedKey) || '[]'));

  // Get commit meta display element
  const commitMetaEl = document.querySelector('[data-id="commit-meta"]') as HTMLElement | null;

  // Function to update commit meta display
  async function updateCommitMeta(filePath: string) {
    if (!commitMetaEl) return;
    
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
  function handleSave() {
    if (!dirty) return;
    baselineMarkdown = getCurrentContent();
    if (currentFilePath) {
      localStorage.removeItem(`${draftPrefix}${currentFilePath}`);
    }
    dirty = false;
    showDraft(false);
    modifiedFiles.delete(currentFilePath);
    persistModified();
    const itemEl = document.querySelector(`.infinite-tree-item[data-id="${CSS.escape(currentFilePath)}"]`);
    if (itemEl) itemEl.classList.remove('modified');
    // TODO: POST to backend save endpoint
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
    }
    showDraft(false);
    modifiedFiles.delete(currentFilePath);
    persistModified();
    const itemEl = document.querySelector(`.infinite-tree-item[data-id="${CSS.escape(currentFilePath)}"]`);
    if (itemEl) itemEl.classList.remove('modified');
  });

  discardCancelBtn?.addEventListener('click', () => {
    discardDialog?.close();
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
  const directoryTree = new DirectoryTree({
    el: treeContainer,
    selectDefault: initialPath ? false : true,
    
    onFileSelect: async (node: TreeNode) => {
      // Persist current draft before navigation
      if (dirty && currentFilePath) {
        try {
          localStorage.setItem(`${draftPrefix}${currentFilePath}`, getCurrentContent());
        } catch (err) {
          console.warn('Failed to store draft before navigation:', err);
        }
      }

      currentFilePath = node.id;
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

  // Initialize drawer toggle
  setupDrawer('#tree-drawer');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
