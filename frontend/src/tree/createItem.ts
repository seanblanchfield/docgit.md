import { TreeNode } from './types';

/**
 * Add create items at the end of each directory and at the root
 */
export function addCreateItems(nodes: TreeNode[]): TreeNode[] {
  // Deep clone the nodes to avoid mutation issues
  const clonedNodes = JSON.parse(JSON.stringify(nodes));

  // Helper function to check if a directory is empty (no actual content, only filtered files like .gitkeep)
  const isDirectoryEmpty = (node: TreeNode): boolean => {
    if (!node.isDirectory || !node.children) return false;

    // A directory is considered empty if it has no non-create-item children
    const nonCreateChildren = node.children.filter(child => !child.isCreateItem);
    return nonCreateChildren.length === 0;
  };

  // Recursively add create items to each directory
  const processNode = (node: TreeNode): TreeNode => {
    // Skip if already a create item
    if (node.isCreateItem) {
      return node;
    }

    const processedNode = { ...node };

    // Process children first if they exist
    if (node.children && node.children.length > 0) {
      processedNode.children = node.children.map(child => processNode(child));
    }

    // Add create item to directories (only once)
    if (node.isDirectory) {
      if (!processedNode.children) {
        processedNode.children = [];
      }

      // Only add if no create item exists yet
      const hasCreateItem = processedNode.children.some(child =>
        child.isCreateItem && child.id === `${node.id}/__create__`
      );

      if (!hasCreateItem) {
        // Check if directory is empty to determine create node appearance
        const isEmpty = isDirectoryEmpty(processedNode);

        const createItem: TreeNode = {
          id: `${node.id}/__create__`,
          name: isEmpty ? '+ −' : '+',  // Show both plus and minus for empty directories
          isDirectory: false,
          isCreateItem: true,
          isEmpty: isEmpty  // Store empty state for later use
        };
        processedNode.children.push(createItem);
      }
    }

    return processedNode;
  };

  // Process all nodes
  const result = clonedNodes.map((node: TreeNode) => processNode(node));

  // Add root-level create item
  const rootCreateItem: TreeNode = {
    id: '__root_create__',
    name: '+',
    isDirectory: false,
    isCreateItem: true
  };
  result.push(rootCreateItem);

  return result;
}

/**
 * Show create file/directory dialog in content area
 */
function showCreateDialog(parentPath: string, isEmpty: boolean = false, onCreateFile: (parentPath: string, name: string, isDirectory: boolean) => Promise<void>, onDeleteDirectory?: (path: string) => Promise<void>): void {
  // Dispatch event to main.ts to show create dialog in content area
  const createEvent = new CustomEvent('showCreateDialog', {
    detail: {
      parentPath: parentPath,
      isEmpty: isEmpty,
      onCreateFile: onCreateFile,
      onDeleteDirectory: onDeleteDirectory
    }
  });

  document.dispatchEvent(createEvent);
}

/**
 * Handle click on a create node
 */
export function handleCreateNodeClick(node: TreeNode, onCreateFile?: (parentPath: string, name: string, isDirectory: boolean) => Promise<void>, onDeleteDirectory?: (path: string) => Promise<void>): void {
  if (!onCreateFile) return;

  // Determine the parent path from the create node ID
  let parentPath = '';
  if (node.id === '__root_create__') {
    parentPath = '';
  } else if (node.id.endsWith('/__create__')) {
    parentPath = node.id.replace('/__create__', '');
  }

  showCreateDialog(parentPath, node.isEmpty || false, onCreateFile, onDeleteDirectory);
}

/**
 * Show create dialog for a specific directory (public method)
 */
export function showCreateDialogForDirectory(directoryPath: string, tree: any, onCreateFile?: (parentPath: string, name: string, isDirectory: boolean) => Promise<void>, onDeleteDirectory?: (path: string) => Promise<void>): void {
  if (!onCreateFile) return;
  // Check if the directory exists in the tree
  const node = tree.getNodeById(directoryPath);
  if (!node) {
    console.warn('Directory node not found in tree:', directoryPath);
    return;
  }

  // Check if directory is empty
  const isEmpty = !node.children || node.children.filter((child: TreeNode) => !child.isCreateItem).length === 0;
  showCreateDialog(directoryPath, isEmpty, onCreateFile, onDeleteDirectory);
}
