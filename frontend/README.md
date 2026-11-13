# Juu frontend

Two Next.js (TypeScript) sites that share one set of parts:

| Folder | What | Local URL |
| --- | --- | --- |
| `app/` | The Juu app: MUSDash, Positions, Doors, Bank, Principal Market, Jackpot, Agents, Leaderboard | http://localhost:3000 |
| `landing/` | The landing page | http://localhost:3001 |
| `shared/` | Design tokens (`juu.css`) and shared parts: Stack logo, page icons, Ladder, ticker, starburst, Agaruzo! banner, floor badge, footer | |

The design source of truth is `docs/design/juu-app-reference.html`.

## Run

Start the data API first (`cd backend && npm start`), then:

```
cd frontend
npm install
npm run dev:app       # app on :3000
npm run dev:landing   # landing on :3001
```

## Settings (environment variables, all optional)

| Name | Used by | Default |
| --- | --- | --- |
| `JUU_API_URL` | app, landing | `http://127.0.0.1:8788` (the data API) |
| `NEXT_PUBLIC_MEZO_RPC` | app | `https://rpc.test.mezo.org` |
| `NEXT_PUBLIC_APP_URL` | landing ("Enter MUSDash" buttons) | `http://localhost:3000` |
| `NEXT_PUBLIC_DOCS_URL`, `NEXT_PUBLIC_DATA_API_URL`, `NEXT_PUBLIC_SOURCE_URL`, `NEXT_PUBLIC_X_URL`, `NEXT_PUBLIC_MEZO_DISCORD_URL` | footer links | not set: shown as plain text |

Contract addresses are in `app/src/lib/addresses.ts`, a copy of `backend/config/addresses.json`.
