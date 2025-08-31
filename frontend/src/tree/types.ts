export interface TreeNode {
  id: string;
  name: string;
  isDirectory: boolean;
  children?: TreeNode[];
  isCreateItem?: boolean; // Flag for create items
  isEmpty?: boolean; // Flag for empty directories (used with create items)
  state?: {
    depth?: number;
    open?: boolean;
    selected?: boolean;
    loading?: boolean;
  };
  lockStatus?: {
    locked: boolean;
    ownedByMe: boolean;
    owner?: string;
    expiresAt?: string;
  };
}

export interface DirectoryTreeOptions {
  el: HTMLElement;
  onFileSelect: (node: TreeNode) => void;
  onCreateFile: (parentPath: string, name: string, isDirectory: boolean) => Promise<void>;
  onDeleteDirectory: (path: string) => Promise<void>;
  selectDefault?: boolean; // true by default
}
