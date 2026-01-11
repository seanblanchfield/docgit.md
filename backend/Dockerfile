# Stage 1: Build frontend static files
FROM node:20-alpine AS frontend-builder
WORKDIR /frontend

# Install pnpm
RUN npm install -g pnpm@8.15.9

# Copy frontend package files
COPY ./frontend/package.json ./frontend/pnpm-lock.yaml ./

# Install frontend dependencies
RUN pnpm install --frozen-lockfile

# Copy frontend source code
COPY ./frontend ./

# Build frontend for production
RUN pnpm run build

# Stage 2: Build backend with Python
FROM python:3.12-slim AS backend
WORKDIR /app

# Install git and curl
RUN apt-get update && apt-get install -y --no-install-recommends git curl && \
    rm -rf /var/lib/apt/lists/*

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Copy requirements and install Python dependencies
COPY ./backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r /app/requirements.txt

# Copy the backend application code
COPY ./backend /app

# Copy built frontend static files from frontend-builder stage
COPY --from=frontend-builder /frontend/dist /app/static

# Copy and set up entrypoint script
COPY ./backend/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Expose the port the app runs on
EXPOSE 8000

# Set entrypoint for pre-flight checks
ENTRYPOINT ["/bin/bash", "/app/entrypoint.sh"]

# Command to run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
