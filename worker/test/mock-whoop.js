/* Tiny fake of the Whoop API (OAuth + the four v2 data endpoints) for local testing.
 * Usage: node test/mock-whoop.js [port]   (default 8799). Also importable: startMock(port) -> {server, stats}. */
import http from 'node:http';

const H = 3600000;
const iso = t => new Date(t).toISOString();

/* Build N days of realistic data ending today (UTC-based; Dublin offset is <= 1h so dates line up for tests that
 * use mid-morning wake times). Day i=0 is today. */
export function buildData(days = 35, now = Date.now()) {
  const recoveries = [], sleeps = [], cycles = [], workouts = [];
  const todayStr = new Date(now).toISOString().slice(0, 10);
  for (let i = 0; i < days; i++) {
    const day = Date.parse(todayStr + 'T00:00:00Z') - i * 24 * H;
    const wake = day + 7.25 * H, bed = wake - 7.6 * H;          // wake 07:15Z, ~7.6h in bed
    const seed = (i * 37 + 11) % 100;
    const score = i === 0 ? 58 : Math.max(8, Math.min(98, 35 + seed * 0.62));
    const sid = `sleep-${i}`, cid = 9000 + (days - i);
    sleeps.push({ id: sid, cycle_id: cid, user_id: 1, start: iso(bed), end: iso(wake), timezone_offset: '+00:00', nap: false, score_state: 'SCORED',
      score: { stage_summary: { total_in_bed_time_milli: 7.6 * H, total_awake_time_milli: 0.6 * H, total_no_data_time_milli: 0, total_light_sleep_time_milli: 3.5 * H, total_slow_wave_sleep_time_milli: 1.6 * H, total_rem_sleep_time_milli: 1.9 * H, sleep_cycle_count: 4, disturbance_count: 7 },
        sleep_needed: { baseline_milli: 8 * H, need_from_sleep_debt_milli: 0.4 * H, need_from_recent_strain_milli: 0.2 * H, need_from_recent_nap_milli: 0 },
        respiratory_rate: 15.2, sleep_performance_percentage: 82 + (seed % 14), sleep_consistency_percentage: 70 + (seed % 20), sleep_efficiency_percentage: 91.4 } });
    /* a nap that must be ignored */
    if (i === 1) sleeps.push({ id: 'nap-1', cycle_id: cid, user_id: 1, start: iso(day + 13 * H), end: iso(day + 13.5 * H), nap: true, score_state: 'SCORED', score: { stage_summary: { total_light_sleep_time_milli: 0.4 * H, total_slow_wave_sleep_time_milli: 0, total_rem_sleep_time_milli: 0, total_awake_time_milli: 0.1 * H } } });
    recoveries.push({ cycle_id: cid, sleep_id: sid, user_id: 1, created_at: iso(wake + 600000), updated_at: iso(wake + 600000), score_state: 'SCORED',
      score: { user_calibrating: false, recovery_score: Math.round(score), resting_heart_rate: 50 + (seed % 9), hrv_rmssd_milli: 55 + seed * 0.4, spo2_percentage: 96.5, skin_temp_celsius: 33.4 } });
    cycles.push({ id: cid, user_id: 1, start: iso(bed), end: i === 0 ? null : iso(bed + 24 * H), timezone_offset: '+00:00', score_state: 'SCORED',
      score: { strain: 8 + (seed % 9) + 0.3, kilojoule: 8000 + seed * 40, average_heart_rate: 66, max_heart_rate: 168 } });
    workouts.push({ id: `w-${i}`, user_id: 1, start: iso(day + 17 * H), end: iso(day + 18 * H), sport_name: i % 2 ? 'running' : 'weightlifting', sport_id: i % 2 ? 0 : 45, score_state: 'SCORED', score: { strain: 9.4, average_heart_rate: 128, max_heart_rate: 171, kilojoule: 1800 } });
  }
  return { recoveries, sleeps, cycles, workouts };
}

export function startMock(port = 8799, opts = {}) {
  const data = opts.data || buildData();
  const stats = { token: 0, refresh: 0, data: 0, auth: 0, fail401: opts.fail401 || 0, fail429: opts.fail429 || 0, codes: new Set(), lastRefreshToken: null };
  let n = 0;
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x'), send = (s, b, h = {}) => { res.writeHead(s, Object.assign({ 'Content-Type': 'application/json' }, h)); res.end(typeof b === 'string' ? b : JSON.stringify(b)); };
    if (u.pathname === '/oauth/oauth2/auth') {            // pretend the user approved: bounce straight back with a code
      stats.auth++; stats.lastAuthQuery = Object.fromEntries(u.searchParams);
      const code = 'code-' + (++n); stats.codes.add(code);
      res.writeHead(302, { Location: u.searchParams.get('redirect_uri') + '?code=' + code + '&state=' + u.searchParams.get('state') }); return res.end();
    }
    if (u.pathname === '/oauth/oauth2/token' && req.method === 'POST') {
      let b = ''; req.on('data', c => b += c); req.on('end', () => {
        const p = new URLSearchParams(b); stats.lastTokenBody = Object.fromEntries(p);
        if (p.get('grant_type') === 'authorization_code') { if (!stats.codes.has(p.get('code'))) return send(400, { error: 'invalid_grant' }); stats.codes.delete(p.get('code')); stats.token++; }
        else if (p.get('grant_type') === 'refresh_token') { stats.refresh++; if (p.get('refresh_token') !== stats.lastRefreshToken) return send(400, { error: 'invalid_grant' }); }
        else return send(400, { error: 'unsupported_grant_type' });
        stats.lastRefreshToken = 'rt-' + (++n);
        send(200, { access_token: 'at-' + n, refresh_token: stats.lastRefreshToken, expires_in: opts.expiresIn ?? 3600, token_type: 'bearer', scope: 'offline' });
        stats.currentAccess = 'at-' + n;
      }); return;
    }
    if (u.pathname.startsWith('/developer/v2/')) {
      if (stats.fail401 > 0) { stats.fail401--; return send(401, { error: 'invalid_token' }); }
      if (stats.fail429 > 0) { stats.fail429--; return send(429, { error: 'rate' }, { 'Retry-After': '1' }); }
      if (req.headers.authorization !== 'Bearer ' + stats.currentAccess) return send(401, { error: 'invalid_token' });
      stats.data++;
      const map = { '/developer/v2/recovery': 'recoveries', '/developer/v2/activity/sleep': 'sleeps', '/developer/v2/cycle': 'cycles', '/developer/v2/activity/workout': 'workouts' };
      const key = map[u.pathname]; if (!key) return send(404, { error: 'not found' });
      const start = Date.parse(u.searchParams.get('start') || 0), end = Date.parse(u.searchParams.get('end') || '2100-01-01');
      const tf = r => Date.parse(r.start || r.created_at);
      const all = data[key].filter(r => tf(r) >= start && tf(r) < end).sort((a, b) => tf(b) - tf(a));
      const limit = Math.min(25, +u.searchParams.get('limit') || 10), off = +(u.searchParams.get('nextToken') || 0);
      return send(200, { records: all.slice(off, off + limit), next_token: off + limit < all.length ? String(off + limit) : null });
    }
    send(404, { error: 'not found' });
  });
  return new Promise(r => server.listen(port, () => r({ server, stats, data })));
}

if (process.argv[1] && process.argv[1].endsWith('mock-whoop.js')) {
  const port = +process.argv[2] || 8799;
  startMock(port).then(() => console.log('mock Whoop on http://localhost:' + port));
}
