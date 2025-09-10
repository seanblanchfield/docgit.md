# Wiki Project Documentation

## Summary

This is a Git-based wiki system built with a modern web stack featuring a FastAPI backend and TypeScript frontend. The system provides WYSIWYG markdown editing with real-time collaboration features, file locking, and comprehensive version control integration.

**Key Features:**
- WYSIWYG markdown editing with Milkdown
- File tree navigation with create/edit/delete operations
- Turn-based editing with file locking system
- Git-based version control with history and diff viewing
- Responsive design with mobile-optimized drawer interface
- Docker-based development and deployment

## Table of Contents

### Core Documentation
- [Overview](overview.md) - Project overview, tech stack, and primary use cases
- [Architecture](architecture.md) - High-level architecture diagram and system design
- [Project Structure](project-structure.md) - Directory layout and file organization

### Technical Specifications
- [Frontend Specification](frontend.md) - Complete frontend implementation details
- [Backend Specification](backend.md) - FastAPI service and API documentation
- [Docker & Deployment](docker.md) - Container setup and deployment configuration

### Development
- [Development Workflow](development.md) - Local development setup and workflow
- [Bug Recording Workflow](bug-workflow.md) - Bug tracking and management within WIP files
- [Environment Configuration](environment.md) - Environment variables and configuration
- [Testing](testing.md) - Testing strategies and implementation

### Operations
- [Production Notes](production.md) - Production deployment considerations
- [Non-functional Requirements](requirements.md) - Performance, accessibility, and browser support

## Quick Start

1. Clone the repository
2. Run `docker compose up -d` 
3. Access the application at `http://localhost:3000`

For detailed setup instructions, see [Development Workflow](development.md).

## Project Status

The core wiki functionality is implemented and stable. See the [WIP directory](../WIP/) for current development tasks and future features.
