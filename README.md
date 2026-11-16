# Jotly

A real-time collaborative document editor. Multiple people edit the same document
at once, and changes merge correctly, even after going offline and reconnecting.

> Work in progress. Built phase by phase as a deployment-focused portfolio project.

## Planned stack

- Frontend: React, Vite, TypeScript, TipTap, Yjs
- Backend: Node.js, TypeScript, Express, y-websocket
- Database: PostgreSQL
- DevOps: Docker, GitHub Actions

## Project structure

- `client/`: the React website (coming in Phase 3)
- `server/`: the Node.js backend (coming in Phase 2)
- `docs/`: architecture diagrams and notes

## Local development

Requirements: Node 22 (use `nvm use`), Docker Desktop.

```bash
cp .env.example .env     # then set your own POSTGRES_PASSWORD
docker compose up -d     # starts Postgres
npm install              # installs lint and format tools
```

Useful commands: `npm run lint`, `npm run format`.
