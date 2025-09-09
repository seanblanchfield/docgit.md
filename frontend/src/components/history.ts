import { apiService } from '../services/apiService';
import { appState } from '../state/appState';
import { CommitDetail } from '../services/apiService';
import { humanizeTime } from '../utils/humanize';

let historyDrawer: HTMLElement | null;
let historyList: HTMLElement | null;
let diffView: HTMLElement | null;
let diffTitle: HTMLElement | null;
let diffContent: HTMLElement | null;

function renderCommitHistory(commits: CommitDetail[]) {
  if (!historyList) return;

  if (commits.length === 0) {
    historyList.innerHTML = '<div class="history-empty">No commit history available</div>';
    return;
  }

  const historyHTML = commits.map(commit => {
    const relativeTime = humanizeTime(commit.date);
    const shortSha = (commit.sha || '').substring(0, 7);

    return `
      <div class="history-item" data-sha="${commit.sha}">
        <div class="commit-info">
          <div class="commit-meta">
            <span class="commit-author">${commit.author_name}</span>
            <span class="commit-time">${relativeTime}</span>
            <span class="commit-sha">${shortSha}</span>
          </div>
          <div class="commit-message">${commit.message}</div>
        </div>
      </div>
    `;
  }).join('');

  historyList.innerHTML = historyHTML;

  historyList.querySelectorAll('.history-item').forEach(item => {
    item.addEventListener('click', () => {
      const sha = item.getAttribute('data-sha');
      if (sha && appState.currentFilePath) {
        openCommitDiff(appState.currentFilePath, sha);
      }
    });
  });
}

async function loadHistoryForFile(filePath: string) {
  if (!historyList) return;
  historyList.innerHTML = '<div class="history-loading">Loading commit history...</div>';
  const commits = await apiService.fetchCommitHistory(filePath);
  renderCommitHistory(commits);
}

function renderDiffContent(diffOutput: string) {
  if (!diffContent) return;
  
  if (!diffOutput || diffOutput.trim() === '') {
    diffContent.innerHTML = '<div class="diff-empty">No changes in this commit</div>';
    return;
  }
  
  const lines = diffOutput.split('\n');
  const diffHTML = lines.map(line => {
    let className = 'diff-line context';
    let content = line;
    
    if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('@@')) {
      className = 'diff-line header';
    } else if (line.startsWith('+')) {
      className = 'diff-line added';
      content = line.substring(1);
    } else if (line.startsWith('-')) {
      className = 'diff-line removed';
      content = line.substring(1);
    }
    
    return `<div class="${className}">${content}</div>`;
  }).join('');
  
  diffContent.innerHTML = diffHTML;
}

async function loadDiffContent(filePath: string, commitSha: string) {
  if (!diffContent) return;
  diffContent.innerHTML = '<div class="diff-loading">Loading diff...</div>';
  const diffOutput = await apiService.fetchCommitDiff(filePath, commitSha);
  if (diffOutput !== null) {
    renderDiffContent(diffOutput);
  } else {
    diffContent.innerHTML = '<div class="diff-empty">Failed to load diff</div>';
  }
}

function showDiffView(filePath: string, commitSha: string, commitMessage: string) {
  if (!diffView || !diffTitle || !historyList) return;
  
  const shortSha = (commitSha || '').substring(0, 7);
  if (diffTitle) {
    diffTitle.textContent = `${shortSha}: ${commitMessage}`;
  }
  
  if (historyList) historyList.classList.add('hidden');
  if (diffView) diffView.classList.remove('hidden');
  
  loadDiffContent(filePath, commitSha);
}

function hideDiffView() {
  if (!diffView || !historyList) return;
  diffView.classList.add('hidden');
  historyList.classList.remove('hidden');
}

function openCommitDiff(filePath: string, commitSha: string) {
  let commitMessage = 'Commit Details';
  document.querySelectorAll('.history-item').forEach(item => {
    if (item.getAttribute('data-sha') === commitSha) {
      const messageEl = item.querySelector('.commit-message');
      if (messageEl) {
        commitMessage = messageEl.textContent || 'Commit Details';
      }
    }
  });
  showDiffView(filePath, commitSha, commitMessage);
}

export function setupHistory() {
  historyDrawer = document.querySelector('[data-id="history-drawer"]');
  historyList = document.querySelector('[data-id="history-list"]');
  diffView = document.querySelector('[data-id="diff-view"]');
  diffTitle = document.querySelector('[data-id="diff-title"]');
  diffContent = document.querySelector('[data-id="diff-content"]');

  document.querySelector('[data-id="history-btn"]')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelector('[data-id="overflow-dropdown"]')?.classList.add('hidden');
    if (historyDrawer) {
        const isHidden = historyDrawer.classList.contains('hidden');
        historyDrawer.classList.toggle('hidden');
        if (isHidden && appState.currentFilePath) {
            loadHistoryForFile(appState.currentFilePath);
        }
    }
  });

  document.querySelector('[data-id="history-close"]')?.addEventListener('click', () => {
    historyDrawer?.classList.add('hidden');
  });

  document.querySelector('[data-id="diff-back"]')?.addEventListener('click', () => {
    hideDiffView();
  });
}
