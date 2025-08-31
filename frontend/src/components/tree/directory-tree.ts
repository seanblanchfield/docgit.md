import $ from 'jquery';
import 'jstree';

import { treeDataService } from './tree-data.service';
import { TreeNavigation } from './tree-navigation';
import { treeCreateDialog } from './tree-create-dialog';
import { apiService } from '../../services/api.service';
import { dialogService } from '../../services/dialog.service';

export class DirectoryTree {
    private treeInstance!: JSTree;

  constructor(private container: HTMLElement, private editor: any) {}

  public async init(): Promise<void> {
        const treeData = await treeDataService.fetchTreeData();

    const core = {
      data: treeData,
      check_callback: true,
      themes: {
        name: 'default-dark',
        responsive: true,
      },
    };

    this.treeInstance = $(this.container).jstree({
      core,
      plugins: ['contextmenu', 'dnd', 'state', 'types'],
      contextmenu: {
        items: this.contextMenuItems.bind(this),
      },
    }).on('ready.jstree', () => {
      new TreeNavigation(this.treeInstance, this.editor);
    });
  }

  private contextMenuItems(node: any): any {
    const items: { [key: string]: any } = {};

    items.create = {
      label: 'New...',
      action: async () => {
        const result = await treeCreateDialog.show();
        if (result) {
          this.createNode(node, result.name, result.type);
        }
      },
    };

    if (node.id !== '#') {
      items.rename = {
        label: 'Rename',
        action: () => this.treeInstance.edit(node),
      };
      items.delete = {
        label: 'Delete',
        action: () => this.deleteNode(node),
      };
    }

    return items;
  }

  private async createNode(parentNode: any, name: string, type: 'file' | 'directory'): Promise<void> {
    try {
      const parentPath = parentNode.id === '#' ? '' : parentNode.data.path;
      const newPath = `${parentPath}/${name}`.replace(/^\/+/, '');

      if (type === 'file') {
        await apiService.createFile(newPath);
      } else {
        await apiService.createDirectory(newPath);
      }

      this.treeInstance.refresh();
    } catch (error) {
      console.error('Error creating node:', error);
      dialogService.alert(`Failed to create ${type}: ${name}`);
    }
  }

  public selectNodeByPath(path: string): void {
    if (this.treeInstance) {
      const nodeToSelect = this.treeInstance.get_node(path as any);
      if (nodeToSelect) {
        this.treeInstance.deselect_all();
        this.treeInstance.select_node(nodeToSelect);
        this.treeInstance.open_node(nodeToSelect.parent, null, true);
      } else {
        console.warn(`Node with path not found: ${path}`);
      }
    }
  }

  private async deleteNode(node: any): Promise<void> {
    const path = node.data.path;
    const isDirectory = node.type === 'directory';

    const confirm = isDirectory
      ? await dialogService.confirmDeleteDirectory(path)
      : await dialogService.confirmDeleteFile(path);

    if (confirm) {
      try {
        if (isDirectory) {
          await apiService.deleteDirectory(path);
        } else {
          await apiService.deleteFile(path);
        }
        this.treeInstance.refresh();
      } catch (error) {
        console.error('Error deleting node:', error);
        dialogService.alert(`Failed to delete: ${path}`);
      }
    }
  }
}
