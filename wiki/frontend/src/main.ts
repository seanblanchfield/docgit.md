import { Crepe } from '@milkdown/crepe';
import { editorViewCtx, parserCtx } from '@milkdown/core'; // Removed unused Editor import
import { Slice } from 'prosemirror-model';
import InfiniteTree, { TreeNodeData } from 'infinite-tree';
import './styles.css'; // Ensure CSS is imported and processed by Vite
// Ensure infinite-tree's default CSS is also loaded if it provides one for basic structure/toggling
// Typically, if the library has its own CSS, it's imported like this:
// import 'infinite-tree/dist/infinite-tree.css'; // Already present, good.
import 'infinite-tree/dist/infinite-tree.css';
import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/frame.css';
import './styles.css'; // Import the new stylesheet

interface ApiFileResponse {
  content: string;
}
interface TreeNodeData {
  id: string; // Path of the file/folder
  name: string; // Display name
  children?: TreeNodeData[]; // Optional children for folders
}

async function fetchFileContent(filePath: string): Promise<string> {
  try {
    const response = await fetch(`/api/files/${filePath}`);
    if (!response.ok) {
      console.error(`Error fetching file '${filePath}': ${response.status} ${response.statusText}`);
      // Return a fallback or throw an error, depending on desired UX
      return `# Error\n\nCould not load ${filePath}. Status: ${response.status}`;
    }
    const jsonData: ApiFileResponse = await response.json(); // Assuming same ApiFileResponse structure
    if (typeof jsonData.content === 'string') {
      return jsonData.content;
    } else {
      console.error(`Fetched data for '${filePath}' does not have a string "content" property:`, jsonData);
      return `# Error\n\nInvalid content format for ${filePath}.`;
    }
  } catch (error) {
    console.error(`Network or JSON parsing error fetching file '${filePath}':`, error);
    return `# Error\n\nCould not fetch ${filePath}.`;
  }
}

async function fetchDirectoryTreeData(): Promise<TreeNodeData[]> {
  try {
    const response = await fetch('/api/files/tree');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data as TreeNodeData[]; // Assuming backend sends data in TreeNodeData format
  } catch (error) {
    let errorDetailMessage = 'Unknown error during fetchDirectoryTreeData.';
    if (error instanceof Error) {
        errorDetailMessage = `Type: ${error.name}, Message: ${error.message}`;
    } else if (typeof error === 'string') {
        errorDetailMessage = error;
    } else {
        try {
            errorDetailMessage = JSON.stringify(error);
        } catch (e) {
            errorDetailMessage = String(error);
        }
    }
    // Log to console (even if not visible to user, good for other environments)

    console.error('--- FETCH_TREE_CATCH_BLOCK_ERROR --- Details:', error);
    // Embed error in the UI node
    return [{ id: 'error', name: `Failed to load tree: ${errorDetailMessage}` }];
  }
}

// const initialMarkdown = await fetchInitialMarkdown(); // Defaulting to "hello world" directly

// Initialize Milkdown editor
async function main() {


  const editor = await new Crepe({
    root: '#app',
    defaultValue: "hello world", // Set default content directly
  }).create();

  // Fetch directory tree data
  const dynamicTreeData = await fetchDirectoryTreeData();

  // Initialize InfiniteTree
  const tree = new InfiniteTree({
    el: document.querySelector('#tree-drawer'),
    data: dynamicTreeData,
    autoOpen: false,
    rowRenderer: (node: TreeNodeData) => {
      const isFolder = (node.children && node.children.length > 0) || !node.id.endsWith('.md');
      const depth = (node as any).state?.depth || 0;
      const indent = depth * 16; // 16px per level for better visual hierarchy
      const isSelected = window.location.hash === `#${encodeURIComponent(node.id)}`;
      
      // Get the open state from node.state if available
      const isOpen = (node as any).state?.open || false;
      
      // Create node wrapper with appropriate classes and data attributes
      let nodeHTML = `
        <div 
          class="infinite-tree-node ${isSelected ? 'selected' : ''} ${isFolder ? 'folder' : 'file'} ${isOpen ? 'infinite-tree-open' : ''}" 
          data-id="${node.id}" 
          data-depth="${depth}"
          style="padding-left: ${indent}px;"
        >
          <div class="infinite-tree-node-content">
      `;

      // Add toggler for folders
      if (isFolder) {
        nodeHTML += `
          <span class="infinite-tree-toggler" aria-label="Toggle folder">
            <span class="toggle-icon"></span>
          </span>
        `;
      } else {
        // Add spacer for files to align with folders
        nodeHTML += '<span class="infinite-tree-toggler" aria-hidden="true"></span>';
      }

      // Add node content
      if (isFolder) {
        nodeHTML += `
          <span class="section-title-custom" title="${node.name}">
            <span class="node-name">${node.name}</span>
          </span>
        `;
      } else {
        nodeHTML += `
          <span class="document-title-custom" title="${node.name}">
            <span class="node-name">${node.name}</span>
          </span>
        `;
      }

      // Close node content and wrapper
      nodeHTML += `
          </div>
        </div>
      `;

      return nodeHTML;
    }
  });



// Handle tree node selection
const handleNodeSelect = async (node: TreeNodeData) => {
  if (!node?.id) return;

  const isFile = node.id.endsWith('.md');
  
  // Update selected state in the UI
  document.querySelectorAll('.infinite-tree-node').forEach(el => {
    el.classList.remove('selected');
  });
  
  // Find and highlight the selected node
  const nodeElement = document.querySelector(`.infinite-tree-node[data-id="${node.id}"]`);
  if (nodeElement) {
    nodeElement.classList.add('selected');
  }
  
  if (isFile) {
    try {
      const markdownContent = await fetchFileContent(node.id);
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const parser = ctx.get(parserCtx);
        const doc = parser(markdownContent);
        if (!doc) return;
        
        view.dispatch(
          view.state.tr.replace(
            0,
            view.state.doc.content.size,
            new Slice(doc.content, 0, 0)
          )
        );
      });
      
      // Update URL to reflect the current file
      window.history.pushState(null, '', `#${encodeURIComponent(node.id)}`);
    } catch (error) {
      console.error(`Failed to load ${node.id}:`, error);
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const parser = ctx.get(parserCtx);
        const errorDoc = parser(`# Error loading ${node.id}\n\n${error}`);
        if (!errorDoc) return;
        
        view.dispatch(
          view.state.tr.replace(
            0,
            view.state.doc.content.size,
            new Slice(errorDoc.content, 0, 0)
          )
        );
      });
    }
  }
};

// Handle tree clicks
const treeDrawer = document.querySelector('#tree-drawer');
if (treeDrawer) {
  treeDrawer.addEventListener('click', (event: Event) => {
    const mouseEvent = event as MouseEvent;
    const target = mouseEvent.target as HTMLElement;
  
    // Find the closest node element
    const nodeElement = target.closest<HTMLElement>('.infinite-tree-node');
    if (!nodeElement) return;
    
    const nodeId = nodeElement.dataset.id;
    if (!nodeId) return;
    
    const nodeObject = tree.getNodeById(nodeId);
    if (!nodeObject) return;
    
    const isFolder = (nodeObject.children?.length ?? 0) > 0 || 
                   (nodeObject.id && !nodeObject.id.endsWith('.md'));
    
    // If it's a folder, toggle it when clicking anywhere on the node
    if (isFolder) {
      // Toggle the folder open/closed in the tree
      tree.toggleNode(nodeObject);
      
      // Also select the folder
      handleNodeSelect(nodeObject);
      return;
    }
    
    // For files, just handle the selection
    handleNodeSelect(nodeObject);
  });
}

// Handle programmatic node selection
tree.on('selectNode', async (node: TreeNodeData) => {
  if (node?.id) {
    await handleNodeSelect(node);
  }
});

} // Close the main async function

// Call the main function to start the application logic
main();
