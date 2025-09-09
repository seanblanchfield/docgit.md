import { TreeNode } from '../tree/types';

export interface TreeContextMenuOptions {
  onRename: (node: TreeNode) => void;
  onDelete: (node: TreeNode) => void;
  onEnterDragMode: (node: TreeNode) => void;
}

export class TreeContextMenu {
  private menu: HTMLElement | null = null;
  private currentNode: TreeNode | null = null;
  private options: TreeContextMenuOptions;

  constructor(options: TreeContextMenuOptions) {
    this.options = options;
    this.setupGlobalClickListener();
  }

  public show(node: TreeNode, x: number, y: number): void {
    // Only hide existing menu if there is one
    if (this.menu) {
      this.hide();
    }
    this.currentNode = node;
    console.log('TreeContextMenu show() called with node:', node);
    this.createMenu(x, y);
  }

  public hide(): void {
    console.log('TreeContextMenu hide() called, currentNode before clear:', this.currentNode);
    if (this.menu) {
      this.menu.remove();
      this.menu = null;
    }
    // Don't clear currentNode immediately - let handlers use it first
    setTimeout(() => {
      console.log('TreeContextMenu clearing currentNode after timeout');
      this.currentNode = null;
    }, 0);
  }

  public isVisible(): boolean {
    return this.menu !== null && document.body.contains(this.menu);
  }

  private createMenu(x: number, y: number): void {
    this.menu = document.createElement('div');
    this.menu.className = 'tree-context-menu';
    
    // Position the menu
    this.menu.style.position = 'fixed';
    this.menu.style.left = `${x}px`;
    this.menu.style.top = `${y}px`;
    this.menu.style.zIndex = '9999';
    this.menu.style.backgroundColor = 'white';
    this.menu.style.border = '1px solid #ddd';
    this.menu.style.borderRadius = '6px';
    this.menu.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    this.menu.style.minWidth = '160px';
    this.menu.style.padding = '4px 0';
    this.menu.style.display = 'block';
    this.menu.style.visibility = 'visible';
    this.menu.style.opacity = '1';

    // Create menu items
    const menuItems = [
      { label: 'Move', action: () => this.handleEnterDragMode() },
      { label: 'Rename', action: () => this.handleRename() },
      { label: 'Delete', action: () => this.handleDelete() }
    ];

    menuItems.forEach(item => {
      const menuItem = document.createElement('div');
      menuItem.className = 'tree-context-menu-item';
      menuItem.textContent = item.label;
      
      // Style menu item
      menuItem.style.padding = '8px 16px';
      menuItem.style.cursor = 'pointer';
      menuItem.style.fontSize = '14px';
      menuItem.style.borderBottom = '1px solid #f0f0f0';
      
      // Hover effects
      menuItem.addEventListener('mouseenter', () => {
        menuItem.style.backgroundColor = '#f5f5f5';
      });
      
      menuItem.addEventListener('mouseleave', () => {
        menuItem.style.backgroundColor = 'transparent';
      });
      
      // Click handler
      menuItem.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log(`Menu item '${item.label}' clicked, currentNode:`, this.currentNode);
        // Store current node before calling action (which may hide the menu)
        const nodeForAction = this.currentNode;
        if (item.label === 'Rename' && nodeForAction && this.options.onRename) {
          console.log('Calling onRename with node:', nodeForAction);
          this.hide();
          this.options.onRename(nodeForAction);
        } else if (item.label === 'Delete' && nodeForAction && this.options.onDelete) {
          this.hide();
          this.options.onDelete(nodeForAction);
        } else if (item.label === 'Move' && nodeForAction && this.options.onEnterDragMode) {
          this.hide();
          this.options.onEnterDragMode(nodeForAction);
        } else {
          console.log('Falling back to item.action()');
          item.action();
        }
      });
      
      this.menu!.appendChild(menuItem);
    });

    // Remove border from last item
    const lastItem = this.menu.lastElementChild as HTMLElement;
    if (lastItem) {
      lastItem.style.borderBottom = 'none';
    }

    // Add to DOM first
    document.body.appendChild(this.menu);
    
    // Then adjust position to keep menu within viewport
    this.adjustMenuPosition();
  }

  private adjustMenuPosition(): void {
    if (!this.menu) return;

    const rect = this.menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Adjust horizontal position if menu goes off-screen
    if (rect.right > viewportWidth) {
      const newLeft = viewportWidth - rect.width - 10;
      this.menu.style.left = `${Math.max(10, newLeft)}px`;
    }

    // Adjust vertical position if menu goes off-screen
    if (rect.bottom > viewportHeight) {
      const newTop = viewportHeight - rect.height - 10;
      this.menu.style.top = `${Math.max(10, newTop)}px`;
    }
  }

  private setupGlobalClickListener(): void {
    // Use capture phase to handle clicks before they bubble up
    document.addEventListener('click', (event) => {
      if (this.menu && !this.menu.contains(event.target as Node)) {
        // Delay hiding to allow menu item clicks to process first
        setTimeout(() => {
          this.hide();
        }, 0);
      }
    }, true); // Use capture phase

    // Add escape key listener
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.menu) {
        event.preventDefault();
        this.hide();
      }
    });
  }

  private handleEnterDragMode(): void {
    if (this.currentNode) {
      this.options.onEnterDragMode(this.currentNode);
    }
  }

  private handleRename(): void {
    console.log('TreeContextMenu handleRename called', { currentNode: this.currentNode, hasOnRename: !!this.options.onRename });
    if (this.currentNode && this.options.onRename) {
      const nodeToRename = this.currentNode; // Store reference before hiding
      this.hide();
      console.log('Calling onRename callback with node:', nodeToRename);
      this.options.onRename(nodeToRename);
    } else {
      console.error('Cannot handle rename - missing node or callback', { currentNode: this.currentNode, onRename: this.options.onRename });
    }
  }

  private handleDelete(): void {
    if (this.currentNode) {
      this.options.onDelete(this.currentNode);
    }
  }

  public destroy(): void {
    this.hide();
    // Remove global click listener if needed
  }
}
