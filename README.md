# re-agregator

Real estate deal aggregator for the Baku market. Continuously scrapes bina.az, scores every listing against its neighbourhood average, and surfaces undervalued properties through an interactive frontend.

## What it does

- **Scrapes bina.az** hourly, normalises location names, and stores listings in Postgres
- **Scores deals** by comparing each property's ₼/m² against its location average — tiers from *High Value Deal* down to *Overpriced*
- **Filters** by price, area, rooms, floor, document status, mortgage eligibility, repair, urgency, and category
- **Three views** — grid cards, compact list, and an interactive map with property pins; hover for a quick summary, click for full detail
- **District statistics** — price trend charts and sorted location rankings
- **Property detail** — image gallery, map location, deal score breakdown, and a direct link to the source listing
- **Telegram alerts** — subscribe to a filter set and get notified when new matching deals appear
- **Live scrape stream** — watch scraping progress in real time via Server-Sent Events

## Stack

- **Runtime:** Bun
- **Server:** `Bun.serve()` (no Express)
- **Database:** PostgreSQL via Prisma ORM
- **Language:** TypeScript (server + frontend, no framework)

## Setup

1. Install dependencies:

```bash
bun install
```

2. Create `.env` with your database URL:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/re_agregator"
```

3. Apply database schema:

```bash
bun run db:push
```

4. Start the dev server:

```bash
bun run dev
```

## Scripts

| Script | Description |
|---|---|
| `bun run dev` | Start with hot reload |
| `bun run start` | Start for production |
| `bun run typecheck` | Type-check without emitting |
| `bun run db:push` | Push schema to DB without migration |
| `bun run db:studio` | Open Prisma Studio |

## Deal Score Methodology

```
discount_percent = ((location_avg_price_per_sqm - property_price_per_sqm) / location_avg_price_per_sqm) × 100
```

| Discount | Tier |
|---|---|
| ≥ 20% | High Value Deal |
| 10–19% | Good Deal |
| 0–9% | Fair Price |
| Negative | Overpriced |
