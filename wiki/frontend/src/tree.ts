import InfiniteTree from 'infinite-tree';

export interface TreeNode {
  id: string;
  name: string;
  isDirectory: boolean;
  children?: TreeNode[];
  state?: {
    depth?: number;
    open?: boolean;
    selected?: boolean;
    loading?: boolean;
  };
}

interface DirectoryTreeOptions {
  el: HTMLElement;
  onFileSelect: (file: TreeNode) => void;
}

export class DirectoryTree {
  private tree: any;
  private onFileSelect: (file: TreeNode) => void;
  private el: HTMLElement;

  constructor({ el, onFileSelect }: DirectoryTreeOptions) {
    this.onFileSelect = onFileSelect;
    this.el = el;
    this.tree = new InfiniteTree({
      el,
      data: [],
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
              ${loading ? '<span class="loading">⟳</span>' : ''}
            </div>
          </div>
        `;
      }
    });

    this.tree.on('selectNode', (node: TreeNode) => {
      if (!node || node.isDirectory) return;
      this.onFileSelect(node);
    });

    this.tree.on('toggle', async (node: TreeNode, isOpen: boolean) => {
      if (isOpen && node.isDirectory && (!node.children || node.children.length === 0)) {
        await this.loadDirectoryContents(node);
      }
    });
  }

  async load() {
    const treeDataRaw = await this.fetchDirectoryTreeData();
    const treeData = Array.isArray(treeDataRaw)
      ? treeDataRaw.map(this.addIsDirectory)
      : treeDataRaw;
    this.tree.loadData(treeData);
  }

  private async fetchDirectoryTreeData(): Promise<TreeNode[]> {
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

  private async loadDirectoryContents(node: TreeNode): Promise<void> {
    if (!node.isDirectory || node.state?.loading) return;
    try {
      node.state = { ...(node.state || {}), loading: true };
      this.tree.updateNode(node);
      const response = await fetch(`/api/files/${encodeURIComponent(node.id)}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      node.children = data.children || [];
      node.state = { ...(node.state || {}), loading: false, open: true };
      this.tree.updateNode(node);
    } catch (error) {
      console.error(`Error loading directory '${node.id}':`, error);
      node.state = { ...(node.state || {}), loading: false };
      this.tree.updateNode(node);
    }
  }

  private addIsDirectory = (node: any): any => {
    const isDirectory = Array.isArray(node.children) && node.children.length > 0;
    return {
      ...node,
      isDirectory,
      children: Array.isArray(node.children)
        ? node.children.map(this.addIsDirectory)
        : node.children,
    };
  }
}
