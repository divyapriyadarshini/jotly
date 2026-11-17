## Run

In two terminals, from the repo root:

```bash
npm run dev:server   # API on http://localhost:4000 (try /health)
npm run dev:client   # app on http://localhost:5173
```

## Scripts

| Command                | What it does                                  |
| ---------------------- | --------------------------------------------- |
| `npm run dev:server`   | Start the API with auto-restart               |
| `npm run dev:client`   | Start the Vite dev server for the React app   |
| `npm run build:server` | Compile the server to `server/dist`           |
| `npm run build:client` | Type-check and build the app to `client/dist` |
| `npm run typecheck`    | Type-check all packages                       |
| `npm run lint`         | Lint the whole repo                           |
| `npm run format`       | Format the whole repo with Prettier           |

## Structure

- `server/`: Node.js + Express API (WebSocket sync added in a later phase)
- `client/`: React + Vite + TipTap app
- `docs/`: documentation
