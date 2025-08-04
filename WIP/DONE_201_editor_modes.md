# Editor Modes (View / WYSIWYG / Raw)

## Status: DONE

## Requirements
Implement three distinct editor modes to provide flexibility for different editing preferences and use cases.

## Features to Implement

### Mode Switching
- **View Mode**: Read-only display of rendered markdown
- **WYSIWYG Mode**: Rich text editing with Milkdown (current default)
- **Raw Mode**: Direct markdown source editing

### User Interface
- Mode toggle buttons in the editor toolbar
- Clear visual indication of current mode
- Smooth transitions between modes
- Preserve cursor position when switching modes where possible

### Technical Implementation
- Extend current Milkdown integration to support mode switching
- Add raw text editor component (likely CodeMirror or similar)
- Implement content synchronization between modes
- Handle auto-save across all modes

## Acceptance Criteria
- [ ] Three distinct editor modes available
- [ ] Smooth mode switching with preserved content
- [ ] Auto-save works in all modes
- [ ] Clear UI indication of current mode
- [ ] Keyboard shortcuts for mode switching
- [ ] Content validation when switching from raw mode

## Dependencies
- Current Milkdown editor implementation
- Lock management system
- Auto-save functionality

## Notes
This feature will significantly enhance the editing experience by catering to different user preferences and workflows.
