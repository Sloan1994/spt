# SPT v2

Personal training, recovery and nutrition log. One static PWA: `index.html` (all CSS and JS inline), `sw.js`, `manifest.json` and icons.
No build step, no dependencies. Data lives on the device in localStorage (`spt-v2`) and IndexedDB (`spt-v2-photos`).

Deploy: push to `main` in the GitHub repo `Sloan1994/spt`. Cloudflare Pages serves the repo root as static files.

Release: edit `index.html`, then bump `CACHE_VERSION` in `sw.js` (for example `v2.0.0-1` to `v2.0.1-1`) and `APP_VERSION` in `index.html`.
Installed apps pick up the new service worker, show "Update available" and reload on tap.

Barcode scanning lazy-loads zxing-wasm 3.1.6 from jsDelivr on first scan. Food data comes from Open Food Facts.
Back up from Plan > Data > Export everything. The old tracker's data (`training-app-v1`) is never modified.

## v2.2 features

Morning briefing, adherence ring and streaks, session recap with a shareable image, haptics and rest chime, previous-session ghost rows, smart swaps, lane-day logging, weekly review (copy for coach), exercise How sheets with inline video, a What's new sheet, and Google Drive backup. Sound and haptics switch off in Plan.

## v2.3 features

Training load and the acute:chronic ratio (ACWR) with Load and Readiness tiles on Today, accessory-set trim advice, HRV/load/soreness-guided deload proposals, grip test with asymmetry, per-game lane scores with performance correlations, travel mode (jet-lag plan, hotel-gym swaps), sleep regularity and a bedtime anchor, session timing from set timestamps, voice logging in the set pad, day-type nutrition targets with context-aware food verdicts, and Learn explainers in Plan. The briefing, recap and weekly review pick up the readiness band, bedtime anchor, session timing, ACWR and lane insights. See `CHANGELOG.md` for every version.

Test data: `localStorage['spt-whoop-mock']='1'` fills 30 days of sample Whoop data (add `spt-whoop-mock-ill`='1' to raise breathing rate, skin temperature and resting HR on the last two days, for the illness warning); `localStorage['spt-opt-mock']='1'` (scenario in `spt-opt-mock-scenario`: steady, caution, spike or hrv) fills 35 days of sample load, sleep, grip and lane data.

The `index.html` here is built from the sources in the build folder (`src/1-core.js` ... `src/9-optimise.js`, `style.css`, `premium.css`, `optimise.css`) and minified with esbuild. It is about 230 KB.

### Exercise videos

The How sheet embeds a privacy-enhanced YouTube player (`youtube-nocookie.com`, no autoplay, `playsinline`). `youtube-nocookie.com`, `ytimg.com` and `youtube.com` are network-only in the service worker and are never cached. Offline, or if the player does not report in within 6 seconds, the sheet shows the written cues and an Open in YouTube button.
Each exercise has an optional curated video ID in the `VID` map in `8-premium.js` (name to 11-character ID). Exercises without one show a YouTube search button. Paste any YouTube link in "Use a different video" to override it per exercise; "Reset to default" removes the override.

### Google Drive backup: one-time setup

Backups go to a Drive folder called `SPT Backups` as `spt-backup-YYYY-MM-DD.json`. The app only sees files it created itself (scope `https://www.googleapis.com/auth/drive.file`). Nothing is sent anywhere except Google, and the access token is kept in memory only.

1. Open the [Google Cloud console](https://console.cloud.google.com/), create a project (for example "SPT") and select it.
2. APIs & Services > Library > search for **Google Drive API** > Enable.
3. APIs & Services > OAuth consent screen (Google Auth platform > Branding): User type **External**, app name `SPT`, your email as support and developer contact. Under Data Access add the scope `.../auth/drive.file`. Under Audience, either add your own Google account as a **Test user** or publish the app. In Testing mode Google asks you to re-consent roughly every 7 days; publishing removes that.
4. APIs & Services > Credentials > **Create credentials > OAuth client ID**. Application type **Web application**, name `SPT web`.
5. Authorized JavaScript origins: `https://sloan1994.github.io` (add `http://localhost:8000` if you test locally). Leave Authorized redirect URIs empty; the token flow does not use one.
6. Copy the client ID (`123456789-abc123.apps.googleusercontent.com`). In SPT go to Plan > Backup to Google Drive, paste it, tap **Connect Google Drive** and approve the consent screen. Then tap **Back up now**.

Use: **Back up now** uploads today's file (a second backup on the same day updates it). **Restore from latest** downloads the newest file in `SPT Backups` and merges it into this device after you confirm. When connected, SPT backs up by itself on open if the last backup is more than 7 days old. Google may need a tap to renew access; SPT then shows a "Weekly Drive backup is due" toast with a Back up button. If you are offline nothing happens until the next open.

## Whoop (v2.1+)

SPT reads your Whoop recovery, sleep and strain through a small Cloudflare Worker that you deploy yourself. The Worker lives in `worker/` and is not served by Pages. The app never sees your Whoop client secret or tokens.

1. Deploy the Worker: follow `worker/README.md` (CLI path or dashboard-only path). In short: register an app at developer.whoop.com with the redirect URL `https://spt-whoop.<your-subdomain>.workers.dev/auth/callback`, create the `TOKENS` KV namespace, set the secrets `WHOOP_CLIENT_ID`, `WHOOP_CLIENT_SECRET` and `APP_SECRET` (`openssl rand -hex 24`), then `npx wrangler deploy`.
2. In SPT open Plan > Whoop, paste the Worker URL and the app key (the `APP_SECRET`), tap **Connect Whoop** and approve on Whoop's page. SPT syncs on open and when you pull down on Today (at most every 15 minutes).
3. Whoop data feeds the Today recovery card, the Train recovery chip and red-day load hold, the check-in prefill (sleep hours, resting HR), the Progress charts, and in v2.3 the readiness score, load model, lane correlations and sleep regularity. The app key is never included in exports or Drive backups.
