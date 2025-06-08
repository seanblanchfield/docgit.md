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
    console.log('--- FETCH_TREE_CATCH_BLOCK_LOG --- (Attempting UI hack for error)'); 
    console.error('--- FETCH_TREE_CATCH_BLOCK_ERROR --- Details:', error);
    // Embed error in the UI node
    return [{ id: 'error', name: `Failed to load tree: ${errorDetailMessage}` }];
  }
}

// const initialMarkdown = await fetchInitialMarkdown(); // Defaulting to "hello world" directly

// Initialize Milkdown editor
async function main() {
  console.log('Entering main function...');

  const editor = await new Crepe({
    root: '#app',
    defaultValue: "hello world", // Set default content directly
  }).create();
  console.log('Milkdown editor instance created:', editor);
  // Fetch directory tree data
  const dynamicTreeData = await fetchDirectoryTreeData();

  // Initialize InfiniteTree
  const tree = new InfiniteTree({
    el: document.querySelector('#tree-drawer'),
    data: dynamicTreeData, // Use the fetched data
    autoOpen: false, // Sections collapsed by default
    rowRenderer: (node: TreeNodeData) => {
      const isFolder = (node.children && node.children.length > 0) || !node.id.endsWith('.md');
      console.log(`rowRenderer: Node ID: ${node.id}, Name: ${node.name}, IsFolder: ${isFolder}`);
      
      let innerHTML = '';
      if (isFolder) {
        // Use 'infinite-tree-toggler' class for the toggle element
        innerHTML = `<span class="infinite-tree-toggler">&nbsp;</span><span class="section-title-custom">${node.name}</span>`;
      } else {
        innerHTML = `<span class="document-title-custom">${node.name}</span>`;
      }
      
      // Wrap the content in a div that includes the data-id and a class for identification.
      // We'll use 'infinite-tree-node' as this is what the click handler looks for.
      // Add inline style for indentation based on node depth.
      // The 'node' object in rowRenderer has 'state.depth'. Using 'as any' for quick access if type is incomplete.
      const depth = (node as any).state?.depth || 0; // Default to 0 if state or depth is undefined
      const indentationPx = depth * 20; // 20px per depth level
      const nodeWrapperHTML = `<div class="infinite-tree-node" data-id="${node.id}" style="padding-left: ${indentationPx}px;">${innerHTML}</div>`;
      
      if (isFolder) {
        console.log(`rowRenderer for FOLDER ${node.name}: Node Wrapper HTML: ${nodeWrapperHTML}`);
      } else {
        console.log(`rowRenderer for FILE ${node.name}: Node Wrapper HTML: ${nodeWrapperHTML}`);
      }
      return nodeWrapperHTML;
    }
  });

console.log('InfiniteTree instance:', tree);

tree.on('selectNode', async (node: TreeNodeData) => {
  console.log('Selected node:', node.id, node.name, node.children ? node.children.length : 0);
  // Check if the selected node is a file (e.g., ends with .md)
  if (node.id && node.id.endsWith('.md')) {
    const filePath = node.id; // Assuming id is the path or unique identifier
    console.log(`File selected: ${node.name} (id: ${filePath}). Attempting to load this file.`);
    try {
      const markdownContent = await fetchFileContent(filePath);
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const parser = ctx.get(parserCtx);
        const doc = parser(markdownContent);
        if (!doc) return;
        const state = view.state;
        view.dispatch(
          state.tr.replace(
            0,
            state.doc.content.size,
            new Slice(doc.content, 0, 0)
          )
        );
      });
      console.log(`Successfully loaded ${filePath} into the editor.`);
    } catch (error) {
      console.error(`Failed to load ${filePath}:`, error);
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const parser = ctx.get(parserCtx);
        const errorDoc = parser(`# Error loading ${filePath}\n\n${error}`);
        if (!errorDoc) return;
        const state = view.state;
        view.dispatch(
          state.tr.replace(
            0,
            state.doc.content.size,
            new Slice(errorDoc.content, 0, 0)
          )
        );
      });
    }
  } else {
    console.log(`Folder selected: ${node.name} (id: ${node.id})`);
  }
  });

  tree.on('click', (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    console.log('Tree click event. Target:', target);

    let nodeElementToToggle: HTMLElement | null = null;

    // Find the .infinite-tree-node that was clicked (our rowRenderer wraps each item in this)
    const clickedNodeWrapper = target.closest('.infinite-tree-node') as HTMLElement | null;

    if (clickedNodeWrapper) {
      // Check if the click was specifically on the toggler icon or the section title within this node wrapper
      const isClickOnToggler = target.closest('.infinite-tree-toggler');
      const isClickOnSectionTitle = target.closest('.section-title-custom');

      if (isClickOnToggler) {
        console.log('Click was on/inside an .infinite-tree-toggler.');
        nodeElementToToggle = clickedNodeWrapper;
      } else if (isClickOnSectionTitle) {
        console.log('Click was on/inside a .section-title-custom.');
        nodeElementToToggle = clickedNodeWrapper;
      } else {
        console.log('Click was inside an .infinite-tree-node but not on a designated toggle target (toggler or title).');
      }
    } else {
      console.log('Click was not inside any .infinite-tree-node element.');
    }

    // If we identified a nodeElement that should be toggled
    if (nodeElementToToggle) {
      const nodeId = nodeElementToToggle.getAttribute('data-id');
      console.log('Target .infinite-tree-node for toggle. Node ID:', nodeId);
      if (nodeId) {
        const nodeObject = tree.getNodeById(nodeId);
        if (nodeObject) {
          // Check if it's a folder before toggling
          const isFolder = (nodeObject.children && nodeObject.children.length > 0) || (nodeObject.id && !nodeObject.id.endsWith('.md'));
          if (isFolder) {
            console.log('Node object is a folder:', nodeObject, 'Attempting to toggle.');
            tree.toggleNode(nodeObject);
            // Log state after toggle for debugging CSS and attributes
            setTimeout(() => {
              const actualTogglerSpan = nodeElementToToggle?.querySelector('.infinite-tree-toggler');
              if (actualTogglerSpan) {
                  console.log('Toggler classList after toggle:', actualTogglerSpan.classList);
              }
              console.log('Node element data-open after toggle:', nodeElementToToggle?.getAttribute('data-open'));
            }, 0);
          } else {
            console.log('Clicked on title of a file node, not toggling. Node:', nodeObject);
            // If you want clicking a file title to also select it (like tree.on('selectNode')):
            // if (nodeObject.id.endsWith('.md')) { tree.selectNode(nodeObject); }
          }
        } else {
          console.error('Could not find node with ID in tree data structure:', nodeId);
        }
      } else {
        console.error('.infinite-tree-node element is missing data-id attribute (should not happen with current rowRenderer).');
      }
    } else {
      // console.log('No .infinite-tree-node identified for toggling based on this click event.'); // Covered by earlier logs
    }
  });

  console.log('Attempting to create Milkdown editor instance...');

} // Close the main async function

// Call the main function to start the application logic
main();
