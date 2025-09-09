import { TreeNode } from '../tree/types';

export interface DeleteResponse {
  message: string;
  commit_sha: string | null;
  path: string;
}

export class DeleteService {
  private static instance: DeleteService;

  public static getInstance(): DeleteService {
    if (!DeleteService.instance) {
      DeleteService.instance = new DeleteService();
    }
    return DeleteService.instance;
  }

  public async deleteItem(node: TreeNode): Promise<DeleteResponse> {
    const path = node.id.startsWith('/') ? node.id.substring(1) : node.id;
    const commitMessage = `Delete ${node.isDirectory ? 'directory' : 'file'}: ${node.name}`;
    
    const url = `/api/files/${encodeURIComponent(path)}?commit_message=${encodeURIComponent(commitMessage)}`;
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage: string;
      
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.detail || errorData.message || 'Failed to delete item';
      } catch {
        errorMessage = errorText || `HTTP ${response.status}: Failed to delete item`;
      }
      
      throw new Error(errorMessage);
    }

    return await response.json();
  }
}
