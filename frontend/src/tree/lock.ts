import { TreeNode } from './types';
import { lockService } from '../services/lock';

/**
 * Update visual indicators for a node based on lock status
 */
export function updateNodeVisualIndicators(el: HTMLElement, node: TreeNode): void {
  const element = el.querySelector(`[data-id="${CSS.escape(node.id)}"]`);
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
 * Update lock status for a specific file
 */
export async function updateLockStatus(tree: any, el: HTMLElement, filePath: string): Promise<void> {
  if (!filePath || filePath.endsWith('/')) return; // Skip directories

  const node = tree.getNodeById(filePath);
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

    tree.updateNode(node);
    updateNodeVisualIndicators(el, node);
  } catch (error) {
    console.error(`Error updating lock status for ${filePath}:`, error);
  }
}

/**
 * Refresh lock status for all visible files
 */
export async function refreshAllLockStatuses(tree: any, el: HTMLElement): Promise<void> {
  try {
    const allNodes = tree.flatten();
    const fileNodes = allNodes.filter((node: TreeNode) => !node.isDirectory);

    // Update lock statuses in parallel
    await Promise.all(
      fileNodes.map((node: TreeNode) => updateLockStatus(tree, el, node.id))
    );
  } catch (error) {
    console.warn('refreshAllLockStatuses: flatten() method not available, skipping');
  }
}
