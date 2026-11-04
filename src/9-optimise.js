/* ===== SPT v2.3 optimise pass. Loaded last; extends the app by wrapping existing functions (presc, ctxFor, dayLabel, padHTML, setHTML,
   exHeadHTML, confirmSet, roundsHTML, settingsHTML, scoreFood, showVerdict, mergeImport, syncWhoop, screens.today/log/progress),
   so no other source file is edited. Whoop and bowling data are read straight from S. ===== */
const OPT = { vx: null, rec: null, lr: { sid: '', n: 0 }, pend: false, preSession: false };
const optMock = () => { try { return localStorage.getItem('spt-opt-mock') === '1'; } catch (e) { return false; } };
const optClamp = (v, a, b) => Math.max(a, Math.min(b, v));
const optSum = a => a.reduce((x, y) => x + y, 0);
const optMean = a => a.length ? optSum(a) / a.length : null;
const optSD = a => { if (a.length < 2) return null; const m = optMean(a); return Math.sqrt(optMean(a.map(x => (x - m) * (x - m)))); };
const optMedian = a => { if (!a.length) return null; const b = a.slice().sort((x, y) => x - y), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
const optHM = m => { m = ((Math.round(m) % 1440) + 1440) % 1440; return pad2(Math.floor(m / 60)) + ':' + pad2(m % 60); };
const optParseHM = s => { const m = /^(\d{1,2}):(\d\d)/.exec(s || ''); return m ? +m[1] * 60 + +m[2] : null; };
const optDays = (end, n) => { const a = []; for (let i = n - 1; i >= 0; i--) a.push(addDays(end, -i)); return a; };
function optInit() {
  S.whoop = S.whoop || {}; S.load = S.load || {}; S.zone2 = S.zone2 || {}; S.overrides = S.overrides || {}; S.bowling = S.bowling || {}; S.dayType = S.dayType || {};
  S.travel = S.travel || { trips: [], done: {} }; S.travel.trips = S.travel.trips || []; S.travel.done = S.travel.done || {};
  S.deload = S.deload || { active: false, shown: false, snooze: '', start: '' };
  S.settings.opt = Object.assign({ dom: 'r', bed: '', trainTime: '17:30', nut: {} }, S.settings.opt || {});
  return S;
}
const optBandOf = v => v == null ? null : v < .8 ? 'under' : v <= 1.3 ? 'sweet' : v <= 1.5 ? 'caution' : 'danger';
const OPT_BAND = { under: { c: 'var(--ob)', n: 'Undertraining' }, sweet: { c: 'var(--ok)', n: 'Sweet spot' }, caution: { c: 'var(--amber)', n: 'Caution' }, danger: { c: 'var(--red)', n: 'Danger' } };

/* ---------- A. load model ---------- */
/* Per-set lift load = weight x reps / 100 x RPE weight, RPE weight = clamp((rpe-5)/3, 0.5, 1.5).
   Sets without a usable weight (bodyweight, time, distance, carries) use RPE x minutes / 10, minutes = (work + prescribed rest) / 60 per set. */
const optRpeW = rpe => optClamp(((rpe == null ? 6 : rpe) - 5) / 3, .5, 1.5);
const optWeighted = (e, st) => st.w > 0 && st.r > 0 && isRepEx(e.tgt);
function optWorkSec(e, st) { const t = e.tgt || {}, ty = t.load && t.load.type; if (ty === 'time') return st.r || 30; if (ty === 'distance' || t.per === 'm') return 40; return (st.r || 8) * 3 + 5; }
function optSetLoad(e, st) {
  const rpe = st.rpe != null ? st.rpe : e.tgt && e.tgt.rpeTarget != null ? e.tgt.rpeTarget : 6;
  if (optWeighted(e, st)) return st.w * st.r / 100 * optRpeW(rpe);
  return rpe * ((optWorkSec(e, st) + ((e.tgt && e.tgt.rest) || 60)) / 60) / 10;
}
function optSetLoads(s, planned) {
  const out = [];
  (s.ex || []).forEach((e, ei) => { if (e.skipped) return; e.sets.forEach((st, si) => { if (planned ? !st.skip || st.done : st.done) out.push({ ei, si, name: e.name, main: !!(e.tgt && e.tgt.main), done: !!st.done, load: optSetLoad(e, st) }); }); });
  return out;
}
const optLiftLoad = (s, planned) => optSum(optSetLoads(s, planned).map(x => x.load));
const optCondLoad = s => optSum((s.rounds || []).filter(Boolean)) / 60 * ((s.rpe || 7) / 10);   /* round minutes x session RPE (default 7) / 10 */
/* Whoop rule: day strain x 2 replaces the cond+bowl estimate on days where it is larger (the lift load always stays),
   so Whoop activity is counted once. The excess shows as "xtra" in the stacked chart. */
function optCombine(p) {
  const est = p.cond + p.bowl, xtra = p.strain > est ? p.strain - est : 0;
  return { lift: r1(p.lift), cond: r1(p.cond), bowl: r1(p.bowl), strain: r1(p.strain), xtra: r1(xtra), total: r1(p.lift + est + xtra) };
}
function optIndex() { const m = {}; Object.values(S.sessions || {}).forEach(s => { (m[s.date] = m[s.date] || []).push(s); }); return m; }
function optBowlLoad(b) { if (!b) return 0; const h = +(b.hours != null ? b.hours : b.h != null ? b.h : 0) || 0, f = b.feel != null ? b.feel : b.armFeel != null ? b.armFeel : b.arm; return h * 6 * (f != null && f <= 2 ? 1.3 : 1); }
function optDayParts(date, idx) {
  idx = idx || optIndex(); let lift = 0, cond = 0;
  (idx[date] || []).forEach(s => { lift += optLiftLoad(s); if (s.key === 'C') cond += optCondLoad(s); });
  const z = (S.zone2 || {})[date]; if (z && z.min > 0) cond += z.min * .5;
  const w = (S.whoop || {})[date], strain = w && w.strain && w.strain.day_strain != null ? w.strain.day_strain * 2 : 0;
  return { lift, cond, bowl: optBowlLoad((S.bowling || {})[date]), strain };
}
const optDayLoad = (date, idx) => optCombine(optDayParts(date, idx));
function optFirstLoadDate(idx) {
  const ds = new Set([...Object.keys(idx), ...Object.keys(S.zone2 || {}), ...Object.keys(S.bowling || {}), ...Object.keys(S.whoop || {})]);
  return [...ds].sort().find(d => optDayLoad(d, idx).total > 0) || null;
}
/* series of daily loads from the first day with any load up to `end` (max 120 days) */
function optSeries(end, idx) {
  idx = idx || optIndex(); const f = optFirstLoadDate(idx); if (!f || f > end) return [];
  const start = diffDays(end, f) > 119 ? addDays(end, -119) : f, out = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(Object.assign({ date: d }, optDayLoad(d, idx)));
  return out;
}
/* Coupled ACWR = 7-day sum / (28-day sum / 4). EWMA ACWR = EWMA(acute, 2/(7+1)) / EWMA(chronic, 2/(28+1)), seeded with the first day.
   With < 28 days of history the chronic window shrinks to the days available (n/7 weeks); under 14 days it is "building". */
const OPT_LA = 2 / 8, OPT_LC = 2 / 29;
function optAcwrCalc(daily) {
  const len = daily.length; if (!len) return null;
  const n = Math.min(28, len), a7 = optSum(daily.slice(-7)), c = optSum(daily.slice(-n));
  let ea = daily[0], ec = daily[0];
  for (let i = 1; i < len; i++) { ea = OPT_LA * daily[i] + (1 - OPT_LA) * ea; ec = OPT_LC * daily[i] + (1 - OPT_LC) * ec; }
  const ewma = ec > 0 ? ea / ec : null;
  return { n: len, ready: len >= 14, coupled: c > 0 ? a7 / (c / (n / 7)) : null, ewma, acute: ea, chronic: ec, band: len >= 14 ? optBandOf(ewma) : null };
}
function optAcwrAll(series) { const t = series.map(x => x.total); return series.map((x, i) => Object.assign({ date: x.date }, optAcwrCalc(t.slice(0, i + 1)))); }
function optAcwrAt(date, idx) { const s = optSeries(date, idx); return s.length ? optAcwrCalc(s.map(x => x.total)) : null; }
function optSyncLoad() {   /* mirror the derived daily load into S.load[date] = {lift, bowl, cond, strain, total} */
  optInit(); const idx = optIndex(); let ch = false;
  optDays(isoDate(), 60).forEach(d => { const l = optDayLoad(d, idx), o = S.load[d]; if (l.total > 0 || o) { if (!o || o.total !== l.total || o.lift !== l.lift || o.cond !== l.cond || o.bowl !== l.bowl || o.strain !== l.strain) { S.load[d] = l; ch = true; } } });
  if (ch) saveState();
}

/* planned session for a day (real draft if present, else a pseudo session built from the prescription) */
function optPseudo(slot) {
  return { key: slot.key, rounds: [], ex: DAYS[slot.key].map((x, i) => {
    const p = slotPresc(slot.key, slot.w, i);
    return { name: p.name, orig: x.name, bi: i, tgt: p, sets: freshSets(p, p.sets, slot.date), skipped: p.optional };
  }) };
}
function optPlan(date) {
  const c = ctxFor(date); if (c.phase !== 'in' || !c.slot || !['A', 'B', 'C'].includes(c.key)) return null;
  const slot = c.slot, real = sessionOf(slot); if (real && real.status === 'done') return null;
  const sess = real || optPseudo(slot);
  let condPlanned = 0;
  if (c.key === 'C') {
    const past = Object.values(S.sessions).filter(s => s.key === 'C' && s.rounds && s.rounds.some(Boolean)).flatMap(s => s.rounds.filter(Boolean)), avgMin = past.length ? optMean(past) / 60 : 7;
    condPlanned = Math.max(optCondLoad(sess), DAY_C.rounds[slot.w - 1] * avgMin * .7);
  }
  return { slot, key: c.key, sess, real: !!real, condPlanned };
}
function optProjected(date, plan, skipSets) {
  const idx = optIndex(), parts = optDayParts(date, idx); plan = plan === undefined ? optPlan(date) : plan;
  const prior = optSeries(addDays(date, -1), idx).map(x => x.total), has = optSeries(date, idx).length > 0 || prior.length > 0;
  let lift = parts.lift, cond = parts.cond;
  if (plan) {
    if (plan.key === 'C') cond = Math.max(cond, plan.condPlanned);
    else { const ls = optSetLoads(plan.sess, true).filter(x => !(skipSets || []).some(k => k[0] === x.ei && k[1] === x.si)); lift = Math.max(parts.lift, optSum(ls.map(x => x.load))); if (skipSets && skipSets.length) lift = optSum(ls.map(x => x.load)); }
  }
  const tot = optCombine({ lift, cond, bowl: parts.bowl, strain: parts.strain }), a = optAcwrCalc(prior.concat(tot.total));
  return { plan, parts: tot, acwr: a, hasHistory: has, days: prior.length + 1 };
}
/* trim: drop accessory sets from the bottom of the session (never the main lift, never a done set, keep >=1 set per exercise) until ACWR <= limit */
function optTrim(date, limit = 1.3) {
  const plan = optPlan(date); if (!plan || plan.key === 'C') return null;
  const base = optProjected(date, plan); if (!base.acwr || !base.acwr.ready || base.acwr.ewma <= limit) return null;
  const sess = plan.sess, skip = [], left = sess.ex.map(e => e.sets.filter(st => !st.skip).length);
  let cur = base;
  outer: for (let ei = sess.ex.length - 1; ei >= 0; ei--) {
    const e = sess.ex[ei]; if (e.skipped || (e.tgt && e.tgt.main)) continue;
    for (let si = e.sets.length - 1; si >= 0; si--) {
      const st = e.sets[si]; if (st.done || st.skip) continue; if (left[ei] <= 1) break;
      skip.push([ei, si]); left[ei]--; cur = optProjected(date, plan, skip);
      if (cur.acwr.ewma <= limit) break outer;
    }
  }
  const by = []; skip.forEach(([ei]) => { let g = by.find(x => x.ei === ei); if (!g) by.push(g = { ei, name: sess.ex[ei].name, n: 0 }); g.n++; });
  by.forEach(g => { g.left = left[g.ei]; });
  const ok = cur.acwr.ewma <= limit, list = by.slice(0, 2).map(g => `${g.name} to ${g.left} set${g.left === 1 ? '' : 's'}`), more = by.length - 2;
  const txt = !skip.length ? '' : `Planned session takes you to ${base.acwr.ewma.toFixed(2)}. ` + (ok ? `Trim ${list.join(', ')}${more > 0 ? ` and ${more} more exercise${more === 1 ? '' : 's'}` : ''} to stay under ${limit}.` : `Trimming every accessory only reaches ${cur.acwr.ewma.toFixed(2)}. Consider lighter main sets.`);
  return { before: base.acwr.ewma, after: cur.acwr.ewma, skip, by, ok, text: txt, plan };
}
actions.opttrim = () => {
  const date = isoDate(), t = optTrim(date); if (!t || !t.skip.length) return toast('Nothing to trim');
  const s = ensureSession(t.plan.slot); t.skip.forEach(([ei, si]) => { if (s.ex[ei] && s.ex[ei].sets[si] && !s.ex[ei].sets[si].done) s.ex[ei].sets[si].skip = true; });
  s.u = Date.now(); saveState(); toast(`Trimmed ${t.skip.length} set${t.skip.length === 1 ? '' : 's'}. Marked optional in today's session.`, { ms: 3200 }); vib(8); if (ui.tab === 'train' && typeof curSess !== 'undefined') curSess = s; render();
};

/* ---------- B. readiness, HRV, deload ---------- */
const optWh = d => (S.whoop || {})[d] || null;
function optHrvOn(d) { const w = optWh(d); if (w && w.recovery && w.recovery.hrv_ms != null) return +w.recovery.hrv_ms; const c = (S.checkins || {})[d]; return c && c.hrv != null && c.hrv !== '' ? +c.hrv : null; }
function optSleepH(d) { const c = (S.checkins || {})[d], w = optWh(d); if (c && c.sleepH != null) return c.sleepH; return w && w.sleep && w.sleep.hours != null ? w.sleep.hours : null; }
function optHrvStats(date) {
  const v7 = optDays(date, 7).map(optHrvOn).filter(x => x != null), v30 = optDays(date, 30).map(optHrvOn).filter(x => x != null);
  if (v7.length < 4 || v30.length < 14) return null;
  const avg7 = optMean(v7), base = optMean(v30); return { avg7, base, ratio: avg7 / base, n7: v7.length, n30: v30.length };
}
const OPT_ACWR_PTS = { sweet: 100, under: 70, caution: 50, danger: 15 };
function optReadiness(date) {
  const ci = (S.checkins || {})[date] || {}, w = optWh(date), comps = [];
  if (w && w.recovery && w.recovery.score != null) comps.push({ k: 'rec', l: 'Whoop recovery', wt: .4, s: w.recovery.score, t: w.recovery.score + '%' });
  const sh = optSleepH(date); if (sh != null) comps.push({ k: 'sleep', l: 'Sleep vs 8 h', wt: .2, s: optClamp(sh / 8 * 100, 0, 100), t: fmtN(sh) + ' h' });
  const hv = optHrvOn(date), base = (() => { const v = optDays(addDays(date, -1), 30).map(optHrvOn).filter(x => x != null); return v.length >= 5 ? optMean(v) : null; })();
  if (hv != null && base) { const ra = hv / base; comps.push({ k: 'hrv', l: 'HRV vs baseline', wt: .2, s: ra >= 1 ? 100 : optClamp(100 - (1 - ra) * 500, 0, 100), t: Math.round(hv) + ' vs ' + Math.round(base) + ' ms' }); }
  if (ci.doms != null) comps.push({ k: 'doms', l: 'Soreness (inverted)', wt: .1, s: (10 - ci.doms) * 10, t: ci.doms + '/10' });
  const ya = optAcwrAt(addDays(date, -1)); if (ya && ya.ready) comps.push({ k: 'acwr', l: "Yesterday's load band", wt: .1, s: OPT_ACWR_PTS[ya.band], t: OPT_BAND[ya.band].n + ' ' + ya.ewma.toFixed(2) });
  if (comps.length < 2) return null;
  const tw = optSum(comps.map(c => c.wt)); comps.forEach(c => { c.w = c.wt / tw; });
  const score = Math.round(optSum(comps.map(c => c.s * c.w)));
  return { score, comps, band: score >= 67 ? 'g' : score >= 40 ? 'y' : 'r' };
}
/* deload triggers: HRV 7-day avg < 90% of 30-day baseline on 3 consecutive days, OR EWMA ACWR > 1.5, OR soreness >= 7 on 3 of the last 5 days */
function optTriggers(date) {
  const hrv = [0, 1, 2].every(k => { const s = optHrvStats(addDays(date, -k)); return s && s.ratio < .9; });
  const a = optAcwrAt(date), acwr = !!(a && a.ready && a.ewma > 1.5);
  const doms = optDays(date, 5).filter(d => ((S.checkins || {})[d] || {}).doms >= 7).length >= 3;
  const reasons = []; if (hrv) reasons.push('HRV has run below 90% of your baseline for 3 days'); if (acwr) reasons.push('load ratio is ' + a.ewma.toFixed(2) + ', above 1.5'); if (doms) reasons.push('soreness 7+ on 3 of the last 5 days');
  return { hrv, acwr, doms, any: hrv || acwr || doms, reasons };
}
function optDeloadCheck(date = isoDate()) {   /* returns triggers when the proposal should be shown now (once per episode) */
  optInit(); const d = S.deload, tr = optTriggers(date);
  if (!tr.any) { if (d.active) { d.active = false; d.shown = false; saveState(); } return null; }
  if (S.overrides[monOf(date)] === 'deload') { if (!d.active || !d.shown) { d.active = true; d.shown = true; saveState(); } return null; }
  if (!d.active) { d.active = true; d.start = date; d.shown = false; saveState(); }
  if (d.shown || (d.snooze && date < d.snooze)) return null;
  d.shown = true; saveState(); return tr;
}
function optDeloadSheet(tr) {
  openSheet('Bring the deload forward?', `<p style="margin-top:0">${esc(tr.reasons.map((r, i) => (i ? r : r[0].toUpperCase() + r.slice(1))).join('; '))}.</p><div class="card pad"><b>This week becomes a deload</b><div class="reason">2 sets per exercise, loads about 15% lighter, RPE 6.</div><div class="reason">No Day C circuit. Do 30 min of Zone 2 instead.</div></div><div style="display:grid;gap:8px;margin-top:14px"><button class="btn pri" data-action="optdeloadyes">Make this a deload week</button><button class="btn ghost" data-action="optdeloadno">Not now, ask again in 7 days</button></div>`, { close: 'Later' });
}
actions.optdeloadyes = () => {
  optInit(); const wk = monOf(isoDate()); S.overrides[wk] = 'deload';
  Object.keys(S.sessions).forEach(id => { const s = S.sessions[id]; if (s.status !== 'done' && monOf(s.date) === wk && !(s.ex || []).some(e => e.sets.some(x => x.done)) && !(s.rounds || []).some(Boolean)) delete S.sessions[id]; });
  saveState(); closeSheet(true); toast('Deload week set. Today and Train show the lighter plan.', { ms: 3500 }); curSess = null; render(false);
};
actions.optdeloadno = () => { optInit(); S.deload.snooze = addDays(isoDate(), 7); S.deload.shown = false; saveState(); closeSheet(); toast('Snoozed for 7 days'); };
actions.optdeloadundo = () => { optInit(); delete S.overrides[monOf(isoDate())]; saveState(); toast('Back to the normal week'); curSess = null; render(false); };
const optWeekDeload = date => !!(S.overrides && S.overrides[monOf(date)] === 'deload');
/* deload prescription: week-4 sets/reps/RPE, loads = 85% of the week the athlete was in */
const _optPresc = presc;
presc = function (key, wk, i) {
  const p = _optPresc(key, wk, i); if (wk === 4 || !S.overrides) return p;
  const date = slotEff(wk, { A: 0, B: 2, C: 4 }[key]); if (!optWeekDeload(date)) return p;
  const x = DAYS[key][i], w = x.w[wk - 1], d = x.w[3];
  p.sets = 2; p.reps = d[1]; p.rpeTarget = x.rpe[3];
  p.load = Object.assign({}, p.load, { value: w[2] != null ? Math.round(w[2] * .85 / 2.5) * 2.5 : null }); p.deload = true;
  return p;
};
const _optCtxFor = ctxFor;
ctxFor = function (date) {   /* deload weeks swap the Day C circuit for Zone 2 */
  const c = _optCtxFor(date);
  if (c.key === 'C' && c.phase === 'in' && c.slot && optWeekDeload(date)) { c.key = 'Z'; c.deloadC = true; }
  return c;
};
const _optDayLabel = dayLabel;
dayLabel = function (c) { const t = _optDayLabel(c); return c.phase === 'in' && S.overrides && optWeekDeload(c.date) && c.w !== 4 ? t.replace(/ · (Day|Zone|Rest)/, ' (deload, brought forward) · $1') : t; };

/* ---------- C. grip + asymmetry ---------- */
const optCI = d => (S.checkins || {})[d] || {};
const optGrip = (d, h) => { const g = optCI(d).grip; return g && g[h] != null && g[h] !== '' ? +g[h] : null; };
function optGripStats(date, dom) {
  dom = dom || (S.settings.opt && S.settings.opt.dom) || 'r'; const avg7 = {}, base = {}, n7 = {};
  ['l', 'r'].forEach(h => {
    const v = optDays(date, 7).map(d => optGrip(d, h)).filter(x => x != null); avg7[h] = optMean(v); n7[h] = v.length;
    let best = null;   /* best 14-day rolling average over the last 60 days (needs >= 4 readings in the window) */
    optDays(date, 60).forEach(e => { const w = optDays(e, 14).map(d => optGrip(d, h)).filter(x => x != null); if (w.length >= 4) { const m = optMean(w); if (best == null || m > best) best = m; } });
    base[h] = best;
  });
  const drop = avg7[dom] != null && base[dom] ? avg7[dom] / base[dom] - 1 : null, flag = drop != null && drop <= -.1 - 1e-9;
  const asym = avg7.l != null && avg7.r != null ? Math.abs(avg7.l - avg7.r) / Math.max(avg7.l, avg7.r) : null;
  return { avg7, base, n7, dom, drop, flag, asym, asymFlag: asym != null && asym > .1,
    text: flag ? `Grip ${String(Math.round(drop * 100)).replace('-', '\u2212')}% vs baseline. CNS fatigue likely, treat today as yellow.` : '' };
}

/* ---------- F. sleep regularity ---------- */
/* bed/wake in minutes since midnight for a night keyed by wake date; from Whoop sleep start/end or the check-in bed/wake fields */
function optSleepTimes(d) {
  const c = optCI(d); let bed = optParseHM(c.bed), wake = optParseHM(c.wake);
  if (bed == null || wake == null) {
    const w = optWh(d), sl = w && w.sleep; bed = wake = null;
    if (sl && sl.start && sl.end) { const a = new Date(sl.start), b = new Date(sl.end); if (!isNaN(a) && !isNaN(b)) { bed = a.getHours() * 60 + a.getMinutes(); wake = b.getHours() * 60 + b.getMinutes(); } }
  }
  if (bed == null || wake == null) return null;
  const dur = ((wake - bed) % 1440 + 1440) % 1440, bedN = bed < 18 * 60 ? bed + 1440 : bed;   /* bed normalised to [18:00, 42:00) */
  return { bed: bedN, wake, mid: (bed + dur / 2) % 1440 };
}
/* SRI (0-100) = 100 - mean |delta of sleep midpoint between consecutive nights| in hours x 12.5, clamped; 14-day window */
function optSri(end, days = 14) {
  const t = optDays(end, days).map(d => [d, optSleepTimes(d)]), dl = [];
  for (let i = 1; i < t.length; i++) if (t[i][1] && t[i - 1][1]) { let x = Math.abs(t[i][1].mid - t[i - 1][1].mid); x = Math.min(x, 1440 - x); dl.push(x / 60); }
  const all = t.map(x => x[1]).filter(Boolean), beds = all.map(x => x.bed), wakes = all.map(x => x.wake);
  if (dl.length < 3) return null;
  const mean = optMean(dl);
  return { sri: optClamp(100 - mean * 12.5, 0, 100), meanDelta: mean, n: all.length, bedMean: optMean(beds), wakeMean: optMean(wakes), bedSD: optSD(beds), wakeSD: optSD(wakes), bedMedian: optMedian(beds) };
}
function optAnchor() {   /* bedtime anchor: the user's target, else the median of recent bedtimes rounded to 10 min */
  const o = S.settings.opt || {}, tgt = optParseHM(o.bed);
  if (tgt != null) return { min: tgt, pm: 30, src: 'target' };
  const r = optSri(isoDate()); if (!r || r.n < 4) return null;
  return { min: Math.round(r.bedMedian / 10) * 10 % 1440, pm: optClamp(Math.round((r.bedSD || 30) / 5) * 5, 10, 60), src: 'median' };
}
function optWind(now = new Date()) {
  const a = optAnchor(); if (!a) return null; const nm = now.getHours() * 60 + now.getMinutes();
  if (nm < 21 * 60 && nm >= 5 * 60) return { a, chip: '' };
  const cur = nm < 5 * 60 ? nm + 1440 : nm, bed = a.min < 18 * 60 ? a.min + 1440 : a.min, wind = bed - 60;
  const chip = cur < wind ? `Wind-down in ${Math.floor((wind - cur) / 60)} h ${pad2((wind - cur) % 60)}` : cur < bed ? 'Wind down now' : 'Past bedtime';
  return { a, chip };
}

/* ---------- G. session density ---------- */
function optRestOf(prevT, curT, workSec) { return Math.max(0, (curT - prevT) / 1000 - workSec); }
function optTiming(s) {
  const exs = []; let work = 0, plan = 0, longest = 0, first = Infinity, last = 0;
  (s.ex || []).forEach(e => {
    if (e.skipped) return; const rest = (e.tgt && e.tgt.rest) || 60, ds = e.sets.filter(x => x.done);
    e.sets.forEach(st => { if (!st.skip || st.done) plan += optWorkSec(e, st) + rest; });
    const ts = ds.filter(x => x.t), rs = [];
    ds.forEach(st => { work += optWorkSec(e, st); if (st.t) { first = Math.min(first, st.t); last = Math.max(last, st.t); } });
    for (let i = 1; i < ts.length; i++) { const r = optRestOf(ts[i - 1].t, ts[i].t, optWorkSec(e, ts[i])); rs.push(r); longest = Math.max(longest, r); }
    if (rs.length) exs.push({ name: e.name, presc: rest, avg: optMean(rs), n: rs.length, over: optMean(rs) / rest });
  });
  const end = s.end || last, durS = s.start && end ? (end - s.start) / 1000 : last > first ? (last - first) / 1000 : 0;
  return { exs, longest, durMin: Math.round(durS / 60), plannedMin: Math.round(plan / 60), density: durS > 0 ? Math.min(1, work / durS) : null, worst: exs.slice().sort((a, b) => b.over - a.over)[0] || null, has: exs.length > 0 };
}
function optTimingLine(s) {
  const t = optTiming(s); if (!t.has) return '';
  const w = t.worst, shortN = n => n.replace(/^(DB|Half-kneeling) /, '').toLowerCase();
  return `Session ran ${t.durMin} min vs ~${t.plannedMin} planned. Rests averaged ${fmtMS(Math.round(w.avg))} vs ${fmtMS(w.presc)} on ${shortN(w.name)}.`;
}
const _optConfirm = confirmSet;
confirmSet = function () {
  const a = ui.act, st = a && curSess ? curSess.ex[a.ei].sets[a.si] : null, was = st && st.done;
  _optConfirm();
  if (!st || !st.done) return;
  delete st.skip; if (!st.t) st.t = Date.now();
  if (!was && a.si > 0) {   /* two long rests in a row -> one quiet nudge per session */
    const e = curSess.ex[a.ei], prev = e.sets.slice(0, a.si).reverse().find(x => x.done && x.t), pr = (e.tgt && e.tgt.rest) || 60;
    if (prev) {
      if (OPT.lr.sid !== curSess.id) OPT.lr = { sid: curSess.id, n: 0 };
      if (optRestOf(prev.t, st.t, optWorkSec(e, st)) > pr * 1.5) OPT.lr.n++; else if (OPT.lr.n < 99) OPT.lr.n = 0;
      if (OPT.lr.n === 2) { OPT.lr.n = 100; toast(`Rests running long. Timer is at ${fmtMS(pr)}.`, { ms: 3200 }); }
    }
  }
  saveSess();
};
const _optSetHTML = setHTML;
setHTML = function (s, ei, si) { const h = _optSetHTML(s, ei, si), st = s.ex[ei].sets[si]; return st.skip && !st.done ? h.replace('class="set ', 'class="set skp ') : h; };

/* ---------- D. lanes ---------- */
const OPT_KIND = { practice: 'Practice', league: 'League', tournament: 'Tournament' };
function optLaneGames() {
  const out = [], idx = optIndex();
  Object.entries(S.bowling || {}).forEach(([d, b]) => {
    const sc = (b.scores || []).map(Number).filter(x => x > 0 && x <= 300); if (!sc.length) return;
    const w = optWh(d), rs = w && w.recovery && w.recovery.score != null ? w.recovery.score : null, sh = optSleepH(d);
    const lower = [d, addDays(d, -1)].some(x => (idx[x] || []).some(s => s.key === 'A' && ((s.ex || []).some(e => e.sets.some(y => y.done)))));
    const ya = optAcwrAt(addDays(d, -1), idx);
    sc.forEach(v => out.push({ date: d, score: v, kind: b.kind || '', zone: rs == null ? null : rs >= 67 ? 'g' : rs >= 34 ? 'y' : 'r', sleep: sh == null ? null : sh < 6.5 ? 'lo' : sh <= 7.5 ? 'mid' : 'hi', lower, band: ya && ya.ready ? ya.band : null }));
  });
  return out;
}
const OPT_MINN = 5;
function optLanes() {
  const g = optLaneGames(), allAvg = optMean(g.map(x => x.score));
  const sect = (title, items) => ({ title, groups: items.map(([label, phrase, pred]) => { const sc = g.filter(pred).map(x => x.score); return { label, phrase, n: sc.length, avg: optMean(sc), enough: sc.length >= OPT_MINN, delta: sc.length >= OPT_MINN && allAvg != null ? optMean(sc) - allAvg : null }; }) });
  const sections = [
    sect('Whoop recovery', [['Green', 'on green days', x => x.zone === 'g'], ['Yellow', 'on yellow days', x => x.zone === 'y'], ['Red', 'on red days', x => x.zone === 'r']]),
    sect('Sleep the night before', [['Under 6.5 h', 'after under 6.5 h sleep', x => x.sleep === 'lo'], ['6.5 to 7.5 h', 'after 6.5 to 7.5 h sleep', x => x.sleep === 'mid'], ['Over 7.5 h', 'after over 7.5 h sleep', x => x.sleep === 'hi']]),
    sect('Legs lifted in the last 24 h', [['Yes', 'with leg work in the last 24 h', x => x.lower], ['No', 'with no leg work in 24 h', x => !x.lower]]),
    sect('Load band the day before', [['Under', 'after a light-load day', x => x.band === 'under'], ['Sweet spot', 'in the sweet spot', x => x.band === 'sweet'], ['Caution', 'in the caution band', x => x.band === 'caution'], ['Danger', 'in the danger band', x => x.band === 'danger']])
  ];
  const lines = []; sections.forEach(s => s.groups.forEach(x => { if (x.enough) lines.push(`${x.delta >= 0 ? '+' : '−'}${Math.abs(x.delta).toFixed(1)} pins ${x.phrase}, ${x.n} games`); }));
  const byKind = Object.keys(OPT_KIND).map(k => { const sc = g.filter(x => x.kind === k).map(x => x.score); return { k, n: sc.length, avg: optMean(sc) }; }).filter(x => x.n);
  return { games: g.length, avg: allAvg, sections, lines, byKind };
}
function optLaneBlock() {   /* compact lines for the weekly review text */
  const L = optLanes(); if (!L.games) return '';
  return `Lanes avg ${Math.round(L.avg)} (${L.games} gms)` + (L.lines.length ? '; ' + L.lines.slice(0, 2).join('; ') : '');
}
function optWeeklyReview(ws, we) {
  const ser = optSeries(we), all = optAcwrAll(ser).filter(x => x.date >= ws && x.date <= we && x.ready);
  if (!all.length) return { peak: null, out: 0, text: '' };
  const peak = all.reduce((a, b) => b.ewma > a.ewma ? b : a), out = all.filter(x => x.ewma < .8 || x.ewma > 1.3).length;
  return { peak: peak.ewma, peakDate: peak.date, out, text: `ACWR peak ${peak.ewma.toFixed(2)}, ${out} day${out === 1 ? '' : 's'} outside 0.8-1.3` };
}
function optLaneSheet(date) {
  optInit(); date = date || isoDate(); const b = S.bowling[date] || {}, k = b.kind || 'practice';
  openSheet('Lane scores', `<p class="muted" style="margin-top:0">${fmtDate(date, { weekday: 'long', day: 'numeric', month: 'short' })}</p><div class="lbl" style="margin-top:0">Session type</div><div class="chips o">${Object.entries(OPT_KIND).map(([v, l]) => `<button class="chip" data-action="optkind" data-v="${v}" aria-pressed="${k === v}">${l}</button>`).join('')}</div><div class="lbl">Pattern</div><input id="olpat" placeholder="Kegel Dead Man's Curve" value="${esc(b.pattern || '')}" aria-label="Oil pattern"><div class="lbl">Game scores, comma separated</div><input id="olsc" inputmode="numeric" placeholder="212, 189, 224" value="${esc((b.scores || []).join(', '))}" aria-label="Game scores">${b.hours == null && b.h == null ? `<div class="lbl">Hours on the lanes</div><input id="olhr" inputmode="decimal" placeholder="2.5" aria-label="Hours on the lanes">` : ''}<button class="btn pri" style="margin-top:16px" data-action="optlanesave" data-date="${date}">Save lane scores</button>`, { close: 'Cancel' });
  OPT.laneKind = k;
}
actions.optkind = el => { OPT.laneKind = el.dataset.v; $$('[data-action=optkind]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === OPT.laneKind))); };
actions.optlanesave = el => {
  optInit(); const d = el.dataset.date, sc = ($('#olsc').value.match(/\d+/g) || []).map(Number).filter(x => x > 0 && x <= 300);
  if (!sc.length) return toast('Add at least one game score');
  const b = S.bowling[d] = Object.assign({ games: sc.length }, S.bowling[d] || {});
  b.scores = sc; b.kind = OPT_KIND[OPT.laneKind] ? OPT.laneKind : 'practice'; b.pattern = $('#olpat').value.trim(); if (b.games == null || typeof b.games === 'number') b.games = Math.max(+b.games || 0, sc.length);
  const hr = $('#olhr') && num($('#olhr').value); if (hr != null) b.hours = hr; b.u = Date.now();
  saveState(); closeSheet(true); toast(`Saved ${sc.length} game${sc.length === 1 ? '' : 's'}, average ${Math.round(optMean(sc))}`); render();
};
actions.optlane = () => optLaneSheet(isoDate());

/* ---------- E. travel ---------- */
function optTzOff(tz, ms) {   /* UTC offset in minutes of an IANA zone at an instant */
  const p = {}; new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(ms)).forEach(x => { p[x.type] = x.value; });
  return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(ms / 1000) * 1000) / 60000);
}
const optTzOk = tz => { try { optTzOff(tz, Date.now()); return true; } catch (e) { return false; } };
const optTzCity = tz => (tz || '').split('/').pop().replace(/_/g, ' ');
function optShift(from, to, whenISO) { const ms = Date.parse(whenISO + (whenISO.length <= 10 ? 'T12:00:00Z' : ':00Z')); return (optTzOff(to, ms) - optTzOff(from, ms)) / 60; }   /* hours the destination clock is ahead (+ = eastward) */
function optTripPhases(t) {
  const d = optShift(t.from, t.to, t.out);
  return [{ id: 'out', anchor: t.out.slice(0, 10), delta: d, from: t.from, to: t.to, label: 'Outbound to ' + optTzCity(t.to) }, { id: 'back', anchor: t.back.slice(0, 10), delta: -optShift(t.from, t.to, t.back), from: t.to, to: t.from, label: 'Return to ' + optTzCity(t.from) }];
}
/* Jet-lag plan, day -3 .. +3 around the flight. Before the flight: shift bed/wake 1 h per day toward the destination (capped at the
   zone difference); eastward = earlier, westward = later. After landing: local clock straight away. */
function optJetPlan(ph, habit = { bed: 23 * 60, wake: 7 * 60 }) {
  const dl = ph.delta, dir = dl >= 0 ? 1 : -1, ad = Math.abs(dl), out = [];
  if (ad < 1) return out;
  for (let k = -3; k <= 3; k++) {
    const away = k > 0, sh = k < 0 ? Math.min(ad, k + 4) : k === 0 ? Math.min(ad, 3) : 0, bed = habit.bed - dir * sh * 60, wake = habit.wake - dir * sh * 60;
    const east = dir > 0, tzL = away ? optTzCity(ph.to) : optTzCity(ph.from);
    const light = east ? { seek: `${optHM(wake)} to ${optHM(wake + 180)}`, avoid: `${optHM(bed - 180)} to ${optHM(bed)}` } : { seek: `${optHM(bed - 240)} to ${optHM(bed - 60)}`, avoid: `${optHM(wake)} to ${optHM(wake + 120)}` };
    const mel = east ? (k === 0 ? 'Only if you sleep during destination night. Check with your doctor first.' : `0.5 mg at ${optHM(bed - 30)}${away ? ' (up to 3 mg, 3 nights)' : ''}. Check with your doctor first.`) : (k < 0 ? 'Not needed going west. Check with your doctor first.' : 'Only if you wake far too early: 0.5 mg after 04:00. Check with your doctor first.');
    out.push({ k, date: addDays(ph.anchor, k), shift: sh * dir, bedMin: bed < 18 * 60 ? bed + 1440 : bed, bed: optHM(bed), wake: optHM(wake), tz: tzL, away, light, caffeine: optHM(bed - 480), melatonin: mel,
      meals: { b: optHM(wake + 60), l: optHM(wake + 300), d: optHM(bed - 180) },
      note: k === -3 ? 'Start shifting. Hold the new times.' : k === 0 ? `Flight day. Set your watch to ${optTzCity(ph.to)} time. Sleep when it is night there.` : k === 1 ? 'Local time from the first morning. Get outside early; nap 20 min at most.' : '' });
  }
  return out;
}
function optActiveTrip(date = isoDate()) {
  optInit(); for (const t of S.travel.trips) { if (!t.out || !t.back) continue; if (date >= addDays(t.out.slice(0, 10), -3) && date <= addDays(t.back.slice(0, 10), 3)) return t; } return null;
}
const optAway = (t, date) => !!t && date >= t.out.slice(0, 10) && date <= t.back.slice(0, 10);
function optTripToday(date = isoDate()) {
  const t = optActiveTrip(date); if (!t) return null;
  const hb = optParseHM(S.settings.opt.bed), a = optAnchor(), habit = { bed: hb != null ? hb : a ? a.min : 23 * 60, wake: 7 * 60 };
  for (const ph of optTripPhases(t)) { const plan = optJetPlan(ph, habit), day = plan.find(x => x.date === date); if (day) return { trip: t, phase: ph, plan, day, away: optAway(t, date) }; }
  return { trip: t, phase: null, plan: [], day: null, away: optAway(t, date) };
}
/* hotel gym substitutions: matched on exercise name, or on the movement `pattern` field when the library has one */
const OPT_HOTEL = [
  { re: /trap bar deadlift|deadlift/i, pat: 'hinge', v: { dumbbells: 'DB Romanian deadlift', bands: 'Band good-morning', machines: 'DB Romanian deadlift', none: 'Single-leg RDL' } },
  { re: /leg press|squat/i, pat: 'squat', v: { dumbbells: 'DB goblet squat or step-up', bands: 'Banded squat', machines: 'Leg press (machine)', none: 'Split squat' } },
  { re: /sled push/i, pat: 'carry-push', v: { dumbbells: 'Incline treadmill push', bands: 'Band-resisted march', machines: 'Incline treadmill push', none: 'Hill sprints' } },
  { re: /landmine press/i, pat: 'vpush', v: { dumbbells: 'Single-arm DB press', bands: 'Band press-out', machines: 'Single-arm DB press', none: 'Pike push-up' } },
  { re: /chest-supported row|row/i, pat: 'hpull', v: { dumbbells: 'DB row', bands: 'Band row', machines: 'Machine row', none: 'Backpack row' } },
  { re: /skierg/i, pat: 'cond', v: { dumbbells: 'Treadmill intervals', bands: 'Band pull-through', machines: 'Treadmill intervals', none: 'Shadow boxing' } },
  { re: /wall ball/i, pat: 'thruster', v: { dumbbells: 'DB thrusters', bands: 'Banded thrusters', machines: 'DB thrusters', none: 'Squat to press' } },
  { re: /kb swing|kettlebell swing/i, pat: 'swing', v: { dumbbells: 'DB swings', bands: 'Band pull-throughs', machines: 'DB swings', none: 'Hip hinge jumps' } },
  { re: /lat pulldown/i, pat: 'vpull', v: { dumbbells: 'DB pullover or band pulldown', bands: 'Band pulldown', machines: 'Lat pulldown (machine)', none: 'Door row' } }
];
function optHotelVariant(name, pattern, equip) {
  if (!equip) return null;
  const hit = OPT_HOTEL.find(h => h.re.test(name)) || (pattern ? OPT_HOTEL.find(h => h.pat === pattern) : null);
  if (!hit || !hit.v[equip]) return null; if (/\(machine\)/.test(hit.v[equip])) return null;
  return hit.v[equip];
}
const _optExHead = exHeadHTML;
exHeadHTML = function (s, ei) {
  const h = _optExHead(s, ei), t = optActiveTrip(s.date || isoDate()); if (!t || !optAway(t, s.date || isoDate()) || t.equip === 'full') return h;
  const e = s.ex[ei], v = optHotelVariant(e.name, e.tgt && e.tgt.pattern, t.equip); if (!v || e.name === v) return h;
  return h.replace(/<\/div><span class="pill/, `<button class="o-hotel" data-action="opthotel" data-ex="${ei}" data-v="${esc(v)}">Hotel gym: ${esc(v)}. Tap to use</button></div><span class="pill`);
};
actions.opthotel = el => { const s = curSess, e = s.ex[+el.dataset.ex], v = el.dataset.v, t = adaptPresc(Object.assign({}, e.tgt, { name: e.name }), v), left = e.sets.filter(x => !x.done).length; e.hotel = e.name; e.hotelTgt = e.tgt; e.name = v; e.tgt = t; e.sets = e.sets.filter(x => x.done).concat(freshSets(t, left, recDate(s))); saveSess(); render(); toast('Swapped for this session only · ' + prescText(t)); };
const _optRounds = roundsHTML;
roundsHTML = function (s, slot) {
  const h = _optRounds(s, slot), t = optActiveTrip(s.date || isoDate()); if (!t || !optAway(t, s.date || isoDate())) return h;
  const eq = t.equip || 'dumbbells', lines = [['Wall balls', 'wall ball'], ['KB swing', 'KB swing'], ['Sled pull', 'sled push']].map(([n, m]) => { const v = optHotelVariant(m, '', eq); return v ? `${n} → ${v}` : ''; }).filter(Boolean);
  return lines.length ? h + `<div class="rule">Hotel gym (${esc(eq)}): ${lines.map(esc).join('; ')}.</div>` : h;
};

/* ---------- H. voice logging ---------- */
const OPT_NW = { zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
const OPT_TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
function optWordsToDigits(str) {
  const tk = str.split(/\s+/).filter(Boolean), out = [], isU = t => t in OPT_NW && t !== 'oh', isN = t => isU(t) || t in OPT_TENS || t === 'hundred';
  for (let i = 0; i < tk.length;) {
    if (!isN(tk[i])) { out.push(tk[i++]); continue; }
    let v = 0, j = i;
    if (isU(tk[j])) { v = OPT_NW[tk[j++]]; if (tk[j] === 'hundred') { v *= 100; j++; if (tk[j] === 'and' && (tk[j + 1] in OPT_TENS || isU(tk[j + 1]))) j++; if (tk[j] in OPT_TENS) { v += OPT_TENS[tk[j++]]; if (isU(tk[j]) && OPT_NW[tk[j]] < 10) v += OPT_NW[tk[j++]]; } else if (isU(tk[j]) && v >= 100) v += OPT_NW[tk[j++]]; } }
    else if (tk[j] in OPT_TENS) { v = OPT_TENS[tk[j++]]; if (isU(tk[j]) && OPT_NW[tk[j]] > 0 && OPT_NW[tk[j]] < 10) v += OPT_NW[tk[j++]]; }
    else if (tk[j] === 'hundred') { v = 100; j++; if (tk[j] in OPT_TENS) { v += OPT_TENS[tk[j++]]; if (isU(tk[j]) && OPT_NW[tk[j]] < 10) v += OPT_NW[tk[j++]]; } }
    if (tk[j] === 'point' && isU(tk[j + 1])) { j++; let dg = ''; while (isU(tk[j]) && OPT_NW[tk[j]] < 10) dg += OPT_NW[tk[j++]]; v = parseFloat(v + '.' + dg); }
    else if (tk[j] === 'and' && tk[j + 1] === 'a' && tk[j + 2] === 'half') { v += .5; j += 3; }
    out.push(String(v)); i = j;
  }
  return out.join(' ');
}
/* "twenty two eight seven" -> w22 r8 rpe7; "22 kilos 8 reps RPE 7"; "same weight 8 at 8"; "bodyweight 12" */
function optParseVoice(txt, fields = ['w', 'r', 'rpe']) {
  let s = ' ' + optWordsToDigits(String(txt || '').toLowerCase().replace(/[-,]/g, ' ').replace(/\bk g\b/g, 'kg')) + ' ';
  const o = {}, N = '(\\d+(?:\\.\\d+)?)', take = (re, f) => { s = s.replace(re, (m, a) => { f(a); return ' '; }); };
  take(new RegExp('\\b(?:rpe|r p e|rp e)\\s*(?:of|at|is)?\\s*' + N), a => { o.rpe = +a; });
  take(new RegExp(N + '\\s*(?:kilos?|kilograms?|kgs?)\\b'), a => { o.w = +a; });
  take(new RegExp(N + '\\s*(?:reps?|repetitions?|times)\\b'), a => { o.r = +a; });
  take(new RegExp(N + '\\s*(?:seconds?|secs?|metres?|meters?)\\b'), a => { o.r = +a; });
  if (/\bsame\b/.test(s)) { o.same = true; s = s.replace(/\bsame(?: weight| again| as before)?\b/, ' '); }
  if (/\b(?:body ?weight|bw|no weight)\b/.test(s)) { o.bw = true; o.w = 0; s = s.replace(/\b(?:body ?weight|bw|no weight)\b/, ' '); }
  const free = fields.filter(f => o[f] == null && !(f === 'w' && o.same)), nums = (s.match(/\d+(?:\.\d+)?/g) || []).map(Number);
  free.forEach((f, i) => { if (nums[i] != null) o[f] = nums[i]; });
  if (o.rpe != null && (o.rpe < 1 || o.rpe > 10)) delete o.rpe;
  if (o.r != null && (o.r < 0 || o.r > 1000)) delete o.r;
  o.ok = ['w', 'r', 'rpe'].some(f => o[f] != null) || !!o.same;
  return o;
}
function optApplyVoice(p) {
  const a = ui.act; if (!a || !curSess) return false; const e = curSess.ex[a.ei], st = e.sets[a.si], fl = fieldsFor(e.tgt).map(f => f.k);
  if (p.same) { const pv = e.sets.slice(0, a.si).reverse().find(x => x.w != null) || e.sets.find(x => x.w != null); if (pv) p.w = pv.w; }
  ['w', 'r', 'rpe'].forEach(f => { if (p[f] != null && fl.includes(f)) st[f] = p[f]; });
  a.fresh = true; a.buf = null; saveSess(); return true;
}
const optVoiceSR = () => window.SpeechRecognition || window.webkitSpeechRecognition;
const _optPad = padHTML;
padHTML = function (e, ei, si) {
  let h = _optPad(e, ei, si); const SR = optVoiceSR(); if (!SR) return h;
  const vx = OPT.vx && OPT.vx.until > Date.now() ? `<div class="o-vx" id="optvx" role="status">${esc(OPT.vx.text)}</div>` : '';
  return h.replace('</div><div class="keys">', `<button class="fld o-mic${OPT.rec ? ' live' : ''}" data-action="optmic" aria-label="${OPT.rec ? 'Stop listening' : 'Speak your set'}" aria-pressed="${!!OPT.rec}"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21"/></svg></button></div>${vx}<div class="keys">`);
};
function optPadRefresh() { if (ui.act && typeof refreshSet === 'function' && curSess) refreshSet(ui.act.ei, ui.act.si); }
actions.optmic = () => {
  const SR = optVoiceSR(); if (!SR || !ui.act) return;
  if (OPT.rec) { try { OPT.rec.stop(); } catch (e) { } return; }
  const r = new SR(); r.lang = 'en-IE'; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1; OPT.rec = r;
  OPT.vx = { text: 'Listening…', until: Date.now() + 9000 };
  r.onresult = ev => {
    let t = '', fin = false; for (let i = 0; i < ev.results.length; i++) { t += ev.results[i][0].transcript; fin = ev.results[i].isFinal; }
    const e = ui.act && curSess ? curSess.ex[ui.act.ei] : null, p = optParseVoice(t, e ? fieldsFor(e.tgt).map(f => f.k) : undefined);
    OPT.vx = { text: `"${t.trim()}"` + (fin ? (p.ok ? ' ✓' : ' – not understood') : ''), until: Date.now() + 4500 };
    if (fin && p.ok) optApplyVoice(p);
    optPadRefresh();
  };
  r.onerror = ev => { OPT.vx = { text: ev.error === 'not-allowed' ? 'Microphone permission denied' : ev.error === 'no-speech' ? 'Heard nothing' : 'Voice entry failed', until: Date.now() + 3500 }; };
  r.onend = () => { OPT.rec = null; optPadRefresh(); };
  try { r.start(); } catch (e) { OPT.rec = null; OPT.vx = { text: 'Voice entry unavailable', until: Date.now() + 3000 }; }
  optPadRefresh();
};

/* ---------- I. day-type nutrition ---------- */
const OPT_DT = { lift: ['Lift day', 1.15], cond: ['Conditioning', 1.25], bowl: ['Bowling day', 1.1], rest: ['Rest day', .8] };
function optDayTypeAuto(date) {
  const c = ctxFor(date), set = [];
  if ((S.bowling || {})[date]) set.push('bowl');
  if (c.phase === 'in' && c.slot && (c.key === 'C' || (c.deloadC))) set.push(c.deloadC ? 'rest' : 'cond');
  if (c.phase === 'in' && (c.key === 'A' || c.key === 'B')) set.push('lift');
  const pick = set.filter(x => OPT_DT[x]).sort((a, b) => OPT_DT[b][1] - OPT_DT[a][1])[0];   /* if more than one applies, the highest-carb type wins */
  return pick || 'rest';
}
const optDayType = date => { const o = (S.dayType || {})[date]; return o && OPT_DT[o] ? o : optDayTypeAuto(date); };
function optDerivedTargets(type, base) {   /* protein constant, carbs scaled, calories constant, fat fills (floor 50 g, calories rise to cover it) */
  const t = base || S.settings.targets, c = Math.round(t.c * OPT_DT[type][1]); let f = Math.round((t.kcal - 4 * t.p - 4 * c) / 9), kcal = t.kcal;
  if (f < 50) { f = 50; kcal = 4 * t.p + 4 * c + 9 * f; }
  return { kcal: Math.round(kcal), p: t.p, c, f };
}
function optTargetsFor(date) { const ty = optDayType(date), ov = (S.settings.opt && S.settings.opt.nut || {})[ty]; return Object.assign({}, optDerivedTargets(ty), ov || {}); }
function optFoodCtx(date) {
  date = date || ui.logDate || isoDate(); const ty = optDayType(date);
  if (date === isoDate()) {
    const now = new Date(), nm = now.getHours() * 60 + now.getMinutes(), tt = optParseHM(S.settings.opt.trainTime) || 1050, plan = ctxFor(date), todo = ty !== 'rest' && !(plan.status === 'done');
    if (OPT.preSession || (todo && nm >= tt - 180 && nm <= tt + 30)) return 'pre';
  }
  return ty === 'rest' ? 'rest' : 'normal';
}
/* scoreFood with context: pre-session raises the sugar "high" line to 25 g/100 g and credits carbs; rest day lowers it to 10 g/100 g */
const _optScoreFood = scoreFood;
scoreFood = function (product, goals) {
  const ctx = (goals && goals.ctx) || OPT.vctx, n = (product && product.nutriments) || {}, sug = n['sugars_100g'];
  if (!ctx || ctx === 'normal' || sug == null) return _optScoreFood(product, goals);
  const hi = ctx === 'pre' ? 25 : 10, k = 15 / hi, p2 = Object.assign({}, product, { nutriments: Object.assign({}, n, { 'sugars_100g': sug * k }) }), v = _optScoreFood(p2, goals);
  v.reasons = v.reasons.map(r => r.replace(/^Sugar: [\d.]+ g per 100 g \((\w+)\)/, (m, g) => `Sugar: ${r1(sug)} g per 100 g (${g} for ${ctx === 'pre' ? 'pre-session' : 'a rest day'})`));
  const carb = n['carbohydrates_100g'], nova = product.nova_group != null ? +product.nova_group : null, sh = sug >= hi;
  if (ctx === 'pre' && carb != null && carb >= 30) {
    v.reasons.push(`Carbs: ${r1(carb)} g per 100 g, useful before training`);
    if (v.grade === 'red' && nova === 4 && !sh) { v.grade = 'amber'; v.headline = 'Fine pre-session; skip on rest days'; }
    else if (v.grade === 'amber' && !sh && (nova == null || nova <= 3)) { v.grade = 'green'; v.headline = sug >= 15 ? 'Fine pre-session; skip on rest days' : 'Good carbs before training'; }
  }
  if (ctx === 'rest' && sh && nova !== 4) v.headline = 'Sugary for a rest day';
  v.headline = v.headline.slice(0, 60); return v;
};
const _optShowVerdict = showVerdict;
showVerdict = function (p, sv) { OPT.vctx = optFoodCtx(); try { return _optShowVerdict(p, sv); } finally { OPT.vctx = null; } };

/* ---------- UI: Today ---------- */
const OPT_RZ = { g: ['var(--ok)', 'Good to go'], y: ['var(--amber)', 'Take it steady'], r: ['var(--red)', 'Pull back'] };
function optTiles(date) {
  const rd = optReadiness(date), pr = optProjected(date), a = pr.acwr, ready = a && a.ready, plan = pr.plan;
  let t1;
  if (rd) { const z = OPT_RZ[rd.band], circ = 2 * Math.PI * 22; t1 = `<button class="card o-tile" style="--oz:${z[0]}" data-action="optready" aria-label="Readiness ${rd.score} out of 100, ${z[1]}. Show details"><svg class="o-ring" viewBox="0 0 56 56" aria-hidden="true"><circle cx="28" cy="28" r="22" class="rt"/><circle cx="28" cy="28" r="22" class="rv" stroke-dasharray="${(circ * rd.score / 100).toFixed(1)} ${circ.toFixed(1)}" transform="rotate(-90 28 28)"/><text x="28" y="34" text-anchor="middle">${rd.score}</text></svg><span class="o-tx"><b>Readiness</b><span>${z[1]}</span></span></button>`; }
  else t1 = `<button class="card o-tile" style="--oz:var(--line2)" data-action="optready"><span class="o-tx"><b>Readiness</b><span>Log sleep and soreness to see it</span></span></button>`;
  let t2;
  if (ready) { const b = OPT_BAND[a.band]; t2 = `<button class="card o-tile col" style="--oz:${b.c}" data-action="optload" aria-label="Load ratio ${a.ewma.toFixed(2)}, ${b.n}. Show details"><span class="o-tx"><b>Load</b></span><span class="o-big tn" style="color:${b.c}">${a.ewma.toFixed(2)}</span><span class="o-tx"><span>${b.n}${plan ? ' after today' : ', today so far'}</span></span></button>`; }
  else { const n = a ? a.n : 0; t2 = `<button class="card o-tile" style="--oz:var(--line2)" data-action="optload"><span class="o-tx"><b>Load</b><span>Building baseline, day ${Math.min(n, 14)} of 14</span></span></button>`; }
  let h = `<div class="o-tiles">${t1}${t2}</div>`;
  const tr = optTrim(date);
  if (tr && tr.skip.length) h += `<div class="card pad o-adv" style="--oz:${OPT_BAND[optBandOf(tr.before)].c}"><div>${esc(tr.text)}</div><button class="btn sm pri" data-action="opttrim">Apply trim</button></div>`;
  return h;
}
function optTodayHTML(date) {
  optInit(); let h = optTiles(date);
  if (optWeekDeload(date)) h += `<div class="card pad o-adv" style="--oz:var(--o)"><div><b>Deload week.</b> 2 sets per exercise, about 15% lighter, no Day C circuit.</div><button class="btn sm" data-action="optdeloadundo">Undo</button></div>`;
  const gs = optGripStats(date); if (gs.flag) h += `<div class="card pad o-adv" style="--oz:var(--amber)"><div>${esc(gs.text)}</div></div>`;
  const w = optWind(); if (w) { const sr = optSri(date); h += `<div class="card pad o-bed"><div class="grow"><b>Bedtime anchor</b><div class="s muted">${optHM(w.a.min)} ± ${w.a.pm} min${w.a.src === 'target' ? ', your target' : ''}${sr ? ' · regularity ' + Math.round(sr.sri) : ''}</div></div>${w.chip ? `<span class="pill o" id="optwind">${w.chip}</span>` : ''}</div>`; }
  const tt = optTripToday(date);
  if (tt) {
    const t = tt.trip, away = tt.away, d = tt.day;
    h += `<div class="sec" style="margin-top:14px"><span>${away ? 'Away · ' + esc(optTzCity(t.to)) : 'Trip to ' + esc(optTzCity(t.to))}</span>${tt.plan.length ? '<button data-action="opttripplan">Full plan</button>' : ''}</div><div class="card">`;
    if (away) h += `<div class="row"><div class="grow"><div class="t">${esc(optTzCity(t.to))} <span class="pill o">UTC${(optTzOff(t.to, Date.now()) / 60 >= 0 ? '+' : '') + optTzOff(t.to, Date.now()) / 60}</span></div><div class="s">Hotel gym: ${esc(t.equip || 'dumbbells')}. Streaks and load carry on unchanged.</div></div></div>`;
    if (d) {
      const items = [['bed', `Bed by ${d.bed}`, d.tz + ' time'], ['wake', `Wake ${d.wake}`, ''], ['light', `Light: seek ${d.light.seek}`, `avoid ${d.light.avoid}`], ['caf', `No caffeine after ${d.caffeine}`, ''], ['mel', 'Melatonin', d.melatonin], ['meal', `Meals ${d.meals.b} · ${d.meals.l} · ${d.meals.d}`, 'breakfast, lunch, dinner']];
      h += `<div class="row"><div class="grow"><div class="t">${esc(tt.phase.label)}: day ${d.k > 0 ? '+' + d.k : d.k}</div><div class="s">${esc(d.note || (d.shift ? `Shifted ${Math.abs(d.shift)} h ${d.shift > 0 ? 'earlier' : 'later'}` : ''))}</div></div></div>`;
      items.forEach(([k, t1, t2]) => { const on = S.travel.done[date + '|' + k]; h += `<button class="row ${on ? 'on' : ''}" data-action="opttravtoggle" data-k="${k}">${checkIco}<div class="grow"><div class="t strike">${esc(t1)}</div>${t2 ? `<div class="s">${esc(t2)}</div>` : ''}</div></button>`; });
    }
    h += '</div>';
  }
  const z = S.zone2[date];
  h += `<div class="o-acts"><button class="btn sm" data-action="optzone2">${z ? `Zone 2: ${z.min} min · edit` : 'Log Zone 2'}</button><button class="btn sm" data-action="optlane">Lane scores</button></div>`;
  return h;
}
const _optToday = screens.today;
screens.today = function () {
  optInit(); optSyncLoad(); const h = _optToday(), add = optTodayHTML(isoDate()), i = h.indexOf('<div class="hero');
  return i < 0 ? h + add : h.slice(0, i) + add + h.slice(i);
};
actions.optready = () => {
  const date = isoDate(), r = optReadiness(date);
  if (!r) return openSheet('Readiness', `<div class="empty">Log sleep and soreness in a check-in to see your score.</div>`);
  openSheet('Readiness ' + r.score, `<p class="muted" style="margin-top:0">Weighted blend of what you have today. Missing inputs are dropped and the rest reweighted.</p><div class="card">${r.comps.map(c => `<div class="row"><div class="grow"><div class="t">${esc(c.l)}</div><div class="s">${esc(c.t)} · weight ${Math.round(c.w * 100)}%</div></div><b class="tn">${Math.round(c.s)}</b></div>`).join('')}</div><div class="rule">Recovery 40%, sleep vs 8 h 20%, HRV vs baseline 20%, soreness 10%, yesterday's load band 10%. Advisory only.</div>`);
};
actions.optload = () => {
  const date = isoDate(), pr = optProjected(date), a = pr.acwr;
  if (!a || !a.ready) return openSheet('Training load', `<div class="empty">Building your baseline: ${a ? a.n : 0} of 14 days so far. The ratio compares this week with your 4-week average, so it needs two weeks of history.</div>`);
  const b = OPT_BAND[a.band], wk = optWeeklyReview(addDays(date, -((parseISO(date).getDay() + 6) % 7)), date), tr = optTrim(date);
  openSheet('Training load', `<div class="o-hero" style="--oz:${b.c}"><b class="tn">${a.ewma.toFixed(2)}</b><span>${b.n}</span></div><p class="muted">${pr.plan ? 'Projected after today\'s planned session.' : 'Today so far.'} Headline is the EWMA ratio; the simple 7:28 day ratio is ${a.coupled == null ? 'n/a' : a.coupled.toFixed(2)}.</p><div class="card"><div class="row"><div class="grow">Today's load</div><b class="tn">${pr.parts.total}</b></div><div class="row"><div class="grow">Acute (7-day EWMA)</div><b class="tn">${a.acute.toFixed(1)}</b></div><div class="row"><div class="grow">Chronic (28-day EWMA)</div><b class="tn">${a.chronic.toFixed(1)}</b></div>${wk.text ? `<div class="row"><div class="grow">This week</div><span class="muted">${esc(wk.text)}</span></div>` : ''}</div>${tr && tr.skip.length ? `<div class="rule">${esc(tr.text)}</div><button class="btn pri" data-action="opttrim">Apply trim</button>` : ''}<div class="rule">Under 0.8 undertraining, 0.8 to 1.3 sweet spot, 1.3 to 1.5 caution, over 1.5 danger.</div>`);
};
actions.optzone2 = () => {
  optInit(); const z = S.zone2[isoDate()] || {};
  openSheet('Zone 2', `<div class="lbl" style="margin-top:0">Minutes</div><input id="oz2m" inputmode="numeric" placeholder="35" value="${z.min ?? ''}" aria-label="Zone 2 minutes"><div class="lbl">Effort (RPE 1 to 10)</div><input id="oz2r" inputmode="decimal" placeholder="4" value="${z.rpe ?? ''}" aria-label="Zone 2 RPE"><button class="btn pri" style="margin-top:16px" data-action="optz2save">Save Zone 2</button>${z.min ? `<button class="btn danger" style="margin-top:8px" data-action="optz2save" data-clear="1">Remove entry</button>` : ''}`, { close: 'Cancel' });
};
actions.optz2save = el => {
  optInit(); const d = isoDate(), m = num($('#oz2m').value);
  if (el.dataset.clear) delete S.zone2[d]; else { if (!m || m <= 0 || m > 300) return toast('Enter the minutes, 1 to 300'); S.zone2[d] = { min: m, rpe: num($('#oz2r').value), u: Date.now() }; }
  saveState(); closeSheet(true); toast(el.dataset.clear ? 'Removed' : 'Zone 2 saved'); render();
};
actions.opttravtoggle = el => { optInit(); const k = isoDate() + '|' + el.dataset.k; if (S.travel.done[k]) delete S.travel.done[k]; else S.travel.done[k] = 1; saveState(); vib(6); render(); };
actions.opttripplan = () => {
  const tt = optTripToday(); if (!tt || !tt.phase) return;
  openSheet(tt.phase.label, `<p class="muted" style="margin-top:0">${Math.abs(tt.phase.delta)} h ${tt.phase.delta > 0 ? 'ahead (eastward): shift earlier' : 'behind (westward): shift later'}. Times are local to where you are that day.</p><div class="card">${tt.plan.map(d => `<div class="row" style="align-items:flex-start"><div style="width:52px" class="t tn">${d.k > 0 ? '+' + d.k : d.k}</div><div class="grow"><div class="t">${fmtDate(d.date, { weekday: 'short', day: 'numeric', month: 'short' })} · bed ${d.bed}, wake ${d.wake}</div><div class="s">Light ${d.light.seek}. Caffeine off ${d.caffeine}. ${esc(d.note)}</div></div></div>`).join('')}</div>`);
};

/* ---------- UI: Log ---------- */
function optCheckExtra(date) {
  const ci = optCI(date), v = (o, k) => o && o[k] != null ? o[k] : '', gs = optGripStats(date);
  const f = (k, l, ph, mode = 'decimal', type = 'text') => `<div><div class="lbl" style="margin-top:0">${l}</div><input data-in="optci" data-k="${k}" type="${type}" ${type === 'text' ? `inputmode="${mode}"` : ''} placeholder="${ph}" value="${esc(k.indexOf('.') > 0 ? v(ci[k.split('.')[0]], k.split('.')[1]) : ci[k] ?? '')}" aria-label="${l}"></div>`;
  return `<div class="sec"><span>Strength and sleep timing</span><button data-action="optgripinfo">What's this?</button></div><div class="card pad"><div class="two">${f('grip.l', 'Grip left (kg)', 'e.g. 52')}${f('grip.r', 'Grip right (kg)', 'e.g. 52')}</div><div class="two" style="margin-top:10px">${f('leg.l', 'Leg hold left (s)', 'e.g. 45', 'numeric')}${f('leg.r', 'Leg hold right (s)', 'e.g. 45', 'numeric')}</div><div class="two" style="margin-top:10px">${f('bed', 'Bedtime', '23:00', '', 'time')}${f('wake', 'Wake time', '07:00', '', 'time')}</div><div class="two" style="margin-top:10px">${f('hrv', 'HRV (ms), if no Whoop', 'e.g. 62', 'numeric')}<div></div></div>${gs.flag ? `<div class="rule" style="margin-bottom:0">${esc(gs.text)}</div>` : ''}${gs.asymFlag ? `<div class="rule" style="margin-bottom:0">Left and right grip differ by ${Math.round(gs.asym * 100)}%.</div>` : ''}</div>`;
}
inputs.optci = el => {
  const k = el.dataset.k, d = ui.logDate;
  debounced('oci' + k, () => {
    optInit(); const [a, b] = k.split('.');
    if (b) { const o = Object.assign({}, optCI(d)[a]); const v = num(el.value); if (v == null) delete o[b]; else o[b] = v; setCI(d, { [a]: o }); }
    else if (k === 'bed' || k === 'wake') setCI(d, { [k]: el.value || null });
    else { const v = num(el.value); setCI(d, { [k]: v }); }
  });
};
actions.optgripinfo = () => openSheet('Grip test', `<p style="margin-top:0">A hand dynamometer costs about €25 and gives you a daily read on nervous-system fatigue that is hard to fake.</p><div class="card pad"><div class="reason">Sit, elbow at 90°, arm by your side.</div><div class="reason">Squeeze as hard as you can for 5 seconds.</div><div class="reason">Two attempts per hand, log the better one.</div><div class="reason">Same time every morning, before coffee.</div></div><div class="rule">A drop of 10% or more on your bowling side against your best 14-day average flags a yellow day, as does a left-right gap over 10%.</div>`);
actions.optdaytype = el => { optInit(); const d = ui.logDate, v = el.dataset.v; if (S.dayType[d] === v || optDayTypeAuto(d) === v && !S.dayType[d]) delete S.dayType[d]; else S.dayType[d] = v; saveState(); vib(6); render(); };
actions.optpre = () => { OPT.preSession = !OPT.preSession; vib(6); render(); };
function optDayTypeRow(date) {
  const cur = optDayType(date), auto = optDayTypeAuto(date), t = optTargetsFor(date);
  return `<div class="o-dt"><div class="chips o" role="group" aria-label="Day type">${Object.keys(OPT_DT).map(k => `<button class="chip" data-action="optdaytype" data-v="${k}" aria-pressed="${cur === k}">${OPT_DT[k][0]}</button>`).join('')}</div><div class="s muted" style="font-size:13px;margin:6px 2px 8px">${(S.dayType || {})[date] ? 'Set by you.' : 'Picked automatically.'} ${t.kcal} kcal · P ${t.p} · C ${t.c} · F ${t.f}. Tap another to override${cur !== auto ? ` (auto: ${OPT_DT[auto][0]})` : ''}.</div>${date === isoDate() ? `<button class="chip" data-action="optpre" aria-pressed="${OPT.preSession}" style="margin-bottom:8px">About to train</button>` : ''}</div>`;
}
const _optLog = screens.log;
screens.log = function () {
  optInit(); const orig = S.settings.targets; S.settings.targets = optTargetsFor(ui.logDate);
  let h; try { h = _optLog(); } finally { S.settings.targets = orig; }
  h = h.replace('<div class="sec"><span>Supplements</span>', m => optCheckExtra(ui.logDate) + m);
  return h.replace('<div class="sec">Nutrition</div>', m => m + optDayTypeRow(ui.logDate));
};

/* ---------- UI: Progress ---------- */
function optSVG(o) {
  const W = 340, H = o.h || 160, L = 34, R = 10, T = 10, B = 22, iw = W - L - R, ih = H - T - B, [lo, hi] = o.yr, px = i => L + (o.n > 1 ? i / (o.n - 1) * iw : iw / 2), py = y => T + ih - (y - lo) / ((hi - lo) || 1) * ih;
  let g = '';
  if (o.band) g += `<rect x="${L}" y="${py(o.band.hi)}" width="${iw}" height="${py(o.band.lo) - py(o.band.hi)}" style="fill:${o.band.c};opacity:.16"/>`;
  (o.ticks || [0, 1, 2, 3].map(i => hi - (hi - lo) * i / 3)).forEach(v => { const y = py(v); g += `<line class="gl" x1="${L}" x2="${W - R}" y1="${y}" y2="${y}"/><text x="${L - 5}" y="${y + 3}" text-anchor="end">${(hi - lo) < 6 ? r1(v) : Math.round(v)}</text>`; });
  (o.refs || []).forEach(r => { g += `<line x1="${L}" x2="${W - R}" y1="${py(r[0])}" y2="${py(r[0])}" style="stroke:${r[1]};stroke-width:1;stroke-dasharray:3 4"/>`; });
  (o.xt || []).forEach((t, i, a) => { g += `<text x="${px(t[0])}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === a.length - 1 ? 'end' : 'middle'}">${esc(t[1])}</text>`; });
  const bw = Math.min(14, iw / o.n * .7);
  (o.stacks || []).forEach(s => { let acc = 0; s.segs.forEach(([v, c]) => { if (v <= 0) return; const y1 = py(acc + v), y0 = py(acc); g += `<rect x="${px(s.i) - bw / 2}" y="${y1}" width="${bw}" height="${Math.max(.5, y0 - y1)}" style="fill:${c}"/>`; acc += v; }); });
  (o.lines || []).forEach(l => {
    if (l.pts.length > 1) g += `<polyline fill="none" points="${l.pts.map(p => px(p[0]).toFixed(1) + ',' + py(optClamp(p[1], lo, hi)).toFixed(1)).join(' ')}" style="stroke:${l.c};stroke-width:${l.w || 2.4};stroke-linejoin:round;stroke-linecap:round" ${l.dash ? 'stroke-dasharray="4 4"' : ''}/>`;
    if (l.dots) l.pts.forEach(p => { g += `<circle cx="${px(p[0])}" cy="${py(optClamp(p[1], lo, hi))}" r="2.6" style="fill:${l.c}"/>`; });
  });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label)}">${g}</svg>` + (o.legend ? `<div class="legend">${o.legend.map(l => `<span><i style="background:${l[1]}"></i>${esc(l[0])}</span>`).join('')}</div>` : '');
}
const OPT_CL = { lift: 'var(--g2)', cond: 'var(--o)', bowl: 'var(--ob)', xtra: 'var(--ink3)' };
function optProgressHTML() {
  optInit(); const today = isoDate(), idx = optIndex(), ser = optSeries(today, idx), all = optAcwrAll(ser), days = optDays(today, 30), mp = {}; all.forEach(x => { mp[x.date] = x; });
  const xt = [[0, fmtShort(days[0])], [29, 'Today']];
  /* training load */
  const ew = [], cp = []; days.forEach((d, i) => { const x = mp[d]; if (x && x.ready && x.ewma != null) { ew.push([i, x.ewma]); if (x.coupled != null) cp.push([i, x.coupled]); } });
  const top = Math.max(2, Math.ceil((Math.max(0, ...ew.map(p => p[1])) + .05) * 4) / 4), cur = all[all.length - 1];
  const wk = optWeeklyReview(addDays(today, -((parseISO(today).getDay() + 6) % 7)), today);
  let h = chartCard('Training load', cur && cur.ready ? 'ratio ' + cur.ewma.toFixed(2) : 'building', ew.length > 1 ? optSVG({ label: 'Acute to chronic load ratio, 30 days', n: 30, yr: [0, top], ticks: [0, .8, 1.3, top], band: { lo: .8, hi: 1.3, c: 'var(--ok)' }, refs: [[1.5, 'var(--red)']], xt, lines: [{ pts: cp, c: 'var(--ink3)', w: 1.4, dash: true }, { pts: ew, c: 'var(--o)', w: 2.6, dots: ew.length < 12 }], legend: [['EWMA ratio', 'var(--o)'], ['7:28 day ratio', 'var(--ink3)'], ['Sweet spot 0.8 to 1.3', 'var(--ok)'], ['Danger above 1.5', 'var(--red)']] }) + (wk.text ? `<div class="s muted" style="font-size:13px;margin-top:6px">This week: ${esc(wk.text)}.</div>` : '') : '', `Needs 14 days of training load. ${all.length} so far.`);
  const lm = {}; ser.forEach(x => { lm[x.date] = x; });
  const stacks = days.map((d, i) => { const l = lm[d] || optDayLoad(d, idx); return { i, segs: [[l.lift, OPT_CL.lift], [l.cond, OPT_CL.cond], [l.bowl, OPT_CL.bowl], [l.xtra, OPT_CL.xtra]], t: l.total }; });
  const mx = Math.max(10, ...stacks.map(s => s.t));
  h += chartCard('Daily load', 'lift, conditioning, bowling', stacks.some(s => s.t > 0) ? optSVG({ label: 'Daily training load, 30 days', n: 30, yr: [0, Math.ceil(mx * 1.1 / 10) * 10], xt, stacks, legend: [['Lift', OPT_CL.lift], ['Conditioning', OPT_CL.cond], ['Bowling', OPT_CL.bowl], ['Other (Whoop)', OPT_CL.xtra]] }) : '', 'Finish a session or log Zone 2 to see daily load.');
  /* grip */
  const gl = [], gr = [], ga = []; days.forEach((d, i) => { const l = optGrip(d, 'l'), r = optGrip(d, 'r'); if (l != null) gl.push([i, l]); if (r != null) gr.push([i, r]); if (l != null && r != null) ga.push([i, Math.abs(l - r) / Math.max(l, r) * 100]); });
  const gs = optGripStats(today), dn = gs.dom === 'r' ? 'right' : 'left';
  h += chartCard('Grip strength', gs.avg7[gs.dom] != null ? `${fmtN(gs.avg7[gs.dom])} kg ${dn} (7-day)` : 'kg', gl.length + gr.length > 2 ? chartSVG({ label: 'Grip strength both hands', y2: true, yr2: [0, 30], xmin: 0, xmax: 29, xt, series: [{ pts: gl, color: 'var(--g2)', r: 2.4 }, { pts: gr, color: 'var(--o)', r: 2.4 }, { pts: ga, color: 'var(--ink3)', axis: 2, dash: true, nodots: true, w: 1.6 }], legend: [['Left (kg)', 'var(--g2)'], ['Right (kg)', 'var(--o)'], ['Asymmetry % (right axis)', 'var(--ink3)']] }) + (gs.flag ? `<div class="rule">${esc(gs.text)}</div>` : '') + (gs.asymFlag ? `<div class="s muted" style="font-size:13px;margin-top:4px">Asymmetry ${Math.round(gs.asym * 100)}%, above the 10% line.</div>` : '') : '', 'Log grip in the Log check-in each morning to see the trend.');
  /* sleep regularity */
  const sp = []; days.forEach((d, i) => { const r = optSri(d); if (r) sp.push([i, r.sri]); }); const sr = optSri(today);
  h += chartCard('Sleep regularity', sr ? `index ${Math.round(sr.sri)}` : '', sp.length > 1 ? optSVG({ label: 'Sleep regularity index, 30 days', n: 30, yr: [40, 100], xt, lines: [{ pts: sp, c: 'var(--g2)', w: 2.6 }] }) + (sr ? `<div class="s muted" style="font-size:13px;margin-top:6px">Bed ${optHM(sr.bedMean)} ± ${Math.round(sr.bedSD || 0)} min · wake ${optHM(sr.wakeMean)} ± ${Math.round(sr.wakeSD || 0)} min (14 days).</div>` : '') : '', 'Needs bed and wake times for about 5 nights, from Whoop or the Log check-in.');
  /* lanes */
  const L = optLanes(); h += `<div class="sec"><span>Lanes</span><button data-action="optlane">Log scores</button></div><div class="card pad">`;
  if (!L.games) h += `<div class="muted" style="text-align:center;padding:10px 0">Log game scores after bowling to see what moves your average.</div>`;
  else {
    h += `<div class="kv"><b>${Math.round(L.avg)}</b><span>average over ${L.games} games${L.byKind.length ? ' · ' + L.byKind.map(k => `${OPT_KIND[k.k].toLowerCase()} ${Math.round(k.avg)}`).join(', ') : ''}</span></div>`;
    if (L.lines.length) h += `<div style="margin-top:10px">${L.lines.map(x => `<div class="reason">${esc(x)}</div>`).join('')}</div>`;
    L.sections.forEach(s => { if (s.groups.every(g => !g.n)) return; h += `<div class="lbl">${esc(s.title)}</div>` + s.groups.filter(g => g.n || g.enough).map(g => `<div class="o-lr"><span>${esc(g.label)}</span>${g.enough ? `<b class="tn">${Math.round(g.avg)}</b><span class="faint tn">${g.n} games</span>` : `<span class="faint">needs ${OPT_MINN - g.n} more game${OPT_MINN - g.n === 1 ? '' : 's'}</span>`}</div>`).join(''); });
  }
  h += '</div>';
  /* session timing */
  const ts = Object.values(S.sessions).filter(s => s.status === 'done').sort((a, b) => a.date < b.date ? 1 : -1).map(s => [s, optTiming(s)]).find(x => x[1].has), tm = ts && ts[1];
  h += chartCard('Session timing', ts ? fmtShort(ts[0].date) : '', tm ? `<div>${esc(optTimingLine(ts[0]))}</div><div class="s muted" style="font-size:13px;margin:6px 0">Longest gap ${fmtMS(Math.round(tm.longest))} · working time ${tm.density != null ? Math.round(tm.density * 100) + '% of the session' : 'n/a'}</div>` + tm.exs.slice().sort((a, b) => b.over - a.over).slice(0, 4).map(e => `<div class="o-lr"><span>${esc(e.name)}</span><b class="tn" style="color:${e.over > 1.5 ? 'var(--o)' : 'var(--ink)'}">${fmtMS(Math.round(e.avg))}</b><span class="faint tn">of ${fmtMS(e.presc)}</span></div>`).join('') : '', 'Rest gaps appear once you log sets with the pad.');
  return h;
}
const _optProgress = screens.progress;
screens.progress = function () {
  optSyncLoad(); const h = _optProgress(), m = '<div class="sec"><span>Progress photos</span>', i = h.indexOf(m), add = optProgressHTML();
  return i < 0 ? h + add : h.slice(0, i) + add + h.slice(i);
};

/* ---------- UI: Plan settings + Learn ---------- */
const OPT_LEARN = [
  ['Load ratio (ACWR)', "The acute:chronic workload ratio compares your last 7 days of training with your average week over the last 28. Around 1.0 means you are doing what your body is used to. 0.8 to 1.3 is the sweet spot. Above 1.5 is a spike, which is where injuries and flat sessions cluster. Below 0.8 you are detraining. SPT shows the EWMA version, which weights recent days more so it reacts to spikes sooner. If a planned session pushes you too high, trim accessory sets, never the main lift."],
  ['HRV and Zone 2', "Heart rate variability is the beat-to-beat variation in your pulse. Above your own baseline usually means recovered; a sustained drop means stress is stacking up. Compare with your 30-day average, never with other people. Easy Zone 2 work, where you can still hold a conversation, raises resting HRV over 8 to 12 weeks by building aerobic base and calming your stress response. That is why Zone 2 days matter even though they feel too easy."],
  ['Sleep regularity', "When you sleep matters almost as much as how long. The regularity index scores how similar your sleep midpoint is from night to night: 100 is metronomic, and every hour of drift costs about 12 points. Irregular sleep blunts recovery and reaction time even with eight hours in the bank. Pick a bedtime you can hold within 30 minutes, weekends and tournament weeks included. The bedtime anchor on Today shows yours."],
  ['Grip as a fatigue marker', "Max grip is a quick read on your nervous system. It tends to fall before you feel run down, and grip matters for bowling. Test the same way every morning: seated, elbow at 90 degrees, 5-second squeeze, best of two. A drop of 10% or more on your bowling side against your best 14-day average means treat the day as yellow. A gap of more than 10% between hands is worth watching."],
  ['How deloads trigger', "A deload is a lighter week that lets your work turn into fitness. SPT proposes one early if HRV runs below 90% of baseline for 3 days, the load ratio passes 1.5, or soreness is 7 or higher on 3 of the last 5 days. A deload week is 2 sets per exercise at about 85% of the load, with Zone 2 instead of the Day C circuit. You choose. Declining snoozes the proposal for 7 days."]
];
actions.optlearn = el => { const i = +el.dataset.i, c = OPT_LEARN[i]; openSheet(c[0], `<p style="margin-top:0;font-size:16px;line-height:1.5">${esc(c[1])}</p>`); };
function optSettingsHTML() {
  optInit(); const o = S.settings.opt, nut = o.nut || {};
  let h = `<div class="sec">Learn</div><div class="card">${OPT_LEARN.map((c, i) => `<button class="row" data-action="optlearn" data-i="${i}"><div class="grow t">${esc(c[0])}</div>${chev}</button>`).join('')}</div>`;
  h += `<div class="sec"><span>Travel</span><button data-action="opttripedit" data-id="">Add trip</button></div><div class="card">${S.travel.trips.length ? S.travel.trips.map(t => `<button class="row" data-action="opttripedit" data-id="${t.id}"><div class="grow"><div class="t">${esc(optTzCity(t.from))} to ${esc(optTzCity(t.to))}</div><div class="s">${fmtShort(t.out.slice(0, 10))} to ${fmtShort(t.back.slice(0, 10))} · hotel gym: ${esc(t.equip || 'dumbbells')}</div></div>${chev}</button>`).join('') : '<div class="empty">No trips yet. Add one for a jet-lag plan and hotel-gym swaps.</div>'}</div>`;
  h += `<div class="sec">Training and sleep</div><div class="card pad"><div class="lbl" style="margin-top:0">Bowling side (for the grip flag)</div><div class="seg">${[['r', 'Right'], ['l', 'Left']].map(([v, l]) => `<button data-action="optdom" data-v="${v}" aria-pressed="${o.dom === v}">${l}</button>`).join('')}</div><div class="two"><div><div class="lbl">Bedtime target</div><input type="time" data-in="optset" data-k="bed" value="${esc(o.bed)}" aria-label="Bedtime target"></div><div><div class="lbl">Usual training time</div><input type="time" data-in="optset" data-k="trainTime" value="${esc(o.trainTime)}" aria-label="Usual training time"></div></div></div>`;
  h += `<div class="sec">Nutrition by day type</div><div class="card">${Object.keys(OPT_DT).map(k => { const t = optDerivedTargets(k), e = Object.assign({}, t, nut[k] || {}); return `<button class="row" data-action="optnut" data-k="${k}"><div class="grow"><div class="t">${OPT_DT[k][0]}${nut[k] ? ' <span class="pill o">edited</span>' : ''}</div><div class="s">${e.kcal} kcal · P ${e.p} · C ${e.c} · F ${e.f}</div></div>${chev}</button>`; }).join('')}</div><div class="s muted" style="font-size:13px;margin:6px 4px 0">Carbs scale from your base targets (lift ×1.15, conditioning ×1.25, bowling ×1.1, rest ×0.8). Protein stays, fat fills.</div>`;
  return h;
}
const _optSettings = settingsHTML;
settingsHTML = function () { return optSettingsHTML() + _optSettings(); };
inputs.optset = el => debounced('os' + el.dataset.k, () => { optInit(); S.settings.opt[el.dataset.k] = el.value; saveState(); });
actions.optdom = el => { optInit(); S.settings.opt.dom = el.dataset.v; saveState(); render(); };
actions.optnut = el => {
  const k = el.dataset.k, t = Object.assign({}, optDerivedTargets(k), (S.settings.opt.nut || {})[k] || {});
  openSheet(OPT_DT[k][0], `<div id="onf" class="two">${[['kcal', 'Calories'], ['p', 'Protein (g)'], ['c', 'Carbs (g)'], ['f', 'Fat (g)']].map(([f, l]) => `<div><div class="lbl" style="margin-top:0">${l}</div><input data-f="${f}" inputmode="numeric" value="${t[f]}" aria-label="${l}"></div>`).join('')}</div><div style="display:grid;gap:8px;margin-top:16px"><button class="btn pri" data-action="optnutsave" data-k="${k}">Save targets</button><button class="btn ghost" data-action="optnutsave" data-k="${k}" data-reset="1">Reset to calculated</button></div>`, { close: 'Cancel' });
};
actions.optnutsave = el => {
  optInit(); const k = el.dataset.k, nut = S.settings.opt.nut = S.settings.opt.nut || {};
  if (el.dataset.reset) delete nut[k]; else { const v = {}; $$('#onf [data-f]').forEach(i => { const n = num(i.value); if (n != null && n > 0) v[i.dataset.f] = n; }); nut[k] = v; }
  saveState(); closeSheet(true); render();
};
const OPT_TZ = ['America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Europe/Berlin', 'Asia/Dubai', 'Asia/Seoul', 'Asia/Tokyo', 'Australia/Sydney'];
actions.opttripedit = el => {
  optInit(); const t = S.travel.trips.find(x => x.id === el.dataset.id) || { id: '', from: 'Europe/Dublin', to: 'America/New_York', out: '', back: '', equip: 'dumbbells' };
  const dt = v => (v || '').slice(0, 16);
  openSheet(t.id ? 'Edit trip' : 'New trip', `<div id="otf"><div class="lbl" style="margin-top:0">From (time zone)</div><input data-k="from" value="${esc(t.from)}" autocapitalize="off" aria-label="Origin time zone"><div class="lbl">To (time zone)</div><input data-k="to" list="otzl" value="${esc(t.to)}" autocapitalize="off" aria-label="Destination time zone"><datalist id="otzl">${OPT_TZ.map(z => `<option value="${z}">`).join('')}</datalist><div class="two"><div><div class="lbl">Outbound</div><input data-k="out" type="datetime-local" value="${dt(t.out)}" aria-label="Outbound date and time"></div><div><div class="lbl">Return</div><input data-k="back" type="datetime-local" value="${dt(t.back)}" aria-label="Return date and time"></div></div><div class="lbl">Hotel gym equipment</div><select data-k="equip" aria-label="Hotel gym equipment">${[['dumbbells', 'Dumbbells'], ['bands', 'Bands only'], ['machines', 'Machines'], ['none', 'Nothing']].map(([v, l]) => `<option value="${v}" ${t.equip === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div><div style="display:grid;gap:8px;margin-top:16px"><button class="btn pri" data-action="opttripsave" data-id="${t.id}">Save trip</button>${t.id ? `<button class="btn danger" data-action="opttripdel" data-id="${t.id}">Delete trip</button>` : ''}</div>`, { close: 'Cancel' });
};
actions.opttripsave = el => {
  const v = {}; $$('#otf [data-k]').forEach(i => { v[i.dataset.k] = i.value.trim(); });
  if (!optTzOk(v.from) || !optTzOk(v.to)) return toast('Use a time zone like Europe/Dublin');
  if (!v.out || !v.back || v.back < v.out) return toast('Set outbound and a later return date');
  if (el.dataset.id) Object.assign(S.travel.trips.find(x => x.id === el.dataset.id), v); else S.travel.trips.push(Object.assign({ id: uid() }, v));
  saveState(); closeSheet(true); toast('Trip saved'); render();
};
actions.opttripdel = el => { S.travel.trips = S.travel.trips.filter(x => x.id !== el.dataset.id); saveState(); closeSheet(true); render(); };

/* ---------- merge, sync, boot ---------- */
const _optMerge = mergeImport;
mergeImport = async function (o) {
  await _optMerge(o); optInit(); const s = (o && o.state) || {};
  ['zone2', 'bowling', 'overrides', 'dayType'].forEach(k => { if (s[k]) { S[k] = S[k] || {}; Object.entries(s[k]).forEach(([d, v]) => { if (!(d in S[k])) S[k][d] = v; }); } });
  ((s.travel || {}).trips || []).forEach(t => { if (!S.travel.trips.some(x => x.id === t.id)) S.travel.trips.push(t); });
  Object.assign(S.travel.done, (s.travel || {}).done || {}); saveState();
};
if (typeof syncWhoop === 'function') { const _optSync = syncWhoop; syncWhoop = async function (f) { const r = await _optSync(f); try { optSyncLoad(); setTimeout(optDeloadNow, 300); } catch (e) { console.warn(e); } return r; }; }
function optDeloadNow() { if (ui.sheet) return; const tr = optDeloadCheck(); if (tr) optDeloadSheet(tr); }
function optTick() {
  const c = $('#optwind'); if (c) { const w = optWind(); if (w && w.chip) c.textContent = w.chip; }
  if (!document.hidden) optDeloadNow();
}
function optBoot() {
  optInit(); if (optMock()) optMockInstall(); optSyncLoad();
  if (ui.tab === 'today' || ui.tab === 'progress' || ui.tab === 'log') render();
  setTimeout(optDeloadNow, 700); setInterval(optTick, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(optDeloadNow, 400); });
}
document.addEventListener('DOMContentLoaded', optBoot);

/* ---------- mock data (localStorage['spt-opt-mock']==='1'; scenario via 'spt-opt-mock-scenario': steady | spike | hrv) ---------- */
function optMockInstall(force) {
  optInit(); if (S.flags.optMock && !force) return;
  let scen = 'steady'; try { scen = localStorage.getItem('spt-opt-mock-scenario') || 'steady'; } catch (e) { }
  const today = isoDate(), rnd = i => { const x = Math.sin(i * 12.9898 + 7.7) * 43758.5453; return x - Math.floor(x); };
  for (let i = 34; i >= 0; i--) {
    const d = addDays(today, -i), k = parseISO(d).getTime() / 864e5, wd = parseISO(d).getDay(), last5 = i <= 4, last7 = i <= 6;
    let rec = Math.round(optClamp(62 + 22 * Math.sin(k / 3.3) + (rnd(k) - .5) * 24, 8, 97)), hrv = r1(58 + (rec - 60) * .35 + rnd(k + 1) * 5);
    if (scen === 'hrv' && i <= 5) { hrv = r1(41 + rnd(k) * 3); rec = Math.min(rec, 45); }
    const sh = r1(optClamp(6.4 + rec / 100 * 1.8 + (rnd(k + 2) - .5), 4.8, 9)), bedM = 23 * 60 + Math.round((rnd(k + 3) - .4) * 50) + (wd === 5 || wd === 6 ? 40 : 0), wakeM = (bedM + Math.round(sh * 60)) % 1440;
    const st0 = parseISO(d).getTime() - 864e5 + bedM * 6e4, bedD = new Date(st0), endD = new Date(st0 + sh * 36e5);
    if (!S.whoop[d]) S.whoop[d] = { date: d, recovery: { score: rec, hrv_ms: hrv, rhr_bpm: Math.round(61 - rec * .12), state: rec >= 67 ? 'green' : rec >= 34 ? 'yellow' : 'red' }, sleep: { start: bedD.toISOString(), end: endD.toISOString(), hours: sh, performance_pct: Math.round(70 + rec * .25) }, strain: { day_strain: r1(7 + rnd(k + 5) * 6) }, workouts: [] };
    const doms = scen === 'spike' && last5 ? 7 + (i % 2) : Math.round(optClamp(3 + (60 - rec) / 14 + (rnd(k + 6) - .5) * 3, 0, 9));
    S.checkins[d] = Object.assign({ bw: r1(84.6 - i * .02 + rnd(k + 7)), sleepH: sh, doms, grip: { l: r1(49 + rnd(k + 8) * 2), r: r1((scen === 'steady' && last7 ? 46 : 53) + rnd(k + 9) * 2) }, bed: optHM(bedM), wake: optHM(wakeM), u: 1 }, S.checkins[d] || {});
    const wk = wd === 1 ? 'A' : wd === 3 ? 'B' : wd === 5 ? 'C' : null, mult = scen === 'spike' && last7 ? 1.5 : 1;
    if (wk && i > 0) {
      const t0 = parseISO(d).getTime() + 17 * 36e5, s = { id: 'm-' + d, slot: 'm', date: d, key: wk, week: 1, status: 'done', start: t0, end: t0 + 62 * 6e4, note: '', ex: [], rounds: [], u: 1 };
      if (wk === 'C') s.rounds = [372, 396, 421, 440].map(x => Math.round(x * mult));
      else { let t = t0 + 6e5; s.ex = DAYS[wk].map((x, ei) => { const p = presc(wk, 1, ei), sets = []; for (let n = 0; n < p.sets; n++) { t += (p.rest * (1 + (rnd(k + ei + n) > .6 ? .9 : .1)) + 35) * 1000; sets.push({ w: p.load.value != null && p.load.type === 'kg' ? Math.round(p.load.value * mult / 2.5) * 2.5 : p.load.type === 'rpe' ? 16 + ei * 2 : null, r: p.reps, rpe: p.rpeTarget + (mult > 1 ? 1 : 0), done: true, t }); } return { name: x.name, orig: x.name, tgt: p, sets, note: '' }; }); }
      S.sessions[s.id] = s;
    }
    const extra = (scen === 'spike' && i >= 1 && i <= 6) || (scen === 'caution' && i === 1);
    if (extra) { const t0 = parseISO(d).getTime() + 8 * 36e5; let t = t0; S.sessions['m2-' + d] = { id: 'm2-' + d, slot: 'm', date: d, key: 'B', week: 1, status: 'done', start: t0, end: t0 + 4e6, note: '', rounds: [], u: 1, ex: DAYS.B.slice(0, scen === 'spike' ? 8 : 5).map((x, ei) => { const p = presc('B', 1, ei), sets = []; for (let n = 0; n < (scen === 'spike' ? 5 : 4); n++) { t += 12e4; sets.push({ w: (scen === 'spike' ? 30 : 20) + ei * 3, r: 10, rpe: scen === 'spike' ? 9 : 8, done: true, t }); } return { name: x.name, orig: x.name, tgt: p, sets, note: '' }; }) }; if (scen === 'spike' && S.whoop[d]) S.whoop[d].strain.day_strain = 20.5; }
    if (wd === 2 || wd === 6) S.zone2[d] = { min: 35, rpe: 4, u: 1 };
    if (wd === 2 || wd === 4 || wd === 6) {
      const z = rec >= 67 ? 9 : rec >= 34 ? 0 : -8, sc = [0, 1, 2, 3].map(g => Math.round(optClamp(196 + z + (sh - 7.3) * 5 + (rnd(k + 20 + g) - .5) * 40, 120, 290)));
      S.bowling[d] = { games: sc.length, hours: wd === 6 ? 3 : 2.2, feel: 3 + Math.round(rnd(k + 30)), scores: sc, kind: wd === 4 ? 'league' : wd === 6 ? 'tournament' : 'practice', pattern: wd === 4 ? 'House shot' : 'Cheetah', u: 1 };
    }
  }
  S.flags.optMock = scen; saveState();
}
