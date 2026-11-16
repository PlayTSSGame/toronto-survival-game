# Toronto Survival Simulator

Client-side React + Vite + TypeScript game. Thirty fixed turns (days), LocalStorage persistence, static hosting plus one small serverless endpoint for TTC data..

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
| `VITE_SPONSOR_URL` | Footer "Sponsor this game" link | `https://google.com` |
| `VITE_REPORT_EMAIL` | Footer "Report issue" mailto address | `playtssgame@gmail.com` |
| `VITE_TRANSIT_URL` | Override the TTC endpoint (optional) | same-origin `/api/transit` |
| `STATS_PASSWORD` | Password for the private `/stats` page (set in Netlify only, not a `VITE_` value) | none: `/stats` shows a setup message |

## Layout
- `src/engine/` pure game logic, no UI imports: `validate` (content parsing), `game` (turn engine, endings), `environment` (weather/TTC modifiers), `live` (feed fetching and caching), `persistence`, `rank` (ranks and share text), `rng`
- `src/data/` `characters.json` and `events.json`, the client's content (61 events and 8 classes), `sponsors.json` (paid sponsors for the scrolling banner)
- `src/ui/` React hook (`useGame`), art, effects, settings, sound, share image
- `src/App.tsx` the single-page view; `src/App.css` styles
- `server/transit.ts` TTC proxy logic, exposed by `netlify/functions/transit.ts` (Netlify) and `api/transit.ts` (Vercel)
- `public/sw.js` offline app-shell service worker (registered in production builds only)
- `scripts/balance.check.ts` the balance report

## How a run works
- 60 days in 6 acts of 10 days. Each day draws one event that has unlocked (`min_turn`). **No scenario repeats within 20 plays** (`recentScenarioIds` on the game state). Events not yet seen come first; the cooldown only relaxes (to 5) if too few events are eligible. Class-specific scenarios (`class_ids`) are drawn 60% of the time while one is off cooldown, otherwise a general one. Everything is seeded, so a save replays the same way.
- **Shock events** (`"shock": true`) replace the normal draw every 4 or 5 days, starting day 4. They show a 10-second countdown; when it runs out the `timeout_choice` (default choice B) is taken. Players can turn the countdown off in Settings.
- **Coin-flip choices** (`gamble`): a 50/50 flip between a win and a lose outcome, seeded by run, day and scenario so reloading cannot re-roll it. Every class meets some; the Luxury Dater's trait changes their payouts.
- **Rent** is charged at the end of day 15 ($350), 30 ($400), 45 ($450), 60 ($450) and every 15th day in endless mode ($450), after the daily stipend. The HUD shows the next bill.
- **Escalation:** days 21-40 hit sanity/health choices 25% harder, days 41-60 hit cash costs 30% harder (that rate carries into endless mode), and every 10 endless days add 10% to both. Coin flips pay their listed numbers and are not scaled.
- Cash, sanity or health below 25 pulses red.
- **Endless mode:** after surviving day 60 the win screen offers "Keep Surviving (Endless Mode)". The run continues with no day cap (act 6 events keep recycling) until sanity or health hits 0. Best days survived and peak cash are kept in the browser (`tss.best.v1`) and shown on the end screen.
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
| Newcomer / International Student | $120 / 70 / 85 | $25 | Presto Card, Meal Plan Voucher | none |
| Downtown Gig & Uber Courier | $60 / 60 / 75 | $45 | Courier Bag, Meal Plan Voucher | none |
| North York Startup Hustler | $180 / 55 / 80 | $50 | Pitch Deck, Meal Plan Voucher | none |

| King West Nightlife Promoter | $120 / 65 / 70 | $45 | VIP Guestlist Clipboard, Double Espresso Shot | every 6th and 7th day: +$65, -10 sanity, -8 health |
| High-Stakes Luxury Dater & Side-Hustler | $180 / 60 / 75 | $35 | Designer Clutch, Limited-Edition Sneaker Pass | coin-flip cash wins x1.5; a failed flip costs an extra 15 sanity |

The first three are the client's original classes. Classes 4-6 have starting stats and stipends from the client; their items, home locations and (neutral) modifiers are our defaults. Classes 7 and 8 have stats, bags and traits from the client (v1.2); their stipends, home locations and neutral modifiers are ours. Neither bag has a Meal Plan Voucher, so they cannot take that choice.

Two choices need items: Midterm Crunch (A) needs a Surge Espresso (only the Intern starts with one) and a Meal Plan Voucher choice needs a voucher (every class starts with one).

## Live data
- **Weather:** Environment Canada MSC GeoMet `swob-realtime`, station TORONTO CITY, called from the browser (CORS `*`). Uses `air_temp` and `pcpn_amt_pst1hr` (1-hour precipitation, mm) from the newest observation less than 3 hours old.
- **TTC:** `alerts.ttc.ca` sends no CORS headers and has no delay-minutes field, so `/api/transit` (`server/transit.ts`) derives minutes from active, unplanned subway and streetcar delay alerts: Critical 30, Major 20, Minor 10, other 5 minutes; the largest value plus 5 per additional alert; capped at 45. **This mapping is approved by the client.** Planned maintenance alerts are ignored. The endpoint also runs in `npm run dev` and `npm run preview`.
- **Resilience:** 1,200 ms abort per request, payload validation, 5 minute fresh cache, up to 1 hour stale cache, then a neutral offline fallback. Play never waits on the network; choices use the latest snapshot. Diagnostics are `console.debug` in dev only. The HUD shows a live / saved / offline marker per feed.
- **Formulas** (`src/engine/environment.ts`): TTC modifier is `1 + minutes/60` when the delay is above 15 minutes, otherwise 1. Weather modifier is `1 + |temp|/20` below 0 degrees C, or 1.25 above 5 mm of precipitation; the larger wins if both apply.

## Endings
Evaluated when day 60 completes with sanity and health above 0 (`src/engine/game.ts`):
- **Wealth:** cash >= $10,000, day >= 50, and at least 80% of the catalog's distinct events seen (events can repeat in a 60-day run, so "every event" no longer applies).
- **Asset (condo):** cash >= $10,000 x (1 + (TTC modifier - 1) + (weather modifier - 1)), using the latest environment snapshot.
- **Endurance:** reach the end of day 60 alive. This is the ending players actually get.
- Highest wins: wealth, then asset, then endurance.

### Ranks and sharing (`src/engine/rank.ts`)
First match wins: any endless-mode run = Endless Legend; lost on health = Frozen Sub-Way Dweller; lost on sanity = Streetcar Casualty; wealth = Bay Street Executive; asset = Condo Conqueror; endurance with negative cash = Overdraft Legend; endurance with sanity >= 50 = Commuter Master; otherwise Tim's Coffee Survivor. Only three rank names came from the client's spec; the rest and the order are our proposals awaiting confirmation.

The end screen offers "Copy result" (clipboard API, with a textarea fallback and on-screen text if both fail) and "Save image" (generates a PNG and uses the share sheet where available). Wins show confetti; losses show the reason.

## UI behaviour
- The root wrapper has 2.5rem of bottom padding on top of the device safe area (folding devices).
- During a run, the browser back button or swipe-back returns to the menu (one history entry is pushed per run; `popstate` resets the run). "Quit run" does the same.
- A scrolling sponsor banner sits at the top of every screen. It shows the placeholder line until `src/data/sponsors.json` has entries (`name`, `text`, optional `url`); it pauses on hover and stands still with Calm motion or reduced motion.
- Settings (sound, vibration, large text, calm motion, high contrast, shock countdown) are stored in LocalStorage and default calm motion from `prefers-reduced-motion`.

## Deploying
1. `npm ci && npm test && npm run build` produces `dist/`.
2. **Netlify:** connect the GitHub repo. `netlify.toml` sets build command `npm run build`, publish directory `dist`, and a `/* -> /index.html` rewrite (status 200) for the SPA. `netlify/functions/transit.ts` serves `/api/transit` through its own path config. Set `VITE_SPONSOR_URL` and `VITE_REPORT_EMAIL` (and optionally `VITE_TRANSIT_URL`) in the site's environment variables before the first build. If the build needs a newer Node, set `NODE_VERSION` to 20 or later.
3. **Vercel:** import the repo (Vite preset). `vercel.json` rewrites everything except `/api/*` to the SPA, and `api/transit.ts` becomes `/api/transit`.
4. After deploying, open `/api/transit` (it should return JSON, not the game page) and refresh on a deep link to confirm the fallback works.
5. Offline: `public/sw.js` caches the app shell after the first visit. It skips `/api/`, `/stats` and cross-origin requests.
6. **Live stats:** `netlify/functions/track.ts` (`POST /api/track`) stores anonymous daily counters in Netlify Blobs: visits (one per browser session), runs started by class, finishes and wins, endless entries and sponsor clicks, each tagged with the visitor's `?ref=` code (kept from the first visit; `a-z`, `0-9`, `-`, `_`, up to 32 characters). No cookies, IPs or personal data. Set `STATS_PASSWORD` in Netlify (use 16+ characters) and redeploy, then open **`https://<your-site>/stats`**: a one-field password page (no username) sets a 30-day login cookie. Add `?days=7` for a range or `?format=json` for raw data. Campus creators get links like `https://playtss.com/?ref=tmu-jane`. Under `npm run dev` / `npm run preview` the same endpoints run in memory (password `local`, or `STATS_PASSWORD`; counting under `dev` needs `VITE_TRACK_IN_DEV=1`).

## Swapping in client content
Replace `src/data/characters.json` and `src/data/events.json` (same schema; `home_location` and `location` are optional extras we added for the map). Content is validated at startup with field-level error messages. Run `npm test`, which checks the event counts and plays each character through 60 days. Saves for a removed class are discarded automatically. If the content changes, also run `npm run balance`.

## Win/loss feasibility check
`npm run balance` runs an automated report (about 10 seconds) over the real content. For each class it searches choice sequences on 12 different games (bounded by `NODES`, since 60 days is too many paths to list), plays 500 simulated games as a random, a careful and a cash-first player, lists choices locked by missing items, and shows which victories are reachable and the most cash ever held. Options: `SEEDS=24 GAMES=2000 NODES=200000 ENV=bad STRICT=1 npm run balance` (`ENV=bad` is a 45 minute TTC delay and -20 degrees C; `STRICT=1` exits with an error if any class cannot win).

## Known limits
- **Wealth and condo wins are unreachable** at the current stipends. Peak cash seen in the balance report is about $5,000 (Luxury Dater) and under $2,500 for most classes, against a $10,000 target, so endurance (surviving day 60) is the only ending players actually get. The wealth and asset paths stay wired for a future income/asset-trading update.
- **Difficulty (balance report, 3 seeds x 400 games):** a careful player (always takes the best sanity + health) wins roughly 10% (Promoter), 13% (Commuter), 29% (Newcomer), 48% (Courier), 62% (Intern), 69% (Hustler), 80% (Campus) and 93% (Dater) of runs. A random player wins about 0-19%. Real players cannot see the numbers before choosing, so real win rates are lower than the careful figures. The Commuter, Newcomer and especially the Promoter are very hard; the Dater is easy because its own scenarios mostly restore sanity/health. Rent, the +25%/+30% escalation, shock events and the Promoter's payday costs are what make 60 days hard. A bounded search finds a surviving path for every class, so all can win. Easing it means adding recovery scenarios or raising stipends; none have been added beyond the client's lists (the stipends for classes 7-8 are ours).
- The analytics counters on Netlify Blobs are approximate under heavy bursts (each day is split over 4 shards with retries). Anyone could send fake hits to `/api/track`; the numbers are for guidance, not billing.
- Only the Intern can take Midterm Crunch choice A (needs a Surge Espresso). The other choice is always available.
- `BASE_DAILY_DRAIN` is 0 until the client supplies a base cost.
- Rank names beyond the three from the client's spec are unconfirmed.
