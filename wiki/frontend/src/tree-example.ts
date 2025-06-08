import classNames from 'classnames';
import debounce from 'lodash/debounce';
import InfiniteTree  from 'infinite-tree';

import tag from 'html5-tag';

const data = [
    {
        id: '0',
        name: 'Local Drive (C:)',
        props: {
            drive: true
        },
        children: [
            {
                id: '0.0',
                name: 'Program Files',
                props: {
                    size: '',
                    type: 'File Folder',
                    dateModified: '14/07/2009 11:20:08'
                },
                children: [
                ]
            },
            {
                id: '0.1',
                name: 'Windows',
                props: {
                    size: '',
                    type: 'File Folder',
                    dateModified: '14/07/2009 11:20:08'
                },
                children: [
                ]
            },
            {
                id: '0.2',
                name: 'Temp',
                props: {
                    size: '',
                    type: 'File Folder',
                    dateModified: '01/10/2012 09:06:46'
                },
                children: [
                ]
            },
            {
                id: '0.3',
                name: 'Users',
                props: {
                    size: '',
                    type: 'File Folder',
                    dateModified: '14/07/2009 11:20:08'
                },
                children: [
                ]
            }
        ]
    },
    {
        id: '1',
        name: 'Local Drive (D:)',
        children: [
            {
                id: '1.1',
                name: 'system-startup.txt',
                props: {
                    size: 1722,
                    type: 'Text Document',
                    dateModified: '23/07/2015 10:19:11'
                }
            },
            {
                id: '1.2',
                name: 'system-shutdown.txt',
                props: {
                    size: 148,
                    type: 'Text Document',
                    dateModified: '15/10/2009 10:15:59'
                }
            }
        ]
    }
];

const renderer = (node, treeOptions) => {
    const { id, name, loadOnDemand = false, children, state, props = {} } = node;
    const { depth, open, path, total, loading = false, selected = false } = state;
    const childrenLength = Object.keys(children).length;
    const more = node.hasChildren();

    let togglerContent = '';
    if (!more && loadOnDemand) {
        togglerContent = tag('i', {
            'class': classNames('glyphicon', 'glyphicon-triangle-right')
        }, '');
    }
    if (more && open) {
        togglerContent = tag('i', {
            'class': classNames('glyphicon', 'glyphicon-triangle-bottom')
        }, '');
    }
    if (more && !open) {
        togglerContent = tag('i', {
            'class': classNames('glyphicon', 'glyphicon-triangle-right')
        }, '');
    }
    const toggler = tag('a', {
        'class': (() => {
            if (!more && loadOnDemand) {
                return classNames(treeOptions.togglerClass, 'infinite-tree-closed');
            }
            if (more && open) {
                return classNames(treeOptions.togglerClass);
            }
            if (more && !open) {
                return classNames(treeOptions.togglerClass, 'infinite-tree-closed');
            }
            return '';
        })()
    }, togglerContent);

    const icon = tag('i', {
        'class': classNames(
            'infinite-tree-folder-icon',
            'glyphicon',
            { 'glyphicon-folder-open': more && open },
            { 'glyphicon-folder-close': more && !open },
            { 'glyphicon-file': !more }
        )
    }, '');
    const title = tag('span', {
        'class': classNames('infinite-tree-title')
    }, name);
    const loadingIcon = tag('i', {
        'style': 'margin-left: 5px',
        'class': classNames(
            { 'hidden': !loading },
            'glyphicon',
            'glyphicon-refresh',
            { 'rotating': loading }
        )
    }, '');

    const columnName = tag('td', {
        'class': 'infinite-tree-node nowrap',
        'style': 'padding-left: ' + depth * 18 + 'px'
    }, toggler + icon + title + loadingIcon);
    const columnSize = tag('td', {
        'class': 'nowrap',
        'style': 'min-width: 50px',
        'width': '1%'
    }, typeof props.size !== undefined ? props.size : '');
    const columnType = tag('td', {
        'class': 'nowrap',
        'style': 'min-width: 50px',
        'width': '1%'
    }, typeof props.type !== undefined ? props.type : '');
    const columnDate = tag('td', {
        'class': 'nowrap',
        'style': 'min-width: 50px',
        'width': '1%'
    }, typeof props.dateModified !== undefined ? props.dateModified : '');

    return tag('tr', {
        'data-id': id,
        'data-expanded': more && open,
        'data-depth': depth,
        'data-path': path,
        'data-selected': selected,
        'data-children': childrenLength,
        'data-total': total,
        'class': classNames(
            'infinite-tree-item',
            { 'infinite-tree-selected': selected }
        )
    }, columnName + columnSize + columnType + columnDate);
};


// Makes header columns equal width to content columns
const fitHeaderColumns = () => {
    const row = document.querySelector('#filebrowser .infinite-tree-content tr.infinite-tree-item');
    if (!row) {
        console.error('Empty rows');
        return;
    }
    const headers = document.querySelectorAll('#filebrowser table.filebrowser-header > thead > tr > th');
    for (let c = row.firstChild, i = 0; c !== null && i < headers.length; c = c.nextSibling, ++i) {
        headers[i].style.width = c.clientWidth + 'px';
    }
};

// Keep header equal width to tbody
const setHeaderWidth = () => {
    const header = document.querySelector('#filebrowser table.filebrowser-header');
    const content = document.querySelector('#filebrowser .infinite-tree-content');
    header.style.width = content.clientWidth + 'px';
};

// Update header columns width on window resize
window.onresize = function() {
    debounce(fitHeaderColumns, 150);
};

const tree = new InfiniteTree(document.querySelector('#filebrowser [data-id="tree"]'), {
    autoOpen: true, // Defaults to false
    droppable: true, // Defaults to false
    layout: 'table', // Defaults to 'div'
    rowRenderer: renderer,
    selectable: true, // Defaults to true
    shouldSelectNode: (node) => { // Defaults to null
        if (!node || (node === tree.getSelectedNode())) {
            return false; // Prevent from deselecting the current node
        }
        return true;
    }
});

tree.on('click', (event) => {
    console.log('click', event);
});
tree.on('keyDown', (event) => {
    event.preventDefault();

    console.log('keyDown', event);
    const node = tree.getSelectedNode();
    const nodeIndex = tree.getSelectedIndex();

    if (event.keyCode === 37) { // Left
        tree.closeNode(node);
    } else if (event.keyCode === 38) { // Up
        const prevNode = tree.nodes[nodeIndex - 1] || node;
        tree.selectNode(prevNode);
    } else if (event.keyCode === 39) { // Right
        tree.openNode(node);
    } else if (event.keyCode === 40) { // Down
        const nextNode = tree.nodes[nodeIndex + 1] || node;
        tree.selectNode(nextNode);
    }
});
tree.on('keyUp', (event) => {
    console.log('keyUp', event);
});
tree.on('contentWillUpdate', () => {
    console.log('contentWillUpdate');
});
tree.on('contentDidUpdate', () => {
    console.log('contentDidUpdate');
    fitHeaderColumns();
    setHeaderWidth();
});
tree.on('openNode', (node) => {
    console.log('openNode', node);
});
tree.on('closeNode', (node) => {
    console.log('closeNode', node);
});
tree.on('selectNode', (node) => {
    console.log('selectNode', node);
});
tree.on('willOpenNode', (node) => {
    console.log('willOpenNode:', node);
});
tree.on('willCloseNode', (node) => {
    console.log('willCloseNode:', node);
});
tree.on('willSelectNode', (node) => {
    console.log('willSelectNode:', node);
});

tree.loadData(data);

// Select the first node
tree.selectNode(tree.getChildNodes()[0]);

const load = () => {
    fitHeaderColumns();
    setHeaderWidth();
};


export {
    load
}