# Task 3 – WebSocket Real-Time Chat Hub

Socket.io server with multiple channels, **Redis** for active-user cache, and an append-only **file log** (`logs/transactions.log`) with timestamps for every join / leave / message.

## Run
```bash
docker compose up -d        # starts Redis
npm install
npm start
npm run demo                # in a second terminal: two clients chat
```
Check the log: `cat logs/transactions.log` · Check Redis-backed presence: `curl localhost:3000/channels/general/users`

## Socket events
| Client -> Server | Payload | Notes |
|---|---|---|
| `join` | `{ username, channel }` | Joins a channel (can join many) |
| `message` | `{ channel, text }` | Must have joined the channel |
| `leave` | `{ channel }` | |

| Server -> Client | Payload |
|---|---|
| `message` | `{ channel, username, text, timestamp }` |
| `presence` | `{ channel, users[] }` |

`REDIS_URL` (default `redis://localhost:6379`) and `PORT` (default 3000) are configurable.
