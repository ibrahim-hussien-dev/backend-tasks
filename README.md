# Backend Tasks 2–4

| Folder | Task | Port |
|---|---|---|
| `task2-crud-api` | Secured CRUD REST API (Express + SQLite) | 3001 |
| `task3-websocket-hub` | Real-time chat hub (Socket.io + Redis + file logs) | 3002 |
| `task4-rbac-microservices` | JWT RBAC API + RabbitMQ + Docker Compose + tests | 3000 |

## Requirements
Node 18+ and Docker (running). Task 4 requires credentials supplied through environment variables.

## Run everything
```bash
node manage.js start   # installs deps, starts Docker services + servers, waits until ready
node manage.js test    # tests all three tasks
node manage.js stop    # stops everything
```
Each folder also has its own README. Process logs: `logs/`.
