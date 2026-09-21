# CI/CD Pipeline

CodeSync.io uses GitHub Actions to automatically validate changes pushed to the repository.

## The CI pipeline performs:

1. Source checkout
2. Node.js setup
3. Dependency installation
4. Database initialization
5. TypeScript validation
6. Unit and integration testing
7. Production build
8. Docker image build
9. Container vulnerability scanning

## Pipeline Architecture

# flowchart LR
    Developer[Developer Push / Pull Request]
    GitHub[GitHub Repository]
    CI[GitHub Actions]
    Dependencies[npm ci]
    DB[(PostgreSQL)]
    Redis[(Redis)]
    Tests[Lint + Unit + Integration Tests]
    Build[Production Build]
    Docker[Docker Image Build]
    Scan[Trivy Vulnerability Scan]

    Developer --> GitHub
    GitHub --> CI

    CI --> Dependencies
    CI --> DB
    CI --> Redis

    Dependencies --> Tests
    DB --> Tests
    Redis --> Tests

    Tests --> Build
    Build --> Docker
    Docker --> Scan

# Workflow Trigger
The CI workflow runs on:
- Pushes to main
- Pull requests targeting main
This provides automated validation before changes are merged into the main development branch.
# CI Environment
The workflow uses:
Ubuntu
Node.js 22
PostgreSQL 17
Redis 7
PostgreSQL and Redis run as GitHub Actions service containers.
## Pipeline Steps
# 1. Checkout
The repository is checked out using:
actions/checkout@v4
# 2. Node.js Setup
The workflow uses Node.js 22.
npm dependency caching is enabled to improve subsequent CI runs.
# 3. Install Dependencies
Dependencies are installed using:
npm ci
Using npm ci ensures the installation follows the committed lockfile.
# 4. Database Initialization
The CI environment initializes the PostgreSQL database using:
npx tsx src/db/init.ts
This prepares the database schema required by the application tests.
# 5. TypeScript Validation
The project runs:
npm run lint
The current lint command performs TypeScript checking using:
tsc --noEmit
This verifies that the TypeScript source compiles without emitting build files.
# 6. Unit and Integration Tests
The workflow runs:
npm test
These tests validate application functionality including:
- CRDT behavior
- Server functionality
- Socket functionality
# 7. Production Build
The production application is built using:
npm run build
The build produces the frontend assets and bundled server output.
# 8. Docker Build
The CI pipeline builds the production Docker image.
The project uses a multi-stage Dockerfile:
Builder Stage
     |
     ├── Install dependencies
     ├── Copy source
     └── Build application
             |
             v
Production Stage
     |
     ├── Production dependencies
     ├── Built application
     └── Healthcheck
This keeps the production image separate from the development/build environment.
# 9. Vulnerability Scanning
The Docker image is scanned using Trivy.
The scan checks the generated container image for known vulnerabilities.
The current pipeline uses the scan primarily as a security visibility mechanism. Vulnerability findings do not automatically block the current CI pipeline.
This allows development to continue while still exposing dependency and image security findings for review.

## CI Environment Variables
The CI workflow provides test-specific environment variables such as:
DATABASE_URL
REDIS_URL
JWT_SECRET
These values are used only inside the CI environment.
Production secrets should be supplied through secure deployment configuration rather than committed to the repository.

## Quality Gates
The CI pipeline provides automated validation for:
TypeScript
    ↓
Unit / Integration Tests
    ↓
Production Build
    ↓
Docker Build
    ↓
Security Scan

A failure in the core test/build stages causes the workflow to fail.
# Local CI-equivalent Checks
Before pushing changes, developers can run:
npm ci
npm run lint
npm test
npm run build
npm run test:e2e
# Docker validation can be performed using:
docker compose up -d --build
docker compose ps
Then:
curl http://localhost:3000/api/health
curl http://localhost:3000/api/metrics
## Deployment Model
The current CI pipeline focuses on automated validation and production image creation.
The current project deployment environment is Docker Compose.
A future pipeline could extend this workflow to automatically deploy the container image to:
- Kubernetes
- AWS ECS
- AWS EKS
- Another container platform
Such deployment automation is part of the future roadmap rather than the current implementation.
## Future CI/CD Improvements
Potential future improvements include:
- Container image publishing to a registry
- Image signing
- SBOM generation
- Dependency update automation
- Automated deployment
- Kubernetes deployment
- Deployment approvals
- Rollback automation
- Staging environments
- Production promotion workflows
## CI/CD Goals
The pipeline is designed to provide:
- Repeatable builds
- Automated testing
- Early error detection
- Container validation
- Security visibility
- Consistent development workflows