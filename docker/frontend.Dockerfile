# Stage 1: Build the React app
FROM node:20-alpine AS build
WORKDIR /app

# Copy package.json and package-lock.json (or yarn.lock if using yarn)
COPY frontend/package.json frontend/package-lock.json* ./

# Install dependencies
# Using 'ci' for cleaner installs, assuming package-lock.json is up-to-date
# If run-node.sh uses 'install', this should ideally match or be robust to it.
# For now, 'npm ci' is standard for build stages.
RUN npm ci

# Copy the rest of the frontend application code
COPY frontend/ ./

# Build the application
RUN npm run build

# Stage 2: Serve static assets with Nginx
FROM nginx:1.27-alpine
WORKDIR /usr/share/nginx/html

# Remove default Nginx welcome page
RUN rm -rf ./*

# Copy the built static assets from the 'build' stage
COPY --from=build /app/dist .

# Nginx will be configured via a mounted nginx.conf in compose.yaml,
# so no need to copy a default.conf here.

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
