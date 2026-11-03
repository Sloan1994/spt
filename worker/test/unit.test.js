/* Node-only tests: runs the Worker's fetch handler in-process against the mock Whoop server with an in-memory KV. */
import worker, { normaliseDay, dublinDate } from '../src/worker.js';
import { startMock, buildData } from './mock-whoop.js';

let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
class KV { constructor() { this.m = new Map(); } async get(k) { const e = this.m.get(k); if (!e) return null; if (e.x && e.x < Date.now()) { this.m.delete(k); return null; } return e.v; }
  async put(k, v, o = {}) { this.m.set(k, { v, x: o.expirationTtl ? Date.now() + o.expirationTtl * 1000 : 0 }); } async delete(k) { this.m.delete(k); } }
const PORT = 8798, KEY = 'secret-key';
const ORIGIN = 'https://sloan1994.github.io';
const mkEnv = () => ({ TOKENS: new KV(), WHOOP_CLIENT_ID: 'cid', WHOOP_CLIENT_SECRET: 'csec', APP_SECRET: KEY, ALLOWED_ORIGIN: ORIGIN, WHOOP_API_BASE: 'http://localhost:' + PORT });
const call = (env, path, o = {}) => worker.fetch(new Request('https://spt-whoop.test' + path, { method: o.method || 'GET', headers: Object.assign({ Origin: ORIGIN }, o.headers || {}), redirect: 'manual' }), env, {});
const auth = { 'X-SPT-Key': KEY };

/* complete the OAuth dance through the mock */
async function connect(env, mock) {
  const link = await (await call(env, '/auth/link', { headers: auth })).json();
  const start = await call(env, link.url.replace('https://spt-whoop.test', ''));
  const loc = new URL(start.headers.get('Location'));
  const authRes = await fetch(loc, { redirect: 'manual' });                 // mock bounces back
  const cb = new URL(authRes.headers.get('Location'));
  const done = await call(env, cb.pathname + cb.search);
  return { link, start, loc, done };
}

/* ---- normaliser ---- */
{
  const data = buildData(5);
  const today = dublinDate(Date.now());
  const d = normaliseDay(today, data);
  ok(d.date === today && d.recovery && d.recovery.score === 58 && d.recovery.state === 'yellow', 'normaliser: recovery 58 -> yellow');
  ok(d.sleep && d.sleep.hours === 7 && d.sleep.stages.awake_h === 0.6 && d.sleep.debt_h === 0.4 && d.sleep.efficiency_pct === 91.4, 'normaliser: sleep hours/stages/debt (' + JSON.stringify(d.sleep && { h: d.sleep.hours, s: d.sleep.stages }) + ')');
  ok(d.strain.day_strain != null && d.strain.max_hr === 168 && Array.isArray(d.workouts) && d.workouts.length === 1 && d.workouts[0].sport, 'normaliser: strain + workouts mapped');
  const keys = ['date', 'recovery', 'sleep', 'strain', 'workouts'];
  ok(JSON.stringify(Object.keys(d)) === JSON.stringify(keys), 'normaliser: top-level shape');
  ok(JSON.stringify(Object.keys(d.recovery)) === '["score","hrv_ms","rhr_bpm","spo2","skin_temp_c","state"]' && JSON.stringify(Object.keys(d.sleep)) === '["start","end","hours","performance_pct","efficiency_pct","consistency_pct","respiratory_rate","stages","debt_h"]', 'normaliser: recovery/sleep key shape');
  const empty = normaliseDay('2000-01-01', data);
  ok(empty.recovery === null && empty.sleep === null && empty.strain.day_strain === null && empty.workouts.length === 0, 'normaliser: missing day -> nulls');
  const unscored = JSON.parse(JSON.stringify(data)); unscored.recoveries[0].score_state = 'PENDING_SCORE';
  ok(normaliseDay(today, unscored).recovery === null, 'normaliser: unscored recovery -> null');
  ok(dublinDate('2026-07-01T23:30:00Z') === '2026-07-02' && dublinDate('2026-12-01T23:30:00Z') === '2026-12-01', 'dublinDate handles BST and GMT');
  const nap = normaliseDay(dublinDate(Date.now() - 864e5), data);
  ok(nap.sleep.hours === 7, 'normaliser: nap ignored as main sleep');
}

/* ---- worker end to end ---- */
const { server, stats } = await startMock(PORT);
try {
  let env = mkEnv();
  let r = await call(env, '/api/today'); ok(r.status === 401, 'api without key -> 401');
  r = await call(env, '/api/today', { headers: { 'X-SPT-Key': 'nope' } }); ok(r.status === 401, 'api with wrong key -> 401');
  r = await call(env, '/api/status', { headers: auth }); let j = await r.json(); ok(j.connected === false, 'status: not connected initially');
  r = await call(env, '/api/today', { headers: auth }); j = await r.json(); ok(j.connected === false, 'today before connect -> {connected:false}');
  r = await call(env, '/auth/start'); ok(r.status === 401, '/auth/start without nonce refused');
  r = await call(env, '/api/today', { method: 'OPTIONS' }); ok(r.status === 204 && r.headers.get('Access-Control-Allow-Origin') === ORIGIN && /X-SPT-Key/.test(r.headers.get('Access-Control-Allow-Headers')), 'CORS preflight for allowed origin');
  r = await worker.fetch(new Request('https://spt-whoop.test/api/status', { headers: Object.assign({ Origin: 'http://localhost:8765' }, auth) }), env, {}); ok(r.headers.get('Access-Control-Allow-Origin') === 'http://localhost:8765', 'CORS allows http://localhost:*');
  r = await worker.fetch(new Request('https://spt-whoop.test/api/status', { headers: Object.assign({ Origin: 'https://evil.example' }, auth) }), env, {}); ok(!r.headers.get('Access-Control-Allow-Origin'), 'CORS refuses other origins');

  const c = await connect(env, stats);
  ok(c.start.status === 302 && c.loc.pathname === '/oauth/oauth2/auth' && c.loc.searchParams.get('scope') === 'read:recovery read:sleep read:cycles read:workout read:profile read:body_measurement offline' && c.loc.searchParams.get('response_type') === 'code' && c.loc.searchParams.get('redirect_uri') === 'https://spt-whoop.test/auth/callback' && c.loc.searchParams.get('state').length >= 8, 'auth/start redirects with scopes, redirect_uri, state>=8 chars');
  ok(c.done.status === 302 && c.done.headers.get('Location') === 'https://sloan1994.github.io/spt/?whoop=connected', 'callback stores tokens and redirects to app ?whoop=connected');
  ok(stats.token === 1 && stats.lastTokenBody.client_id === 'cid' && stats.lastTokenBody.client_secret === 'csec' && stats.lastTokenBody.grant_type === 'authorization_code', 'token exchange once, client_id/secret in body');
  const reuse = await call(env, '/auth/callback?code=code-1&state=' + c.loc.searchParams.get('state')); ok(/whoop=error/.test(reuse.headers.get('Location')), 'state is single-use');
  r = await call(env, '/api/status', { headers: auth }); j = await r.json(); ok(j.connected === true && j.since, 'status connected + since');

  r = await call(env, '/api/today', { headers: auth }); j = await r.json();
  ok(r.status === 200 && j.recovery && j.recovery.score === 58 && j.sleep.hours === 7 && j.strain.day_strain != null, '/api/today normalised JSON ' + JSON.stringify({ date: j.date, rec: j.recovery && j.recovery.score, sl: j.sleep && j.sleep.hours }));
  const dataBefore = stats.data;
  r = await call(env, '/api/today', { headers: auth }); ok(r.headers.get('X-SPT-Cache') === 'hit' && stats.data === dataBefore, 'second /api/today served from KV cache (no upstream calls)');
  const today = dublinDate(Date.now()), start = dublinDate(Date.now() - 29 * 864e5);
  r = await call(env, `/api/range?start=${start}&end=${today}`, { headers: auth }); j = await r.json();
  ok(j.days && j.days.length === 30 && j.days[29].date === today && j.days.every(d => d.recovery && d.recovery.score != null) , '/api/range 30 days, all with recovery (pagination across 25-record pages)');
  r = await call(env, `/api/range?start=${start}&end=2020-01-01`, { headers: auth }); ok(r.status === 400, 'range validation: end < start -> 400');
  r = await call(env, `/api/range?start=2026-01-01&end=2026-06-30`, { headers: auth }); ok(r.status === 400, 'range validation: > 45 days -> 400');

  /* token refresh near expiry + rotation */
  const t0 = JSON.parse(await env.TOKENS.get('whoop:tokens')); t0.expires_at = Date.now() + 60000; await env.TOKENS.put('whoop:tokens', JSON.stringify(t0));
  for (const k of [...env.TOKENS.m.keys()]) if (k.startsWith('cache:')) env.TOKENS.m.delete(k);
  const rf = stats.refresh; r = await call(env, '/api/today', { headers: auth }); j = await r.json();
  const t1 = JSON.parse(await env.TOKENS.get('whoop:tokens'));
  ok(stats.refresh === rf + 1 && t1.refresh_token === stats.lastRefreshToken && t1.refresh_token !== t0.refresh_token && j.recovery, 'auto-refresh within 5 min of expiry; rotated refresh token persisted');
  ok(stats.lastTokenBody.scope === 'offline' && stats.lastTokenBody.grant_type === 'refresh_token', 'refresh sends grant_type=refresh_token scope=offline');

  /* 401 mid-flight: one refresh then success */
  for (const k of [...env.TOKENS.m.keys()]) if (k.startsWith('cache:')) env.TOKENS.m.delete(k);
  stats.fail401 = 1; const rf2 = stats.refresh; r = await call(env, '/api/today', { headers: auth }); j = await r.json();
  ok(stats.refresh === rf2 + 1 && j.recovery, 'upstream 401 -> one refresh attempt -> success');
  /* persistent 401 and rejected refresh -> connected:false */
  for (const k of [...env.TOKENS.m.keys()]) if (k.startsWith('cache:')) env.TOKENS.m.delete(k);
  stats.fail401 = 99; stats.lastRefreshToken = 'something-else'; r = await call(env, '/api/today', { headers: auth }); j = await r.json();
  ok(j.connected === false, 'persistent 401 + rejected refresh -> {connected:false}');
  r = await call(env, '/api/status', { headers: auth }); j = await r.json(); ok(j.connected === false, 'dead tokens cleared');
  stats.fail401 = 0;

  /* 429 */
  env = mkEnv(); await connect(env, stats); stats.fail429 = 1;
  const t = Date.now(); r = await call(env, '/api/today', { headers: auth }); j = await r.json();
  ok(r.status === 200 && j.recovery && Date.now() - t >= 900, '429 with Retry-After:1 -> waits and retries');
  for (const k of [...env.TOKENS.m.keys()]) if (k.startsWith('cache:')) env.TOKENS.m.delete(k);
  stats.fail429 = 99; r = await call(env, '/api/today', { headers: auth }); j = await r.json();
  ok(r.status === 429 && r.headers.get('Retry-After') && j.error === 'rate_limited', 'sustained 429 -> 429 with Retry-After passed on'); stats.fail429 = 0;

  /* disconnect */
  r = await call(env, '/auth/disconnect', { method: 'POST' }); ok(r.status === 401, 'disconnect needs key');
  r = await call(env, '/auth/disconnect', { method: 'POST', headers: auth }); j = await r.json(); ok(j.connected === false && !(await env.TOKENS.get('whoop:tokens')), 'disconnect deletes tokens');
} finally { server.close(); }
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
