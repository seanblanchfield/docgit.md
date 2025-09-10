import { TreeNode } from './types';
import { ConfirmMoveDialog, MoveConfirmationData } from '../components/dialogs/confirmMoveDialog';
import { ReorderService } from '../services/reorderService';
import { TreeContextMenu, TreeContextMenuOptions } from '../components/treeContextMenu';
import { RenameDialog } from '../components/dialogs/renameDialog';
import { DeleteDialog } from '../components/dialogs/deleteDialog';
import { RenameService } from '../services/renameService';
import { DeleteService } from '../services/deleteService';

export interface DragState {
  isDragging: boolean;
  draggedItem: TreeNode | null;
  dragStartPosition: { x: number; y: number };
  currentDropTarget: TreeNode | null;
  dropPosition: 'before' | 'after' | 'inside';
  expandTimer: number | null;
  dragGhost: HTMLElement | null;
  dropIndicator: HTMLElement | null;
}

export class DragManager {
  private state: DragState;
  private confirmDialog: ConfirmMoveDialog;
  private contextMenu!: TreeContextMenu;
  private renameDialog!: RenameDialog;
  private deleteDialog!: DeleteDialog;
  private longPressTimer: number | null = null;
  private longPressPosition: { x: number; y: number } = { x: 0, y: 0 };
  private readonly LONG_PRESS_DURATION = 500; // ms
  private readonly AUTO_EXPAND_DELAY = 1000; // 1 second for auto-expand

  constructor(private tree: any, private container: HTMLElement, private directoryTree?: any) {
    console.log('DragManager constructor called', { tree, container });
    this.state = this.getInitialState();
    this.confirmDialog = new ConfirmMoveDialog();
    this.setupContextMenu();
    this.setupRenameDialog();
    this.setupDeleteDialog();
    this.setupEventListeners();
    console.log('DragManager initialized successfully');
  }

  private getInitialState(): DragState {
    return {
      isDragging: false,
      draggedItem: null,
      dragStartPosition: { x: 0, y: 0 },
      currentDropTarget: null,
      dropPosition: 'after',
      expandTimer: null,
      dragGhost: null,
      dropIndicator: null,
    };
  }

  private setupContextMenu(): void {
    const contextMenuOptions: TreeContextMenuOptions = {
      onRename: (node: TreeNode) => {
        if (this.renameDialog) {
          this.renameDialog.show(node);
        }
      },
      onDelete: (node: TreeNode) => {
        this.handleDeleteFromContextMenu(node);
      },
      onEnterDragMode: (node: TreeNode) => {
        // Create a synthetic mouse event to initiate drag
        const syntheticEvent = new MouseEvent('mousedown', {
          clientX: this.longPressPosition.x,
          clientY: this.longPressPosition.y,
          bubbles: true
        });
        this.initiateDrag(syntheticEvent, node);
      }
    };
    
    this.contextMenu = new TreeContextMenu(contextMenuOptions);
  }

  private setupRenameDialog(): void {
    this.renameDialog = new RenameDialog({
      onConfirm: async (node: TreeNode, newName: string) => {
        try {
          const renameService = new RenameService();
          await renameService.renameItem(node.id, newName);
          
          // Refresh the tree to show the updated name while preserving expansion state
          if (this.directoryTree && this.directoryTree.loadPreservingExpansion) {
            await this.directoryTree.loadPreservingExpansion();
          }
        } catch (error) {
          console.error('Rename failed:', error);
          throw error; // Re-throw to let the dialog handle the error display
        }
      },
      onCancel: () => {
        // Rename cancelled - no action needed
      }
    });
  }

  private setupDeleteDialog(): void {
    this.deleteDialog = new DeleteDialog({
      onConfirm: async (node: TreeNode) => {
        try {
          // Find the next item to navigate to before deletion
          const nextItem = this.findNextItemAfterDelete(node);
          
          const deleteService = new DeleteService();
          const result = await deleteService.deleteItem(node);
          console.log('Delete successful:', result);
          
          // Refresh the tree to show the item is removed while preserving expansion state
          if (this.directoryTree && this.directoryTree.loadPreservingExpansion) {
            await this.directoryTree.loadPreservingExpansion();
          }
          
          // Handle content view navigation after tree refresh
          const currentPath = window.location.pathname;
          const isCurrentFileDeleted = currentPath.includes(node.id) || currentPath.endsWith(node.id);
          
          if (isCurrentFileDeleted) {
            if (nextItem) {
              // Navigate to the next appropriate file
              setTimeout(() => {
                window.history.pushState({}, '', `/file/${nextItem.id}`);
                if (this.directoryTree.options.onFileSelect) {
                  this.directoryTree.options.onFileSelect(nextItem.id);
                }
                this.directoryTree.selectPath(nextItem.id);
              }, 150); // Delay to ensure tree is fully refreshed
            } else {
              // No next item, show create new file screen
              setTimeout(() => {
                window.history.pushState({}, '', '/');
                // Clear any existing content and show create new file interface
                const contentArea = document.querySelector('.content-area, .main-content, #content');
                if (contentArea) {
                  contentArea.innerHTML = '<div class="create-file-prompt">No files available. Create a new file to get started.</div>';
                }
              }, 150);
            }
          } else if (nextItem && this.directoryTree) {
            // File wasn't currently displayed, just update tree selection
            setTimeout(() => {
              this.directoryTree.selectPath(nextItem.id);
            }, 150);
          }
          
          // Show success notification
          console.log(`Successfully deleted "${node.name}"`);
        } catch (error) {
          console.error('Delete failed:', error);
          throw error; // Re-throw to let the dialog handle the error display
        }
      },
      onCancel: () => {
        console.log('Delete cancelled');
      }
    });
  }

  private findNextItemAfterDelete(nodeToDelete: TreeNode): TreeNode | null {
    if (!this.tree) return null;
    
    // Get all visible nodes in the tree
    const allNodes = this.tree.getAllNodes ? this.tree.getAllNodes() : [];
    if (!allNodes.length) return null;
    
    // Find the index of the node to delete
    const deleteIndex = allNodes.findIndex((node: TreeNode) => node.id === nodeToDelete.id);
    if (deleteIndex === -1) return null;
    
    // Try to find the next sibling or previous sibling
    // First try next sibling
    if (deleteIndex + 1 < allNodes.length) {
      return allNodes[deleteIndex + 1];
    }
    
    // If no next sibling, try previous sibling
    if (deleteIndex > 0) {
      return allNodes[deleteIndex - 1];
    }
    
    // If no siblings, try parent
    const parent = this.tree.getParentNode ? this.tree.getParentNode(nodeToDelete.id) : null;
    if (parent && !parent.isCreateItem) {
      return parent;
    }
    
    return null;
  }

  private async handleDeleteFromContextMenu(node: TreeNode): Promise<void> {
    this.deleteDialog.show(node);
  }

  private setupEventListeners(): void {
    // Mouse events
    this.container.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.container.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.container.addEventListener('mouseup', this.handleMouseUp.bind(this));
    this.container.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
    this.container.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    this.container.addEventListener('touchend', this.handleTouchEnd.bind(this));

    // Keyboard events
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
  }

  private handleMouseDown(event: MouseEvent): void {
    console.log('DragManager handleMouseDown called', event);
    
    // Check if context menu is open and hide it if clicking anywhere
    if (this.contextMenu && this.contextMenu.isVisible()) {
      this.contextMenu.hide();
      return; // Don't start new long press if dismissing context menu
    }
    
    const treeItem = this.getTreeItemFromEvent(event);
    if (!treeItem) {
      console.log('No tree item found from event');
      return;
    }

    const nodeId = treeItem.getAttribute('data-id');
    if (!nodeId) {
      console.log('No node ID found on tree item');
      return;
    }

    const node = this.tree.getNodeById(nodeId);
    if (!node || node.isCreateItem) {
      console.log('Node not found or is create item', { node });
      return; // Don't allow dragging create items
    }

    console.log('Starting long press timer for node', node);
    this.startLongPressTimer(event, node);
  }

  private handleTouchStart(event: TouchEvent): void {
    if (event.touches.length !== 1) return;

    const touch = event.touches[0];
    if (!touch) return;
    
    const treeItem = this.getTreeItemFromTouch(touch);
    if (!treeItem) return;

    const nodeId = treeItem.getAttribute('data-id');
    if (!nodeId) return;

    const node = this.tree.getNodeById(nodeId);
    if (!node || node.isCreateItem) return;

    // Prevent default to avoid scrolling during long press
    event.preventDefault();
    
    const mouseEvent = new MouseEvent('mousedown', {
      clientX: touch.clientX,
      clientY: touch.clientY,
    });
    
    this.startLongPressTimer(mouseEvent, node);
  }

  private startLongPressTimer(event: MouseEvent, node: TreeNode): void {
    console.log('startLongPressTimer called', { node, duration: this.LONG_PRESS_DURATION });
    this.clearLongPressTimer();
    
    // Store the position for potential drag initiation later
    this.longPressPosition = { x: event.clientX, y: event.clientY };
    
    this.longPressTimer = window.setTimeout(() => {
      console.log('Long press timer fired, showing context menu');
      this.showContextMenu(event, node);
    }, this.LONG_PRESS_DURATION);
    console.log('Long press timer set with ID:', this.longPressTimer);
  }

  private clearLongPressTimer(): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  private showContextMenu(event: MouseEvent, node: TreeNode): void {
    console.log('Showing context menu for node:', node);
    this.contextMenu.show(node, event.clientX, event.clientY);
  }

  private initiateDrag(event: MouseEvent, node: TreeNode): void {
    this.state.isDragging = true;
    this.state.draggedItem = node;
    this.state.dragStartPosition = { x: event.clientX, y: event.clientY };

    // Add dragging class to the original item
    const originalElement = this.container.querySelector(`[data-id="${CSS.escape(node.id)}"]`) as HTMLElement;
    if (originalElement) {
      originalElement.classList.add('dragging');
    }

    // Create drag ghost
    this.createDragGhost(node);
    
    // Create drop indicator
    this.createDropIndicator();

    // Add dragging class to tree
    this.container.classList.add('tree-dragging');

    // Change cursor
    document.body.style.cursor = 'grabbing';

    // Prevent text selection during drag
    document.body.style.userSelect = 'none';

    // Add long press feedback
    if (originalElement) {
      originalElement.classList.add('long-press-active');
      setTimeout(() => {
        originalElement.classList.remove('long-press-active');
      }, 200);
    }
  }

  private createDragGhost(node: TreeNode): void {
    const originalElement = this.container.querySelector(`[data-id="${CSS.escape(node.id)}"]`) as HTMLElement;
    if (!originalElement) return;

    const ghost = originalElement.cloneNode(true) as HTMLElement;
    ghost.classList.add('drag-ghost');
    ghost.style.position = 'fixed';
    ghost.style.pointerEvents = 'none';
    ghost.style.zIndex = '10000';
    ghost.style.opacity = '0.7';
    ghost.style.transform = 'rotate(5deg)';
    
    document.body.appendChild(ghost);
    this.state.dragGhost = ghost;
  }

  private createDropIndicator(): void {
    const indicator = document.createElement('div');
    indicator.className = 'drop-indicator';
    indicator.style.position = 'absolute';
    indicator.style.height = '2px';
    indicator.style.backgroundColor = '#007acc';
    indicator.style.zIndex = '9999';
    indicator.style.display = 'none';
    indicator.style.left = '0';
    indicator.style.right = '0';
    
    this.container.appendChild(indicator);
    this.state.dropIndicator = indicator;
  }

  private handleMouseMove(event: MouseEvent): void {
    if (!this.state.isDragging) {
      this.clearLongPressTimer(); // Cancel long press if mouse moves before timer
      return;
    }

    this.updateDragPosition(event.clientX, event.clientY);
    this.updateDropTarget(event);
  }

  private handleTouchMove(event: TouchEvent): void {
    if (!this.state.isDragging || event.touches.length !== 1) return;

    event.preventDefault(); // Prevent scrolling
    const touch = event.touches[0];
    if (!touch) return;
    
    this.updateDragPosition(touch.clientX, touch.clientY);
    
    // Create a mouse event for drop target calculation
    const mouseEvent = new MouseEvent('mousemove', {
      clientX: touch.clientX,
      clientY: touch.clientY,
    });
    this.updateDropTarget(mouseEvent);
  }

  private updateDragPosition(clientX: number, clientY: number): void {
    if (!this.state.dragGhost) return;

    this.state.dragGhost.style.left = `${clientX + 10}px`;
    this.state.dragGhost.style.top = `${clientY + 10}px`;
  }


  private updateDropTarget(event: MouseEvent): void {
    const treeItem = this.getTreeItemFromEvent(event);
    if (!treeItem) {
      this.clearDropTarget();
      return;
    }

    const nodeId = treeItem.getAttribute('data-id');
    if (!nodeId) {
      this.clearDropTarget();
      return;
    }

    const node = this.tree.getNodeById(nodeId);
    if (!node || node === this.state.draggedItem || node.isCreateItem) {
      this.clearDropTarget();
      return;
    }

    // Prevent dropping a parent into its own child
    if (this.isDescendant(node, this.state.draggedItem)) {
      this.clearDropTarget();
      return;
    }

    // Calculate drop position based on mouse position within the item
    const rect = treeItem.getBoundingClientRect();
    const relativeY = event.clientY - rect.top;
    const itemHeight = rect.height;
    
    let dropPosition: 'before' | 'after' | 'inside';
    
    if (node.isDirectory && relativeY > itemHeight * 0.25 && relativeY < itemHeight * 0.75) {
      dropPosition = 'inside';
    } else if (relativeY < itemHeight * 0.5) {
      dropPosition = 'before';
    } else {
      dropPosition = 'after';
    }

    // Update state
    this.state.currentDropTarget = node;
    this.state.dropPosition = dropPosition;

    // Update visual feedback
    this.showDropIndicator(treeItem, dropPosition);
    this.updateTreeItemHighlight(treeItem, dropPosition);
    this.handleAutoExpand(node);
  }

  private isDescendant(potentialChild: TreeNode | null, potentialParent: TreeNode | null): boolean {
    if (!potentialChild || !potentialParent) return false;
    
    // Check if potentialChild's path starts with potentialParent's path
    return potentialChild.id.startsWith(potentialParent.id + '/');
  }

  private updateTreeItemHighlight(treeItem: HTMLElement, position: 'before' | 'after' | 'inside'): void {
    // Clear previous highlights
    this.clearTreeItemHighlights();
    
    // Add appropriate highlight class
    treeItem.classList.add('drop-target');
    if (position === 'inside') {
      treeItem.classList.add('inside');
    }
  }

  private clearTreeItemHighlights(): void {
    const highlightedItems = this.container.querySelectorAll('.drop-target');
    highlightedItems.forEach(item => {
      item.classList.remove('drop-target', 'inside');
    });
  }

  private showDropIndicator(treeItem: HTMLElement, position: 'before' | 'after' | 'inside'): void {
    if (!this.state.dropIndicator) return;

    const rect = treeItem.getBoundingClientRect();
    const treeRect = this.container.getBoundingClientRect();
    
    this.state.dropIndicator.style.display = 'block';
    this.state.dropIndicator.style.left = `${rect.left - treeRect.left}px`;
    this.state.dropIndicator.style.width = `${rect.width}px`;

    // Reset background color
    this.state.dropIndicator.style.backgroundColor = '#007acc';
    this.state.dropIndicator.classList.remove('inside');

    if (position === 'before') {
      this.state.dropIndicator.style.top = `${rect.top - treeRect.top}px`;
    } else if (position === 'after') {
      this.state.dropIndicator.style.top = `${rect.bottom - treeRect.top}px`;
    } else { // inside
      this.state.dropIndicator.style.top = `${rect.top - treeRect.top + rect.height / 2}px`;
      this.state.dropIndicator.style.backgroundColor = '#28a745';
      this.state.dropIndicator.classList.add('inside');
    }
  }

  private handleAutoExpand(node: TreeNode): void {
    if (!node.isDirectory || node.state?.open) return;

    // Clear existing timer
    if (this.state.expandTimer) {
      clearTimeout(this.state.expandTimer);
    }

    // Add visual feedback for pending auto-expand
    const nodeElement = this.container.querySelector(`[data-id="${CSS.escape(node.id)}"]`) as HTMLElement;
    if (nodeElement) {
      nodeElement.classList.add('auto-expanding');
    }

    // Set new timer for auto-expand
    this.state.expandTimer = window.setTimeout(() => {
      if (this.state.currentDropTarget === node && this.state.isDragging) {
        this.tree.openNode(node);
        
        // Remove auto-expanding class after expansion
        if (nodeElement) {
          nodeElement.classList.remove('auto-expanding');
        }
      }
    }, this.AUTO_EXPAND_DELAY);
  }

  private clearDropTarget(): void {
    this.state.currentDropTarget = null;
    
    if (this.state.dropIndicator) {
      this.state.dropIndicator.style.display = 'none';
    }

    // Clear tree item highlights
    this.clearTreeItemHighlights();

    if (this.state.expandTimer) {
      clearTimeout(this.state.expandTimer);
      this.state.expandTimer = null;
    }
  }

  private handleMouseUp(_event: MouseEvent): void {
    // Only clear the long press timer if context menu is not visible
    if (!this.contextMenu.isVisible()) {
      this.clearLongPressTimer();
    }
    
    if (!this.state.isDragging) return;

    this.completeDrag();
  }

  private handleTouchEnd(_event: TouchEvent): void {
    // Only clear the long press timer if context menu is not visible
    if (!this.contextMenu.isVisible()) {
      this.clearLongPressTimer();
    }
    
    if (!this.state.isDragging) return;

    this.completeDrag();
  }

  private completeDrag(): void {
    if (this.state.currentDropTarget && this.state.draggedItem) {
      // Create move confirmation data
      const moveData: MoveConfirmationData = {
        sourceNode: this.state.draggedItem,
        targetNode: this.state.currentDropTarget,
        dropPosition: this.state.dropPosition
      };

      // Hide drag ghost immediately when showing confirmation dialog
      if (this.state.dragGhost) {
        this.state.dragGhost.style.display = 'none';
      }

      // Show confirmation dialog
      this.confirmDialog.show(
        moveData,
        (confirmedData) => this.handleMoveConfirmed(confirmedData),
        () => this.handleMoveCancelled()
      );
      this.confirmDialog.setMoveData(moveData);
    } else {
      this.cancelDrag();
    }
  }

  private async handleMoveConfirmed(data: MoveConfirmationData): Promise<void> {
    try {
      // Calculate reorder parameters
      const reorderParams = ReorderService.calculateReorderParams(
        data.sourceNode.id,
        data.targetNode.id,
        data.dropPosition
      );

      // Prepare the API request
      const reorderRequest = {
        source_path: ReorderService.getSourcePath(data.sourceNode.id),
        target_parent_path: reorderParams.target_parent_path,
        position: reorderParams.position,
        is_directory: ReorderService.isDirectory(data.sourceNode)
      };

      console.log('Sending reorder request:', reorderRequest);

      // Call the reorder API
      const result = await ReorderService.reorderItem(reorderRequest);

      if (result.success) {
        console.log('Reorder successful:', result.message);
        // Refresh the tree while preserving expanded state
        if (this.directoryTree && this.directoryTree.loadPreservingExpansion) {
          await this.directoryTree.loadPreservingExpansion();
        } else {
          // Fallback to page reload if directoryTree not available
          window.location.reload();
        }
      } else {
        console.error('Reorder failed:', result.message);
        alert(`Failed to move item: ${result.message}`);
      }
    } catch (error) {
      console.error('Error during reorder operation:', error);
      alert(`Error moving item: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      this.cancelDrag();
    }
  }

  private handleMoveCancelled(): void {
    this.cancelDrag();
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.state.isDragging) {
      this.cancelDrag();
    }
  }

  private cancelDrag(): void {
    // Clean up drag ghost
    if (this.state.dragGhost) {
      document.body.removeChild(this.state.dragGhost);
    }

    // Clean up drop indicator
    if (this.state.dropIndicator) {
      this.container.removeChild(this.state.dropIndicator);
    }

    // Remove dragging class from original item
    if (this.state.draggedItem) {
      const originalElement = this.container.querySelector(`[data-id="${CSS.escape(this.state.draggedItem.id)}"]`) as HTMLElement;
      if (originalElement) {
        originalElement.classList.remove('dragging', 'long-press-active');
      }
    }

    // Clear all visual feedback
    this.clearTreeItemHighlights();
    
    // Remove auto-expanding classes
    const autoExpandingItems = this.container.querySelectorAll('.auto-expanding');
    autoExpandingItems.forEach(item => {
      item.classList.remove('auto-expanding');
    });

    // Clear timers
    if (this.state.expandTimer) {
      clearTimeout(this.state.expandTimer);
    }

    // Reset cursor and selection
    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    // Remove dragging class
    this.container.classList.remove('tree-dragging');

    // Reset state
    this.state = this.getInitialState();
  }

  private getTreeItemFromEvent(event: MouseEvent): HTMLElement | null {
    const target = event.target as HTMLElement;
    return target.closest('.infinite-tree-item') as HTMLElement | null;
  }

  private getTreeItemFromTouch(touch: Touch): HTMLElement | null {
    const element = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement;
    return element?.closest('.infinite-tree-item') as HTMLElement | null;
  }

  public destroy(): void {
    this.cancelDrag();
    // Event listeners will be cleaned up when the tree element is removed
  }
}
