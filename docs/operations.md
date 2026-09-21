## Operations Guide

This document describes how to run, monitor, troubleshoot, and maintain CodeSync.io locally using Docker Compose.

## Prerequisites

Install:

- Node.js 22+
- npm
- Docker Desktop
- Git

## Local Development

Install dependencies:
npm ci

Start the development application:
npm run dev

The application is available at:
http://localhost:3000

## Docker Deployment
Build and start the complete environment:
docker compose up -d --build

Check running containers:
docker compose ps
Expected services:
codesync-app
codesync-nginx
codesync-postgres
codesync-redis

# Stop the Application
docker compose down
This stops and removes the containers while preserving named Docker volumes.

# Rebuild the Application
When application or Docker configuration changes:
docker compose up -d --build
For a completely fresh image build:
docker compose build --no-cache app
docker compose up -d
# Application Health
The application exposes:
GET /api/health
# Test it with:
curl http://localhost:3000/api/health
A healthy response looks similar to:
{
  "status": "ok",
  "dependencies": {
    "database": "ok",
    "redis": "ok"
  }
}
The health endpoint checks:
- PostgreSQL connectivity
- Redis connectivity
- Application availability
# Application Metrics
The application exposes:
GET /api/metrics
Test it with:
curl http://localhost:3000/api/metrics
The endpoint reports:
- Uptime
- HTTP requests
- HTTP errors
- Active rooms
- Active users
- Socket connections
- Socket disconnections
## Docker Healthcheck
The application Docker image includes a healthcheck based on:
/api/health
Inspect the health state:
docker inspect --format='{{json .State.Health}}' codesync-app
A healthy application should report:
"Status":"healthy"
# Container Status
Check all services:
docker compose ps
The expected state is:
codesync-app        healthy
codesync-postgres   healthy
codesync-redis      healthy
codesync-nginx      running
# Application Logs
View application logs:
docker logs codesync-app
Follow logs in real time:
docker logs -f codesync-app
Or use Docker Compose:
docker compose logs -f app
# PostgreSQL Logs
docker compose logs postgres
Follow PostgreSQL logs:
docker compose logs -f postgres
# Redis Logs
docker compose logs redis
# Nginx Logs
docker compose logs nginx
# Database Troubleshooting
Check PostgreSQL health:
docker compose ps postgres
Check the database container logs:
docker compose logs postgres
The application uses the PostgreSQL connection configured through:
DATABASE_URL
For local Docker Compose deployment, the application connects to the PostgreSQL service using the Docker service name.
# Redis Troubleshooting
Check Redis:
docker compose ps redis
Test Redis directly:
docker exec codesync-redis redis-cli ping
Expected:
PONG
# Application Troubleshooting
Application is unhealthy
First check:
docker compose ps
Then:
docker logs codesync-app --tail 100
Check the health endpoint:
curl http://localhost:3000/api/health
If PostgreSQL reports an error, inspect:
docker compose logs postgres
If Redis reports an error, inspect:
docker compose logs redis
# Application container keeps restarting
Check:
docker logs codesync-app --tail 100
Common causes include:
- Missing environment variables
- Invalid JWT configuration
- Database connection failure
- Redis connection failure
- Application startup errors
# Environment Variables
Required variables include:
DATABASE_URL
REDIS_URL
JWT_SECRET
The project provides an example configuration in:
.env.example
Production environments should use a strong randomly generated JWT secret.
## Security Operations
The application includes:
Helmet
Helmet adds HTTP security headers.
# Rate Limiting
Authentication routes have a stricter rate limit than general API routes.
# Environment Validation
Production startup validates required environment variables and JWT secret requirements.
# Secret Management
Secrets should not be committed to Git.
The .env file is ignored by Git.
# Testing
Run unit and integration tests:
npm test
Run TypeScript validation:
npm run lint
Run the production build:
npm run build
Run Playwright E2E tests:
npm run test:e2e
# Operational Verification
After deployment, run:
docker compose ps
curl http://localhost:3000/api/health
curl http://localhost:3000/api/metrics
npm run test:e2e
These checks verify:
- Container health
- Database availability
- Redis availability
- Application availability
- Metrics endpoint
- End-to-end application functionality
# Data Reset
For local development only, Docker volumes can be removed:
docker compose down -v
Then recreate the environment:
docker compose up -d --build
Warning: Removing volumes deletes the local PostgreSQL and Redis persistent data.
This command should not be used against a production environment without understanding the data-loss implications.
## Recovery Procedure
A basic local recovery sequence is:
docker compose down
docker compose up -d --build
docker compose ps
curl http://localhost:3000/api/health
If the problem persists:
docker compose logs app
docker compose logs postgres
docker compose logs redis
docker compose logs nginx
## Production Roadmap
Potential future operational improvements include:
- Kubernetes deployment
- Horizontal Pod Autoscaling
- Prometheus metrics
- Grafana dashboards
- Centralized log aggregation
- Automated database backups
- Managed PostgreSQL
- Managed Redis
- Container orchestration
- External secret management
These are future improvements and are not part of the current Docker Compose deployment.