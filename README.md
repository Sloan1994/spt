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

The `index.html` here is built from the sources in the build folder (`src/*.js`, `style.css`, `premium.css`) and minified. Keep it under 170 KB.

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
