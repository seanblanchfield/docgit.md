import InfiniteTree from 'infinite-tree';
import { humanizeFileName } from './humanize';

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
  private lastSelectedId: string | null = null;

  constructor({ el, onFileSelect }: DirectoryTreeOptions) {
    this.onFileSelect = onFileSelect;
    this.el = el;
    this.tree = new InfiniteTree({
      el,
      data: [],
      autoOpen: false,
      childrenProperty: 'children'
    });

    // Add manual toggle handler for directory toggler or name clicks
    el.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      // Accept clicks on toggler or on directory title
      if (
        (target.classList.contains('infinite-tree-toggler')) ||
        (target.classList.contains('infinite-tree-title') && target.closest('.infinite-tree-item[data-children]'))
      ) {
        const item = target.closest('.infinite-tree-item');
        if (item) {
          const nodeId = item.getAttribute('data-id');
          if (nodeId) {
            const node = this.tree.getNodeById(nodeId);
            if (node && node.isDirectory) {
              console.log('[DirectoryTree] Manually toggling node:', nodeId, 'from click on', target.className);
              this.tree.toggleNode(node);
            }
          }
        }
      }
    });

    this.tree.on('selectNode', (node: TreeNode) => {
      if (!node || node.isDirectory) return;
      this.lastSelectedId = node.id;
      this.onFileSelect(node);
    });

    this.tree.on('toggle', async (node: TreeNode, isOpen: boolean) => {
      if (isOpen && node.isDirectory && (!node.children || node.children.length === 0)) {
        await this.loadDirectoryContents(node);
      }
      if (isOpen && this.lastSelectedId && this.lastSelectedId.startsWith(node.id + '/')) {
        const tgt = this.tree.getNodeById(this.lastSelectedId);
        if (tgt) this.tree.selectNode(tgt);
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
    const displayName = humanizeFileName(node.name ?? '');
    return {
      ...node,
      name: displayName,
      isDirectory,
      children: Array.isArray(node.children)
        ? node.children.map(this.addIsDirectory)
        : node.children,
    };
  }
}
