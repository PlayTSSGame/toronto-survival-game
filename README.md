# Toronto Survival Simulator

Client-side React + Vite + TypeScript game. Fixed-turn, LocalStorage persistence, static hosting.

```
npm install
npm run dev      # local dev
npm test         # engine unit tests
npm run build    # production build -> dist/
```

Config: copy `.env.example` to `.env`; `VITE_SPONSOR_URL` sets the footer link (rebuild required).
SPA fallback: `vercel.json` (Vercel) and `public/_redirects` (Netlify).

## Layout
- `src/engine/` validate, game (turn engine), persistence, rng — no UI imports
- `src/data/` `characters.json`, `events.json` — **PLACEHOLDER content** until the client's real files arrive
- `src/ui/` React hook and glue; `src/App.tsx` view

## Live data (Milestone 2)
- **Weather:** Environment Canada MSC GeoMet `swob-realtime`, station TORONTO CITY, called directly from the browser (CORS `*`). Uses `air_temp` and `pcpn_amt_pst1hr` (1-hour precipitation, mm) from the newest observation under 3 h old.
- **TTC:** `alerts.ttc.ca` sends no CORS headers and has no `delay_minutes` field, so a tiny serverless proxy (`server/transit.ts`, exposed as `/api/transit` by `api/transit.ts` on Vercel and `netlify/functions/transit.ts` on Netlify; also served by `npm run dev`) derives minutes from active unplanned subway/streetcar delay alerts (Critical 30, Major 20, Minor 10, other 5; max + 5 per extra alert; cap 45). **Mapping needs client sign-off.** Override the URL with `VITE_TRANSIT_URL`.
- **Resilience:** 1,200 ms abort per request, payload validation, 5 min fresh cache, up to 1 h stale cache, then neutral offline fallback. Play never waits on the network; choices use the latest snapshot. Diagnostics are `console.debug` in dev only.
- **Formulas:** `src/engine/environment.ts` (TTC `1 + min/60` above 15 min; weather `1 + |T|/20` below 0°C, `1.25` over 5 mm; larger wins if both).

## Endings (Milestone 3)
Evaluated when turn 30 completes alive (`src/engine/game.ts`, `src/engine/rank.ts`):
- **Wealth:** cash >= 100,000, turn >= 25, every catalog event played.
- **Asset:** cash >= 100,000 x (1 + (TTC modifier - 1) + (weather modifier - 1)), using the latest environment snapshot.
- **Endurance:** reach the end of day 30 with sanity and health above 0.
- Highest wins (wealth > asset > endurance). Defeat: sanity or health <= 0 (turns 1-10 floor vitals at 1).
- `BASE_DAILY_DRAIN` (base x 1.15^turn) is 0 until the client supplies the base cost.
- Ranks and share text: `src/engine/rank.ts` (clipboard API with textarea fallback).

## Deploying
1. `npm ci && npm test && npm run build` produces `dist/`.
2. **Vercel:** import the repo; framework preset Vite. `vercel.json` rewrites everything except `/api/*` to the SPA, and `api/transit.ts` becomes `/api/transit`.
3. **Netlify:** `netlify.toml` sets build/publish and the SPA redirect; `netlify/functions/transit.ts` serves `/api/transit`.
4. Set `VITE_SPONSOR_URL` in the host's environment settings, then **redeploy** (Vite bakes it in at build time). Only public values belong in `VITE_*` variables.
5. Offline: `public/sw.js` is registered in production builds; the app shell is cached after the first visit.

## Swapping in client content
Replace `src/data/characters.json` and `src/data/events.json` (same schema; `home_location` and `location` are optional). Content is validated at startup with field-level error messages; run `npm test`, which checks 5 events per act and plays each character through 30 days. Bump nothing else: saves referring to a removed character are discarded automatically.

## Status
All three milestones implemented and tested. `src/data/events.json` is the client's full 15-event catalog (plus an optional `location` field per event, added by us for the map). `src/data/characters.json` is still **placeholder** (only the Commuter's $40 cash comes from the client): replace it with the client's file and re-run `npm test`.
