import { TreeData } from './tree-types';

class TreeDataService {
  public async fetchTreeData(): Promise<TreeData[]> {
    try {
      const response = await fetch('/api/files/tree');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any[] = await response.json();
      return this.transformData(data);
    } catch (error) {
      console.error('Failed to fetch tree data:', error);
      return [];
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private transformData(data: any[]): TreeData[] {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return data.map((item: any) => ({
      id: item.path,
      text: item.name,
      type: item.type,
      children: item.children ? this.transformData(item.children) : [],
      data: {
        path: item.path,
        git_status: item.git_status,
      },
      state: {
        opened: item.type === 'directory' ? false : undefined,
      },
    }));
  }
}

export const treeDataService = new TreeDataService();
