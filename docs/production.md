# Production Notes

## Production Deployment

### Requirements
- Docker and Docker Compose installed on production server
- Sufficient disk space for Git repository growth
- Network access for container communication
- SSL/TLS certificate for HTTPS (recommended)

### Deployment Steps
1. Clone repository to production server
2. Configure production environment variables
3. Set up reverse proxy for SSL termination
4. Run `docker compose -f compose.yaml -f compose.prod.yaml up -d --build`
5. Verify health check endpoint: `GET /health`

## Security Considerations

### TLS Termination
- Handle TLS termination with upstream reverse-proxy (Caddy, Traefik, or nginx)
- Use Let's Encrypt for automatic certificate management
- Redirect HTTP to HTTPS in production

### File System Security
- Enable read-only filesystem except for mounted repo volume
- Use non-root user in containers where possible
- Restrict volume mount permissions appropriately

### Network Security
- Use Docker internal networks for service communication
- Expose only necessary ports to external network
- Configure firewall rules for production server

## Environment Configuration

### Production Environment Variables
```bash
# Required
GIT_REPO_PATH=/data/repo
LOCK_STORAGE_PATH=/data/locks

# Recommended
GIT_AUTHOR_NAME="Wiki System"
GIT_AUTHOR_EMAIL="wiki@yourdomain.com"
FRONTEND_URL=https://wiki.yourdomain.com

# Optional
REMOTE_GIT_URL=git@github.com:yourorg/wiki-content.git
```

### Docker Compose Production Override
```yaml
# compose.prod.yaml
version: "3.9"
services:
  backend:
    restart: unless-stopped
    environment:
      - GIT_AUTHOR_NAME=${GIT_AUTHOR_NAME}
      - GIT_AUTHOR_EMAIL=${GIT_AUTHOR_EMAIL}
      - FRONTEND_URL=${FRONTEND_URL}
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  frontend:
    restart: unless-stopped
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  # Reverse proxy (example with Caddy)
  caddy:
    image: caddy:2-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - frontend

volumes:
  caddy_data:
  caddy_config:
```

## Reverse Proxy Configuration

### Caddy Configuration (Recommended)
```caddyfile
# Caddyfile
wiki.yourdomain.com {
    reverse_proxy frontend:80
    
    # Security headers
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        X-XSS-Protection "1; mode=block"
    }
    
    # Gzip compression
    encode gzip
    
    # Access logging
    log {
        output file /var/log/caddy/access.log
    }
}
```

### nginx Configuration (Alternative)
```nginx
server {
    listen 443 ssl http2;
    server_name wiki.yourdomain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Remote Git Integration

### Automatic Push to Remote
Consider pushing commits to a remote bare origin if `REMOTE_GIT_URL` environment variable is set:

```python
# In git_service.py
if os.getenv("REMOTE_GIT_URL"):
    try:
        repo.remote().push()
    except Exception as e:
        logger.warning(f"Failed to push to remote: {e}")
```

### SSH Key Setup for Remote Push
```bash
# Generate SSH key for Git operations
ssh-keygen -t ed25519 -C "wiki@yourdomain.com" -f /data/ssh/id_ed25519

# Add to container
volumes:
  - /data/ssh:/root/.ssh:ro
```

## Monitoring and Logging

### Health Monitoring
- Health check endpoint: `GET /health`
- Monitor container status: `docker compose ps`
- Check service logs: `docker compose logs -f`

### Log Management
```yaml
# Production logging configuration
services:
  backend:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
        labels: "service=wiki-backend"
```

### Metrics Collection
- Monitor disk usage for repository growth
- Track API response times
- Monitor lock file accumulation
- Watch for Git repository size

## Backup Strategy

### Repository Backup
```bash
# Backup Git repository
docker run --rm -v wiki_repo_data:/data -v $(pwd):/backup alpine \
  tar czf /backup/wiki-repo-$(date +%Y%m%d).tar.gz -C /data .

# Automated backup script
#!/bin/bash
BACKUP_DIR="/backups/wiki"
DATE=$(date +%Y%m%d-%H%M%S)
docker run --rm -v wiki_repo_data:/data -v $BACKUP_DIR:/backup alpine \
  tar czf /backup/wiki-repo-$DATE.tar.gz -C /data .
```

### Lock Storage Backup
```bash
# Backup lock storage (usually not necessary as locks are temporary)
docker run --rm -v wiki_lock_data:/data -v $(pwd):/backup alpine \
  tar czf /backup/wiki-locks-$(date +%Y%m%d).tar.gz -C /data .
```

## Performance Optimization

### Container Resource Limits
```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.5'
        reservations:
          memory: 256M
          cpus: '0.25'
```

### Volume Optimization
- Use named volumes for better performance
- Consider SSD storage for repository data
- Monitor disk I/O for large repositories

## Troubleshooting

### Common Production Issues

**Container Won't Start:**
```bash
# Check container logs
docker compose logs backend
docker compose logs frontend

# Verify environment variables
docker compose config
```

**Permission Issues:**
```bash
# Check volume permissions
docker run --rm -v wiki_repo_data:/data alpine ls -la /data

# Fix permissions if needed
docker run --rm -v wiki_repo_data:/data alpine chown -R 1000:1000 /data
```

**Git Repository Corruption:**
```bash
# Access backend container
docker compose exec backend bash

# Check Git repository status
cd /data/repo && git status
git fsck --full
```

### Emergency Recovery

**Restore from Backup:**
```bash
# Stop services
docker compose down

# Restore repository data
docker run --rm -v wiki_repo_data:/data -v $(pwd):/backup alpine \
  tar xzf /backup/wiki-repo-YYYYMMDD.tar.gz -C /data

# Restart services
docker compose up -d
```

**Reset Lock Storage:**
```bash
# Clear all locks (emergency only)
docker run --rm -v wiki_lock_data:/data alpine rm -rf /data/*
```

## Maintenance

### Regular Maintenance Tasks
- Monitor disk usage and clean up old backups
- Update Docker images regularly
- Review and rotate logs
- Check Git repository integrity
- Monitor SSL certificate expiration

### Update Procedure
1. Backup current data
2. Pull latest code changes
3. Build new containers: `docker compose build`
4. Stop services: `docker compose down`
5. Start with new images: `docker compose up -d`
6. Verify functionality
7. Monitor for issues
