export type EditorMode = 'read' | 'wysiwyg' | 'raw';

interface AppState {
  currentFilePath: string | null;
  currentFileGitHash: string | null;
  lockRefreshInterval: (() => void) | null;
  currentMarkdown: string;
  baselineMarkdown: string;
  isDirty: boolean;
  currentMode: EditorMode;
  dialog: {
    visible: boolean;
  };
  previousFilePath: string | null;
}

export const appState: AppState = {
  currentFilePath: null,
  currentFileGitHash: null,
  lockRefreshInterval: null,
  currentMarkdown: '# Welcome to Markdown Wiki\n\nSelect a file from the sidebar to edit.',
  baselineMarkdown: '',
  isDirty: false,
  currentMode: (localStorage.getItem('editorMode') as EditorMode) || 'read',
  dialog: {
    visible: false,
  },
  previousFilePath: null,
};

export function setCurrentFile(path: string | null, markdown: string, gitHash: string | null) {
  appState.currentFilePath = path;
  appState.currentMarkdown = markdown;
  appState.baselineMarkdown = markdown;
  appState.currentFileGitHash = gitHash;
  appState.isDirty = false;
}

export function setDirty(dirty: boolean) {
  appState.isDirty = dirty;
}

export function setMode(mode: EditorMode) {
  appState.currentMode = mode;
  localStorage.setItem('editorMode', mode);
}

export function getMode(): EditorMode {
  return appState.currentMode;
}
