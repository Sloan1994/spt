# SPT v2

Personal training, recovery and nutrition log. One static PWA: `index.html` (all CSS and JS inline), `sw.js`, `manifest.json` and icons.
No build step, no dependencies. Data lives on the device in localStorage (`spt-v2`) and IndexedDB (`spt-v2-photos`).

Deploy: push to `main` in the GitHub repo `Sloan1994/spt`. Cloudflare Pages serves the repo root as static files.

Release: edit `index.html`, then bump `CACHE_VERSION` in `sw.js` (for example `v2.0.0-1` to `v2.0.1-1`) and `APP_VERSION` in `index.html`.
Installed apps pick up the new service worker, show "Update available" and reload on tap.

Barcode scanning lazy-loads zxing-wasm 3.1.6 from jsDelivr on first scan. Food data comes from Open Food Facts.
Back up from Plan > Data > Export everything. The old tracker's data (`training-app-v1`) is never modified.
