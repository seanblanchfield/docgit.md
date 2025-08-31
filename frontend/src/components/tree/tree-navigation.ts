import { stateService } from '../../services/state.service';
import { apiService } from '../../services/api.service';
import { lockService } from '../../services/lock.service';
import { draftService } from '../../services/draft.service';
import { dialogService } from '../../services/dialog.service';

export class TreeNavigation {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private tree: any, private editor: any) {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.tree.on('select_node.jstree', this.handleNodeSelection);
  }

    private handleNodeSelection = async (_e: Event, data: { node: any }): Promise<void> => {
    if (data.node.type === 'directory') {
      this.tree.toggle_node(data.node);
      return;
    }

    const filePath = data.node.data.path;
    await this.handleFileOpening(filePath);
  };

  public async handleFileOpening(filePath: string): Promise<void> {
    const { isDirty, currentFilePath } = stateService.getState();

    if (isDirty && currentFilePath) {
      const userChoice = await dialogService.confirm('You have unsaved changes. Do you want to save them before switching?', ['Save', 'Discard', 'Cancel']);
      
      if (userChoice === 'Cancel') {
        this.tree.deselect_node(filePath);
        this.tree.select_node(currentFilePath);
        return;
      }
      
      if (userChoice === 'Save') {
        const success = await this.editor.save();
        if (!success) {
          this.tree.deselect_node(filePath);
          this.tree.select_node(currentFilePath);
          return; // Do not proceed if save failed
        }
      }
    }
    
    await this.openFile(filePath);
  }

  public async openFile(filePath: string): Promise<void> {
    try {
      const draft = draftService.getDraftData(filePath);
      let content: string;
      let baseCommitHash: string | null = null;

      if (draft) {
        content = draft.content;
        baseCommitHash = draft.baseCommitHash || null;
        console.log(`[DEBUG] Loaded draft for ${filePath}`);
      } else {
        content = await apiService.fetchFileContent(filePath);
        console.log(`[DEBUG] Fetched file content for ${filePath}`);
      }

      const latestCommit = await apiService.fetchLatestCommit(filePath);
      const currentGitHash = latestCommit ? latestCommit.sha : null;

      if (draft && draft.baseCommitHash && draft.baseCommitHash !== currentGitHash) {
        console.log(`[DEBUG] Stale draft detected for ${filePath}. Base: ${draft.baseCommitHash}, Current: ${currentGitHash}`);
        const userChoice = await dialogService.confirm(
          'Your saved draft is based on an older version of the file. Do you want to keep your draft or load the latest version?', 
          ['Keep Draft', 'Load Latest']
        );
        if (userChoice === 'Load Latest') {
          content = await apiService.fetchFileContent(filePath);
          draftService.discardStaleDraft(filePath);
          stateService.setBaseCommitHash(currentGitHash);
        } else {
          stateService.setBaseCommitHash(draft.baseCommitHash);
        }
      } else {
        stateService.setBaseCommitHash(baseCommitHash || currentGitHash);
      }

      stateService.setCurrentFile(filePath, content, currentGitHash);

      const lockStatus = await lockService.checkLockStatus(filePath);
      if (lockStatus.locked) {
        const isOwned = await lockService.isOwnedByCurrentSession(filePath);
        if (isOwned) {
          stateService.setActiveLock(lockStatus.lock_info!);
        } else {
          dialogService.alert(`This file is locked by ${lockStatus.lock_info?.owner}. You can view it but not make changes.`);
        }
      }

    } catch (error) {
      console.error(`Error opening file ${filePath}:`, error);
      dialogService.alert(`Failed to open file: ${filePath}.`);
    }
  }
}
