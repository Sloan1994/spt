/* SPT Whoop proxy: Cloudflare Worker (module syntax, no dependencies).
 * Holds the Whoop OAuth tokens in KV and serves a compact, normalised daily summary to the SPT PWA.
 * Whoop API v2. Endpoint paths and field names were written from knowledge of the v2 API and must be
 * re-checked against https://developer.whoop.com/api (see README "Verify against the live docs"). */

const DEFAULT_BASE = 'https://api.prod.whoop.com';
const TZ = 'Europe/Dublin';
const SCOPES = 'read:recovery read:sleep read:cycles read:workout read:profile read:body_measurement offline';
const APP_HOME = 'https://sloan1994.github.io/spt/';
const TOKEN_KEY = 'whoop:tokens';
const REFRESH_MARGIN_MS = 5 * 60 * 1000;
const CACHE_TTL_S = 15 * 60;
const MAX_RANGE_DAYS = 45;
const H_MS = 3600000;

/* ---------- small helpers ---------- */
const base = env => (env.WHOOP_API_BASE || DEFAULT_BASE).replace(/\/+$/, '');
const workerOrigin = (env, url) => (env.WORKER_ORIGIN || url.origin).replace(/\/+$/, '');
const appHome = env => env.APP_HOME || APP_HOME;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const r1 = n => (n == null || isNaN(n)) ? null : Math.round(n * 10) / 10;
const r2 = n => (n == null || isNaN(n)) ? null : Math.round(n * 100) / 100;
const hrs = ms => (ms == null || isNaN(ms)) ? null : r2(ms / H_MS);
const nn = v => (v == null || (typeof v === 'number' && isNaN(v))) ? null : v;

function safeEqual(a, b) {
  a = String(a || ''); b = String(b || '');
  let d = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
}
function randomToken(bytes = 24) {
  const a = new Uint8Array(bytes); crypto.getRandomValues(a);
  return [...a].map(x => x.toString(16).padStart(2, '0')).join('');
}

/* ---------- dates (Europe/Dublin) ---------- */
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
export function dublinDate(t) { const d = new Date(t); return isNaN(d) ? null : dayFmt.format(d); }  // en-CA => YYYY-MM-DD
function addDaysISO(s, n) { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); }
const validDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !isNaN(Date.parse(s + 'T00:00:00Z'));
const daysBetween = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5);

/* ---------- normaliser (pure, unit-tested) ----------
 * A Whoop "day" is keyed by the Europe/Dublin date on which the main (non-nap) sleep ENDED, i.e. the morning the recovery
 * is produced. Recovery and cycle are linked through that sleep (sleep_id / cycle_id). strain.* is the cycle that starts
 * with that sleep, so on date D it is "strain so far today", and D-1's strain is the finished previous day. */
export function normaliseDay(date, raw) {
  const sleeps = (raw.sleeps || []).filter(s => s && !s.nap && s.end && dublinDate(s.end) === date);
  const sl = sleeps.sort((a, b) => ((b.score && b.score.stage_summary ? stageTotal(b.score.stage_summary) : 0) - (a.score && a.score.stage_summary ? stageTotal(a.score.stage_summary) : 0)))[0] || null;
  const recs = raw.recoveries || [], cycles = raw.cycles || [];
  let rec = sl ? recs.find(r => String(r.sleep_id) === String(sl.id)) : null;
  if (!rec && sl) rec = recs.find(r => r.cycle_id != null && String(r.cycle_id) === String(sl.cycle_id));
  const cyc = cycles.find(c => (rec && String(c.id) === String(rec.cycle_id)) || (sl && String(c.id) === String(sl.cycle_id))) || null;

  const rs = rec && rec.score_state === 'SCORED' && rec.score ? rec.score : null;
  const recovery = rs ? {
    score: nn(rs.recovery_score), hrv_ms: r1(rs.hrv_rmssd_milli), rhr_bpm: nn(rs.resting_heart_rate),
    spo2: r1(rs.spo2_percentage), skin_temp_c: r1(rs.skin_temp_celsius),
    state: rs.recovery_score == null ? null : rs.recovery_score >= 67 ? 'green' : rs.recovery_score >= 34 ? 'yellow' : 'red'
  } : null;

  const ss = sl && sl.score_state === 'SCORED' && sl.score ? sl.score : null;
  let sleepOut = null;
  if (sl) {
    const st = ss && ss.stage_summary || null;
    const asleep = st ? stageTotal(st) : null;
    sleepOut = {
      start: sl.start || null, end: sl.end || null, hours: hrs(asleep),
      performance_pct: ss ? nn(ss.sleep_performance_percentage) : null,
      efficiency_pct: ss ? r1(ss.sleep_efficiency_percentage) : null,
      consistency_pct: ss ? nn(ss.sleep_consistency_percentage) : null,
      respiratory_rate: ss ? r1(ss.respiratory_rate) : null,
      stages: st ? { light_h: hrs(st.total_light_sleep_time_milli), sws_h: hrs(st.total_slow_wave_sleep_time_milli), rem_h: hrs(st.total_rem_sleep_time_milli), awake_h: hrs(st.total_awake_time_milli) } : { light_h: null, sws_h: null, rem_h: null, awake_h: null },
      debt_h: ss && ss.sleep_needed ? hrs(ss.sleep_needed.need_from_sleep_debt_milli) : null
    };
  }

  const cs = cyc && cyc.score_state === 'SCORED' && cyc.score ? cyc.score : null;
  const strain = cs ? { day_strain: r1(cs.strain), kilojoules: r1(cs.kilojoule), avg_hr: nn(cs.average_heart_rate), max_hr: nn(cs.max_heart_rate) }
    : { day_strain: null, kilojoules: null, avg_hr: null, max_hr: null };

  const workouts = (raw.workouts || []).filter(w => w && w.start && dublinDate(w.start) === date).sort((a, b) => a.start < b.start ? -1 : 1).map(w => ({
    sport: w.sport_name || null, start: w.start, strain: w.score_state === 'SCORED' && w.score ? r1(w.score.strain) : null,
    avg_hr: w.score_state === 'SCORED' && w.score ? nn(w.score.average_heart_rate) : null
  }));

  return { date, recovery, sleep: sleepOut, strain, workouts };
}
function stageTotal(st) { return (st.total_light_sleep_time_milli || 0) + (st.total_slow_wave_sleep_time_milli || 0) + (st.total_rem_sleep_time_milli || 0); }
export function normaliseRange(start, end, raw) {
  const out = []; for (let d = start; d <= end; d = addDaysISO(d, 1)) out.push(normaliseDay(d, raw));
  return out;
}

/* ---------- CORS / responses ---------- */
function corsHeaders(req, env) {
  const o = req.headers.get('Origin'), h = { 'Vary': 'Origin' };
  if (o && (o === env.ALLOWED_ORIGIN || /^http:\/\/localhost(:\d+)?$/.test(o))) {
    h['Access-Control-Allow-Origin'] = o;
    h['Access-Control-Allow-Headers'] = 'X-SPT-Key, Content-Type';
    h['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    h['Access-Control-Max-Age'] = '86400';
  }
  return h;
}
function json(req, env, body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), { status, headers: Object.assign({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, corsHeaders(req, env), extra) });
}
const authed = (req, env) => !!env.APP_SECRET && safeEqual(req.headers.get('X-SPT-Key'), env.APP_SECRET);

/* ---------- tokens ---------- */
class AuthError extends Error { }
class RateLimit extends Error { constructor(s) { super('rate limited'); this.retryAfter = s; } }
async function readTokens(env) { try { return JSON.parse(await env.TOKENS.get(TOKEN_KEY)); } catch (e) { return null; } }
async function tokenRequest(env, params) {
  const body = new URLSearchParams(Object.assign({ client_id: env.WHOOP_CLIENT_ID, client_secret: env.WHOOP_CLIENT_SECRET }, params));
  const r = await fetch(base(env) + '/oauth/oauth2/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' }, body });
  const txt = await r.text(); let j = null; try { j = JSON.parse(txt); } catch (e) { }
  return { ok: r.ok, status: r.status, j };
}
async function saveTokenResponse(env, j, prev) {
  const t = {
    access_token: j.access_token,
    refresh_token: j.refresh_token || (prev && prev.refresh_token) || null,   // Whoop rotates: always persist the newest
    expires_at: Date.now() + (Number(j.expires_in) || 3600) * 1000,
    since: (prev && prev.since) || new Date().toISOString()
  };
  await env.TOKENS.put(TOKEN_KEY, JSON.stringify(t));
  return t;
}
let refreshing = null;   // dedupe concurrent refreshes within one isolate (rotation makes a double refresh fatal)
async function refreshTokens(env, tokens) {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      if (!tokens || !tokens.refresh_token) throw new AuthError('no refresh token');
      const r = await tokenRequest(env, { grant_type: 'refresh_token', refresh_token: tokens.refresh_token, scope: 'offline' });
      if (r.ok && r.j && r.j.access_token) return await saveTokenResponse(env, r.j, tokens);
      if (r.status === 400 || r.status === 401) { await env.TOKENS.delete(TOKEN_KEY); throw new AuthError('refresh rejected'); }
      throw new Error('token endpoint ' + r.status);
    } finally { refreshing = null; }
  })();
  return refreshing;
}
async function validTokens(env) {
  let t = await readTokens(env);
  if (!t || !t.access_token) throw new AuthError('not connected');
  if (t.expires_at - Date.now() < REFRESH_MARGIN_MS) t = await refreshTokens(env, t);
  return t;
}

/* ---------- Whoop API ---------- */
async function whoopGet(env, path, params, tokens, retried = false, waited = false) {
  const u = new URL(base(env) + path); Object.entries(params || {}).forEach(([k, v]) => v != null && u.searchParams.set(k, v));
  const r = await fetch(u, { headers: { Authorization: 'Bearer ' + tokens.access_token, Accept: 'application/json' } });
  if (r.status === 401) {
    if (retried) { throw new AuthError('unauthorised after refresh'); }
    const t = await refreshTokens(env, tokens); return whoopGet(env, path, params, t, true, waited);
  }
  if (r.status === 429) {
    const ra = Math.max(1, Number(r.headers.get('Retry-After')) || 1);
    if (!waited && ra <= 3) { await sleep(ra * 1000); return whoopGet(env, path, params, tokens, retried, true); }
    throw new RateLimit(ra);
  }
  if (!r.ok) throw new Error(`Whoop ${path} ${r.status}`);
  return r.json();
}
async function whoopAll(env, path, params, tokens) {
  const out = []; let next = null;
  for (let i = 0; i < 8; i++) {   // 8 pages x 25 = 200 records, ample for 45 days
    const j = await whoopGet(env, path, Object.assign({ limit: 25 }, params, next ? { nextToken: next } : {}), tokens);
    out.push(...(j.records || [])); next = j.next_token; if (!next) break;
  }
  return out;
}
async function loadRaw(env, start, end) {
  /* pad a day each side: sleep can start the evening before, workouts are filtered by Dublin date afterwards */
  const p = { start: addDaysISO(start, -1) + 'T00:00:00.000Z', end: addDaysISO(end, 2) + 'T00:00:00.000Z' };
  let tokens = await validTokens(env);
  const get = async path => whoopAll(env, path, p, tokens);
  const [recoveries, sleeps, cycles, workouts] = await Promise.all([
    get('/developer/v2/recovery'), get('/developer/v2/activity/sleep'), get('/developer/v2/cycle'), get('/developer/v2/activity/workout')]);
  return { recoveries, sleeps, cycles, workouts };
}

/* ---------- routes ---------- */
async function handle(req, env, ctx) {
  const url = new URL(req.url), path = url.pathname.replace(/\/+$/, '') || '/', method = req.method;
  const cors = corsHeaders(req, env);
  if (method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  if (path === '/' ) return new Response('SPT Whoop proxy', { headers: { 'Content-Type': 'text/plain' } });

  /* OAuth: the app asks for a one-time link (key in header), then navigates to it. Keeps APP_SECRET out of URLs. */
  if (path === '/auth/link' && method === 'GET') {
    if (!authed(req, env)) return json(req, env, { error: 'unauthorised' }, 401);
    const n = randomToken(16); await env.TOKENS.put('nonce:' + n, '1', { expirationTtl: 300 });
    return json(req, env, { url: workerOrigin(env, url) + '/auth/start?n=' + n });
  }
  if (path === '/auth/start' && method === 'GET') {
    const n = url.searchParams.get('n');
    if (!n || !(await env.TOKENS.get('nonce:' + n))) return new Response('Link expired. Go back to SPT and tap Connect Whoop again.', { status: 401 });
    await env.TOKENS.delete('nonce:' + n);
    const state = randomToken(12); await env.TOKENS.put('state:' + state, '1', { expirationTtl: 300 });
    const a = new URL(base(env) + '/oauth/oauth2/auth');
    a.search = new URLSearchParams({ response_type: 'code', client_id: env.WHOOP_CLIENT_ID, redirect_uri: workerOrigin(env, url) + '/auth/callback', scope: SCOPES, state }).toString();
    return Response.redirect(a.toString(), 302);
  }
  if (path === '/auth/callback' && method === 'GET') {
    const home = appHome(env), fail = why => Response.redirect(home + '?whoop=error&reason=' + encodeURIComponent(why), 302);
    if (url.searchParams.get('error')) return fail(url.searchParams.get('error'));
    const code = url.searchParams.get('code'), state = url.searchParams.get('state');
    if (!code || !state || !(await env.TOKENS.get('state:' + state))) return fail('bad_state');
    await env.TOKENS.delete('state:' + state);
    const r = await tokenRequest(env, { grant_type: 'authorization_code', code, redirect_uri: workerOrigin(env, url) + '/auth/callback' });
    if (!r.ok || !r.j || !r.j.access_token) return fail('token_exchange_' + r.status);
    await saveTokenResponse(env, r.j, null);
    return Response.redirect(home + '?whoop=connected', 302);
  }
  if (path === '/auth/disconnect' && method === 'POST') {
    if (!authed(req, env)) return json(req, env, { error: 'unauthorised' }, 401);
    await env.TOKENS.delete(TOKEN_KEY); return json(req, env, { connected: false });
  }

  if (path.startsWith('/api/')) {
    if (!authed(req, env)) return json(req, env, { error: 'unauthorised' }, 401);
    if (method !== 'GET') return json(req, env, { error: 'method not allowed' }, 405);
    if (path === '/api/status') {
      const t = await readTokens(env); return json(req, env, { connected: !!(t && t.access_token), since: t ? t.since || null : null });
    }
    if (path === '/api/today' || path === '/api/range') {
      let start, end;
      const today = dublinDate(Date.now());
      if (path === '/api/today') start = end = today;
      else {
        start = url.searchParams.get('start'); end = url.searchParams.get('end');
        if (!validDate(start) || !validDate(end) || end < start) return json(req, env, { error: 'start and end must be YYYY-MM-DD with end >= start' }, 400);
        if (daysBetween(start, end) + 1 > MAX_RANGE_DAYS) return json(req, env, { error: `max ${MAX_RANGE_DAYS} days` }, 400);
      }
      const ck = `cache:${start}:${end}`;
      const hit = await env.TOKENS.get(ck);
      if (hit) { try { const c = JSON.parse(hit); return json(req, env, path === '/api/today' ? c.days[0] : { days: c.days, cached: true }, 200, { 'X-SPT-Cache': 'hit' }); } catch (e) { } }
      try {
        const raw = await loadRaw(env, start, end), days = normaliseRange(start, end, raw);
        await env.TOKENS.put(ck, JSON.stringify({ days }), { expirationTtl: CACHE_TTL_S });
        return json(req, env, path === '/api/today' ? days[0] : { days });
      } catch (e) {
        if (e instanceof AuthError) return json(req, env, { connected: false }, 200);
        if (e instanceof RateLimit) return json(req, env, { error: 'rate_limited', retry_after: e.retryAfter }, 429, { 'Retry-After': String(e.retryAfter) });
        return json(req, env, { error: 'upstream_error', detail: String(e.message || e) }, 502);
      }
    }
    return json(req, env, { error: 'not found' }, 404);
  }
  return new Response('Not found', { status: 404, headers: cors });
}

export default {
  async fetch(req, env, ctx) {
    try { return await handle(req, env, ctx); }
    catch (e) { return json(req, env, { error: 'server_error', detail: String(e && e.message || e) }, 500); }
  }
};
