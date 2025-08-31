import { TreeNode } from './types';
import { humanizeFileName } from '../utils/humanize';

export function filterHiddenFiles(nodes: any[]): any[] {
  return nodes
    .filter(node => {
      // Hide .gitkeep files
      if (node.name === '.gitkeep') {
        return false;
      }
      return true;
    })
    .map((n: any) => ({
      ...n,
      children: n.children ? filterHiddenFiles(n.children) : n.children,
    }));
}

export function sortNodes(nodes: any[]): any[] {
  return nodes
    .sort((a: any, b: any) => (a.rawName || a.name).localeCompare(b.rawName || b.name, undefined, { sensitivity: 'base' }))
    .map((n: any) => ({
      ...n,
      children: n.children ? sortNodes(n.children) : n.children,
    }));
}

export async function fetchDirectoryTreeData(path?: string): Promise<TreeNode[]> {
  try {
    const url = path ? `/api/files/tree?path=${encodeURIComponent(path)}` : '/api/files/tree';
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error loading directory tree:', error);
    return [{ 
      id: 'error', 
      name: 'Failed to load directory',
      isDirectory: false
    }];
  }
}

export const addIsDirectory = (node: any): any => {
  const isDirectory = Array.isArray(node.children) && node.children.length > 0;
  const rawName = node.name ?? '';
  const displayName = humanizeFileName(rawName);
  return {
    ...node,
    name: displayName,
    rawName,
    isDirectory,
    children: Array.isArray(node.children)
      ? node.children.map(addIsDirectory)
      : node.children,
  };
}

// Determine default landing file based on rules
export function findDefaultFile(nodes: any[]): string | undefined {
  const clean = (s: string) => s.replace(/^\d+[_]*/, '').toLowerCase();
  // 1. root index/start/home
  const preferred = ['index', 'start', 'home'];
  for (const name of preferred) {
    const match = nodes.find((n) => !n.isDirectory && clean(n.rawName || n.name).startsWith(name));
    if (match) return match.id;
  }
  // 3. first other file in root
  const firstFile = nodes.find((n) => !n.isDirectory);
  if (firstFile) return firstFile.id;
  // 4. first file of first directory that contains files (depth-first)
  for (const dir of nodes.filter((n) => n.isDirectory)) {
    const childFile = findDefaultFile(dir.children || []);
    if (childFile) return childFile;
  }
  return undefined;
}
