import { initContentEditor } from './content';
import { DirectoryTree, TreeNode } from './tree';
import { setupDrawer } from './drawer';


import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/frame.css';
import './styles.css';



interface ApiFileResponse {
  content: string;
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


async function main() {
  // Initialize content editor
  const draftPill = document.querySelector('[data-id="draft-pill"]') as HTMLElement | null;
  const saveBtn = document.querySelector('[data-id="save-btn"]') as HTMLButtonElement | null;
  const revertBtn = document.querySelector('[data-id="revert-btn"]') as HTMLButtonElement | null;

  let currentMarkdown = '# Welcome to Markdown Wiki\n\nSelect a file from the sidebar to edit.';
  let baselineMarkdown = '';
  // Draft/dirty tracking vars declared early to avoid hoisting issues
  let currentFilePath = '';
  const draftPrefix = 'draft:';
  const modifiedKey = 'modifiedFiles';
  const modifiedFiles = new Set<string>(JSON.parse(localStorage.getItem(modifiedKey) || '[]'));

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
    // Toggle pill
    if (draftPill) {
      draftPill.classList.toggle('hidden', !show);
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

  // Revert handler
  revertBtn?.addEventListener('click', () => {
    if (!dirty) return;
    if (confirm('Discard local changes and revert to last saved version?')) {
      contentEditor.replaceContent(baselineMarkdown);
      rawTextarea.value = baselineMarkdown;
      dirty = false;
      showDraft(false);
      if (currentFilePath) {
        localStorage.removeItem(`${draftPrefix}${currentFilePath}`);
        modifiedFiles.delete(currentFilePath);
        const itemEl = document.querySelector(`.infinite-tree-item[data-id="${CSS.escape(currentFilePath)}"]`);
        if (itemEl) itemEl.classList.remove('modified');
      }
    }
  });

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




  // Create DirectoryTree instance
  const directoryTree = new DirectoryTree({
    el: treeContainer,
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
    }
  });
  await directoryTree.load();

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
