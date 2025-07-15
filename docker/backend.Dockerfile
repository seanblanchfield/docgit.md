# Stage 1: Build base with Python and Poetry (or pip if not using Poetry yet)
FROM python:3.12-slim AS base
WORKDIR /app

# Install git first
RUN apt-get update && apt-get install -y --no-install-recommends git && \
    rm -rf /var/lib/apt/lists/*

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Install system dependencies if any (none specified for now)
# RUN apt-get update && apt-get install -y --no-install-recommends some-package

# Copy requirements and install Python dependencies
COPY ./backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r /app/requirements.txt

# Copy the backend application code (which now includes the 'app' subdirectory)
COPY ./backend /app

# Expose the port the app runs on
EXPOSE 8000

# Command to run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
