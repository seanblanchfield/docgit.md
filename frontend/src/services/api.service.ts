export interface ApiFileResponse {
  content: string;
}

export interface CommitDetail {
  sha: string;
  author_name: string;
  author_email: string;
  date: string; // ISO format string
  message: string;
}

class ApiService {
  async fetchFileContent(filePath: string): Promise<string> {
    try {
      const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
      const response = await fetch(`/api/files/${encodedPath}`);
      if (!response.ok) {
        console.error(`Error fetching file '${filePath}': ${response.status} ${response.statusText}`);
        return `# Error\n\nCould not load ${filePath}. Status: ${response.status}`;
      }
      const jsonData: ApiFileResponse = await response.json();
      return jsonData.content || '';
    } catch (error) {
      console.error(`Error fetching file '${filePath}':`, error);
      return `# Error\n\nCould not fetch ${filePath}.`;
    }
  }

  async fetchLatestCommit(filePath: string): Promise<CommitDetail | null> {
    try {
      const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
      const response = await fetch(`/api/history/${encodedPath}?limit=1`);
      if (!response.ok) {
        console.warn(`Could not fetch commit history for '${filePath}': ${response.status} ${response.statusText}`);
        return null;
      }
      const commits: CommitDetail[] = await response.json();
      return commits.length > 0 ? commits[0]! : null;
    } catch (error) {
      console.warn(`Error fetching commit history for '${filePath}':`, error);
      return null;
    }
  }

  async fetchCommitHistory(filePath: string): Promise<CommitDetail[]> {
    try {
      const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
      const response = await fetch(`/api/history/${encodedPath}`);
      if (!response.ok) {
        console.warn(`Could not fetch commit history for '${filePath}': ${response.status} ${response.statusText}`);
        return [];
      }
      return await response.json();
    } catch (error) {
      console.warn(`Error fetching commit history for '${filePath}':`, error);
      return [];
    }
  }

  async fetchGitHashes(filePaths: string[]): Promise<Record<string, string | null>> {
    try {
      const response = await fetch('/api/git-hashes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(filePaths),
      });
      if (!response.ok) {
        console.warn(`Failed to fetch git hashes: ${response.statusText}`);
        return {};
      }
      return await response.json();
    } catch (error) {
      console.error(`Error fetching git hashes:`, error);
      return {};
    }
  }

  async getGitHash(): Promise<string | null> {
    try {
      const response = await fetch('/api/git/hash');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data.hash;
    } catch (error) {
      console.error('Failed to fetch git hash:', error);
      return null;
    }
  }

  async checkLockStatus(filePath: string): Promise<any> {
    const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
    const response = await fetch(`/api/lock/${encodedPath}`);
    if (response.status === 404) {
      return { locked: false };
    }
    if (!response.ok) {
      throw new Error(`Failed to check lock status for ${filePath}: ${response.statusText}`);
    }
    return response.json();
  }

  async acquireLock(filePath: string, owner: string): Promise<any> {
    const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
    const response = await fetch(`/api/lock/${encodedPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ owner }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw Object.assign(new Error(`Failed to acquire lock for ${filePath}`), { status: response.status, data: errorData });
    }
    return response.json();
  }

  async refreshLock(filePath: string, lockId: string): Promise<void> {
    const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
    const response = await fetch(`/api/lock/${encodedPath}/ping`, {
      method: 'PUT',
      headers: { 'X-Lock-ID': lockId },
    });
    if (!response.ok) {
      throw new Error(`Failed to refresh lock for ${filePath}: ${response.statusText}`);
    }
  }

  async releaseLock(filePath: string, lockId: string): Promise<void> {
    const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
    const response = await fetch(`/api/lock/${encodedPath}`, {
      method: 'DELETE',
      headers: { 'X-Lock-ID': lockId },
    });
    if (!response.ok && response.status !== 404) {
      throw new Error(`Failed to release lock for ${filePath}: ${response.statusText}`);
    }
  }

  async saveFile(filePath: string, content: string, message: string, lockId: string): Promise<{success: boolean, error?: any}> {
    try {
      const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
      const response = await fetch(`/api/files/${encodedPath}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Lock-ID': lockId || ''
        },
        body: JSON.stringify({ 
          content,
          message
        })
      });
      if (!response.ok) {
        const errorData = await response.json();
        return { success: false, error: errorData };
      }
      return { success: true };
    } catch (error) {
      console.error('Save error:', error);
      return { success: false, error };
    }
  }

  async createFile(filePath: string): Promise<{success: boolean, error?: any}> {
    try {
      const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
      const response = await fetch(`/api/files/${encodedPath}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: '' })
        });
      if (!response.ok) {
        const errorData = await response.json();
        return { success: false, error: errorData };
      }
      return { success: true };
    } catch (error) {
      console.error('Error creating file:', error);
      return { success: false, error };
    }
  }

  async createDirectory(directoryPath: string): Promise<{success: boolean, error?: any}> {
    try {
      const encodedPath = directoryPath.split('/').map(encodeURIComponent).join('/');
      const response = await fetch(`/api/directories/${encodedPath}`,
        {
          method: 'POST'
        });
      if (!response.ok) {
        const errorData = await response.json();
        return { success: false, error: errorData };
      }
      return { success: true };
    } catch (error) {
      console.error('Error creating directory:', error);
      return { success: false, error };
    }
  }

  async deleteFile(filePath: string): Promise<{success: boolean, error?: any}> {
    try {
      const response = await fetch(`/api/files/${encodeURIComponent(filePath)}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        const errorData = await response.json();
        return { success: false, error: errorData };
      }
      return { success: true };
    } catch (error) {
      console.error('Error deleting file:', error);
      return { success: false, error };
    }
  }

  async deleteDirectory(directoryPath: string): Promise<{success: boolean, error?: any}> {
    try {
      const encodedPath = directoryPath.split('/').map(encodeURIComponent).join('/');
      const response = await fetch(`/api/files/${encodedPath}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        const errorData = await response.json();
        return { success: false, error: errorData };
      }
      return { success: true };
    } catch (error) {
      console.error('Error deleting directory:', error);
      return { success: false, error };
    }
  }

  async fetchCommitDiff(filePath: string, commitSha: string): Promise<string | null> {
    try {
      const parentSha = `${commitSha}^1`;
      const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
      const response = await fetch(`/api/diff/${encodedPath}?sha1=${parentSha}&sha2=${commitSha}`);
      if (!response.ok) {
        console.error('Failed to fetch commit diff:', response.statusText);
        return null;
      }
      const diffData = await response.json();
      return diffData.diff_output || '';
    } catch (error) {
      console.error('Error fetching commit diff:', error);
      return null;
    }
  }
}

export const apiService = new ApiService();
