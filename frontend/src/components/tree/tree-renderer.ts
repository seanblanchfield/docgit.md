import { draftService } from '../services/draft.service';
import { lockService } from '../services/lock.service';

export class TreeRenderer {
  public renderNode = async (node: any): Promise<HTMLElement> => {
    const { text, type, data } = node;
    const path = data.path as string;

    const isDir = type === 'directory';
    const iconClass = isDir ? 'codicon-folder' : 'codicon-file';
    const statusClass = data.git_status ? `git-status-${data.git_status}` : '';

    const el = document.createElement('div');
    el.className = `tree-node-content ${statusClass}`.trim();
    el.innerHTML = `
      <i class="codicon ${iconClass}"></i>
      <span class="node-text">${text}</span>
      <span class="node-icons"></span>
    `;

    if (!isDir) {
      await this.updateFileIcons(el, path);
    }

    return el;
  };

  public async updateFileIcons(element: HTMLElement, filePath: string): Promise<void> {
    const iconsContainer = element.querySelector('.node-icons');
    if (!iconsContainer) return;

    let iconsHTML = '';

    const lockStatus = await lockService.checkLockStatus(filePath);
    if (lockStatus.locked) {
      const isOwned = await lockService.isOwnedByCurrentSession(filePath);
      const lockIcon = isOwned ? 'codicon-lock' : 'codicon-lock';
      const lockTitle = `Locked by ${lockStatus.lock_info?.owner || 'another user'}`;
      iconsHTML += `<i class="codicon ${lockIcon}" title="${lockTitle}"></i>`;
    }

    if (draftService.hasDraftForFile(filePath)) {
      iconsHTML += `<i class="codicon codicon-edit" title="You have unsaved changes."></i>`;
    }

    iconsContainer.innerHTML = iconsHTML;
  }
}
