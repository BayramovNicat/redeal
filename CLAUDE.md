---
description: Use Bun instead of Node.js, npm, pnpm, or vite.
globs: "*.ts, *.tsx, *.html, *.css, *.js, *.jsx, package.json"
alwaysApply: false
---

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

## Frontend

Use HTML imports with `Bun.serve()`. Don't use `vite`. HTML imports fully support React, CSS, Tailwind.

Server:

```ts#index.ts
import index from "./index.html"

Bun.serve({
  routes: {
    "/": index,
    "/api/users/:id": {
      GET: (req) => {
        return new Response(JSON.stringify({ id: req.params.id }));
      },
    },
  },
  // optional websocket support
  websocket: {
    open: (ws) => {
      ws.send("Hello, world!");
    },
    message: (ws, message) => {
      ws.send(message);
    },
    close: (ws) => {
      // handle close
    }
  },
  development: {
    hmr: true,
    console: true,
  }
})
```

HTML files can import .tsx, .jsx or .js files directly and Bun's bundler will transpile & bundle automatically. `<link>` tags can point to stylesheets and Bun's CSS bundler will bundle.

```html#index.html
<html>
  <body>
    <h1>Hello, world!</h1>
    <script type="module" src="./frontend.tsx"></script>
  </body>
</html>
```

With the following `frontend.tsx`:

```tsx#frontend.tsx
import React from "react";
import { createRoot } from "react-dom/client";

// import .css files directly and it works
import './index.css';

const root = createRoot(document.body);

export default function Frontend() {
  return <h1>Hello, world!</h1>;
}

root.render(<Frontend />);
```

Then, run index.ts

```sh
bun --hot ./index.ts
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.mdx`.

## Project: re-agregator

Real estate deal aggregator for the Baku market (bina.az). Bun + TypeScript + PostgreSQL (Prisma).

### Key conventions

- Server entry point: `src/index.ts` — uses `Bun.serve()` with typed route handlers. No Express, no framework.
- Database: Prisma with PostgreSQL. Client singleton at `src/utils/prisma.ts`. Use `bun run db:push` for schema changes during development.
- Scrapers implement the abstract interface in `src/scrapers/base.scraper.ts`. Add new sources there.
- All deal-scoring logic lives in `src/services/analytics.service.ts`. Thresholds and tier labels are defined in `classifyDeal()`.
- Location names come from bina.az and are normalised in `src/utils/district-normalizer.ts` before being stored as `location_name`.
- Static frontend files go in `public/`. The server serves them with a SPA fallback in the `fetch()` handler.
- Frontend source in `frontend/` — vanilla TypeScript, no framework. `main.ts` is the entry point.
- Frontend split into: `core/` (state, types, i18n, events, utils), `features/` (products, search, header, map-view, district-stats, alerts, trend), `ui/` (components), `dialogs/` (property-detail, gallery, map, heatmap, description).
- Run dev server: `bun run dev` (hot reload). Type-check: `bun run typecheck`.
- All API responses use brotli compression when client supports it (`Accept-Encoding: br`).
- Hourly cron scrape runs automatically on server start (40 pages, 800ms delay).
- Telegram alert system: `src/services/telegram.service.ts` + `src/services/alert.service.ts`.

### Frontend views

Three property views: **Grid** (card grid), **List** (compact rows), **Map** (interactive pins on SVG Baku map). Map view uses `/api/deals/map-pins` — fetches all visible properties with lat/lng. Hover shows tooltip, click opens property-detail dialog.

### Data model (Property)

Core fields: `source_url` (unique), `price`, `area_sqm`, `price_per_sqm`, `district`, `location_name`, `rooms`, `floor`, `total_floors`, `category`, `has_document`, `has_mortgage`, `has_repair`, `is_urgent`, `posted_date`, `images` (string[]), `lat`, `lng`.

Indexes on: `district`, `location_name`, `is_urgent`, `price_per_sqm`, `(location_name, price_per_sqm)`.

### API surface

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Status + property count |
| GET | `/api/deals/locations` | Distinct location names |
| GET | `/api/deals/undervalued` | Scored deals with filters |
| GET | `/api/deals/trend?location=X` | Weekly ₼/m² sparkline |
| GET | `/api/deals/map-pins` | Lat/lng pins for map view |
| POST | `/api/deals/by-urls` | Fetch properties by URL list |
| GET | `/api/heatmap` | District-level heatmap data |
| GET | `/api/scrape/stream` | SSE live scrape progress |
| GET | `/api/alerts?chat_id=X` | List Telegram alerts |
| POST | `/api/alerts` | Create Telegram alert |
| DELETE | `/api/alerts/:token` | Deactivate alert |
| POST | `/api/telegram/webhook` | Telegram bot webhook |
