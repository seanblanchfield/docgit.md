/**
 * Service for handling drag & drop reorder operations via API
 */

export interface ReorderRequest {
  source_path: string;
  target_parent_path: string;
  position: number;
  is_directory: boolean;
}

export interface ReorderResponse {
  success: boolean;
  message?: string;
  new_path?: string;
}

export class ReorderService {
  private static readonly API_BASE = '/api';

  /**
   * Reorder an item by calling the backend API
   */
  static async reorderItem(request: ReorderRequest): Promise<ReorderResponse> {
    try {
      const response = await fetch(`${this.API_BASE}/reorder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: ReorderResponse = await response.json();
      return result;
    } catch (error) {
      console.error('Error calling reorder API:', error);
      return {
        success: false,
        message: `Failed to reorder item: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Calculate the target parent path and position based on drop target and position
   */
  static calculateReorderParams(
    sourceId: string,
    targetId: string,
    dropPosition: 'before' | 'after' | 'inside'
  ): { target_parent_path: string; position: number } {
    if (dropPosition === 'inside') {
      // Moving inside a directory
      return {
        target_parent_path: targetId,
        position: 0, // Insert at the beginning of the directory
      };
    }

    // Moving before or after an item
    const targetParentPath = this.getParentPath(targetId);
    const targetPosition = this.calculatePosition(targetId, dropPosition);

    return {
      target_parent_path: targetParentPath,
      position: targetPosition,
    };
  }

  /**
   * Get the parent directory path from a full path
   */
  private static getParentPath(fullPath: string): string {
    const parts = fullPath.split('/');
    if (parts.length <= 1) {
      return ''; // Root directory
    }
    return parts.slice(0, -1).join('/');
  }

  /**
   * Calculate the position index for insertion based on target item's numerical prefix
   */
  private static calculatePosition(targetId: string, dropPosition: 'before' | 'after'): number {
    // Extract the filename from the full path
    const filename = targetId.split('/').pop() || '';
    
    // Extract numerical prefix from the target filename
    const match = filename.match(/^(\d+)_/);
    const targetPrefix = match ? parseInt(match[1] || '0', 10) : 0;
    
    let position: number;
    if (dropPosition === 'before') {
      // Insert before the target item
      position = Math.max(1, targetPrefix - 1);
    } else {
      // Insert after the target item  
      position = targetPrefix + 1;
    }
    
    console.log('Position calculation:', {
      targetId,
      filename,
      targetPrefix,
      dropPosition,
      calculatedPosition: position
    });
    
    return position;
  }

  /**
   * Extract the source path from a tree node ID
   */
  static getSourcePath(nodeId: string): string {
    // Remove leading slash if present
    return nodeId.startsWith('/') ? nodeId.substring(1) : nodeId;
  }

  /**
   * Check if a node is a directory based on its properties
   */
  static isDirectory(node: any): boolean {
    return node.isDirectory === true;
  }
}
