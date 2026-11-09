/* ===== WHOOP (via the spt-whoop Cloudflare Worker) ===== */
const WH = () => S.settings.whoop;
const whoopMock = () => { try { return localStorage.getItem('spt-whoop-mock') === '1'; } catch (e) { return false; } };
const whoopOn = () => whoopMock() || !!(WH().connected && WH().url && WH().key);
ui.whoop = { busy: false, offline: false, err: '' };
const WZ = { g: { c: 'var(--wg)', n: 'Green' }, y: { c: 'var(--wy)', n: 'Yellow' }, r: { c: 'var(--wr)', n: 'Red' } };
const whoopZone = s => s == null ? null : s >= 67 ? 'g' : s >= 34 ? 'y' : 'r';
/* coaching lines: the one place they live. Used by the recovery card, the Train chip, the briefing and the suggested-load rule */
const DS_LINE = {
  sick: 'Sick, below the neck — no training today. Easy walk only. Back 24 h after symptoms clear.',
  above: 'Head cold — train light if you want: 2 sets per exercise, RPE 6, no conditioning, stop at 40 min.',
  red: 'Red — main lift RPE 6 and 2 working sets, or swap for Zone 2.',
  yellow: 'Yellow — session as written, nothing above RPE 7.',
  green: 'Green — session as written.'
};
const WH_TIP = { r: DS_LINE.red, y: DS_LINE.yellow, g: DS_LINE.green };
function whoopDay(d) { const w = S.whoop && S.whoop[d]; return w && (w.recovery || w.sleep) ? w : null; }
const whoopZoneOn = d => { const w = whoopDay(d); return w && w.recovery ? whoopZone(w.recovery.score) : null; };
const whoopRed = (d = isoDate()) => whoopZoneOn(d) === 'r';
const ZNAME = { g: 'green', y: 'yellow', r: 'red' }, ZRANK = { red: 0, yellow: 1, green: 2 };
const feelZone = f => f == null ? null : f <= 2 ? 'red' : f === 3 ? 'yellow' : 'green';

/* ----- illness early warning: today's Whoop numbers against the median of the last 14 days (today excluded) ----- */
const ILL = [
  { k: 'resp', l: 'Breathing rate', u: 'br/min', dp: 1, get: w => w.sleep && w.sleep.respiratory_rate, bad: (v, m) => v >= m + 1 - 1e-9, word: (v, m) => `breathing rate +${r1(v - m)} br/min` },
  { k: 'temp', l: 'Skin temperature', u: '°C', dp: 1, get: w => w.recovery && w.recovery.skin_temp_c, bad: (v, m) => v >= m + .5 - 1e-9, word: (v, m) => `skin temperature +${r1(v - m)} °C` },
  { k: 'rhr', l: 'Resting heart rate', u: 'bpm', dp: 0, get: w => w.recovery && w.recovery.rhr_bpm, bad: (v, m) => v >= m + 5 - 1e-9, word: (v, m) => `resting heart rate +${Math.round(v - m)} bpm` },
  { k: 'hrv', l: 'HRV', u: 'ms', dp: 0, get: w => w.recovery && w.recovery.hrv_ms, bad: (v, m) => v <= m * .85 + 1e-9, word: (v, m) => `HRV down ${Math.round((1 - v / m) * 100)}%` }
];
function illnessWarning(date = isoDate()) {
  const t = whoopDay(date); if (!t) return null;
  const rows = [];
  ILL.forEach(m => {
    const v = m.get(t), base = []; for (let i = 1; i <= 14; i++) { const w = whoopDay(addDays(date, -i)), x = w && m.get(w); if (typeof x === 'number' && !isNaN(x)) base.push(x); }
    if (typeof v !== 'number' || isNaN(v) || base.length < 7) return;
    const b = base.slice().sort((x, y) => x - y), h = b.length >> 1, med = b.length % 2 ? b[h] : (b[h - 1] + b[h]) / 2;
    rows.push({ k: m.k, l: m.l, u: m.u, dp: m.dp, v, med, flag: m.bad(v, med), word: m.word(v, med) });
  });
  if (!rows.length) return null;
  const fl = rows.filter(r => r.flag), words = fl.map(r => r.word);
  const text = words.length > 1 ? words.slice(0, -1).join(', ') + ' and ' + words[words.length - 1] : words[0] || '';
  return { rows, flags: fl, n: fl.length, text, line: `Possible illness coming: ${text}. Treat today as yellow and sleep early.` };
}

/* ----- one source of truth for the day: Whoop, how you feel, sickness, the early warning ----- */
function dayStatus(date = isoDate()) {
  const ci = getCI(date), w = whoopDay(date), sc = w && w.recovery && w.recovery.score != null ? w.recovery.score : null;
  const wz = sc != null ? ZNAME[whoopZone(sc)] : null, feel = ci.feel != null ? +ci.feel : null, fz = feelZone(feel), sick = ci.sick || null;
  let zone = wz || fz || 'green', source = wz ? 'whoop' : fz ? 'feel' : 'none';
  if (wz && fz && ZRANK[fz] < ZRANK[wz]) { zone = fz; source = 'feel'; }
  if (sick === 'below') { zone = 'sick'; source = 'sick'; }
  else if (sick === 'above') { zone = 'red'; source = 'sick'; }
  else if (feel == null) { const iw = illnessWarning(date); if (iw && iw.n >= 2 && ZRANK[zone] > 1) { zone = 'yellow'; source = 'warning'; } }
  const line = zone === 'sick' ? DS_LINE.sick : sick === 'above' ? DS_LINE.above : DS_LINE[zone];
  return { zone, source, whoop: wz, score: sc, feel, sick, line };
}
const zcol = z => z === 'green' ? 'var(--wg)' : z === 'yellow' ? 'var(--wy)' : 'var(--wr)';
const overrideNote = ds => ds.whoop && ds.source === 'feel' ? `Whoop says ${ds.whoop} ${ds.score}%, you said ${ds.feel}/5 — going with how you feel.` : '';
/* why suggested loads hold today (empty = no hold) */
function holdWhy(date) {
  const d = dayStatus(date);
  if (d.sick === 'below') return 'sick: holding';
  if (d.sick === 'above') return 'head cold: holding';
  if (d.zone !== 'red') return '';
  return d.source === 'whoop' ? 'recovery red: holding' : 'feeling rough: holding';
}
const agoTxt = ms => { const m = Math.max(0, Math.round((Date.now() - ms) / 60000)); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' d ago'; };

/* ----- fetch ----- */
async function whoopApi(path, ms = 8000) {
  const w = WH(), ac = new AbortController(), to = setTimeout(() => ac.abort(), ms);
  try {
    const r = await fetch(w.url.replace(/\/+$/, '') + path, { headers: { 'X-SPT-Key': w.key }, signal: ac.signal });
    if (r.status === 401) throw Object.assign(new Error('key'), { code: 'key' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(to); }
}

/* ----- store ----- */
function storeWhoop(days) {
  S.whoop = S.whoop || {};
  (days || []).forEach(d => {
    if (!d || !/^\d{4}-\d\d-\d\d$/.test(d.date || '')) return;
    const old = S.whoop[d.date];
    if (old && (old.recovery || old.sleep) && !d.recovery && !d.sleep) return;   /* never replace real data with an empty day */
    S.whoop[d.date] = d; fillCheckin(d);
  });
  const keep = Object.keys(S.whoop).sort().slice(-120); Object.keys(S.whoop).forEach(k => { if (!keep.includes(k)) delete S.whoop[k]; });
  saveState();
}
/* prefill sleep hours + resting HR in the day's check-in; never touches values the user typed (src tag = 'whoop') */
function fillCheckin(d) {
  const ci = S.checkins[d.date] || {}, src = Object.assign({}, ci.src), p = {};
  const slh = d.sleep && d.sleep.hours, hr = d.recovery && d.recovery.rhr_bpm;
  if (slh != null && (ci.sleepH == null || src.sleepH === 'whoop')) { p.sleepH = r1(slh); src.sleepH = 'whoop'; }
  if (hr != null && (ci.hr == null || src.hr === 'whoop')) { p.hr = Math.round(hr); src.hr = 'whoop'; }
  if (Object.keys(p).length) S.checkins[d.date] = Object.assign({}, ci, p, { src, u: Date.now() });
}

/* ----- built-in mock generator (localStorage['spt-whoop-mock']==='1') ----- */
function mockWhoopDays() {
  const today = isoDate(), rnd = i => { const x = Math.sin(i * 12.9898 + 4.1) * 43758.5453; return x - Math.floor(x); };
  let ov = null, ill = false; try { ov = localStorage.getItem('spt-whoop-mock-today'); ill = localStorage.getItem('spt-whoop-mock-ill') === '1'; } catch (e) { }
  const out = [];
  for (let i = 29; i >= 0; i--) {
    const date = addDays(today, -i), k = parseISO(date).getTime() / 864e5;
    let rec = Math.round(Math.max(6, Math.min(98, 58 + 26 * Math.sin(k / 3.1) + (rnd(k) - .5) * 28)));
    if (i === 0 && ov) rec = { red: 24, yellow: 52, green: 84 }[ov] || rec;
    const hrv = r1(46 + rec * .42 + rnd(k + 1) * 6), rhr = Math.round(61 - rec * .13 + rnd(k + 2) * 3) + (ill && i <= 1 ? 7 : 0), sh = r1(Math.max(4.8, 6.1 + rec / 100 * 1.7 + (rnd(k + 3) - .5) * 1.2));
    const perf = Math.round(Math.min(100, 66 + rec * .28 + rnd(k + 4) * 6));
    out.push({ date, recovery: { score: rec, hrv_ms: hrv, rhr_bpm: rhr, spo2: 96.8, skin_temp_c: r1(33.4 + (ill && i <= 1 ? .7 : 0)), state: rec >= 67 ? 'green' : rec >= 34 ? 'yellow' : 'red' },
      sleep: { start: date + 'T23:10:00Z', end: date + 'T07:05:00Z', hours: sh, performance_pct: perf, efficiency_pct: 91, consistency_pct: 78, respiratory_rate: r1(15.1 + (ill && i <= 1 ? 1.4 : 0)), stages: { light_h: r1(sh * .5), sws_h: r1(sh * .22), rem_h: r1(sh * .28), awake_h: .5 }, debt_h: .4 },
      strain: { day_strain: r1(7 + rnd(k + 5) * 9), kilojoules: 8200, avg_hr: 66, max_hr: 168 }, workouts: [] });
  }
  return out;
}

/* ----- sync ----- */
function whoopRefreshUI() {
  const a = document.activeElement; if (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) return;
  if (['today', 'progress', 'plan', 'log'].includes(ui.tab) && !ui.sheet) render();
}
async function syncWhoop(force) {
  if (whoopMock()) { storeWhoop(mockWhoopDays()); WH().last = Date.now(); saveState(); ui.whoop.offline = false; whoopRefreshUI(); return 'ok'; }
  const w = WH(); if (!whoopOn() || ui.whoop.busy) return 'skipped';
  if (!force && w.last && Date.now() - w.last < 15 * 60000) return 'skipped';
  ui.whoop.busy = true; let res = 'ok';
  try {
    const today = isoDate(), j = !w.seeded ? await whoopApi(`/api/range?start=${addDays(today, -29)}&end=${today}`, 15000) : await whoopApi('/api/today');
    if (j && j.connected === false) { w.connected = false; saveState(); toast('Whoop disconnected. Reconnect in Plan.', { ms: 4000 }); res = 'fail'; }
    else if (j && (j.days || j.date)) { storeWhoop(j.days || [j]); if (j.days) w.seeded = true; w.last = Date.now(); ui.whoop.offline = false; ui.whoop.err = ''; saveState(); }
    else throw new Error('bad response');
  } catch (e) { ui.whoop.offline = true; ui.whoop.err = e && e.code === 'key' ? 'App key rejected' : e && e.name === 'AbortError' ? 'Timed out' : 'Worker unreachable'; res = 'fail'; }
  ui.whoop.busy = false; whoopRefreshUI(); return res;
}

/* ----- pull to refresh on Today ----- */
function bindPTR() {
  const el = $('#screen'); let y0 = null, dy = 0, pt;
  const ind = () => pt || (pt = Object.assign(document.createElement('div'), { id: 'ptr', className: 'pill' }), $('#app').appendChild(pt), pt);
  el.addEventListener('touchstart', e => { y0 = ui.tab === 'today' && whoopOn() && el.scrollTop <= 0 && !ui.sheet && e.touches.length === 1 ? e.touches[0].clientY : null; dy = 0; }, { passive: true });
  el.addEventListener('touchmove', e => { if (y0 == null) return; dy = e.touches[0].clientY - y0; const p = ind(); p.style.opacity = dy > 30 ? 1 : 0; p.textContent = dy > 80 ? 'Release to sync Whoop' : 'Pull to sync Whoop'; }, { passive: true });
  el.addEventListener('touchend', async () => {
    const go_ = y0 != null && dy > 80; y0 = null; if (pt) pt.style.opacity = 0; if (!go_) return;
    const w = WH(); if (!whoopMock() && w.last && Date.now() - w.last < 15 * 60000) return toast('Whoop is up to date. Synced ' + agoTxt(w.last));
    toast('Syncing Whoop…', { ms: 1200 }); await syncWhoop(true);
  });
}

/* ----- Today: recovery card ----- */
const warnOne = iw => `<button class="whone" data-action="illness">One early sign: ${esc(iw.flags[0].word)}. Tap for details</button>`;
function recoveryCard(date) {
  const ds = dayStatus(date), iw = illnessWarning(date), logged = ds.feel != null || ds.sick, d = whoopDay(date);
  const warn = iw && iw.n >= 2 ? `<button class="card pad whwarn" data-action="illness" aria-label="Possible illness coming. Show details"><div class="grow"><b>Possible illness coming</b><div class="s muted" style="font-size:14px">${esc(iw.text.replace(/^./, c => c.toUpperCase()))}. Treat today as yellow and sleep early.</div></div>${chev}</button>` : '';
  const one = iw && iw.n === 1 ? warnOne(iw) : '';
  const note = overrideNote(ds), tip = `<div class="wh-tip" style="border-left:3px solid ${zcol(ds.zone === 'sick' ? 'red' : ds.zone)}">${note ? `<div class="wh-ov">${esc(note)}</div>` : ''}${esc(ds.line)}</div>`;
  const feelTxt = ds.feel != null ? `You feel ${ds.feel}/5` : '';
  /* no Whoop recovery today: a compact card when feel or sickness is logged */
  const compact = () => logged ? `<div class="card pad whc" style="--wz:${zcol(ds.zone === 'sick' ? 'red' : ds.zone)}"><div class="t" style="font-weight:700;font-size:19px">Today <span style="color:var(--wz)">${ds.zone === 'sick' ? 'Sick' : cap(ds.zone)}</span></div><div class="s muted" style="font-size:13px;margin:2px 0 10px">${esc([feelTxt, ds.sick ? (ds.sick === 'above' ? 'Head cold' : 'Run down') : ''].filter(Boolean).join(' · '))}</div>${tip}${one}</div>` : '';
  if (!whoopOn()) return compact();
  const off = ui.whoop.offline && !whoopMock(), chip = off ? '<span class="pill o" role="status">Whoop: offline</span>' : '';
  if (!d || !d.recovery || d.recovery.score == null) return `<div class="card pad whwait"><div class="grow"><b>Whoop</b><div class="s muted" style="font-size:14px">${d && d.sleep ? 'Sleep synced. Recovery is not scored yet.' : 'No recovery for today yet.'}</div>${one}</div>${chip}</div>` + (logged ? compact() : '') + warn;
  const r = d.recovery, z = whoopZone(r.score), c = WZ[z].c, sl = d.sleep || {}, y = S.whoop[addDays(date, -1)], ys = y && y.strain ? y.strain.day_strain : null, circ = 2 * Math.PI * 30;
  const st = (v, u, l) => `<div class="kv"><b>${v}<small>${u}</small></b><span>${l}</span></div>`;
  return `<div class="card pad whc" style="--wz:${c}"><div class="wh-top"><svg class="ring" viewBox="0 0 72 72" role="img" aria-label="Recovery ${r.score} percent, ${WZ[z].n}"><circle cx="36" cy="36" r="30" class="rt"/><circle cx="36" cy="36" r="30" class="rv" stroke-dasharray="${(circ * r.score / 100).toFixed(1)} ${circ.toFixed(1)}" transform="rotate(-90 36 36)"/><text x="36" y="43" text-anchor="middle">${r.score}%</text></svg><div class="grow"><div class="t" style="font-weight:700;font-size:19px">Recovery <span style="color:var(--wz)">${WZ[z].n}</span></div><div class="s muted" style="font-size:13px">Whoop · ${fmtDate(date, { weekday: 'short', day: 'numeric', month: 'short' })}</div>${chip}</div></div><div class="wh-g">${st(r.hrv_ms != null ? Math.round(r.hrv_ms) : '–', ' ms', 'HRV')}${st(r.rhr_bpm ?? '–', ' bpm', 'Resting HR')}${st(sl.hours != null ? fmtN(sl.hours) : '–', ' h', sl.performance_pct != null ? 'Sleep · ' + sl.performance_pct + '%' : 'Sleep')}${st(ys != null ? fmtN(ys) : '–', '', 'Strain yesterday')}</div>${tip}${one}</div>` + warn;
}
/* the session card's left border follows the day's status, not just Whoop */
const wzCls = date => { const d = dayStatus(date); return d.source === 'none' ? '' : d.zone === 'sick' ? ' wz-s' : ' wz-' + { green: 'g', yellow: 'y', red: 'r' }[d.zone]; };
const recChip = date => {
  const d = dayStatus(date); if (d.source === 'none') return '';
  const txt = d.sick ? (d.sick === 'above' ? 'Head cold' : 'Sick') : d.source === 'feel' ? `Feel ${d.feel}/5` : d.source === 'warning' ? 'Illness warning' : `Recovery ${d.score}%`;
  return ` <span class="pill wchip" style="--wz:${zcol(d.zone === 'sick' ? 'red' : d.zone)}" title="${esc(d.line)}">${esc(txt)}</span>`;
};
actions.illness = () => {
  const iw = illnessWarning(isoDate()); if (!iw) return;
  const fmt = (v, dp) => dp ? r1(v).toFixed(1) : String(Math.round(v));
  openSheet('Illness early warning', `<p class="muted" style="margin-top:0">Today against your normal, the median of the last 14 days. Two or more flags is an early sign of illness.</p><div class="card">${iw.rows.map(r => `<div class="row"><div class="grow"><div class="t">${esc(r.l)}</div><div class="s">Today ${fmt(r.v, r.dp)} ${r.u} · normal ${fmt(r.med, r.dp)} ${r.u}</div></div>${r.flag ? '<span class="pill o">Flagged</span>' : '<span class="pill g">Normal</span>'}</div>`).join('')}</div><div class="rule">Flags: breathing rate 1 br/min or more above normal, skin temperature 0.5 °C or more above, resting heart rate 5 bpm or more above, HRV 15% or more below.</div>`);
};

/* ----- Plan: Whoop card ----- */
function whoopSettingsHTML() {
  const w = WH(), mock = whoopMock(), on = whoopOn();
  const status = mock ? 'Test mode: built-in sample data' : w.connected ? `Connected${w.since ? ' since ' + fmtShort(isoDate(new Date(w.since))) : ''} · ${w.last ? 'synced ' + agoTxt(w.last) : 'not synced yet'}` : 'Not connected';
  return `<div class="sec">Whoop</div><div class="card pad"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span class="pill ${on ? 'g' : ''}" id="whstat">${esc(status)}</span>${ui.whoop.offline && !mock ? `<span class="pill o">Whoop: offline${ui.whoop.err ? ' · ' + esc(ui.whoop.err) : ''}</span>` : ''}</div><div class="lbl">Worker URL</div><input type="url" inputmode="url" autocapitalize="off" autocorrect="off" spellcheck="false" data-in="whurl" placeholder="https://spt-whoop.yourname.workers.dev" value="${esc(w.url)}" aria-label="Worker URL"><div class="lbl">App key</div><input type="password" autocomplete="off" autocapitalize="off" spellcheck="false" data-in="whkey" placeholder="The APP_SECRET you set on the Worker" value="${esc(w.key)}" aria-label="App key"><div style="display:grid;gap:8px;margin-top:14px"><button class="btn pri" data-action="whconnect">${w.connected ? 'Reconnect Whoop' : 'Connect Whoop'}</button>${w.connected || on ? `<div class="two"><button class="btn" data-action="whsync">Sync now</button><button class="btn danger" data-action="whdisconnect">Disconnect</button></div>` : ''}</div></div>`;
}
inputs.whurl = el => debounced('whurl', () => { WH().url = el.value.trim().replace(/\/+$/, ''); saveState(); });
inputs.whkey = el => debounced('whkey', () => { WH().key = el.value.trim(); saveState(); });
function readWhoopFields() {
  const u = $('[data-in=whurl]'), k = $('[data-in=whkey]'); if (u) WH().url = u.value.trim().replace(/\/+$/, ''); if (k) WH().key = k.value.trim(); saveState();
  return WH().url && WH().key && /^https:\/\/|^http:\/\/localhost/.test(WH().url);
}
actions.whconnect = async () => {
  if (!readWhoopFields()) return toast('Enter the Worker URL (https://…) and the app key first', { ms: 3500 });
  try {
    const st = await whoopApi('/api/status');
    if (st.connected) { WH().connected = true; WH().since = WH().since || st.since || new Date().toISOString(); WH().seeded = false; saveState(); toast('Whoop already connected'); await syncWhoop(true); return render(); }
    const l = await whoopApi('/auth/link'); if (!l || !/^https?:\/\//.test(l.url || '')) throw new Error('bad link');
    location.href = l.url;
  } catch (e) { toast(e && e.code === 'key' ? 'The Worker rejected the app key' : 'Could not reach the Worker. Check the URL.', { ms: 4000 }); }
};
actions.whsync = async () => { toast('Syncing Whoop…', { ms: 1200 }); const r = await syncWhoop(true); toast(r === 'ok' ? 'Whoop synced' : 'Whoop: offline', { ms: 2000 }); };
actions.whdisconnect = async () => {
  const w = WH(); let remote = true;
  try { if (w.url && w.key) { const r = await fetch(w.url.replace(/\/+$/, '') + '/auth/disconnect', { method: 'POST', headers: { 'X-SPT-Key': w.key } }); remote = r.ok; } } catch (e) { remote = false; }
  w.connected = false; w.seeded = false; w.last = 0; w.since = ''; ui.whoop.offline = false; saveState(); render();
  toast(remote ? 'Whoop disconnected. Synced history stays on this device.' : 'Disconnected here. The Worker could not be reached, so it may still hold the tokens.', { ms: 4500 });
};

/* ----- OAuth return: ?whoop=connected ----- */
function handleWhoopReturn() {
  let p; try { p = new URLSearchParams(location.search); } catch (e) { return; }
  const v = p.get('whoop'); if (!v) return;
  const reason = p.get('reason'); p.delete('whoop'); p.delete('reason');
  try { history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p : '') + location.hash); } catch (e) { }
  if (v === 'connected') { const w = WH(); w.connected = true; w.since = new Date().toISOString(); w.seeded = false; w.last = 0; saveState(); toast('Whoop connected'); syncWhoop(true); }
  else toast('Whoop connection failed' + (reason ? ' (' + reason + ')' : ''), { ms: 4500 });
}

/* ----- Progress ----- */
function whoopRange(today, n) { const a = []; for (let i = n - 1; i >= 0; i--) { const d = addDays(today, -i); a.push([d, whoopDay(d)]); } return a; }
function whoopCharts(today) {
  if (!whoopOn() && !Object.keys(S.whoop || {}).length) return '';
  const days = whoopRange(today, 30), last = days.length - 1, xt = [[0, fmtShort(days[0][0])], [last, 'Today']];
  const rec = [], hrv = [], dm = [];
  days.forEach(([d, w], i) => { if (w && w.recovery && w.recovery.score != null) rec.push([i, w.recovery.score]); if (w && w.recovery && w.recovery.hrv_ms != null) hrv.push([i, w.recovery.hrv_ms]); const c = S.checkins[d]; if (c && c.doms != null) dm.push([i, c.doms]); });
  const none = 'Connect Whoop in Plan to see this.';
  const bars = rec.map(p => [p[0], p[1], WZ[whoopZone(p[1])].c]);
  let h = chartCard('Recovery', 'last 30 days, %', rec.length ? chartSVG({ label: 'Recovery percent, 30 days', series: [{ pts: rec, color: 'transparent', nodots: true }], bars, yr: [0, 100], xmin: 0, xmax: last, xt, legend: [['Green 67+', 'var(--wg)'], ['Yellow 34–66', 'var(--wy)'], ['Red 0–33', 'var(--wr)']] }) : '', none);
  const ma = hrv.map((p, i) => { const sl = hrv.filter(q => q[0] > p[0] - 7 && q[0] <= p[0]); return [p[0], sl.reduce((a, b) => a + b[1], 0) / sl.length]; });
  h += chartCard('HRV', 'ms, 7-day average', hrv.length > 1 ? chartSVG({ label: 'HRV, 30 days', series: [{ pts: hrv, color: 'var(--ink3)', r: 2.2, w: 1.2 }, { pts: ma, color: 'var(--g2)', nodots: true, w: 2.6 }], xmin: 0, xmax: last, xt, legend: [['Daily', 'var(--ink3)'], ['7-day average', 'var(--g2)']] }) : '', none);
  h += chartCard('Recovery vs soreness', 'last 30 days', rec.length > 1 && dm.length > 1 ? chartSVG({ label: 'Recovery vs soreness', y2: true, yr: [0, 100], yr2: [0, 12], xmin: 0, xmax: last, xt, series: [{ pts: rec, color: 'var(--g2)', r: 2.4 }, { pts: dm, color: 'var(--o)', axis: 2, r: 2.4 }], legend: [['Recovery % (left)', 'var(--g2)'], ['Soreness 0–10 (right)', 'var(--o)']] }) : '', rec.length > 1 ? 'Log soreness for a few days to compare it with recovery.' : none);
  return h;
}
function whoopWeek(ws, we) {
  const v = []; for (let d = ws; d <= we; d = addDays(d, 1)) { const w = whoopDay(d); if (w && w.recovery) v.push(w.recovery); }
  if (!v.length) return '';
  const avg = k => { const a = v.map(x => x[k]).filter(x => x != null); return a.length ? Math.round(a.reduce((p, q) => p + q, 0) / a.length) : '–'; };
  return `<div class="s" style="font-size:13px;color:var(--ink2)">Recovery ${avg('score')}% · HRV ${avg('hrv_ms')} ms</div>`;
}
