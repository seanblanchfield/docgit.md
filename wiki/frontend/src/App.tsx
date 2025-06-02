import { useState, useEffect, useCallback } from 'react';
import { Tree } from 'react-arborist';
import type { NodeApi } from 'react-arborist';
import type { CSSProperties } from 'react';
import './App.css';

// Type for items coming from the backend API
interface FileListItem {
  name: string; // Basename of the file or folder
  path: string; // Full path relative to repo root
  type: 'file' | 'folder';
}

// Type for nodes used by react-arborist
interface ArboristNode {
  id: string; // Unique ID for the node (e.g., full path)
  name: string; // Display name for the node
  children?: ArboristNode[]; // Children nodes for folders
  data: FileListItem; // Original data item from the API
}

// Transforms the flat list from API into a tree structure for react-arborist
function fileListToTree(fileList: FileListItem[]): ArboristNode[] {
  const nodes: Record<string, ArboristNode> = {};
  const tree: ArboristNode[] = [];

  // First pass: create all nodes and map them by path
  fileList.forEach(item => {
    nodes[item.path] = {
      id: item.path,
      name: item.name,
      data: item,
      children: item.type === 'folder' ? [] : undefined,
    };
  });

  // Second pass: link nodes to their parents to form the tree
  fileList.forEach(item => {
    const node = nodes[item.path];
    const parentPath = item.path.includes('/') ? item.path.substring(0, item.path.lastIndexOf('/')) : null;

    if (parentPath && nodes[parentPath] && nodes[parentPath].children) {
      nodes[parentPath].children!.push(node);
    } else if (!parentPath) {
      // This is a root-level node
      tree.push(node);
    }
    // Note: If parentPath exists but nodes[parentPath] doesn't, it implies an API inconsistency
    // or a file path for which the parent folder was not listed.
    // The current backend API should list all parent folders.
  });

  // Helper to recursively sort children by name (folders first, then files, then alphabetically)
  const sortChildrenRecursive = (nodesToSort: ArboristNode[]) => {
    nodesToSort.sort((a, b) => {
      // Sort folders before files
      if (a.data.type === 'folder' && b.data.type === 'file') return -1;
      if (a.data.type === 'file' && b.data.type === 'folder') return 1;
      // Then sort alphabetically by name
      return a.name.localeCompare(b.name);
    });
    nodesToSort.forEach(node => {
      if (node.children) {
        sortChildrenRecursive(node.children);
      }
    });
  };

  sortChildrenRecursive(tree); // Sort the root level
  return tree;
}

// Custom Node Renderer for react-arborist
const Node: React.FC<{ node: NodeApi<ArboristNode>; style: CSSProperties; dragHandle?: (el: HTMLDivElement | null) => void; }> = ({ node, style, dragHandle }) => {
  // node.data here is the ArboristNode object itself
  // node.data.data is the original FileListItem
  return (
    <div style={style} ref={dragHandle} className={`node ${node.isSelected ? 'selected' : ''}`}>
      <span className="node-icon">
        {node.data.data.type === 'folder' ? '📁' : '📄'}
      </span>
      <span className="node-text">{node.data.name}</span>
    </div>
  );
}

function App() {
  const [treeData, setTreeData] = useState<ArboristNode[]>([]);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [selectedFileContent, setSelectedFileContent] = useState<string | null>(null);
  const [isContentLoading, setIsContentLoading] = useState<boolean>(false);
  const [contentError, setContentError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchFilesAndBuildTree = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/files');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const apiData: FileListItem[] = await response.json();
        const newTreeData = fileListToTree(apiData);
        setTreeData(newTreeData);
        setError(null);
      } catch (e) {
        if (e instanceof Error) {
          setError(e.message);
        } else {
          setError('An unknown error occurred');
        }
        console.error("Failed to fetch files:", e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFilesAndBuildTree();
  }, []);

  const handleNodeActivate = useCallback(async (node: NodeApi<ArboristNode>) => {
    if (node.data.data.type === 'file' && node.data.data.name.endsWith('.md')) {
      setSelectedFilePath(node.data.data.path);
      setSelectedFileContent(null);
      setIsContentLoading(true);
      setContentError(null);
      try {
        const response = await fetch(`/api/files/${encodeURIComponent(node.data.data.path)}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }
        const data = await response.json(); // Expects { path: string, content: string }
        setSelectedFileContent(data.content);
      } catch (error) {
        console.error('Failed to fetch file content:', error);
        setContentError(error instanceof Error ? error.message : 'Failed to load file content.');
      } finally {
        setIsContentLoading(false);
      }
    } else {
      // Clear selection if not a markdown file or a folder is activated
      setSelectedFilePath(node.data.data.type === 'file' ? node.data.data.path : null); // Keep path if it's another file type
      setSelectedFileContent(null); 
      setContentError(node.data.data.type === 'file' ? 'Selected file is not a Markdown file.' : null);
    }
  }, []);

  if (isLoading) {
    return <div className="status-message">Loading files...</div>;
  }

  if (error) return <div className="error-message">Error loading file tree: {error}</div>;

  return (
    <div className="app-container">
      <div className="tree-pane">
        {isLoading && <div className="status-message">Loading tree...</div>}
        {!isLoading && error && <div className="error-message">Error loading file tree: {error}</div>}
        {!isLoading && !error && treeData.length === 0 && (
          <div className="status-message">No files found in the repository.</div>
        )}
        {!isLoading && !error && treeData.length > 0 && (
          <div className="tree-wrapper">
            <Tree<ArboristNode>
              initialData={treeData}
              openByDefault={false}
              width="100%"
              height={500} // Fixed height as required by react-arborist
              indent={24}
              rowHeight={28}
              onActivate={handleNodeActivate}
            >
              {Node}
            </Tree>
          </div>
        )}
      </div>
      <div className="content-pane">
        {isContentLoading && <div className="status-message">Loading content...</div>}
        {contentError && <div className="error-message">{contentError}</div>}
        {!isContentLoading && !contentError && selectedFileContent !== null && (
          <pre>{selectedFileContent}</pre>
        )}
        {!isContentLoading && !contentError && selectedFileContent === null && selectedFilePath && !selectedFilePath.endsWith('.md') && (
            <div className="status-message">Selected file is not a Markdown file. Please select a .md file to view content.</div>
        )}
        {!isContentLoading && !contentError && selectedFileContent === null && !selectedFilePath && (
          <div className="status-message">Select a Markdown file from the tree to view its content.</div>
        )}
      </div>
    </div>
  );
}

export default App;
