import { TreeNode } from './types';

export function customRowRenderer(tree: any, node: TreeNode): string {
  const { id, name } = node;
  const isCreateItem = node.isCreateItem || false;
  const hasChildren = node.children && node.children.length > 0;

  // Calculate depth by counting slashes in the ID (more reliable than treeOptions.depth)
  const depth = (id.match(/\//g) || []).length;

  // Get the actual node state from the tree instance
  const actualNode = tree.getNodeById(id);
  const isOpen = actualNode?.state?.open || false;

  // Build CSS classes - start with InfiniteTree defaults
  const classes = ['infinite-tree-item'];
  if (isCreateItem) {
    classes.push('create-item');
  }
  if (isOpen) {
    classes.push('infinite-tree-open');
  }

  // Build data attributes - preserve InfiniteTree defaults
  const dataAttrs = [`data-id="${id}"`];
  if (isCreateItem) {
    dataAttrs.push('data-create-item="true"');
  }
  if (hasChildren) {
    dataAttrs.push('data-children="true"');
  }

  // Calculate indentation based on depth
  const indentStyle = depth > 0 ? `style="padding-left: ${depth * 18}px"` : '';

  // Triangle icon for directories (right-pointing when closed, down-pointing when open)
  const triangleIcon = hasChildren ? (isOpen ? '▼' : '▶') : '▶';

  // Build the row HTML using InfiniteTree's expected structure
  return `
    <div class="${classes.join(' ')}" ${dataAttrs.join(' ')} ${indentStyle}>
      <div class="infinite-tree-node">
        ${hasChildren ? `<span class="infinite-tree-toggler">${triangleIcon}</span>` : '<span class="infinite-tree-toggler-spacer"></span>'}
        <span class="infinite-tree-title">${name}</span>
      </div>
    </div>
  `;
}
