import { TreeNode } from './types';
import { handleCreateNodeClick } from './createItem';
import { updateVisualSelection } from './state';

export function setupEventHandlers(treeInstance: any, el: HTMLElement, onFileSelect: (node: TreeNode) => void) {
  let lastSelectedId: string | null = null;
  let manualSelectedId: string | null = null;

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

    const node: TreeNode | undefined = treeInstance.getNodeById(nodeId);
    if (!node) return;

    // Handle create node clicks
    if (node.isCreateItem) {
      event.preventDefault();
      event.stopPropagation();
      handleCreateNodeClick(node);
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
      if (currentlyOpen && lastSelectedId && lastSelectedId.startsWith(node.id + '/')) {
        treeInstance.selectNode(node);
      }

      // Toggle directories
      treeInstance.toggleNode(node);

      // If expanding and we have a stored leaf inside, select the nearest visible ancestor (next path segment)
      if (!currentlyOpen && lastSelectedId && lastSelectedId.startsWith(node.id + '/')) {
        const rel = lastSelectedId.slice(node.id.length + 1);
        const firstSeg = rel.split('/')[0];
        const nextId = node.id + '/' + firstSeg;

        setTimeout(() => {
          const n = treeInstance.getNodeById(nextId);
          if (n) {
            treeInstance.selectNode(n);
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

  treeInstance.on('selectNode', (node: TreeNode) => {
    if (!node) return;

    // Always update visual selection for files, directories, and create items
    updateVisualSelection(el, node.id);

    // Only update lastSelectedId and trigger onFileSelect for files (not directories or create items)
    if (!node.isDirectory && !node.isCreateItem) {
      lastSelectedId = node.id;
      onFileSelect(node);
    }
  });

  // Prevent deselecting the currently selected file by reselecting if deselect would leave none selected
  treeInstance.on('deselectNode', (node: TreeNode) => {
    const selected = treeInstance.getSelectedNodes();

    if (selected.length === 0 && node) {
      // re-select after microtask so internal deselect finishes
      setTimeout(() => {
        treeInstance.selectNode(node);
      }, 0);
    } else if (selected.length === 0) {
      // Clear visual selection if no nodes are selected
      const allItems = el.querySelectorAll('.infinite-tree-item');
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
    const selected = (treeInstance.getSelectedNodes ? treeInstance.getSelectedNodes()[0] : (treeInstance.getSelectedNode ? treeInstance.getSelectedNode() : undefined));

    if (!selected) {
      const firstVisibleElement = el.querySelector('.infinite-tree-item') as HTMLElement;
      if (firstVisibleElement) {
        const firstId = firstVisibleElement.getAttribute('data-id');
        if (firstId) {
          const firstNode = treeInstance.getNodeById(firstId);
          if (firstNode) {
            treeInstance.selectNode(firstNode);
          }
        }
      }
    }
  });

  // Ensure tree gets focus when clicked
  el.addEventListener('click', () => {
    el.focus();
  });

  el.addEventListener('keydown', (ev) => {
    const key = ev.key;

    // Helper function to get currently selected node
    const getSelected = (): TreeNode | undefined => {
      // First try manual selection if it exists
      if (manualSelectedId) {
        const manualNode = treeInstance.getNodeById(manualSelectedId);
        if (manualNode) {
          return manualNode;
        }
      }

      // Fall back to tree's selection
      const selected = (treeInstance.getSelectedNodes ? treeInstance.getSelectedNodes()[0] : (treeInstance.getSelectedNode ? treeInstance.getSelectedNode() : undefined));
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
          if (!target) break;
          const id = target.getAttribute('data-id');

          if (id) {
            const node = treeInstance.getNodeById(id);
            if (node) {
              treeInstance.selectNode(node);

              // Check if tree selection worked
              const afterTreeSelect = (treeInstance.getSelectedNodes ? treeInstance.getSelectedNodes()[0] : (treeInstance.getSelectedNode ? treeInstance.getSelectedNode() : undefined));

              if (afterTreeSelect && afterTreeSelect.id === node.id) {
                // Tree selection worked, clear manual selection
                manualSelectedId = null;
              } else {
                // Tree selection failed (likely for create items), use manual selection
                manualSelectedId = node.id;
                updateVisualSelection(el, node.id);
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
          if (!target) break;
          const id = target.getAttribute('data-id');

          if (id) {
            const node = treeInstance.getNodeById(id);
            if (node) {
              treeInstance.selectNode(node);

              // Check if tree selection worked
              const afterTreeSelect = (treeInstance.getSelectedNodes ? treeInstance.getSelectedNodes()[0] : (treeInstance.getSelectedNode ? treeInstance.getSelectedNode() : undefined));

              if (afterTreeSelect && afterTreeSelect.id === node.id) {
                // Tree selection worked, clear manual selection
                manualSelectedId = null;
              } else {
                // Tree selection failed (likely for create items), use manual selection
                manualSelectedId = node.id;
                updateVisualSelection(el, node.id);
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
              const refreshedNode = treeInstance.getNodeById(currentSelected.id);
              if (refreshedNode && refreshedNode.children && refreshedNode.children.length > 0) {
                const firstChild = refreshedNode.children[0];
                treeInstance.selectNode(firstChild);
                // Clear manual selection since tree selection should work for children
                manualSelectedId = null;
              }
            }, 50);
          } else {
            const firstChild = currentSelected.children && currentSelected.children[0];
            if (firstChild) {
              treeInstance.selectNode(firstChild);
              // Clear manual selection since tree selection should work for children
              manualSelectedId = null;
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
            const freshNode = treeInstance.getNodeById(directoryId);

            if (freshNode) {
              treeInstance.selectNode(freshNode);

              // Check if tree selection worked
              const afterTreeSelect = (treeInstance.getSelectedNodes ? treeInstance.getSelectedNodes()[0] : (treeInstance.getSelectedNode ? treeInstance.getSelectedNode() : undefined));

              // If tree selection failed, use manual selection
              if (!afterTreeSelect) {
                manualSelectedId = freshNode.id;
              }

              updateVisualSelection(el, freshNode.id);
            }
          }, 20);
        } else {
          const parentId = currentSelected.id.substring(0, currentSelected.id.lastIndexOf('/'));
          if (parentId) {
            const parent = treeInstance.getNodeById(parentId);
            if (parent) {
              treeInstance.selectNode(parent);
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
          handleCreateNodeClick(currentSelected);
        }
        break;
      }
      default:
        break;
    }
  });

  treeInstance.on('toggle', async (node: TreeNode, isOpen: boolean) => {
    // Lazy-load children on first expand
    if (isOpen && node.isDirectory && (!node.children || node.children.length === 0)) {
      // await this.loadDirectoryContents(node);
    }

    // Force re-render of the node to update triangle icon
    treeInstance.updateNode(node);

    if (isOpen) {
      // Section was expanded – if previously selected leaf lies inside, restore highlight to it
      if (lastSelectedId && lastSelectedId.startsWith(node.id + '/')) {
        const tgt = treeInstance.getNodeById(lastSelectedId);
        if (tgt) {
          setTimeout(() => {
            treeInstance.selectNode(tgt);
            updateVisualSelection(el, tgt.id);
          }, 0);
        }
      }
    } else {
      // Section being collapsed – selection is now handled by the ArrowLeft key handler
    }
  });
}
