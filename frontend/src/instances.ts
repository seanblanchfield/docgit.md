import { ContentEditor } from './components/editor';
import { DirectoryTree } from './tree';

// This module holds shared instances of components that need to be accessed across different modules.

export let contentEditor: ContentEditor;
export let directoryTree: DirectoryTree;

export function setContentEditor(instance: ContentEditor) {
  contentEditor = instance;
}

export function setDirectoryTree(instance: DirectoryTree) {
  directoryTree = instance;
}
