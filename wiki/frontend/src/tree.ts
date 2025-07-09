import InfiniteTree from 'infinite-tree';
import { humanizeFileName } from './humanize';
import { lockService } from './lock';

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
  lockStatus?: {
    locked: boolean;
    ownedByMe: boolean;
    owner?: string;
    expiresAt?: string;
  };
}

interface DirectoryTreeOptions {
  el: HTMLElement;
  onFileSelect: (node: TreeNode) => void;
  onCreateFile?: (parentPath: string, name: string, isDirectory: boolean) => Promise<void>;
  selectDefault?: boolean; // true by default
}

export class DirectoryTree {
  private tree: any;
  private onFileSelect: (file: TreeNode) => void;
  private onCreateFile?: (parentPath: string, name: string, isDirectory: boolean) => Promise<void>;
  private el: HTMLElement;
  private lastSelectedId: string | null = null;

  constructor(private options: DirectoryTreeOptions) {
    this.onFileSelect = options.onFileSelect;
    this.onCreateFile = options.onCreateFile;
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

    // Add create rows after tree is initialized
    setTimeout(() => {
      this.addCreateRows();
    }, 1000);

    el.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      
      // Check if click is on a toggler
      const toggler = target.closest('.infinite-tree-toggler');
      if (toggler) {
        // Find the parent node
        const nodeEl = toggler.closest('.infinite-tree-node');
        if (nodeEl) {
          const titleEl = nodeEl.querySelector('.infinite-tree-title');
          if (titleEl) {
            const nodeData = this.findNodeByTitle(titleEl.textContent || '');
            if (nodeData && nodeData.isDirectory) {
              // Add create rows after a delay to allow the tree to update
              setTimeout(() => {
                this.addCreateRows();
              }, 150);
            }
          }
        }
        return;
      }
      
      const itemEl = target.closest('.infinite-tree-node');
      if (!itemEl) return;
      
      // For file selection, find the node by title
      const titleEl = itemEl.querySelector('.infinite-tree-title');
      if (!titleEl) return;
      
      const nodeData = this.findNodeByTitle(titleEl.textContent || '');
      if (!nodeData) return;
      
      const node: TreeNode | undefined = this.tree.getNodeById(nodeData.id);
      if (!node) return;

      if (node.isDirectory) {
        const currentlyOpen = !!node.state?.open;
        

        // If collapsing and selected leaf is inside, move highlight to this directory
        if (currentlyOpen && this.lastSelectedId && this.lastSelectedId.startsWith(node.id + '/')) {
          
          this.tree.selectNode(node);
        }

        // Toggle directories
        this.tree.toggleNode(node);

        // Add create rows after toggle
        setTimeout(() => {
          this.addCreateRows();
        }, 100); // Increased timeout to ensure DOM is updated

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

  /**
   * Recursively open all directories in the tree
   */
  private openAllDirectories(nodes: TreeNode[]): void {
    nodes.forEach(node => {
      if (node.isDirectory) {
        const treeNode = this.tree.getNodeById(node.id);
        if (treeNode) {
          this.tree.openNode(treeNode);
        }
        if (node.children) {
          this.openAllDirectories(node.children);
        }
      }
    });
  }

  async load() {
    const treeDataRaw = await this.fetchDirectoryTreeData();
    const treeData = Array.isArray(treeDataRaw)
      ? treeDataRaw.map(this.addIsDirectory)
      : treeDataRaw;
    const sorted = this.sortNodes(treeData);
    this.tree.loadData(sorted);
    
    // Add create rows after loading data
    setTimeout(() => {
      this.addCreateRows();
    }, 500);

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
    for (let i = 0; i <parts.length - 1; i++) {
      curr = curr ? curr + '/' + parts[i]! : parts[i]!;
      const ancestor = this.tree.getNodeById(curr);
      if (ancestor && ancestor.isDirectory && !ancestor.state?.open) {
        this.tree.openNode(ancestor);
      }
    }
    this.tree.selectNode(node);
  }

  /**
   * Update lock status for a specific file
   */
  async updateLockStatus(filePath: string): Promise<void> {
    if (!filePath || filePath.endsWith('/')) return; // Skip directories
    
    const node = this.tree.getNodeById(filePath);
    if (!node || node.isDirectory) return;

    try {
      const lockResponse = await lockService.checkLockStatus(filePath);
      const ownedByMe = lockService.hasLock(filePath);
      
      node.lockStatus = {
        locked: lockResponse.locked,
        ownedByMe,
        owner: lockResponse.lock_info?.owner,
        expiresAt: lockResponse.lock_info?.expires_at
      };
      
      this.tree.updateNode(node);
      this.updateNodeVisualIndicators(node);
    } catch (error) {
      console.error(`Error updating lock status for ${filePath}:`, error);
    }
  }

  /**
   * Update visual indicators for a node based on lock status
   */
  private updateNodeVisualIndicators(node: TreeNode): void {
    const element = this.el.querySelector(`[data-id="${CSS.escape(node.id)}"]`);
    if (!element) return;

    // Remove existing lock classes
    element.classList.remove('locked-by-me', 'locked-by-other');
    
    // Add appropriate lock class
    if (node.lockStatus?.locked) {
      if (node.lockStatus.ownedByMe) {
        element.classList.add('locked-by-me');
      } else {
        element.classList.add('locked-by-other');
      }
    }
  }

  /**
   * Refresh lock status for all visible files
   */
  async refreshAllLockStatuses(): Promise<void> {
    const allNodes = this.tree.flatten();
    const fileNodes = allNodes.filter((node: TreeNode) => !node.isDirectory);
    
    // Update lock statuses in parallel
    await Promise.all(
      fileNodes.map((node: TreeNode) => this.updateLockStatus(node.id))
    );
  }

  /**
   * Find the insertion point for a create row (after the last child of a directory)
   */
  private findCreateRowInsertionPoint(dirNode: Element, nodeData: TreeNode): Element | null {
    if (!nodeData.children || nodeData.children.length === 0) {
      return dirNode; // Insert right after the directory if it has no children
    }

    // Find the last child by name in the tree data
    const lastChild = nodeData.children[nodeData.children.length - 1];
    if (!lastChild) {
      return dirNode;
    }
    
    const lastChildName = lastChild.name;
    
    // Find the DOM element for this last child
    const allNodes = this.el.querySelectorAll('.infinite-tree-node');
    for (const node of allNodes) {
      const titleElement = node.querySelector('.infinite-tree-title');
      if (titleElement && titleElement.textContent === lastChildName) {
        // This is the last child - now find where its subtree ends
        return this.findEndOfSubtree(node, lastChild);
      }
    }
    
    return dirNode; // Fallback to directory node
  }

  /**
   * Find the end of a node's subtree (including all descendants)
   */
  private findEndOfSubtree(node: Element, nodeData: TreeNode): Element {
    if (!nodeData.children || nodeData.children.length === 0) {
      return node; // No children, so this node is the end
    }
    
    // Find the last child recursively
    const lastChild = nodeData.children[nodeData.children.length - 1];
    if (!lastChild) {
      return node;
    }
    
    const lastChildName = lastChild.name;
    
    // Find the DOM element for the last child
    const allNodes = this.el.querySelectorAll('.infinite-tree-node');
    for (const childNode of allNodes) {
      const titleElement = childNode.querySelector('.infinite-tree-title');
      if (titleElement && titleElement.textContent === lastChildName) {
        return this.findEndOfSubtree(childNode, lastChild);
      }
    }
    
    return node; // Fallback
  }

  /**
   * Find a tree node by its title text
   */
  private findNodeByTitle(title: string): TreeNode | null {
    // Get all nodes from the tree data instead of using flatten()
    const treeData = this.tree.nodes || [];
    
    const findInNodes = (nodes: TreeNode[]): TreeNode | null => {
      for (const node of nodes) {
        if (node.name === title) {
          return node;
        }
        if (node.children) {
          const found = findInNodes(node.children);
          if (found) return found;
        }
      }
      return null;
    };
    
    return findInNodes(treeData);
  }

  /**
   * Add create rows to expanded directories
   */
  private addCreateRows(): void {
    if (!this.onCreateFile) {
      return;
    }
    
    // Remove existing create rows first
    const existingCreateRows = this.el.querySelectorAll('.create-file-row');
    existingCreateRows.forEach(row => row.remove());
    
    // Find all directory nodes that have togglers and are expanded (not closed)
    const allNodes = this.el.querySelectorAll('.infinite-tree-node');
    
    let expandedDirCount = 0;
    allNodes.forEach(dirNode => {
      // Check if this node has a toggler (meaning it's a directory)
      const toggler = dirNode.querySelector('.infinite-tree-toggler');
      if (!toggler) return; // Not a directory
      
      // Check if the directory is expanded (toggler doesn't have 'infinite-tree-closed' class)
      if (toggler.classList.contains('infinite-tree-closed')) {
        return; // Directory is collapsed
      }
      
      expandedDirCount++;
      
      // Get the node ID from the tree data
      const titleElement = dirNode.querySelector('.infinite-tree-title');
      if (!titleElement) return;
      
      // Find the corresponding tree node data to get the ID
      const nodeData = this.findNodeByTitle(titleElement.textContent || '');
      if (!nodeData || !nodeData.isDirectory) return;
      
      // Calculate indentation based on the node's current margin-left
      const currentMargin = parseInt((dirNode as HTMLElement).style.marginLeft || '0px');
      const createRowIndent = currentMargin + 16; // Add one level of indentation
      
      // Create the create row element
      const createRow = document.createElement('div');
      createRow.className = 'create-file-row';
      createRow.textContent = '+';
      createRow.style.cssText = `
        margin-left: ${createRowIndent}px;
        padding: 4px 8px;
        color: #999;
        cursor: pointer;
        font-size: 16px;
        user-select: none;
        transition: all 0.2s ease;
      `;
      createRow.setAttribute('data-parent-path', nodeData.id);
      
      // Add hover effect
      createRow.addEventListener('mouseenter', () => {
        createRow.style.color = '#000';
        createRow.style.fontWeight = 'bold';
      });
      createRow.addEventListener('mouseleave', () => {
        createRow.style.color = '#999';
        createRow.style.fontWeight = 'normal';
      });
      
      // Add click handler
      createRow.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.showCreateDialog(nodeData.id);
      });
      
      // Insert the create row after all children of this directory
      const insertionPoint = this.findCreateRowInsertionPoint(dirNode, nodeData);
      
      // Find the tree container to insert at the correct level
      const treeContainer = this.el.querySelector('.infinite-tree-content');
      if (!treeContainer) {
        console.warn('Could not find tree container for create row insertion');
        return;
      }
      
      if (insertionPoint && insertionPoint !== dirNode) {
        // Find the infinite-tree-item that contains the insertion point
        let itemElement: Element | null = insertionPoint;
        while (itemElement && !itemElement.classList.contains('infinite-tree-item')) {
          itemElement = itemElement.parentElement;
        }
        
        if (itemElement) {
          // Insert after the tree item (as a sibling)
          if (itemElement.nextSibling) {
            treeContainer.insertBefore(createRow, itemElement.nextSibling);
          } else {
            treeContainer.appendChild(createRow);
          }
        } else {
          // Fallback: insert after directory's tree item
          let dirItemElement: Element | null = dirNode;
          while (dirItemElement && !dirItemElement.classList.contains('infinite-tree-item')) {
            dirItemElement = dirItemElement.parentElement;
          }
          if (dirItemElement && dirItemElement.nextSibling) {
            treeContainer.insertBefore(createRow, dirItemElement.nextSibling);
          } else if (dirItemElement) {
            treeContainer.appendChild(createRow);
          }
        }
      } else {
        // If no children, insert after the directory's tree item
        let dirItemElement: Element | null = dirNode;
        while (dirItemElement && !dirItemElement.classList.contains('infinite-tree-item')) {
          dirItemElement = dirItemElement.parentElement;
        }
        if (dirItemElement && dirItemElement.nextSibling) {
          treeContainer.insertBefore(createRow, dirItemElement.nextSibling);
        } else if (dirItemElement) {
          treeContainer.appendChild(createRow);
        }
      }
    });
  }

  /**
   * Show create file/directory dialog
   */
  private showCreateDialog(parentPath: string): void {
    if (!this.onCreateFile) return;
    
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'create-file-modal-overlay';
    
    // Create modal content
    const modal = document.createElement('div');
    modal.className = 'create-file-modal';
    modal.innerHTML = `
      <div class="modal-header">
        <h3>Create New</h3>
        <button class="modal-close" type="button">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label for="create-name">Name:</label>
          <input type="text" id="create-name" class="form-input" placeholder="Enter name..." />
        </div>
        <div class="form-group">
          <label>Type:</label>
          <div class="radio-group">
            <label class="radio-label">
              <input type="radio" name="create-type" value="file" checked />
              <span>File</span>
            </label>
            <label class="radio-label">
              <input type="radio" name="create-type" value="directory" />
              <span>Directory</span>
            </label>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary modal-cancel">Cancel</button>
        <button class="btn btn-primary modal-create">Create</button>
      </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // Focus name input
    const nameInput = modal.querySelector('#create-name') as HTMLInputElement;
    nameInput.focus();
    
    // Handle form submission
    const handleCreate = async () => {
      const name = nameInput.value.trim();
      if (!name) {
        nameInput.focus();
        return;
      }
      
      // Validate name
      if (name.includes('/') || name.includes('\\') || name === '.' || name === '..') {
        alert('Invalid name. Names cannot contain slashes or be "." or ".."');
        nameInput.focus();
        return;
      }
      
      const typeRadio = modal.querySelector('input[name="create-type"]:checked') as HTMLInputElement;
      const isDirectory = typeRadio.value === 'directory';
      
      try {
        await this.onCreateFile!(parentPath, name, isDirectory);
        document.body.removeChild(overlay);
      } catch (error) {
        console.error('Error creating file/directory:', error);
        alert('Failed to create file/directory. Please try again.');
      }
    };
    
    // Event handlers
    modal.querySelector('.modal-close')?.addEventListener('click', () => {
      document.body.removeChild(overlay);
    });
    
    modal.querySelector('.modal-cancel')?.addEventListener('click', () => {
      document.body.removeChild(overlay);
    });
    
    modal.querySelector('.modal-create')?.addEventListener('click', handleCreate);
    
    // Handle Enter key
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleCreate();
      }
    });
    
    // Handle Escape key
    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.body.removeChild(overlay);
      }
    });
    
    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        document.body.removeChild(overlay);
      }
    });
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
