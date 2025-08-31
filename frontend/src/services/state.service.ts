import { LockInfo } from './lock.service';
import { ContentEditor } from '../components/editor';
import { DirectoryTree } from '../components/tree/directory-tree';

export interface AppState {
  currentFilePath: string | null;
  isDirty: boolean;
  activeLock: LockInfo | null;
  editorContent: string | null;
  currentGitHash: string | null;
  baseCommitHash: string | null;
  editor: ContentEditor | null;
  directoryTree: DirectoryTree | null;
}

type StateListener = (state: AppState) => void;

class StateService {
  private state: AppState = {
    currentFilePath: null,
    isDirty: false,
    activeLock: null,
    editorContent: null,
    currentGitHash: null,
    baseCommitHash: null,
    editor: null,
    directoryTree: null,
  };

  private listeners: Set<StateListener> = new Set();

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.state); // Immediately notify with current state
    return () => this.listeners.delete(listener); // Return an unsubscribe function
  }

  private notify() {
    const readonlyState = { ...this.state };
    this.listeners.forEach(listener => listener(readonlyState));
  }

  setState(newState: Partial<AppState>) {
    this.state = { ...this.state, ...newState };
    this.notify();
  }

  getState(): Readonly<AppState> {
    return this.state;
  }

  setEditor(editor: ContentEditor) {
    this.setState({ editor });
  }

  setDirectoryTree(directoryTree: DirectoryTree) {
    this.setState({ directoryTree });
  }

  setCurrentFile(path: string | null, content: string | null, gitHash: string | null) {
    this.setState({
      currentFilePath: path,
      editorContent: content,
      currentGitHash: gitHash,
      baseCommitHash: gitHash, // Initially, base and current are the same
      isDirty: false,
      activeLock: null,
    });
  }

  updateCurrentMarkdown(content: string) {
    if (this.state.editorContent !== content) {
      this.setState({ editorContent: content, isDirty: true });
    }
  }

  setActiveLock(lock: LockInfo | null) {
    this.setState({ activeLock: lock });
  }

  setBaseCommitHash(hash: string | null) {
    this.setState({ baseCommitHash: hash });
  }
  
  saved() {
    this.setState({ isDirty: false, baseCommitHash: this.state.currentGitHash });
  }
}

export const stateService = new StateService();
