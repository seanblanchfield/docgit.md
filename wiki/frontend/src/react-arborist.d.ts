declare module 'react-arborist' {
  import type { CSSProperties, ElementType, FC, HTMLAttributes, ReactElement } from 'react';

  // This is a generic placeholder. You'd ideally define this based on your actual data structure.
  // For now, we'll keep it minimal to match the ArboristNode type in App.tsx
  export interface DefaultData {
    id: string;
    name: string;
    children?: DefaultData[];
    [key: string]: any;
  }

  export interface NodeApi<T = DefaultData> {
    id: string;
    data: T; // The raw data object for this node
    isLeaf: boolean;
    isInternal: boolean;
    isOpen: boolean;
    isSelected: boolean;
    isEditing: boolean;
    isDraggable: boolean;
    isDragging: boolean;
    isFocused: boolean;
    parent: NodeApi<T> | null;
    children: NodeApi<T>[] | null; // Children of this node
    level: number; // How deep is this node
    index: number; // The index of this node in its parent's children array
    // Methods
    select(): void;
    deselect(): void;
    focus(): void;
    toggle(): void;
    open(): void;
    close(): void;
    edit(): Promise<string | undefined>;
    // Add other properties/methods as needed from documentation
  }

  export interface TreeApi<T = DefaultData> {
    // Node Accessors
    get(id: string): NodeApi<T> | null;
    at(index: number): NodeApi<T> | null;
    visibleNodes: readonly NodeApi<T>[];
    // Focus Methods
    focus(id: string, opts?: { scroll?: boolean }): void;
    // Selection Methods
    select(id: string, opts?: { extend?: boolean }): void;
    deselect(id: string): void;
    selectAll(): void;
    deselectAll(): void;
    // Visibility
    open(id: string | readonly string[]): void;
    close(id: string | readonly string[]): void;
    toggle(id: string): void;
    // Add other properties/methods as needed from documentation
  }

  export interface NodeRendererProps<T = DefaultData> {
    style: CSSProperties; // Style object for positioning (includes indentation)
    node: NodeApi<T>;     // The node to render
    tree: TreeApi<T>;     // The tree API
    dragHandle?: (el: HTMLDivElement | null) => void; // Ref for the drag handle
    preview?: boolean;    // Is this a drag preview?
  }

  export interface TreeProps<T = DefaultData> {
    // Data
    initialData?: readonly T[];
    data?: readonly T[];
    // Accessors
    idAccessor?: keyof T | ((data: T) => string);
    childrenAccessor?: keyof T | ((data: T) => readonly T[] | null | undefined);
    // Dimensions
    width?: number | string;
    height?: number;
    rowHeight?: number;
    indent?: number;
    // Renderers
    children?: ElementType<NodeRendererProps<T>>; // Node Renderer
    // Behavior
    openByDefault?: boolean;
    // Event Handlers
    onActivate?: (node: NodeApi<T>) => void;
    onSelect?: (nodes: NodeApi<T>[]) => void;
    onToggle?: (id: string) => void;
    // Add other props as needed from documentation
    [key: string]: any; // Allow other props
  }

  export function Tree<T = DefaultData>(props: TreeProps<T>): ReactElement | null;
}
