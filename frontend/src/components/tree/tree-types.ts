export interface TreeData {
    id: string;
    text: string;
    type: 'file' | 'directory';
    children?: TreeData[];
    state?: TreeNodeState;
    data?: {
      path: string;
      git_status?: 'untracked' | 'modified' | 'added' | 'deleted' | 'renamed' | 'copied';
    };
  }
  
  export interface TreeNodeState {
    opened?: boolean;
    selected?: boolean;
    disabled?: boolean;
    loading?: boolean;
  }