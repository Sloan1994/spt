# SPT Whoop Worker

A small Cloudflare Worker that sits between the SPT app and the Whoop API. It holds your Whoop OAuth tokens (in Workers KV), refreshes them, and returns one compact JSON summary per day. The app never sees your Whoop client secret or tokens.

```
SPT (GitHub Pages)  --X-SPT-Key-->  Worker  --Bearer token-->  api.prod.whoop.com
```

## Endpoints

| Route | Auth | What it does |
|---|---|---|
| `GET /auth/link` | `X-SPT-Key` | Returns `{url}`: a one-time (5 min) link to `/auth/start`. The app navigates to it. |
| `GET /auth/start?n=...` | one-time nonce | 302 to Whoop's authorize page (scopes, state stored in KV for 5 min). |
| `GET /auth/callback` | Whoop `state` | Exchanges the code, stores tokens, 302 to `https://sloan1994.github.io/spt/?whoop=connected`. |
| `POST /auth/disconnect` | `X-SPT-Key` | Deletes the stored tokens. |
| `GET /api/status` | `X-SPT-Key` | `{connected, since}` |
| `GET /api/today` | `X-SPT-Key` | Normalised summary for today (Europe/Dublin). |
| `GET /api/range?start=YYYY-MM-DD&end=YYYY-MM-DD` | `X-SPT-Key` | `{days:[...]}`, max 45 days. |

If the Whoop tokens are dead, `/api/*` returns `{"connected":false}` (HTTP 200). On sustained Whoop rate limiting it returns 429 with `Retry-After`.

Day shape:

```json
{ "date": "2026-11-03",
  "recovery": { "score": 58, "hrv_ms": 59.4, "rhr_bpm": 52, "spo2": 96.5, "skin_temp_c": 33.4, "state": "yellow" },
  "sleep": { "start": "...", "end": "...", "hours": 7, "performance_pct": 93, "efficiency_pct": 91.4, "consistency_pct": 81,
             "respiratory_rate": 15.2, "stages": { "light_h": 3.5, "sws_h": 1.6, "rem_h": 1.9, "awake_h": 0.6 }, "debt_h": 0.4 },
  "strain": { "day_strain": 10.3, "kilojoules": 8440, "avg_hr": 66, "max_hr": 168 },
  "workouts": [ { "sport": "weightlifting", "start": "...", "strain": 9.4, "avg_hr": 128 } ] }
```

A day is keyed by the Europe/Dublin date the main (non-nap) sleep ended, which is the morning that day's recovery is produced. `strain` is the Whoop cycle that starts with that sleep, so on today's date it is "strain so far". The previous date's strain is the finished day. Anything Whoop has not scored is `null`.

## Deploy (CLI path, about 10 minutes)

1. Create the Whoop app (see step 1 in the morning checklist below). You need the Worker URL for the redirect URL, which is `https://spt-whoop.<your-subdomain>.workers.dev`. Your subdomain is shown after the first `wrangler deploy`, or under Workers & Pages in the Cloudflare dashboard. You can deploy once first, then register the app.
2. From this folder:
   ```
   npx wrangler login
   npx wrangler kv namespace create TOKENS
   ```
   Paste the printed `id` into `wrangler.toml` (replace `REPLACE_WITH_KV_NAMESPACE_ID`).
3. Generate the app key (this is the value you will also type into SPT):
   ```
   openssl rand -hex 24
   ```
4. Set the three secrets (each command prompts for the value):
   ```
   npx wrangler secret put WHOOP_CLIENT_ID
   npx wrangler secret put WHOOP_CLIENT_SECRET
   npx wrangler secret put APP_SECRET
   ```
5. `npx wrangler deploy`
6. Open SPT, Plan tab, Whoop card: enter the Worker URL and app key, tap **Connect Whoop**, approve on Whoop's page.

## Deploy (dashboard-only path, no CLI)

1. Cloudflare dashboard, Workers & Pages, Create, Create Worker, name it `spt-whoop`, Deploy, then Edit code.
2. Replace the code with the contents of `src/worker.js` and Deploy.
3. Storage & Databases, KV, Create a namespace named `TOKENS`.
4. Worker, Settings, Bindings, Add, KV namespace: variable name `TOKENS`, pick the namespace.
5. Settings, Variables and Secrets: add plaintext `ALLOWED_ORIGIN` = `https://sloan1994.github.io`, and Secrets `WHOOP_CLIENT_ID`, `WHOOP_CLIENT_SECRET`, `APP_SECRET`.
6. Deploy again, then use the Worker URL in SPT as above.

## Tests

- `npm test` (or `node test/unit.test.js`): runs the Worker in-process with an in-memory KV against `test/mock-whoop.js`. Covers the normaliser, the full OAuth flow, token rotation and refresh near expiry, 401 retry, 429 handling, caching, CORS, key checks, disconnect.
- `./test/run.sh`: runs the real Worker runtime (`wrangler dev --local`) pointed at the mock through the `WHOOP_API_BASE` var, completes the OAuth dance with curl and checks the `/api/today` shape. Set `WRANGLER=/path/to/wrangler` to use a local install.

## Verify against the live docs

The Whoop developer site was not reachable from the build sandbox, so these details come from prior knowledge of the v2 API and are covered only by the mock. Check them at https://developer.whoop.com/docs/developing/oauth and https://developer.whoop.com/api before relying on them:

- Authorize `https://api.prod.whoop.com/oauth/oauth2/auth`, token `https://api.prod.whoop.com/oauth/oauth2/token`, credentials sent in the POST body (client_secret_post).
- Scopes: `read:recovery read:sleep read:cycles read:workout read:profile read:body_measurement offline`. `offline` is what yields a refresh token.
- `state` must be at least 8 characters (the Worker sends 24 hex).
- Data endpoints under `https://api.prod.whoop.com/developer/v2/`: `recovery`, `activity/sleep`, `cycle`, `activity/workout`; query `start`, `end` (ISO 8601), `limit` (max 25), `nextToken`; response `{records, next_token}`.
- Field names: recovery `score.{recovery_score,resting_heart_rate,hrv_rmssd_milli,spo2_percentage,skin_temp_celsius}`, `sleep_id`, `cycle_id`; sleep `nap`, `score.{stage_summary.*_milli, sleep_needed.need_from_sleep_debt_milli, respiratory_rate, sleep_performance_percentage, sleep_consistency_percentage, sleep_efficiency_percentage}`; cycle `score.{strain,kilojoule,average_heart_rate,max_heart_rate}`; workout `sport_name`, `score.{strain,average_heart_rate}`.
- Whoop's app-registration page may require the redirect URL to be exact and may limit apps to a small number of users until approved. Personal use with your own account normally works in the development state.

If a field name differs, the mapping to change is in `normaliseDay()` in `src/worker.js`; the unit tests will show what breaks.

## Security notes

- Every `/api/*` and `/auth/disconnect` call needs `X-SPT-Key`. `/auth/start` cannot send headers (it is a browser navigation), so the app first fetches a one-time link from `/auth/link` with the header. The key itself never appears in a URL.
- The key is stored in the app's local settings on your phone. Rotate it with `wrangler secret put APP_SECRET`.
- CORS allows only `https://sloan1994.github.io` and `http://localhost:*`.
