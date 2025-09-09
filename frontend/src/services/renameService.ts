export interface RenameRequest {
  new_name: string;
  message?: string;
}

export interface RenameResponse {
  success: boolean;
  old_path: string;
  new_path: string;
  message: string;
  commit_sha?: string;
}

export class RenameService {
  private baseUrl: string;

  constructor(baseUrl: string = '/api') {
    this.baseUrl = baseUrl;
  }

  async renameItem(itemPath: string, newName: string, message?: string): Promise<RenameResponse> {
    const url = `${this.baseUrl}/rename/${encodeURIComponent(itemPath)}`;
    
    const requestBody: RenameRequest = {
      new_name: newName,
      message
    };

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Failed to rename item: ${response.statusText}`);
    }

    return await response.json();
  }
}

// Export singleton instance
export const renameService = new RenameService();
