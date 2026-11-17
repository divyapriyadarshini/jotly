# Jotly

A real-time collaborative document editor built with Yjs: multiple people edit the same
document at once, and changes merge correctly, even after going offline.

> Work in progress. Built phase by phase as a portfolio project.

## Requirements

- Node.js 22 (`nvm use`)
- Docker Desktop (for PostgreSQL)

## Setup

```bash
git clone https://github.com/divyapriyadarshini/jotly.git
cd jotly
nvm use
npm install
cp .env.example .env   # then edit .env and choose your own POSTGRES_PASSWORD
docker compose up -d   # starts PostgreSQL
```

## Run the server

```bash
npm run dev:server
```

Then open http://localhost:4000/health. You should see JSON with `"status": "ok"`.

## Scripts

| Command                | What it does                        |
| ---------------------- | ----------------------------------- |
| `npm run dev:server`   | Start the API with auto-restart     |
| `npm run build:server` | Compile the server to `server/dist` |
| `npm run typecheck`    | Type-check all packages             |
| `npm run lint`         | Lint the whole repo                 |
| `npm run format`       | Format the whole repo with Prettier |

## Structure

- `server/`: Node.js + Express API (WebSocket sync added in a later phase)
- `client/`: React app (coming soon)
- `docs/`: documentation
