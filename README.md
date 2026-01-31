# docgit.md

A Git-based wiki system with WYSIWYG markdown editing, real-time collaboration, and comprehensive version control integration.

## Features

- **WYSIWYG Markdown Editing** - Powered by Milkdown for intuitive content creation
- **File Tree Navigation** - Create, edit, and delete pages with ease
- **Turn-based Editing** - File locking system prevents conflicts
- **Git Version Control** - Full history tracking and diff viewing
- **Responsive Design** - Mobile-optimized drawer interface
- **Docker-based** - Simple deployment and development setup

## Quick Start

```bash
# Clone the repository
git clone <repository-url>
cd docgit.md

# Start the application
docker compose up -d

# Access the wiki
open http://localhost:8080
```

The application will be available at `http://localhost:8080` with the FastAPI backend serving both the API and frontend.

## Tech Stack

**Backend:**
- FastAPI (Python)
- Git integration for version control
- File-based locking system

**Frontend:**
- TypeScript
- Milkdown (WYSIWYG markdown editor)
- Modern responsive UI

**Infrastructure:**
- Docker & Docker Compose
- Volume-based data persistence

## Documentation

Comprehensive documentation is available in the [`docs/`](docs/) directory:

- [Overview](docs/overview.md) - Project overview and use cases
- [Architecture](docs/architecture.md) - System design and architecture
- [Frontend Specification](docs/frontend.md) - Frontend implementation details
- [Backend Specification](docs/backend.md) - API documentation
- [Development Workflow](docs/development.md) - Local development setup
- [Docker & Deployment](docs/docker.md) - Container configuration

See [`docs/index.md`](docs/index.md) for the complete documentation index.

## Development

For detailed development instructions, see [Development Workflow](docs/development.md).

### Prerequisites

- Docker and Docker Compose
- Git

### Project Structure

```
docgit.md/
├── backend/          # FastAPI backend service
├── frontend/         # TypeScript frontend application
├── docs/            # Project documentation
├── data/            # Persistent data (git repo, logs, locks)
├── WIP/             # Work in progress tracking
└── compose.yaml     # Docker Compose configuration
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Credits

- [@seanblanchfield](https://github.com/seanblanchfield), Sean Blanchfield (Jentic) - Creator and maintainer

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.
