import { initContentEditor } from './content';
import { DirectoryTree, TreeNode } from './tree';
import { setupDrawer } from './Drawer';
import './styles.css';
import 'infinite-tree/dist/infinite-tree.css';
import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/frame.css';



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
  const contentEditor = await initContentEditor('#content', '# Welcome to Markdown Wiki\n\nSelect a file from the sidebar to edit.');

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
      contentEditor.replaceContent(content);
    }
  });
  await directoryTree.load();

  // Initialize drawer toggle
  setupDrawer('#tree-drawer', '#drawer-toggle');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
