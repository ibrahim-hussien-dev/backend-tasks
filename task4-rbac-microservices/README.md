# Task 4 – Role-Based Microservice API with RabbitMQ

```
client -> [api :3000] --publishes--> [RabbitMQ] --consumes--> [worker] --> [PostgreSQL]
             (JWT + RBAC)                                      (writes orders)
```

- **api** – register/login, JWT auth, RBAC (`user`, `admin`), validation, publishes order requests to RabbitMQ and returns `202`.
- **worker** – consumes the queue (prefetch 10) and performs the DB writes, so request spikes never hit the DB directly.
- **Docker networks** – `public` (only the API is exposed) and `private` (internal: API, worker, Postgres, RabbitMQ).

## Run
```bash
docker compose up -d --build
npm test        # needs Node 18+; prints pass/fail summary for every endpoint
docker compose down -v
```

Required env vars: `JWT_SECRET`, `DATABASE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB`. The admin account is seeded on startup; public registration only creates `user` accounts.

## Endpoints
| Method | Path | Access |
|---|---|---|
| GET | /health | public |
| POST | /auth/register | public |
| POST | /auth/login | public -> JWT |
| POST | /orders | user, admin (queued, 202) |
| GET | /orders/mine | user, admin |
| GET | /orders | admin only |
