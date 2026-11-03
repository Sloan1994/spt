#!/usr/bin/env bash
# End-to-end check: real Worker runtime (wrangler dev --local / workerd) against the mock Whoop server.
# Needs Node 18+ and network for `npx wrangler` on first run. Usage: ./test/run.sh
set -euo pipefail
cd "$(dirname "$0")/.."
WR="${WRANGLER:-npx --yes wrangler@4}"
MOCK_PORT=8799; W_PORT=8787; KEY=test-app-key
TMP=$(mktemp -d); trap 'kill $MOCK_PID $W_PID 2>/dev/null || true; rm -f .dev.vars; rm -rf "$TMP"' EXIT
node test/mock-whoop.js $MOCK_PORT & MOCK_PID=$!
printf 'WHOOP_CLIENT_ID=cid\nWHOOP_CLIENT_SECRET=csec\nAPP_SECRET=%s\n' "$KEY" > .dev.vars
$WR dev --local --port $W_PORT --var WHOOP_API_BASE:http://localhost:$MOCK_PORT --persist-to "$TMP/state" >"$TMP/wrangler.log" 2>&1 & W_PID=$!
for i in $(seq 1 60); do curl -fs localhost:$W_PORT/ >/dev/null 2>&1 && break; sleep 1; done
curl -fs localhost:$W_PORT/ >/dev/null || { echo "wrangler did not start"; cat "$TMP/wrangler.log"; exit 1; }
echo "-- status before connect:"; curl -s -H "X-SPT-Key: $KEY" localhost:$W_PORT/api/status; echo
LINK=$(curl -s -H "X-SPT-Key: $KEY" localhost:$W_PORT/auth/link | node -pe 'JSON.parse(require("fs").readFileSync(0)).url')
AUTH=$(curl -s -o /dev/null -w '%{redirect_url}' "$LINK")                 # Worker -> Whoop (mock) authorize URL
CB=$(curl -s -o /dev/null -w '%{redirect_url}' "$AUTH")                   # mock approves -> Worker callback URL
APPURL=$(curl -s -o /dev/null -w '%{redirect_url}' "$CB")                 # Worker stores tokens -> app URL
echo "-- callback redirected to: $APPURL"; [[ "$APPURL" == *"?whoop=connected" ]] || { echo FAIL callback; exit 1; }
OUT=$(curl -s -H "X-SPT-Key: $KEY" localhost:$W_PORT/api/today); echo "-- /api/today:"; echo "$OUT"
echo "$OUT" | node -e '
const j=JSON.parse(require("fs").readFileSync(0));
const need=(c,m)=>{if(!c){console.error("FAIL "+m);process.exit(1)}};
need(/^\d{4}-\d\d-\d\d$/.test(j.date),"date");
need(j.recovery&&typeof j.recovery.score==="number"&&["green","yellow","red"].includes(j.recovery.state),"recovery");
for (const k of ["hrv_ms","rhr_bpm","spo2","skin_temp_c"]) need(k in j.recovery,"recovery."+k);
for (const k of ["start","end","hours","performance_pct","efficiency_pct","consistency_pct","respiratory_rate","stages","debt_h"]) need(k in j.sleep,"sleep."+k);
for (const k of ["light_h","sws_h","rem_h","awake_h"]) need(k in j.sleep.stages,"stages."+k);
for (const k of ["day_strain","kilojoules","avg_hr","max_hr"]) need(k in j.strain,"strain."+k);
need(Array.isArray(j.workouts),"workouts");
console.log("PASS normalised shape ok")'
curl -s -o /dev/null -w "-- no key -> %{http_code}\n" localhost:$W_PORT/api/today
echo ALL PASSED
