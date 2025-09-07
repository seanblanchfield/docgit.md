declare module 'infinite-tree';
import InfiniteTree from 'infinite-tree';
import { DirectoryTreeOptions, TreeNode } from './types';
import { customRowRenderer } from './renderer';
import { fetchDirectoryTreeData, filterHiddenFiles, sortNodes, addIsDirectory, findDefaultFile } from './data';
import { addCreateItems, showCreateDialogForDirectory } from './createItem';
import { refreshAllLockStatuses, updateLockStatus } from './lock';
import { selectPath, loadPreservingExpansion } from './state';
import { setupEventHandlers } from './eventHandlers';
import { DragManager } from './DragManager';

export class DirectoryTree {
  private tree: any;
  private el: HTMLElement;
  private options: DirectoryTreeOptions;
  private dragManager: DragManager;

  constructor(options: DirectoryTreeOptions) {
    this.options = options;
    this.el = options.el;
    this.tree = new InfiniteTree({
      el: this.el,
      data: [],
      autoOpen: false,
      childrenProperty: 'children',
      rowRenderer: (node: TreeNode) => customRowRenderer(this.tree, node)
    });

    setupEventHandlers(this.tree, this.el, this.options.onFileSelect, this.options.onCreateFile, this.options.onDeleteDirectory);
    
    // Initialize drag manager
    this.dragManager = new DragManager(this.tree, this.el, this);
  }

  async load(path?: string) {
    const treeDataRaw = await fetchDirectoryTreeData(path);
    const treeData = Array.isArray(treeDataRaw)
      ? treeDataRaw.map(addIsDirectory)
      : treeDataRaw;
    const filtered = filterHiddenFiles(treeData);
    const sorted = sortNodes(filtered);
    const dataWithCreateItems = addCreateItems(sorted);
    this.tree.loadData(dataWithCreateItems);

    if (this.options.selectDefault !== false) {
      const defaultPath = findDefaultFile(sorted);
      if (defaultPath) {
        setTimeout(() => {
          this.selectPath(defaultPath);
        }, 0);
      }
    }
  }

  public selectPath(id: string) {
    selectPath(this.tree, this.el, id, this.options.onFileSelect);
  }

  public async loadPreservingExpansion(newDirectoryPath?: string): Promise<void> {
    await loadPreservingExpansion(this.tree, this.el, newDirectoryPath);
  }

  public async updateLockStatus(filePath: string): Promise<void> {
    await updateLockStatus(this.tree, this.el, filePath);
  }

  public async refreshAllLockStatuses(): Promise<void> {
    await refreshAllLockStatuses(this.tree, this.el);
  }

  public showCreateDialogForDirectory(directoryPath: string): void {
    showCreateDialogForDirectory(directoryPath, this.tree, this.options.onCreateFile);
  }

  public destroy(): void {
    this.dragManager.destroy();
  }
}
