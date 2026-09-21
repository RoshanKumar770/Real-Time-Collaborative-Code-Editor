# System Architecture

## Overview

CodeSync.io is a real-time collaborative code editor built with React, Node.js, Express, Socket.IO, PostgreSQL, Redis, Docker, and Nginx.

The system supports multiple users collaborating inside shared rooms while maintaining persistent application data and real-time communication.

## Architecture


# flowchart TB

    User1[User / Browser]
    User2[Collaborator / Browser]

    Nginx[Nginx Reverse Proxy]

    Frontend[React + Vite Frontend]
    Server[Node.js + Express + Socket.IO]

    PostgreSQL[(PostgreSQL)]
    Redis[(Redis)]

    User1 --> Nginx
    User2 --> Nginx

    Nginx --> Frontend
    Nginx --> Server

    Frontend --> Server

    Server --> PostgreSQL
    Server --> Redis

    User1 <-->|WebSocket / Socket.IO| Server
    User2 <-->|WebSocket / Socket.IO| Server
## Components
# Frontend
The frontend is built with:
- React 19
- TypeScript
- Vite
- Tailwind CSS
- Socket.IO Client
The frontend provides:
- Code editor interface
- Room selection
- User authentication
- Real-time collaboration
- User presence
- Chat functionality
- Application status information
# Backend
The backend runs on Node.js and Express.
It provides:
- REST API endpoints
- JWT-based authentication
- Room management
- Health monitoring
- Application metrics
- Socket.IO real-time communication
- PostgreSQL integration
- Redis integration
# Real-Time Communication
Socket.IO provides the real-time communication layer.
When a user performs a collaborative action:
User A
   |
   | Socket.IO event
   v
Node.js Server
   |
   | Broadcast
   v
Other connected users
This allows changes and collaboration events to be propagated without requiring continuous page refreshes.
## PostgreSQL
PostgreSQL is used for persistent application data.
The database stores information such as:
- Users
- Rooms
- Authentication-related data
- Persistent room information
The application initializes the database schema when the server starts.
# Redis
Redis is used as part of the real-time infrastructure.
It is integrated with Socket.IO through the Redis adapter and provides infrastructure for coordinating real-time events.
Redis health is also checked by the application's health endpoint.
# Nginx
Nginx runs as a separate Docker Compose service.
Its role is to provide a reverse-proxy layer in front of the application.
Browser
   |
   v
Nginx :8080
   |
   v
Application :3000
The application itself remains accessible on port 3000 during local development, while Nginx provides the additional reverse-proxy layer on port 8080.
## Docker Architecture
The project uses a multi-container Docker Compose environment:
┌─────────────────────────────────────┐
│           Docker Compose            │
│                                     │
│  ┌──────────┐    ┌──────────────┐   │
│  │  Nginx   │───▶│     App      │   │
│  │   :8080  │    │    :3000     │   │
│  └──────────┘    └──────┬───────┘   │
│                         │           │
│              ┌──────────┴───────┐   │
│              │                  │   │
│        ┌─────▼─────┐       ┌────▼─┐ │
│        │ PostgreSQL│       │ Redis│ │
│        │   :5433   │       │ :6379│ │
│        └───────────┘       └──────┘ │
│                                     │
└─────────────────────────────────────┘
Container Health
The PostgreSQL and Redis containers have Docker healthchecks.
The application container also has a healthcheck that calls:
GET /api/health
The application is considered healthy only when the health endpoint responds successfully.
# Security Architecture
Security-related application controls include:
- JWT authentication
- Required environment variables
- Production JWT secret validation
- Helmet security headers
- API rate limiting
- Authentication-specific rate limiting
- Docker container isolation
- Environment-based configuration
## Observability
The application provides:
# Health endpoint
GET /api/health
Reports:
- Application status
- Database status
- Redis status
- Active rooms
- Persisted rooms
- Active users
- Application uptime
# Metrics endpoint
GET /api/metrics
Reports:
- Application uptime
- HTTP request count
- HTTP error count
- Active rooms
- Active users
- Socket connections
- Socket disconnections
# HTTP Logging
Application HTTP requests are logged with:
HTTP method
Request path
HTTP status
Request duration
Example:
[HTTP] GET /api/health 200 43ms
## Design Goals
The architecture is designed around:
1. Real-time communication
2. Persistent data storage
3. Containerized deployment
4. Health monitoring
5. Basic production security
6. Automated testing
7. CI-based validation
8. Clear separation between application services
## Future Architecture
A future production deployment could extend the current Docker Compose architecture to Kubernetes.
Potential future components include:
- Kubernetes Deployments
- Kubernetes Services
- ConfigMaps
- Secrets
- Horizontal Pod Autoscaling
- NetworkPolicies
- Ingress
- Prometheus
- Grafana
These components are part of the future deployment roadmap and are not required for the current Docker Compose deployment.