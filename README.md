# Toronto Survival Simulator

Client-side React + Vite + TypeScript game. Thirty fixed turns (days), LocalStorage persistence, static hosting plus one small serverless endpoint for TTC data.

```
npm install
npm run dev       # local dev (also serves /api/transit)
npm test          # unit and playthrough tests
npm run balance   # win/loss feasibility report (see below)
npm run lint
npm run build     # type-check + production build -> dist/
```

## Configuration
Copy `.env.example` to `.env`. Only public values belong in `VITE_*` variables; they are baked into the bundle at build time, so **rebuild/redeploy after changing them**.

| Variable | Purpose | Default if unset |
| --- | --- | --- |
| `VITE_SPONSOR_URL` | Footer "Sponsor this game" link | `https://forms.google.com` |
| `VITE_TRANSIT_URL` | Override the TTC endpoint (optional) | same-origin `/api/transit` |

## Layout
- `src/engine/` pure game logic, no UI imports: `validate` (content parsing), `game` (turn engine, endings), `environment` (weather/TTC modifiers), `live` (feed fetching and caching), `persistence`, `rank` (ranks and share text), `rng`
- `src/data/` `characters.json` and `events.json`, the client's content (15 events, 5 per act, plus 3 classes)
- `src/ui/` React hook (`useGame`), art, effects, settings, sound, share image
- `src/App.tsx` the single-page view; `src/App.css` styles
- `server/transit.ts` TTC proxy logic, exposed by `netlify/functions/transit.ts` (Netlify) and `api/transit.ts` (Vercel)
- `public/sw.js` offline app-shell service worker (registered in production builds only)
- `scripts/balance.check.ts` the balance report

## How a run works
- 30 days. Days 1-10 are Act 1, 11-20 Act 2, 21-30 Act 3. Each day draws one unplayed event from the current act (seeded, so a save replays the same way). No event left means a quiet day.
- Each event has two choices. A choice can cost more than one day (`turns_consumed`) and can require an inventory item, which is consumed when used.
- Negative sanity/health changes on events that depend on TTC and/or weather are multiplied by the class modifier and the live modifier. Cash is uncapped and may go negative; sanity and health stay within 0-100.
- Days 1-10 floor sanity and health at 1, so Act 1 cannot kill the player.
- Each completed day pays the class stipend first, then the overdraft check runs. While cash is below zero, sanity drops an extra 2 per day.
- `BASE_DAILY_DRAIN` (`src/engine/game.ts`) is 0 because the client has not supplied a base cost. If set, the daily sanity drain is `base x 1.08^day`.
- Defeat: sanity or health reaches 0. Saves carry a checksum and sanity check; a corrupt, edited or outdated save is discarded, as is a save for a class that no longer exists.

## Classes (as delivered by the client)
| Class | Start cash / sanity / health | Daily stipend | Items | Modifiers |
| --- | --- | --- | --- | --- |
| Mississauga Commuter | $40 / 85 / 90 | $35 | Presto Card, Meal Plan Voucher | TTC x1.25 |
| Financial District Intern | $250 / 45 / 75 | $65 | Corporate Lanyard, Surge Espresso, Meal Plan Voucher | weather x1.15 |
| Campus Residence Dweller | $15 / 65 / 80 | $15 | Meal Plan Voucher | TTC x0.5, weather x0.75 |

Two choices need items: Midterm Crunch (A) needs a Surge Espresso (only the Intern starts with one) and a Meal Plan Voucher choice needs a voucher (all three classes start with one).

## Live data
- **Weather:** Environment Canada MSC GeoMet `swob-realtime`, station TORONTO CITY, called from the browser (CORS `*`). Uses `air_temp` and `pcpn_amt_pst1hr` (1-hour precipitation, mm) from the newest observation less than 3 hours old.
- **TTC:** `alerts.ttc.ca` sends no CORS headers and has no delay-minutes field, so `/api/transit` (`server/transit.ts`) derives minutes from active, unplanned subway and streetcar delay alerts: Critical 30, Major 20, Minor 10, other 5 minutes; the largest value plus 5 per additional alert; capped at 45. **This mapping is approved by the client.** Planned maintenance alerts are ignored. The endpoint also runs in `npm run dev` and `npm run preview`.
- **Resilience:** 1,200 ms abort per request, payload validation, 5 minute fresh cache, up to 1 hour stale cache, then a neutral offline fallback. Play never waits on the network; choices use the latest snapshot. Diagnostics are `console.debug` in dev only. The HUD shows a live / saved / offline marker per feed.
- **Formulas** (`src/engine/environment.ts`): TTC modifier is `1 + minutes/60` when the delay is above 15 minutes, otherwise 1. Weather modifier is `1 + |temp|/20` below 0 degrees C, or 1.25 above 5 mm of precipitation; the larger wins if both apply.

## Endings
Evaluated when day 30 completes with sanity and health above 0 (`src/engine/game.ts`):
- **Wealth:** cash >= $10,000, day >= 25, and every catalog event played.
- **Asset (condo):** cash >= $10,000 x (1 + (TTC modifier - 1) + (weather modifier - 1)), using the latest environment snapshot.
- **Endurance:** reach the end of day 30 alive. This is the ending players actually get.
- Highest wins: wealth, then asset, then endurance.

### Ranks and sharing (`src/engine/rank.ts`)
First match wins: lost on health = Frozen Sub-Way Dweller; lost on sanity = Streetcar Casualty; wealth = Bay Street Executive; asset = Condo Conqueror; endurance with negative cash = Overdraft Legend; endurance with sanity >= 50 = Commuter Master; otherwise Tim's Coffee Survivor. Only three rank names came from the client's spec; the rest and the order are our proposals awaiting confirmation.

The end screen offers "Copy result" (clipboard API, with a textarea fallback and on-screen text if both fail) and "Save image" (generates a PNG and uses the share sheet where available). Wins show confetti; losses show the reason.

## UI behaviour
- The root wrapper has 2.5rem of bottom padding on top of the device safe area (folding devices).
- During a run, the browser back button or swipe-back returns to the menu (one history entry is pushed per run; `popstate` resets the run). "Quit run" does the same.
- Settings (sound, vibration, large text, calm motion, high contrast) are stored in LocalStorage and default calm motion from `prefers-reduced-motion`.

## Deploying
1. `npm ci && npm test && npm run build` produces `dist/`.
2. **Netlify:** connect the GitHub repo. `netlify.toml` sets build command `npm run build`, publish directory `dist`, and a `/* -> /index.html` rewrite (status 200) for the SPA. `netlify/functions/transit.ts` serves `/api/transit` through its own path config. Set `VITE_SPONSOR_URL` (and optionally `VITE_TRANSIT_URL`) in the site's environment variables before the first build. If the build needs a newer Node, set `NODE_VERSION` to 20 or later.
3. **Vercel:** import the repo (Vite preset). `vercel.json` rewrites everything except `/api/*` to the SPA, and `api/transit.ts` becomes `/api/transit`.
4. After deploying, open `/api/transit` (it should return JSON, not the game page) and refresh on a deep link to confirm the fallback works.
5. Offline: `public/sw.js` caches the app shell after the first visit. It skips `/api/` and cross-origin requests.

## Swapping in client content
Replace `src/data/characters.json` and `src/data/events.json` (same schema; `home_location` and `location` are optional extras we added for the map). Content is validated at startup with field-level error messages. Run `npm test`, which checks 5 events per act and plays each character through 30 days. Saves for a removed class are discarded automatically. If the content changes, also run `npm run balance`.

## Win/loss feasibility check
`npm run balance` runs an automated report (about 1 second) over the real content. For each class it tries every possible sequence of choices on 12 different games, plays 500 simulated games as a random and as a careful player, lists choices locked by missing items, and shows which victories are reachable and the most cash ever held. Options: `SEEDS=24 GAMES=2000 ENV=bad STRICT=1 npm run balance` (`ENV=bad` is a 45 minute TTC delay and -20 degrees C; `STRICT=1` exits with an error if any class cannot win).

## Known limits
- **Wealth and condo wins are unreachable** at the current stipends. Most cash ever held in the balance report: Commuter about $1,045, Intern about $2,125, Campus about $442, against a $10,000 target. The client confirmed surviving day 30 is the true victory for this build; the wealth and asset paths stay wired for a future income/asset-trading update.
- **Survival is possible for all three classes** (every-choice search wins 12 of 12 games). It is not easy for a random player: the Intern wins 1 of 500 random games but 474 of 500 careful ones; Commuter and Campus win about 70% and 67% of random games.
- Commuter and Campus cannot take Midterm Crunch choice A (no Surge Espresso). The other choice is always available.
- `BASE_DAILY_DRAIN` is 0 until the client supplies a base cost.
- Rank names beyond the three from the client's spec are unconfirmed.
