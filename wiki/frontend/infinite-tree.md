# Infinite Tree Library Reference Documentation

## Overview

The `infinite-tree` library provides a performant, customizable tree component for displaying hierarchical data structures. This documentation covers setup, configuration, and implementation based on a file browser example.

## Table of Contents

1. [Installation & Setup](#installation--setup)
2. [Core Concepts](#core-concepts)
3. [Data Structure](#data-structure)
4. [Renderer Function](#renderer-function)
5. [Tree Configuration](#tree-configuration)
6. [Event Handling](#event-handling)
7. [Styling & Layout](#styling--layout)
8. [Implementation Plan](#implementation-plan)
9. [Testing Scenarios](#testing-scenarios)
10. [API Reference](#api-reference)

## Installation & Setup

### Required Dependencies

```bash
npm install infinite-tree classnames lodash html5-tag
```

### Basic HTML Structure

```html
<div id="filebrowser">
    <!-- Header table for column headers -->
    <table class="filebrowser-header">
        <thead>
            <tr>
                <th>Name</th>
                <th>Size</th>
                <th>Type</th>
                <th>Date Modified</th>
            </tr>
        </thead>
    </table>
    
    <!-- Tree container -->
    <div data-id="tree"></div>
</div>
```

### Required CSS Classes

```css
.infinite-tree-node {
    white-space: nowrap;
}

.nowrap {
    white-space: nowrap;
}

.infinite-tree-selected {
    background-color: #007bff;
    color: white;
}

.infinite-tree-closed {
    /* Styles for closed togglers */
}

.rotating {
    animation: spin 1s linear infinite;
}

@keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

.hidden {
    display: none;
}
```

## Core Concepts

### Node Structure
Each tree node contains:
- **id**: Unique identifier
- **name**: Display name
- **props**: Additional properties (size, type, date, etc.)
- **children**: Array of child nodes
- **state**: Runtime state (depth, open, selected, loading)

### Tree Operations
- **Open/Close**: Expand or collapse nodes with children
- **Selection**: Highlight and focus on specific nodes
- **Navigation**: Keyboard and mouse interaction
- **Dynamic Loading**: Load children on demand

## Data Structure

### Basic Node Format

```javascript
const nodeStructure = {
    id: 'unique-identifier',           // Required: Unique node ID
    name: 'Display Name',              // Required: Node display text
    props: {                           // Optional: Additional properties
        size: 1024,                    // File size in bytes
        type: 'File Folder',           // Type description
        dateModified: '14/07/2009 11:20:08',
        drive: true                    // Custom boolean flags
    },
    children: [                        // Optional: Child nodes array
        // ... nested node objects
    ]
};
```

### Example Tree Data

```javascript
const treeData = [
    {
        id: '0',
        name: 'Local Drive (C:)',
        props: { drive: true },
        children: [
            {
                id: '0.0',
                name: 'Program Files',
                props: {
                    size: '',
                    type: 'File Folder',
                    dateModified: '14/07/2009 11:20:08'
                },
                children: []
            }
        ]
    }
];
```

## Renderer Function

The renderer function defines how each tree node appears. It receives `(node, treeOptions)` and returns HTML.

### Key Renderer Components

#### 1. Toggler (Expand/Collapse Button)
```javascript
const createToggler = (node, state, treeOptions) => {
    const { open } = state;
    const more = node.hasChildren();
    
    let iconClass = '';
    if (more && open) {
        iconClass = 'glyphicon-triangle-bottom';
    } else if (more && !open) {
        iconClass = 'glyphicon-triangle-right';
    }
    
    return tag('a', {
        'class': classNames(treeOptions.togglerClass, {
            'infinite-tree-closed': !open
        })
    }, tag('i', { 'class': `glyphicon ${iconClass}` }, ''));
};
```

#### 2. Node Icon
```javascript
const createIcon = (node, state) => {
    const { open } = state;
    const more = node.hasChildren();
    
    return tag('i', {
        'class': classNames(
            'infinite-tree-folder-icon',
            'glyphicon',
            {
                'glyphicon-folder-open': more && open,
                'glyphicon-folder-close': more && !open,
                'glyphicon-file': !more
            }
        )
    }, '');
};
```

#### 3. Loading Indicator
```javascript
const createLoadingIcon = (loading) => {
    return tag('i', {
        'style': 'margin-left: 5px',
        'class': classNames(
            { 'hidden': !loading },
            'glyphicon',
            'glyphicon-refresh',
            { 'rotating': loading }
        )
    }, '');
};
```

### Complete Renderer Template

```javascript
const renderer = (node, treeOptions) => {
    const { id, name, state, props = {} } = node;
    const { depth, open, selected = false, loading = false } = state;
    
    // Create components
    const toggler = createToggler(node, state, treeOptions);
    const icon = createIcon(node, state);
    const title = tag('span', { 'class': 'infinite-tree-title' }, name);
    const loadingIcon = createLoadingIcon(loading);
    
    // Create columns
    const nameColumn = tag('td', {
        'class': 'infinite-tree-node nowrap',
        'style': `padding-left: ${depth * 18}px`
    }, toggler + icon + title + loadingIcon);
    
    const sizeColumn = tag('td', {
        'class': 'nowrap',
        'style': 'min-width: 50px; width: 1%'
    }, props.size || '');
    
    // Return complete row
    return tag('tr', {
        'data-id': id,
        'data-selected': selected,
        'class': classNames('infinite-tree-item', {
            'infinite-tree-selected': selected
        })
    }, nameColumn + sizeColumn /* + other columns */);
};
```

## Tree Configuration

### Basic Configuration Options

```javascript
const treeConfig = {
    autoOpen: true,              // Auto-expand nodes on load
    droppable: false,            // Enable drag-and-drop
    layout: 'table',             // Layout type: 'div' or 'table'
    rowRenderer: renderer,       // Custom renderer function
    selectable: true,            // Enable node selection
    shouldSelectNode: (node) => { // Selection validation
        return node && node !== tree.getSelectedNode();
    }
};
```

### Tree Initialization

```javascript
const tree = new InfiniteTree(
    document.querySelector('#tree-container'),
    treeConfig
);

// Load data
tree.loadData(treeData);

// Select first node
const firstNode = tree.getChildNodes()[0];
if (firstNode) {
    tree.selectNode(firstNode);
}
```

## Event Handling

### Core Events

```javascript
// Node interaction events
tree.on('click', (event) => {
    console.log('Node clicked:', event);
});

tree.on('selectNode', (node) => {
    console.log('Node selected:', node);
});

tree.on('openNode', (node) => {
    console.log('Node opened:', node);
});

tree.on('closeNode', (node) => {
    console.log('Node closed:', node);
});

// Lifecycle events
tree.on('contentWillUpdate', () => {
    console.log('Content will update');
});

tree.on('contentDidUpdate', () => {
    console.log('Content updated');
    // Perform layout adjustments
    adjustColumnWidths();
});
```

### Keyboard Navigation

```javascript
tree.on('keyDown', (event) => {
    event.preventDefault();
    
    const node = tree.getSelectedNode();
    const nodeIndex = tree.getSelectedIndex();
    
    switch (event.keyCode) {
        case 37: // Left Arrow
            tree.closeNode(node);
            break;
        case 38: // Up Arrow
            const prevNode = tree.nodes[nodeIndex - 1] || node;
            tree.selectNode(prevNode);
            break;
        case 39: // Right Arrow
            tree.openNode(node);
            break;
        case 40: // Down Arrow
            const nextNode = tree.nodes[nodeIndex + 1] || node;
            tree.selectNode(nextNode);
            break;
    }
});
```

## Styling & Layout

### Column Width Management

```javascript
// Synchronize header columns with content columns
const adjustColumnWidths = () => {
    const contentRow = document.querySelector('.infinite-tree-content tr.infinite-tree-item');
    const headers = document.querySelectorAll('.filebrowser-header th');
    
    if (!contentRow) return;
    
    let cell = contentRow.firstChild;
    for (let i = 0; i < headers.length && cell; i++) {
        headers[i].style.width = cell.clientWidth + 'px';
        cell = cell.nextSibling;
    }
};

// Adjust header table width to match content
const adjustHeaderWidth = () => {
    const header = document.querySelector('.filebrowser-header');
    const content = document.querySelector('.infinite-tree-content');
    header.style.width = content.clientWidth + 'px';
};

// Handle window resize
window.addEventListener('resize', debounce(() => {
    adjustColumnWidths();
    adjustHeaderWidth();
}, 150));
```

### Node State Styling

```css
/* Selected node highlighting */
.infinite-tree-selected {
    background-color: #007bff;
    color: white;
}

/* Indentation for tree hierarchy */
.infinite-tree-node {
    /* padding-left set dynamically based on depth */
    
}

/* Icon states */
.glyphicon-folder-open { color: #f39c12; }
.glyphicon-folder-close { color: #f39c12; }
.glyphicon-file { color: #3498db; }

/* Loading animation */
.rotating {
    animation: spin 1s linear infinite;
}
```

## Implementation Plan

### Phase 1: Basic Setup
1. Install dependencies (`infinite-tree`, `classnames`, `lodash`, `html5-tag`)
2. Create HTML structure with container and header table
3. Define basic CSS classes for styling
4. Set up tree data structure

### Phase 2: Renderer Implementation
1. Create basic renderer function
2. Implement toggler component with expand/collapse icons
3. Add node icons (folder/file) with open/closed states
4. Create table columns for node properties
5. Add loading indicator support

### Phase 3: Tree Configuration
1. Initialize InfiniteTree with configuration options
2. Set up data loading
3. Implement initial node selection
4. Configure layout and behavior options

### Phase 4: Event Handling
1. Add click event handlers for node interaction
2. Implement keyboard navigation (arrow keys)
3. Set up node state change events (open/close/select)
4. Add content update lifecycle events

### Phase 5: Layout & Styling
1. Implement column width synchronization
2. Add responsive behavior for window resizing
3. Style selected and hover states
4. Add animations and transitions

### Phase 6: Advanced Features
1. Add lazy loading for large datasets
2. Implement drag-and-drop functionality
3. Add context menus
4. Optimize performance for large trees

## Testing Scenarios

### Unit Tests (Jest/Mocha)

```javascript
describe('InfiniteTree', () => {
    let tree;
    let container;
    
    beforeEach(() => {
        container = document.createElement('div');
        tree = new InfiniteTree(container, { rowRenderer: renderer });
    });
    
    test('should initialize with empty tree', () => {
        expect(tree.getChildNodes()).toHaveLength(0);
    });
    
    test('should load data correctly', () => {
        tree.loadData(testData);
        expect(tree.getChildNodes()).toHaveLength(testData.length);
    });
    
    test('should select node', () => {
        tree.loadData(testData);
        const firstNode = tree.getChildNodes()[0];
        tree.selectNode(firstNode);
        expect(tree.getSelectedNode()).toBe(firstNode);
    });
    
    test('should open and close nodes', () => {
        tree.loadData(testData);
        const nodeWithChildren = tree.getChildNodes()[0];
        
        tree.openNode(nodeWithChildren);
        expect(tree.isNodeOpen(nodeWithChildren)).toBe(true);
        
        tree.closeNode(nodeWithChildren);
        expect(tree.isNodeOpen(nodeWithChildren)).toBe(false);
    });
});
```

### Integration Tests

```javascript
describe('Tree Interaction', () => {
    test('keyboard navigation works correctly', () => {
        // Test arrow key navigation
        // Verify node selection changes
        // Check open/close operations
    });
    
    test('column width adjustment works', () => {
        // Test responsive behavior
        // Verify header synchronization
    });
    
    test('renderer produces correct HTML', () => {
        // Test renderer output
        // Verify CSS classes
        // Check data attributes
    });
});
```

### User Story Tests

```javascript
// User Story: As a user, I want to navigate a file tree using keyboard
test('User can navigate tree with keyboard', () => {
    // Given: A tree with multiple nodes
    // When: User presses arrow keys
    // Then: Selection moves appropriately
});

// User Story: As a user, I want to see folder icons change when opened
test('Folder icons update on open/close', () => {
    // Given: A closed folder node
    // When: User opens the folder
    // Then: Icon changes from closed to open state
});
```

## API Reference

### Core Methods

```javascript
// Data management
tree.loadData(data)                    // Load tree data
tree.updateNode(node, data)            // Update node data

// Node operations
tree.openNode(node)                    // Expand node
tree.closeNode(node)                   // Collapse node
tree.selectNode(node)                  // Select node
tree.getSelectedNode()                 // Get current selection
tree.getSelectedIndex()                // Get selection index

// Navigation
tree.getChildNodes(node)               // Get child nodes
tree.getParentNode(node)               // Get parent node
tree.getNodeById(id)                   // Find node by ID

// State queries
tree.isNodeOpen(node)                  // Check if node is open
tree.isNodeSelected(node)              // Check if node is selected
tree.hasChildren(node)                 // Check if node has children

// Rendering
tree.refresh()                         // Force re-render
tree.scrollToNode(node)                // Scroll to node
```

### Event Types

- `click` - Node clicked
- `selectNode` - Node selected
- `openNode` - Node opened
- `closeNode` - Node closed
- `keyDown` - Key pressed
- `keyUp` - Key released
- `contentWillUpdate` - Before content update
- `contentDidUpdate` - After content update
- `willOpenNode` - Before node opens
- `willCloseNode` - Before node closes
- `willSelectNode` - Before node selection

### Configuration Options

```javascript
{
    autoOpen: boolean,           // Auto-expand on load
    droppable: boolean,          // Enable drag-drop
    layout: 'div' | 'table',     // Layout mode
    rowRenderer: function,       // Custom renderer
    selectable: boolean,         // Enable selection
    shouldSelectNode: function   // Selection validator
}
```

This documentation provides a complete reference for implementing the infinite-tree library in any project, with detailed examples, testing strategies, and best practices.