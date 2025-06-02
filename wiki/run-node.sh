#!/bin/bash
set -e

NODE_IMAGE="${NODE_IMAGE:-node:20-alpine}"
COMMAND_TO_RUN="$@"

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd)
FRONTEND_DIR="$SCRIPT_DIR/frontend"
CONTAINER_APP_DIR="/app"
# Use an ephemeral cache directory inside the container
EPHEMERAL_NPM_CACHE_DIR="/tmp/.npm-cache"

if [ ! -d "$FRONTEND_DIR" ]; then
  echo "Error: Frontend directory does not exist: $FRONTEND_DIR"
  echo "Please ensure the directory structure is correct (e.g., wiki/frontend/ exists)."
  exit 1
fi

echo "Host frontend directory: $FRONTEND_DIR"
echo "Container working directory: $CONTAINER_APP_DIR"
echo "Using ephemeral npm cache in container: $EPHEMERAL_NPM_CACHE_DIR"
echo "Running in Docker (image: $NODE_IMAGE): npm $COMMAND_TO_RUN"

docker run --rm \
  -v "$FRONTEND_DIR:$CONTAINER_APP_DIR" \
  -w "$CONTAINER_APP_DIR" \
  -e "NPM_CONFIG_CACHE=$EPHEMERAL_NPM_CACHE_DIR" \
  --user "$(id -u):$(id -g)" \
  "$NODE_IMAGE" \
  npm $COMMAND_TO_RUN

echo "Docker command finished."
