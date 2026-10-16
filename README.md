# Impact Cup 2026 - USGA/WHS Source-of-Truth Build

This build is governed by `HANDICAP_RULES_SOURCE_OF_TRUTH.txt`.

## Cloudflare live scoring

The app ships as **static assets + a Worker API** (`src/worker.js`) with **D1** for shared tournament state across devices.

### One-time setup

1. Install dependencies: `npm install`
2. Log in: `npx wrangler login`
3. Create D1 and note the database id:

   ```bash
   npx wrangler d1 create impactcup
   ```

   Copy the returned `database_id` into `wrangler.toml` under `[[d1_databases]]`.

4. Apply migrations:

   ```bash
   npm run db:migrate:remote
   ```

5. Set the scorer write secret (6-digit tournament PIN — see `.dev.vars.example` for local; production value is in your Impact Cup deploy guide, not committed to git):

   ```bash
   npx wrangler secret put SCORER_PIN
   ```

### Deploy

```bash
npm run deploy
```

Wrangler prints the `*.workers.dev` URL. Open it in a browser; use **Scorer PIN** in Admin mode before edits sync to the server.

### Local development

```bash
npm run db:migrate:local
cp .dev.vars.example .dev.vars
npm run dev
```

API:

- `GET /api/state` — `{ state, version }` (public)
- `PUT /api/state` — body `{ state, expectedVersion }`; header `Authorization: Bearer <pin>` or `X-Scorer-Pin`

### API smoke test (local)

```bash
curl -s http://localhost:8787/api/state | jq .
curl -s -X PUT http://localhost:8787/api/state \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer 675843' \
  -d @fixtures/minimal-state.json
```

Key rules:
- Match 1: 2-player scramble, 35% low + 15% high from unrounded Front-9 Course Handicaps; head-to-head strokes are the rounded difference between the two unrounded team allowance values.
- Match 2: Four-Ball Match Play, 90% from the lowest unrounded Back-9 Course Handicap.
- Match 3: Individual Match Play, 100% of the unrounded Front-9 Course Handicap difference, rounded once; six-hole use is an explicit Impact Cup committee rule.
- Finale: scratch (committee rule; no directly applicable USGA 10-player alternate-shot allowance).
- Presentation Mode and Admin Mode call the same centralized handicap functions.
- Joshua Delo: +1.7. Mike Koper: 17.0.
- Match 1 / Match 2 pairing unrestricted; Singles remains same-tier.
