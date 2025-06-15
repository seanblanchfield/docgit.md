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
    return jsonData.content || '';
  } catch (error) {
    console.error(`Error fetching file '${filePath}':`, error);
    return `# Error\n\nCould not fetch ${filePath}.`;
  }
}


async function main() {
  // Initialize content editor
  let currentMarkdown = '# Welcome to Markdown Wiki\n\nSelect a file from the sidebar to edit.';
  const contentEditor = await initContentEditor('#editor-root', currentMarkdown);

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
      const content = await fetchFileContent(node.id);
      currentMarkdown = content;
      contentEditor.replaceContent(content);
    }
  });
  await directoryTree.load();

  // Initialize drawer toggle
  setupDrawer('#tree-drawer');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
