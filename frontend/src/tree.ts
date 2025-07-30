import InfiniteTree from 'infinite-tree';
import { humanizeFileName } from './humanize';
import { lockService } from './lock';

export interface TreeNode {
  id: string;
  name: string;
  isDirectory: boolean;
  children?: TreeNode[];
  isCreateItem?: boolean; // Flag for create items
  isEmpty?: boolean; // Flag for empty directories (used with create items)
  gitHash?: string; // Git commit hash for this file (files only)
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
  private manualSelectedId: string | null = null;

  private updateVisualSelection(nodeId: string) {
    // Remove selection from all items
    const allItems = this.el.querySelectorAll('.infinite-tree-item');
    allItems.forEach(item => item.classList.remove('infinite-tree-selected'));
    
    // Add selection to target item
    const targetItem = this.el.querySelector(`[data-id="${CSS.escape(nodeId)}"]`);
    if (targetItem) {
      targetItem.classList.add('infinite-tree-selected');
    }
  }

  constructor(private options: DirectoryTreeOptions) {
    this.onFileSelect = options.onFileSelect;
    this.onCreateFile = options.onCreateFile;
    this.el = options.el;
    const el = this.el;
    this.tree = new InfiniteTree({
      el,
      data: [],
      autoOpen: false,
      childrenProperty: 'children',
      rowRenderer: this.customRowRenderer.bind(this)
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
      
      // IMPORTANT: Still need to ensure focus happens even if we stop propagation
      el.focus();
      
    }, true);



    el.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      
      // Get the closest tree item to determine what was clicked
      const itemEl = target.closest('.infinite-tree-item');
      if (!itemEl) return;
      
      const nodeId = itemEl.getAttribute('data-id');
      if (!nodeId) return;
      
      const node: TreeNode | undefined = this.tree.getNodeById(nodeId);
      if (!node) return;

      // Handle create node clicks
      if (node.isCreateItem) {
        event.preventDefault();
        event.stopPropagation();
        this.handleCreateNodeClick(node);
        return;
      }
      
      // Check if click is on a toggler - let InfiniteTree handle it
      const toggler = target.closest('.infinite-tree-toggler');
      if (toggler) {
        return; // Let the tree handle toggling
      }
      
      // Handle directory clicks (on title, not toggler)
      if (node.isDirectory && target.closest('.infinite-tree-title')) {
        event.preventDefault();
        event.stopPropagation();
        
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
        return;
      }
      
      // Handle file clicks - let InfiniteTree handle selection
      if (!node.isDirectory) {
        // Let the default behavior handle file selection
        return;
      }
    });

    this.tree.on('selectNode', (node: TreeNode) => {
      if (!node) return;
      
      // Always update visual selection for files, directories, and create items
      this.updateVisualSelection(node.id);
      
      // Only update lastSelectedId and trigger onFileSelect for files (not directories or create items)
      if (!node.isDirectory && !node.isCreateItem) {
        this.lastSelectedId = node.id;
        this.onFileSelect(node);
      }
    });

    // Prevent deselecting the currently selected file by reselecting if deselect would leave none selected
    this.tree.on('deselectNode', (node: TreeNode) => {
      const selected = this.tree.getSelectedNodes();
      
      if (selected.length === 0 && node) {
        // re-select after microtask so internal deselect finishes
        setTimeout(() => {
          this.tree.selectNode(node);
        }, 0);
      } else if (selected.length === 0) {
        // Clear visual selection if no nodes are selected
        const allItems = this.el.querySelectorAll('.infinite-tree-item');
        allItems.forEach(item => item.classList.remove('infinite-tree-selected'));
      }
    });

    // --- Keyboard navigation ---
    // Ensure container focusable
    if (!el.hasAttribute('tabindex')) {
      el.setAttribute('tabindex', '0');
    }
    
    // Auto-select first node if none is selected when tree gains focus
    el.addEventListener('focus', () => {
      const selected = (this.tree.getSelectedNodes ? this.tree.getSelectedNodes()[0] : (this.tree.getSelectedNode ? this.tree.getSelectedNode() : undefined));
      
      if (!selected) {
        const firstVisibleElement = el.querySelector('.infinite-tree-item') as HTMLElement;
        if (firstVisibleElement) {
          const firstId = firstVisibleElement.getAttribute('data-id');
          if (firstId) {
            const firstNode = this.tree.getNodeById(firstId);
            if (firstNode) {
              this.tree.selectNode(firstNode);
            }
          }
        }
      }
    });
    
    // Ensure tree gets focus when clicked
    el.addEventListener('click', () => {
      el.focus();
    });
    const treeInstance = this.tree;
    el.addEventListener('keydown', (ev) => {
      const key = ev.key;
      
      // Helper function to get currently selected node
      const getSelected = (): TreeNode | undefined => {
        // First try manual selection if it exists
        if (this.manualSelectedId) {
          const manualNode = this.tree.getNodeById(this.manualSelectedId);
          if (manualNode) {
            return manualNode;
          }
        }
        
        // Fall back to tree's selection
        const selected = (this.tree.getSelectedNodes ? this.tree.getSelectedNodes()[0] : (this.tree.getSelectedNode ? this.tree.getSelectedNode() : undefined));
        return selected;
      };
      switch (key) {
        case 'ArrowUp': {
          ev.preventDefault();
          // Get fresh selected node
          const currentSelected = getSelected();
          if (!currentSelected) return;
          
          let selEl = el.querySelector('.infinite-tree-selected') as HTMLElement | null;
          if (!selEl) {
            selEl = el.querySelector(`[data-id="${CSS.escape(currentSelected.id)}"]`) as HTMLElement | null;
          }
          if (!selEl) break;
          
          const allItems = Array.from(el.querySelectorAll('.infinite-tree-item')) as HTMLElement[];
          const currentIndex = allItems.indexOf(selEl);
          
          if (currentIndex > 0) {
            const target = allItems[currentIndex - 1];
            const id = target.getAttribute('data-id');
            
            if (id) {
              const node = this.tree.getNodeById(id);
              if (node) {
                this.tree.selectNode(node);
                
                // Check if tree selection worked
                const afterTreeSelect = (this.tree.getSelectedNodes ? this.tree.getSelectedNodes()[0] : (this.tree.getSelectedNode ? this.tree.getSelectedNode() : undefined));
                
                if (afterTreeSelect && afterTreeSelect.id === node.id) {
                  // Tree selection worked, clear manual selection
                  this.manualSelectedId = null;
                } else {
                  // Tree selection failed (likely for create items), use manual selection
                  this.manualSelectedId = node.id;
                  this.updateVisualSelection(node.id);
                }
              }
            }
          }
          break;
        }
        case 'ArrowDown': {
          ev.preventDefault();
          // Get fresh selected node
          const currentSelected = getSelected();
          if (!currentSelected) return;
          
          let selEl = el.querySelector('.infinite-tree-selected') as HTMLElement | null;
          if (!selEl) {
            selEl = el.querySelector(`[data-id="${CSS.escape(currentSelected.id)}"]`) as HTMLElement | null;
          }
          if (!selEl) break;
          
          const allItems = Array.from(el.querySelectorAll('.infinite-tree-item')) as HTMLElement[];
          const currentIndex = allItems.indexOf(selEl);
          
          if (currentIndex >= 0 && currentIndex < allItems.length - 1) {
            const target = allItems[currentIndex + 1];
            const id = target.getAttribute('data-id');
            
            if (id) {
              const node = this.tree.getNodeById(id);
              if (node) {
                this.tree.selectNode(node);
                
                // Check if tree selection worked
                const afterTreeSelect = (this.tree.getSelectedNodes ? this.tree.getSelectedNodes()[0] : (this.tree.getSelectedNode ? this.tree.getSelectedNode() : undefined));
                
                if (afterTreeSelect && afterTreeSelect.id === node.id) {
                  // Tree selection worked, clear manual selection
                  this.manualSelectedId = null;
                } else {
                  // Tree selection failed (likely for create items), use manual selection
                  this.manualSelectedId = node.id;
                  this.updateVisualSelection(node.id);
                }
              }
            }
          }
          break;
        }
        case 'ArrowRight': {
          ev.preventDefault();
          // Get fresh selected node
          const currentSelected = getSelected();
          if (!currentSelected) return;
          
          if (currentSelected.isDirectory) {
            if (!currentSelected.state?.open) {
              treeInstance.openNode(currentSelected);
              // After opening, select the first child
              setTimeout(() => {
                const refreshedNode = this.tree.getNodeById(currentSelected.id);
                if (refreshedNode && refreshedNode.children && refreshedNode.children.length > 0) {
                  const firstChild = refreshedNode.children[0];
                  this.tree.selectNode(firstChild);
                  // Clear manual selection since tree selection should work for children
                  this.manualSelectedId = null;
                }
              }, 50);
            } else {
              const firstChild = currentSelected.children && currentSelected.children[0];
              if (firstChild) {
                treeInstance.selectNode(firstChild);
                // Clear manual selection since tree selection should work for children
                this.manualSelectedId = null;
              }
            }
          }
          break;
        }
        case 'ArrowLeft': {
          ev.preventDefault();
          // Get fresh selected node in case it changed
          const currentSelected = getSelected();
          if (!currentSelected) return;
          
          if (currentSelected.isDirectory && currentSelected.state?.open) {
            treeInstance.closeNode(currentSelected);
            
            // Use setTimeout to ensure the close operation completes before selecting
            const directoryId = currentSelected.id;
            setTimeout(() => {
              const freshNode = this.tree.getNodeById(directoryId);
              
              if (freshNode) {
                this.tree.selectNode(freshNode);
                
                // Check if tree selection worked
                const afterTreeSelect = (this.tree.getSelectedNodes ? this.tree.getSelectedNodes()[0] : (this.tree.getSelectedNode ? this.tree.getSelectedNode() : undefined));
                
                // If tree selection failed, use manual selection
                if (!afterTreeSelect) {
                  this.manualSelectedId = freshNode.id;
                }
                
                this.updateVisualSelection(freshNode.id);
              }
            }, 20);
          } else {
            const parentId = currentSelected.id.substring(0, currentSelected.id.lastIndexOf('/'));
            if (parentId) {
              const parent = treeInstance.getNodeById(parentId);
              if (parent) {
                this.tree.selectNode(parent);
              }
            }
          }
          break;
        }
        case 'Enter': {
          ev.preventDefault();
          // Get fresh selected node
          const currentSelected = getSelected();
          if (!currentSelected) return;
          
          // If it's a create node, trigger the create dialog
          if (currentSelected.isCreateItem) {
            this.handleCreateNodeClick(currentSelected);
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

      // Force re-render of the node to update triangle icon
      this.tree.updateNode(node);

      if (isOpen) {
        // Section was expanded – if previously selected leaf lies inside, restore highlight to it
        if (this.lastSelectedId && this.lastSelectedId.startsWith(node.id + '/')) {
          const tgt = this.tree.getNodeById(this.lastSelectedId);
          if (tgt) {
            setTimeout(() => {
              this.tree.selectNode(tgt);
              this.updateVisualSelection(tgt.id);
            }, 0);
          }
        }
      } else {
        // Section being collapsed – selection is now handled by the ArrowLeft key handler
      }
    });
  }

  private filterHiddenFiles(nodes: any[]): any[] {
    return nodes
      .filter(node => {
        // Hide .gitkeep files
        if (node.name === '.gitkeep') {
          return false;
        }
        return true;
      })
      .map((n: any) => ({
        ...n,
        children: n.children ? this.filterHiddenFiles(n.children) : n.children,
      }));
  }

  private sortNodes(nodes: any[]): any[] {
    return nodes
      .sort((a: any, b: any) => (a.rawName || a.name).localeCompare(b.rawName || b.name, undefined, { sensitivity: 'base' }))
      .map((n: any) => ({
        ...n,
        children: n.children ? this.sortNodes(n.children) : n.children,
      }));
  }

  /**
   * Step 2: Add create items at the end of each directory and at the root
   */
  private addCreateItems(nodes: TreeNode[]): TreeNode[] {
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
   * Handle click on a create node
   */
  private handleCreateNodeClick(node: TreeNode): void {
    if (!this.onCreateFile) return;
    
    // Determine the parent path from the create node ID
    let parentPath = '';
    if (node.id === '__root_create__') {
      parentPath = '';
    } else if (node.id.endsWith('/__create__')) {
      parentPath = node.id.replace('/__create__', '');
    }
    
    this.showCreateDialog(parentPath, node.isEmpty || false);
  }

  async load() {
    const treeDataRaw = await this.fetchDirectoryTreeData();
    const treeData = Array.isArray(treeDataRaw)
      ? treeDataRaw.map(this.addIsDirectory)
      : treeDataRaw;
    const filtered = this.filterHiddenFiles(treeData);
    const sorted = this.sortNodes(filtered);
    
    // Step 2: Add create items at the end of each directory and at the root
    const dataWithCreateItems = this.addCreateItems(sorted);
    this.tree.loadData(dataWithCreateItems);
    
    // Step 3: Load git hashes for files with drafts only (performance optimization)
    await this.loadGitHashesForDraftFiles();



    // Auto-select default file if any
    if (this.options.selectDefault !== false) {
      const defaultPath = this.findDefaultFile(sorted);
      if (defaultPath) {
        const node = this.tree.getNodeById(defaultPath);
        if (node) {
          setTimeout(() => {
            this.tree.selectNode(node);
            
            // Check if tree selection worked
            const afterTreeSelect = (this.tree.getSelectedNodes ? this.tree.getSelectedNodes()[0] : (this.tree.getSelectedNode ? this.tree.getSelectedNode() : undefined));
            
            // If tree selection failed, use manual selection
            if (!afterTreeSelect) {
              this.manualSelectedId = defaultPath;
            } else {
              // Clear manual selection if tree selection worked
              this.manualSelectedId = null;
            }
            
            // Ensure visual selection is updated
            this.updateVisualSelection(defaultPath);
          }, 0);
        }
      }
    }
  }

  /**
   * Reload the tree while preserving expansion state
   */
  async loadPreservingExpansion(newDirectoryPath?: string): Promise<void> {
    try {
      // First, capture the current expansion state
      const expandedNodes = new Set<string>();
      const selectedNodeId = this.tree.getSelectedNodes?.()?.[0]?.id || this.tree.getSelectedNode?.()?.id;
      
      // Capture expanded states by checking DOM elements
      const treeItems = this.el.querySelectorAll('.infinite-tree-item');
      treeItems.forEach(item => {
        const itemId = item.getAttribute('data-id');
        if (itemId) {
          const node = this.tree.getNodeById(itemId);
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
      const treeDataRaw = await this.fetchDirectoryTreeData();
      const treeData = Array.isArray(treeDataRaw)
        ? treeDataRaw.map(this.addIsDirectory)
        : treeDataRaw;
      const filtered = this.filterHiddenFiles(treeData);
      const sorted = this.sortNodes(filtered);
      
      // Add create items
      const dataWithCreateItems = this.addCreateItems(sorted);
      this.tree.loadData(dataWithCreateItems);
      
      // Load git hashes for files with drafts only
      await this.loadGitHashesForDraftFiles();
      
      // Use a small delay to ensure the tree has processed the new data
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Restore expansion state
      expandedNodes.forEach(nodeId => {
        const node = this.tree.getNodeById(nodeId);
        if (node && node.isDirectory) {
          this.tree.openNode(node);
        }
      });
      
      // Restore selection if the node still exists
      if (selectedNodeId) {
        const selectedNode = this.tree.getNodeById(selectedNodeId);
        if (selectedNode) {
          setTimeout(() => this.tree.selectNode(selectedNode), 0);
        }
      }
    } catch (error) {
      console.error('loadPreservingExpansion: Error occurred:', error);
      // Fall back to regular load if there's an error
      await this.load();
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
      const children = data.children || [];
      const filteredChildren = this.filterHiddenFiles(children);
      node.children = this.sortNodes(filteredChildren);
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
    
    // Use robust selection with fallback
    this.tree.selectNode(node);
    
    // Check if tree selection worked
    const afterTreeSelect = (this.tree.getSelectedNodes ? this.tree.getSelectedNodes()[0] : (this.tree.getSelectedNode ? this.tree.getSelectedNode() : undefined));
    
    // If tree selection failed, use manual selection
    if (!afterTreeSelect) {
      this.manualSelectedId = id;
    } else {
      // Clear manual selection if tree selection worked
      this.manualSelectedId = null;
    }
    
    // Ensure visual selection is updated
    this.updateVisualSelection(id);
  }

  /**
   * Reload a specific directory's contents while preserving tree state
   */
  async reloadDirectory(directoryPath: string): Promise<void> {
    if (!directoryPath) {
      // If no path provided, reload the entire tree
      await this.load();
      return;
    }

    const node = this.tree.getNodeById(directoryPath);
    if (!node || !node.isDirectory) {
      console.warn(`Directory not found or not a directory: ${directoryPath}`);
      // If the directory node doesn't exist, reload the entire tree
      await this.load();
      return;
    }

    try {
      // Reload the directory contents
      await this.loadDirectoryContents(node);
      
      // Re-add create items to the loaded directory
      if (node.children) {
        const dataWithCreateItems = this.addCreateItems(node.children);
        node.children = dataWithCreateItems;
        this.tree.updateNode(node);
      }
    } catch (error) {
      console.error(`Error reloading directory '${directoryPath}':`, error);
      // Fall back to reloading the entire tree
      await this.load();
    }
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
      const ownedByMe = await lockService.isOwnedByCurrentSession(filePath);
      
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
    try {
      const allNodes = this.tree.flatten();
      const fileNodes = allNodes.filter((node: TreeNode) => !node.isDirectory);
      
      // Update lock statuses in parallel
      await Promise.all(
        fileNodes.map((node: TreeNode) => this.updateLockStatus(node.id))
      );
    } catch (error) {
      console.warn('refreshAllLockStatuses: flatten() method not available, skipping');
    }
  }





  /**
   * Show create file/directory dialog in content area
   */
  private showCreateDialog(parentPath: string, isEmpty: boolean = false): void {
    if (!this.onCreateFile) return;
    
    // Dispatch event to main.ts to show create dialog in content area
    const createEvent = new CustomEvent('showCreateDialog', {
      detail: {
        parentPath: parentPath,
        isEmpty: isEmpty,
        onCreateFile: this.onCreateFile
      }
    });
    
    document.dispatchEvent(createEvent);
  }

  /**
   * Show create dialog for a specific directory (public method)
   */
  public showCreateDialogForDirectory(directoryPath: string): void {
    // Check if the directory exists in the tree
    const node = this.tree.getNodeById(directoryPath);
    if (!node) {
      console.warn('Directory node not found in tree:', directoryPath);
      return;
    }
    
    // Check if directory is empty
    const isEmpty = !node.children || node.children.filter(child => !child.isCreateItem).length === 0;
    this.showCreateDialog(directoryPath, isEmpty);
  }

  /**
   * Custom row renderer that extends the default InfiniteTree renderer
   * to add create node styling while preserving all original functionality
   */
  private customRowRenderer(node: any, _treeOptions: any): string {
    const { id, name } = node;
    const isCreateItem = node.isCreateItem || false;
    const hasChildren = node.children && node.children.length > 0;
    
    // Calculate depth by counting slashes in the ID (more reliable than treeOptions.depth)
    const depth = (id.match(/\//g) || []).length;
    
    // Get the actual node state from the tree instance
    const actualNode = this.tree.getNodeById(id);
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
    const triangleIcon = hasChildren ? (isOpen ? '▼' : '▶') : '';
    
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

  /**
   * Load git hashes only for files that have drafts in localStorage
   * This optimization prevents loading git hashes for all files on initial tree load
   */
  private async loadGitHashesForDraftFiles(): Promise<void> {
    try {
      // Get all file paths that have drafts in localStorage
      const draftFilePaths = this.getDraftFilePaths();
      
      if (draftFilePaths.length === 0) {
        console.log('[GIT HASH] No draft files found, skipping git hash lookup');
        return;
      }
      
      console.log(`[GIT HASH] Loading git hashes for ${draftFilePaths.length} draft files:`, draftFilePaths);
      
      // Fetch git hashes for draft files only
      const response = await fetch('/api/git-hashes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(draftFilePaths),
      });
      
      if (!response.ok) {
        console.error('[GIT HASH] Failed to fetch git hashes:', response.statusText);
        return;
      }
      
      const gitHashes: Record<string, string | null> = await response.json();
      console.log('[GIT HASH] Received git hashes:', gitHashes);
      
      // Update tree nodes with git hashes
      this.updateTreeNodesWithGitHashes(gitHashes);
      
    } catch (error) {
      console.error('[GIT HASH] Error loading git hashes for draft files:', error);
    }
  }
  
  /**
   * Get file paths that have drafts stored in localStorage
   */
  private getDraftFilePaths(): string[] {
    const draftPrefix = 'draft:';
    const draftPaths: string[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(draftPrefix)) {
        const filePath = key.substring(draftPrefix.length);
        draftPaths.push(filePath);
      }
    }
    
    return draftPaths;
  }
  
  /**
   * Update tree nodes with git hashes from the API response
   */
  private updateTreeNodesWithGitHashes(gitHashes: Record<string, string | null>): void {
    // Recursively update all nodes in the tree
    const updateNode = (node: TreeNode): void => {
      if (!node.isDirectory && gitHashes.hasOwnProperty(node.id)) {
        node.gitHash = gitHashes[node.id] || undefined;
        console.log(`[GIT HASH] Updated ${node.id} with hash: ${node.gitHash?.substring(0, 8) || 'null'}`);
        
        // Update the node in the tree to trigger any necessary re-rendering
        this.tree.updateNode(node);
      }
      
      // Recursively update children
      if (node.children) {
        node.children.forEach(updateNode);
      }
    };
    
    const rootNodes = this.tree.getChildren() || [];
    rootNodes.forEach(updateNode);
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
