#!/bin/bash
set -e

REPO_PATH="/data/repo"

echo "=== DocGit Backend Pre-flight Checks ==="

# Check if /data/repo is a mount point
if grep -qs " ${REPO_PATH} " /proc/mounts; then
    echo "INFO: Volume mounted at ${REPO_PATH}"
else
    echo "WARNING: No volume mounted at ${REPO_PATH}"
    echo "WARNING: Data will not persist after container restart"
    echo "WARNING: To persist data, mount a volume with: -v /host/path:${REPO_PATH}"
fi

# Ensure the directory exists
mkdir -p "${REPO_PATH}"

# Check if it's a git repository
if [ -d "${REPO_PATH}/.git" ]; then
    echo "INFO: Git repository detected at ${REPO_PATH}"
else
    # Check if directory is empty
    if [ -z "$(ls -A ${REPO_PATH})" ]; then
        echo "INFO: Initializing new git repository at ${REPO_PATH}"
        git init "${REPO_PATH}"
        git -C "${REPO_PATH}" config user.name "DocGit System"
        git -C "${REPO_PATH}" config user.email "system@docgit.local"
        
        # Create initial commit to ensure HEAD exists
        touch "${REPO_PATH}/.initial_commit_marker"
        git -C "${REPO_PATH}" add .initial_commit_marker
        git -C "${REPO_PATH}" commit -m "Initial repository setup"
        echo "INFO: Git repository initialized successfully with initial commit"
    else
        echo "WARNING: Directory ${REPO_PATH} is not a git repository but contains files"
        echo "WARNING: Initializing as git repository - existing files will be tracked"
        git init "${REPO_PATH}"
        git -C "${REPO_PATH}" config user.name "DocGit System"
        git -C "${REPO_PATH}" config user.email "system@docgit.local"
        
        # Create initial commit with existing files
        git -C "${REPO_PATH}" add .
        git -C "${REPO_PATH}" commit -m "Initial repository setup with existing files"
        echo "WARNING: Git repository initialized - existing files have been committed"
    fi
fi

echo "=== Pre-flight checks complete ==="
echo ""

# Start the application
exec "$@"
