import { Crepe } from '@milkdown/crepe';
import InfiniteTree from 'infinite-tree';
import './styles.css';
import 'infinite-tree/dist/infinite-tree.css';
import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/frame.css';

interface TreeNode {
  id: string;          // Full path
  name: string;        // Display name
  isDirectory: boolean;
  children?: TreeNode[];
  state?: {
    depth?: number;
    open?: boolean;
    selected?: boolean;
    loading?: boolean;
  };
}

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

async function fetchDirectoryTreeData(): Promise<TreeNode[]> {
  try {
    const response = await fetch('/api/files/tree');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error loading directory tree:', error);
    return [{ 
      id: 'error', 
      name: 'Failed to load directory',
      isDirectory: false
    }];
  }
}

async function loadDirectoryContents(node: TreeNode, tree: InfiniteTree): Promise<void> {
  if (!node.isDirectory || node.state?.loading) return;
  try {
    node.state = { ...(node.state || {}), loading: true };
    tree.updateNode(node);
    const response = await fetch(`/api/files/${encodeURIComponent(node.id)}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    node.children = data.children || [];
    node.state = { ...(node.state || {}), loading: false, open: true };
    tree.updateNode(node);
  } catch (error) {
    console.error(`Error loading directory '${node.id}':`, error);
    node.state = { ...(node.state || {}), loading: false };
    tree.updateNode(node);
  }
}

async function main() {
  // Initialize Milkdown editor
  await new Crepe({
    root: '#app',
    defaultValue: '# Welcome to Markdown Wiki\n\nSelect a file from the sidebar to edit.',
  }).create();

  // Find tree container
    const treeContainer = document.querySelector('[data-id="tree"]');
  if (!treeContainer) {
    console.error('[FATAL] Tree container not found in DOM. Ensure <div id="tree-drawer" data-id="tree"> exists and script runs after DOM is ready.');
    return;
  }

  // Fetch directory tree data
  const treeDataRaw = await fetchDirectoryTreeData();

  // Recursively add isDirectory to each node
  function addIsDirectory(node: any): any {
    const isDirectory = Array.isArray(node.children) && node.children.length > 0;
    return {
      ...node,
      isDirectory,
      children: Array.isArray(node.children)
        ? node.children.map(addIsDirectory)
        : node.children,
    };
  }
  const treeData = Array.isArray(treeDataRaw)
    ? treeDataRaw.map(addIsDirectory)
    : treeDataRaw;

  // Create InfiniteTree instance
  const tree = new InfiniteTree({
    el: treeContainer,
    data: treeData,
    autoOpen: false,
    childrenProperty: 'children',
    renderNode: (node: TreeNode) => {
      const { id, name, isDirectory, state = {} } = node;
      const { depth = 0, open, selected, loading } = state;
      const indent = depth * 16;
      return `
        <div class="infinite-tree-node" data-id="${id}">
          <div class="node-content${selected ? ' selected' : ''}" style="padding-left: ${indent}px" ${isDirectory ? 'data-action="toggle"' : ''}>
            <span class="toggler">${isDirectory ? (open ? '▼' : '▶') : ''}</span>
            <span class="node-icon">${isDirectory ? '📁' : '📄'}</span>
            <span class="node-name">${name}</span>
            ${loading ? '<span class=\"loading\">⟳</span>' : ''}
          </div>
        </div>
      `;
    }
  });

  // DEBUG: Direct click handler for InfiniteTree DOM
  treeContainer.addEventListener('click', (event: Event) => {
    const target = event.target as HTMLElement;
    // Find the closest .infinite-tree-node
    const nodeDiv = target.closest('.infinite-tree-node');
    if (!nodeDiv) return;
    // Find the containing .infinite-tree-item for the data-id
    const itemDiv = nodeDiv.closest('.infinite-tree-item');
    const itemEl = itemDiv as HTMLElement | null;
    if (itemEl && itemEl.dataset.id) {
      const node = tree.getNodeById(itemEl.dataset.id);
      if (node) {
        // Debug: what was clicked?
        if (target.classList.contains('infinite-tree-title')) {
          if (node.isDirectory) {
            tree.toggleNode(node);
          }
        } else if (target.classList.contains('infinite-tree-toggler')) {
          if (node.isDirectory) {
            tree.toggleNode(node);
          }
        }
      }
    }
  });


  // Event: Node select
  tree.on('select', async (node: TreeNode) => {
    console.log('[DEBUG] select event:', node);
    if (node.isDirectory) {
      console.log('[DEBUG] toggling directory:', node.id, node.name);
      tree.toggleNode(node);
      return;
    }
    // For files, load content
    console.log('[DEBUG] file selected:', node.id, node.name);
    const content = await fetchFileContent(node.id);
    // Set content in Milkdown editor
    // (Assume #app is the Milkdown root)
    // This example assumes Milkdown API provides a way to set content
    // You may need to adjust this depending on actual Milkdown usage
    // Example:
    // editor.setContent(content);
  });

  // Event: Node toggle (expand/collapse)
  tree.on('toggle', async (node: TreeNode, isOpen: boolean) => {
    if (isOpen && node.isDirectory && (!node.children || node.children.length === 0)) {
      await loadDirectoryContents(node, tree);
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
