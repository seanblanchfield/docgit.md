import { TreeNode } from './types';
import { fetchDirectoryTreeData, filterHiddenFiles, sortNodes, addIsDirectory } from './data';
import { addCreateItems } from './createItem';

export function updateVisualSelection(el: HTMLElement, nodeId: string) {
  // Remove selection from all items
  const allItems = el.querySelectorAll('.infinite-tree-item');
  allItems.forEach(item => item.classList.remove('infinite-tree-selected'));

  // Add selection to target item
  const targetItem = el.querySelector(`[data-id="${CSS.escape(nodeId)}"]`);
  if (targetItem) {
    targetItem.classList.add('infinite-tree-selected');
  }
}

export function selectPath(tree: any, el: HTMLElement, id: string, onFileSelect: (node: TreeNode) => void) {
  const node = tree.getNodeById(id);
  if (!node) return;

  // open ancestors
  const parts = id.split('/');
  let curr = '';
  for (let i = 0; i < parts.length - 1; i++) {
    curr = curr ? curr + '/' + parts[i]! : parts[i]!;
    const ancestor = tree.getNodeById(curr);
    if (ancestor && ancestor.isDirectory && !ancestor.state?.open) {
      tree.openNode(ancestor);
    }
  }

  // Use robust selection with fallback
  tree.selectNode(node);

  // Ensure visual selection is updated
  updateVisualSelection(el, id);

  // Trigger onFileSelect callback for files (same logic as click handler)
  if (!node.isDirectory && !node.isCreateItem) {
    onFileSelect(node);
  }
}

/**
 * Reload the tree while preserving expansion state
 */
export async function loadPreservingExpansion(tree: any, el: HTMLElement, newDirectoryPath?: string): Promise<void> {
  try {
    // First, capture the current expansion state
    const expandedNodes = new Set<string>();
    const selectedNodeId = tree.getSelectedNodes?.()?.[0]?.id || tree.getSelectedNode?.()?.id;

    // Capture expanded states by checking DOM elements
    const treeItems = el.querySelectorAll('.infinite-tree-item');
    treeItems.forEach(item => {
      const itemId = item.getAttribute('data-id');
      if (itemId) {
        const node = tree.getNodeById(itemId);
        if (node && node.state?.open) {
          expandedNodes.add(itemId);
        }
      }
    });

    // If a new directory was created, also expand it
    if (newDirectoryPath) {
      expandedNodes.add(newDirectoryPath);
    }

    // Reload the tree data
    const treeDataRaw = await fetchDirectoryTreeData();
    const treeData = Array.isArray(treeDataRaw)
      ? treeDataRaw.map(addIsDirectory)
      : treeDataRaw;
    const filtered = filterHiddenFiles(treeData);
    const sorted = sortNodes(filtered);

    // Add create items
    const dataWithCreateItems = addCreateItems(sorted);
    tree.loadData(dataWithCreateItems);

    // Use a small delay to ensure the tree has processed the new data
    await new Promise(resolve => setTimeout(resolve, 50));

    // Restore expansion state
    expandedNodes.forEach(nodeId => {
      const node = tree.getNodeById(nodeId);
      if (node && node.isDirectory) {
        tree.openNode(node);
      }
    });

    // Restore selection if the node still exists
    if (selectedNodeId) {
      const selectedNode = tree.getNodeById(selectedNodeId);
      if (selectedNode) {
        setTimeout(() => tree.selectNode(selectedNode), 0);
      }
    }
  } catch (error) {
    console.error('loadPreservingExpansion: Error occurred:', error);
  }
}
