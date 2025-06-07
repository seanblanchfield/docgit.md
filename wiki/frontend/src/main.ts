import { Crepe } from '@milkdown/crepe';
import { editorViewCtx, parserCtx } from '@milkdown/core'; // Removed unused Editor import
import { Slice } from 'prosemirror-model';
import InfiniteTree from 'infinite-tree';
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
    console.error('Failed to fetch directory tree data:', error);
    // Return an empty array or some default structure in case of error
    return [{ id: 'error', name: 'Error loading tree. Check console.' }];
  }
}

// const initialMarkdown = await fetchInitialMarkdown(); // Defaulting to "hello world" directly

const editor = await new Crepe({
  root: '#app',
  defaultValue: "hello world", // Set default content directly
}).create();

console.log('Milkdown editor instance created:', editor);

// Initialize Milkdown editor
async function main() {
  // Fetch directory tree data
  const dynamicTreeData = await fetchDirectoryTreeData();

  // Initialize InfiniteTree
  const tree = new InfiniteTree({
    el: document.querySelector('#tree-drawer'),
    data: dynamicTreeData, // Use the fetched data
    autoOpen: true, // Automatically open nodes with children
    rowRenderer: (node: TreeNodeData) => { // Use TreeNodeData type for node
      // You can customize how each node is rendered
      // For example, adding icons for files/folders
      // Determine if it's a folder by checking for a children array or a conventional indicator
      // (e.g., if your backend adds a 'type' field, you could use node.type === 'folder')
      // For now, we rely on the presence of a `children` array or if the ID doesn't end with .md
      const isFolder = (node.children && node.children.length > 0) || !node.id.endsWith('.md');
      const icon = isFolder ? '📁' : '📄';
      return `<div class="infinite-tree-item" data-id="${node.id}">${icon} ${node.name}</div>`;
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
} // Close the main async function

// Call the main function to start the application logic
main();
