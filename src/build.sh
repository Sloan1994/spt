#!/bin/sh
# Builds out/index.html. Minifies (top-level names are kept so the console and tests can reach them) so the single file stays under 230 KB.
cd "$(dirname "$0")"
ESB=${ESBUILD:-/opt/npm-tools/node_modules/@esbuild/linux-x64/bin/esbuild}
min_js() { if [ -x "$ESB" ]; then "$ESB" --minify --charset=utf8; else echo "esbuild not found, shipping unminified" >&2; cat; fi; }
min_css() { if [ -x "$ESB" ]; then "$ESB" --loader=css --minify --charset=utf8; else cat; fi; }
{ cat head.html; echo '<style>'; cat style.css premium.css optimise.css | min_css; echo '</style></head><body>'
echo '<div id="app"><main id="screen"></main><div id="restbar" aria-live="polite"></div><nav id="nav" aria-label="Main"></nav><div id="sheets"></div><div id="toasts" aria-live="polite"></div></div>'
echo '<script>'; cat 1-core.js 2-data.js 3-today-plan.js 4-train.js 5-log.js 6-progress.js 6b-whoop.js 7-boot.js 8-premium.js 9-optimise.js | min_js; echo '</script></body></html>'; } > ../index.html
wc -c ../index.html
