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

  async fetchGitHash(filePath: string): Promise<string | null> {
    if (!filePath) return null;

    try {
      const response = await fetch('/api/git-hashes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([filePath]),
      });

      if (!response.ok) {
        console.warn(`Failed to fetch git hash for ${filePath}: ${response.statusText}`);
        return null;
      }

      const gitHashes: Record<string, string | null> = await response.json();
      return gitHashes[filePath] || null;

    } catch (error) {
      console.error(`Error fetching git hash for ${filePath}:`, error);
      return null;
    }
  }

  async saveFile(filePath: string, content: string, lockId: string, message: string): Promise<{ success: boolean; error?: string; conflict?: any }> {
    try {
      const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
      const response = await fetch(`/api/files/${encodedPath}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Lock-ID': lockId,
        },
        body: JSON.stringify({ content, message }),
      });

      if (!response.ok) {
        if (response.status === 423) { // Lock conflict
          const errorData = await response.json();
          return { success: false, conflict: errorData };
        }
        const errorText = await response.text();
        return { success: false, error: `Save failed: ${errorText}` };
      }

      return { success: true };
    } catch (error) {
      console.error('Save error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' };
    }
  }

  async deleteDirectory(path: string): Promise<void> {
    const response = await fetch(`/api/directory?path=${encodeURIComponent(path)}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.detail || errorMessage;
      } catch (e) {
        // Not a JSON response, use the raw text
      }
      throw new Error(errorMessage || `Failed to delete directory: ${response.statusText}`);
    }
  }

  async createDirectory(path: string): Promise<void> {
    const response = await fetch('/api/directory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.detail || errorMessage;
      } catch (e) {
        // Not a JSON response, use the raw text
      }
      throw new Error(errorMessage || `Failed to create directory: ${response.statusText}`);
    }
  }
}

export const apiService = new ApiService();
