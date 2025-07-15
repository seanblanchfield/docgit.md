#!/bin/bash
set -e

NODE_IMAGE="${NODE_IMAGE:-node:20-alpine}"

# Get the command name (e.g., "add", "install", "run")
COMMAND_NAME=$1
# Shift arguments so $@ now contains only the arguments to the command
shift
# Store the remaining arguments, ensuring they are handled correctly if they contain spaces
COMMAND_ARGS_ARRAY=("$@")

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd)
FRONTEND_DIR="$SCRIPT_DIR/frontend"
CONTAINER_APP_DIR="/app"
# Use an ephemeral store directory for pnpm inside the container
EPHEMERAL_PNPM_STORE_DIR="/tmp/.pnpm-store"

if [ ! -d "$FRONTEND_DIR" ]; then
  echo "Error: Frontend directory does not exist: $FRONTEND_DIR"
  echo "Please ensure the directory structure is correct (e.g., wiki/frontend/ exists)."
  exit 1
fi

echo "Host frontend directory: $FRONTEND_DIR"
echo "Container working directory: $CONTAINER_APP_DIR"
echo "Using ephemeral pnpm store in container: $EPHEMERAL_PNPM_STORE_DIR"
echo "Running in Docker (image: $NODE_IMAGE): pnpm $COMMAND_NAME ${COMMAND_ARGS_ARRAY[@]}"

docker run --rm \
  -v "$FRONTEND_DIR:$CONTAINER_APP_DIR" \
  -w "$CONTAINER_APP_DIR" \
  -e "PNPM_STORE_PATH=$EPHEMERAL_PNPM_STORE_DIR" \
  --user "$(id -u):$(id -g)" \
  "$NODE_IMAGE" \
  sh -c ' 
  # All these exports and commands run inside the new shell started by sh -c
  export HOME=/tmp/pnpm-home && \
  mkdir -p "$HOME" && \
  export NPM_CONFIG_PREFIX=/tmp/pnpm-global-install && \
  mkdir -p "$NPM_CONFIG_PREFIX/bin" && \
  export PATH="$NPM_CONFIG_PREFIX/bin:$PATH" && \
  npm install -g pnpm --no-update-notifier --no-fund --cache /tmp/npm-cache-for-global-pnpm && \
  # "$@" here refers to the arguments passed to sh -c (i.e., COMMAND_NAME and COMMAND_ARGS_ARRAY)
  "$NPM_CONFIG_PREFIX/bin/pnpm" "$@" 
' _ "$COMMAND_NAME" "${COMMAND_ARGS_ARRAY[@]}" # Pass arguments to sh -c

echo "Docker command finished."

exit 0
