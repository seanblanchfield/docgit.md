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
  onFileSelect: (node: TreeNode) => void;
  selectDefault?: boolean; // true by default
}

export class DirectoryTree {
  private tree: any;
  private onFileSelect: (file: TreeNode) => void;
  private el: HTMLElement;
  private lastSelectedId: string | null = null;

  constructor(private options: DirectoryTreeOptions) {
    this.onFileSelect = options.onFileSelect;
    this.el = options.el;
    const el = this.el;
    this.tree = new InfiniteTree({
      el,
      data: [],
      autoOpen: false,
      childrenProperty: 'children'
    });

    // Add manual toggle handler for directory toggler or name clicks
    // Prevent InfiniteTree from deselecting already-selected file rows
    el.addEventListener('mousedown', (event) => {
      const itemEl = (event.target as HTMLElement).closest('.infinite-tree-item');
      if (!itemEl) return;
      if (!itemEl.classList.contains('infinite-tree-selected')) return;
      // only for files (no children)
      if (itemEl.hasAttribute('data-children')) return;
      event.stopImmediatePropagation();
      event.preventDefault();
      
    }, true);

    // Capture phase guard to keep selection
    el.addEventListener('click', (event) => {
      const itemEl = (event.target as HTMLElement).closest('.infinite-tree-item');
      if (!itemEl) return;
      if (!itemEl.classList.contains('infinite-tree-selected')) return;
      if (itemEl.hasAttribute('data-children')) return;
      event.stopImmediatePropagation();
      
    }, true);

    el.addEventListener('click', (event) => {
      const itemEl = (event.target as HTMLElement).closest('.infinite-tree-item');
      if (!itemEl) return;
      const nodeId = itemEl.getAttribute('data-id');
      if (!nodeId) return;
      const node: TreeNode | undefined = this.tree.getNodeById(nodeId);
      if (!node) return;

      if (node.isDirectory) {
        const currentlyOpen = !!node.state?.open;
        

        // If collapsing and selected leaf is inside, move highlight to this directory
        if (currentlyOpen && this.lastSelectedId && this.lastSelectedId.startsWith(node.id + '/')) {
          
          this.tree.selectNode(node);
        }

        // Toggle directories
        this.tree.toggleNode(node);

        // If expanding and we have a stored leaf inside, select the nearest visible ancestor (next path segment)
        if (!currentlyOpen && this.lastSelectedId && this.lastSelectedId.startsWith(node.id + '/')) {
          const rel = this.lastSelectedId.slice(node.id.length + 1);
          const firstSeg = rel.split('/')[0];
          const nextId = node.id + '/' + firstSeg;
          
          setTimeout(() => {
            const n = this.tree.getNodeById(nextId);
            if (n) {
              this.tree.selectNode(n);
            }
          }, 0);
        }
      } else {
        // If this file is already selected, prevent InfiniteTree from deselecting it
        const alreadySelected = itemEl.classList.contains('infinite-tree-selected');
        if (alreadySelected) {
          
          event.preventDefault();
          event.stopPropagation();
          // Re-select explicitly to ensure class stays
          this.tree.selectNode(node);
        }
      }
    });

    this.tree.on('selectNode', (node: TreeNode) => {
      if (!node || node.isDirectory) return;
      this.lastSelectedId = node.id;
      this.onFileSelect(node);
    });

    // Prevent deselecting the currently selected file by reselecting if deselect would leave none selected
    this.tree.on('deselectNode', (node: TreeNode) => {
      
      const selected = this.tree.getSelectedNodes();
      
      if (selected.length === 0 && node) {
        
        // re-select after microtask so internal deselect finishes
        setTimeout(() => {
          this.tree.selectNode(node);
        }, 0);
      }
    });

    // --- Keyboard navigation ---
    // Ensure container focusable
    if (!el.hasAttribute('tabindex')) {
      el.setAttribute('tabindex', '0');
    }
    const treeInstance = this.tree;
    el.addEventListener('keydown', (ev) => {
      const key = ev.key;
      const selected: TreeNode | undefined = (this.tree.getSelectedNodes ? this.tree.getSelectedNodes()[0] : (this.tree.getSelectedNode ? this.tree.getSelectedNode() : undefined));
      if (!selected) return;
      switch (key) {
        case 'ArrowUp': {
          ev.preventDefault();
          const selEl = el.querySelector('.infinite-tree-selected') as HTMLElement | null;
          if (!selEl) break;
          let target = selEl.previousElementSibling as HTMLElement | null;
          while (target && target.offsetParent === null) target = target.previousElementSibling as HTMLElement | null; // skip hidden
          if (target) {
            const id = target.getAttribute('data-id');
            if (id) {
              const node = this.tree.getNodeById(id);
              if (node) this.tree.selectNode(node);
            }
          }
          break;
        }
        case 'ArrowDown': {
          ev.preventDefault();
          const selEl = el.querySelector('.infinite-tree-selected') as HTMLElement | null;
          if (!selEl) break;
          let target = selEl.nextElementSibling as HTMLElement | null;
          while (target && target.offsetParent === null) target = target.nextElementSibling as HTMLElement | null;
          if (target) {
            const id = target.getAttribute('data-id');
            if (id) {
              const node = this.tree.getNodeById(id);
              if (node) this.tree.selectNode(node);
            }
          }
          break;
        }
        case 'ArrowRight': {
          ev.preventDefault();
          if (selected.isDirectory) {
            if (!selected.state?.open) {
              treeInstance.openNode(selected);
            } else {
              // move to first child if exists
              const firstChild = selected.children && selected.children[0];
              if (firstChild) treeInstance.selectNode(firstChild);
            }
          }
          break;
        }
        case 'ArrowLeft': {
          ev.preventDefault();
          if (selected.isDirectory && selected.state?.open) {
            treeInstance.closeNode(selected);
          } else {
            const parentId = selected.id.substring(0, selected.id.lastIndexOf('/'));
            if (parentId) {
              const parent = treeInstance.getNodeById(parentId);
              if (parent) this.tree.selectNode(parent);
            }
          }
          break;
        }
        default:
          break;
      }
    });

    this.tree.on('toggle', async (node: TreeNode, isOpen: boolean) => {
      console.log('[DirectoryTree] toggle', node.id, 'isOpen', isOpen, 'lastSelectedId', this.lastSelectedId);

      // Lazy-load children on first expand
      if (isOpen && node.isDirectory && (!node.children || node.children.length === 0)) {
        await this.loadDirectoryContents(node);
      }

      if (isOpen) {
        

        // Section was expanded – if previously selected leaf lies inside, restore highlight to it
        if (this.lastSelectedId && this.lastSelectedId.startsWith(node.id + '/')) {
          const tgt = this.tree.getNodeById(this.lastSelectedId);
          if (tgt) {
            
            setTimeout(() => {
              
              this.tree.selectNode(tgt);
            }, 0);
          }
        }
      } else {
        // Section being collapsed – if current leaf selection will be hidden, shift highlight to this visible parent
        if (this.lastSelectedId && this.lastSelectedId.startsWith(node.id + '/') && this.lastSelectedId !== node.id) {
          
          this.tree.selectNode(node); // directory selection does not overwrite lastSelectedId
        }
      }
    });
  }

  private sortNodes(nodes: any[]): any[] {
    return nodes
      .sort((a: any, b: any) => (a.rawName || a.name).localeCompare(b.rawName || b.name, undefined, { sensitivity: 'base' }))
      .map((n: any) => ({
        ...n,
        children: Array.isArray(n.children) ? this.sortNodes(n.children) : n.children,
      }));
  }

  async load() {
    const treeDataRaw = await this.fetchDirectoryTreeData();
    const treeData = Array.isArray(treeDataRaw)
      ? treeDataRaw.map(this.addIsDirectory)
      : treeDataRaw;
    const sorted = this.sortNodes(treeData);
    this.tree.loadData(sorted);

    // Auto-select default file if any
    if (this.options.selectDefault !== false) {
      const defaultPath = this.findDefaultFile(sorted);
      if (defaultPath) {
        const node = this.tree.getNodeById(defaultPath);
        if (node) setTimeout(() => this.tree.selectNode(node), 0);
      }
    }
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
      node.children = this.sortNodes(data.children || []);
      node.state = { ...(node.state || {}), loading: false, open: true };
      this.tree.updateNode(node);
    } catch (error) {
      console.error(`Error loading directory '${node.id}':`, error);
      node.state = { ...(node.state || {}), loading: false };
      this.tree.updateNode(node);
    }
  }

  // Determine default landing file based on rules
  private findDefaultFile(nodes: any[]): string | undefined {
    const clean = (s: string) => s.replace(/^\d+[_-]*/, '').toLowerCase();
    // 1. root index/start/home
    const preferred = ['index', 'start', 'home'];
    for (const name of preferred) {
      const match = nodes.find((n) => !n.isDirectory && clean(n.rawName || n.name).startsWith(name));
      if (match) return match.id;
    }
    // 3. first other file in root
    const firstFile = nodes.find((n) => !n.isDirectory);
    if (firstFile) return firstFile.id;
    // 4. first file of first directory that contains files (depth-first)
    for (const dir of nodes.filter((n) => n.isDirectory)) {
      const childFile = this.findDefaultFile(dir.children || []);
      if (childFile) return childFile;
    }
    return undefined;
  }

  public selectPath(id: string) {
    const node = this.tree.getNodeById(id);
    if (!node) return;
    // open ancestors
    const parts = id.split('/');
    let curr = '';
    for (let i = 0; i < parts.length - 1; i++) {
      curr = curr ? curr + '/' + parts[i] : parts[i];
      const ancestor = this.tree.getNodeById(curr);
      if (ancestor && ancestor.isDirectory && !ancestor.state?.open) {
        this.tree.openNode(ancestor);
      }
    }
    this.tree.selectNode(node);
  }

  private addIsDirectory = (node: any): any => {
    const isDirectory = Array.isArray(node.children) && node.children.length > 0;
    const rawName = node.name ?? '';
    const displayName = humanizeFileName(rawName);
    return {
      ...node,
      name: displayName,
      rawName,
      isDirectory,
      children: Array.isArray(node.children)
        ? node.children.map(this.addIsDirectory)
        : node.children,
    };
  }
}
