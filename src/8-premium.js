/* ===== SPT v2.2 premium (additive; hooks are one-liners in other files) ===== */
const CHANGELOG = {
  '2.3.0': [
    'Training load: lifts, conditioning, lanes and Whoop strain become one daily load, with a load ratio (ACWR) and charts in Progress.',
    'Today gets Load and Readiness tiles. If the planned session would push you past 1.3, Apply trim marks accessory sets optional.',
    'Deload proposals when HRV, load or soreness say you are run down. Accept and the week becomes a deload.',
    'Grip test for each hand with a fatigue flag and asymmetry, plus sleep regularity and a bedtime anchor in the briefing.',
    'Lane scores per game, with averages by recovery, sleep, leg work and load. They feed the weekly review.',
    'Travel mode: a day-by-day jet-lag plan and hotel-gym swaps.',
    'Session timing from set timestamps (also in the recap), a nudge when rests run long, and voice logging in the set pad.',
    'Day-type nutrition targets, food verdicts that know pre-session and rest days, Learn explainers in Plan, and How cues on every Day C station.'
  ],
  '2.2.0': [
    'Morning briefing: last night’s sleep, today’s plan and one coaching line, once a day.',
    'Adherence ring with check-in and session streaks on Today.',
    'Session recap with PRs, a soreness outlook and a shareable image.',
    'Haptics and a rest-timer chime. Both switch off in Plan.',
    'Last session’s set shows behind each set, with a marker when you beat it.',
    'Smarter swaps: like-for-like exercises first.',
    'Log lane days: games, hours and how the arm, wrist and thumb felt.',
    'Weekly review you can copy straight to your coach.',
    'Video and cues on every exercise.',
    'Back up to Google Drive from Plan.',
    'New app icon.'
  ],
  '2.1.0': [
    'Whoop on Today: recovery, HRV, resting HR, sleep and yesterday’s strain, with one line of coaching.',
    'Connect Whoop from Plan through your own Cloudflare Worker. Pull down on Today to sync.',
    'Train shows the recovery chip and holds suggested loads on red days.',
    'Check-in fills sleep hours and resting HR from Whoop. Anything you type stays.',
    'Progress charts for recovery, HRV and recovery against soreness. Weekly cards show average recovery and HRV.'
  ]
};
const verCmp = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d; } return 0; };
function PX() { ['recaps', 'bowling', 'videos', 'drive', 'reviews'].forEach(k => { if (!S[k] || typeof S[k] !== 'object') S[k] = {}; }); return S; }
const yest = d => addDays(d, -1);
const bowlOf = d => (PX().bowling[d]) || null;
const bowlHrs = d => { const b = bowlOf(d); return b && b.hours ? +b.hours : 0; };

/* ----- haptics + sound ----- */
let hapEl, pctx;
function haptic(kind) {
  if (S.settings.haptics === false) return;
  try {
    if (navigator.vibrate) { navigator.vibrate(kind === 'timer' ? [200, 80, 200] : kind === 'success' ? [30, 40, 30] : 12); return; }
    if (!hapEl) { hapEl = document.createElement('label'); hapEl.setAttribute('aria-hidden', 'true'); hapEl.style.cssText = 'position:fixed;left:-60px;top:0;width:30px;height:30px;opacity:.02;pointer-events:none'; hapEl.innerHTML = '<input type="checkbox" switch tabindex="-1">'; document.body.appendChild(hapEl); }
    const n = kind === 'timer' ? 3 : kind === 'success' ? 2 : 1;
    for (let i = 0; i < n; i++) setTimeout(() => { try { hapEl.click(); } catch (e) { } }, i * 120);
  } catch (e) { }
}
function audioInit() {
  try {
    if (!pctx) { pctx = new (window.AudioContext || window.webkitAudioContext)(); try { if (navigator.audioSession) navigator.audioSession.type = 'ambient'; } catch (e) { } }
    if (pctx.state === 'suspended') pctx.resume();
  } catch (e) { }
}
['pointerdown', 'touchend', 'click'].forEach(t => document.addEventListener(t, audioInit, { capture: true, passive: true }));
function chime() {
  if (S.settings.sound === false) return; audioInit(); if (!pctx) return;
  const t = pctx.currentTime;
  [[880, 0], [1318.5, .17]].forEach(([f, d]) => { const o = pctx.createOscillator(), g = pctx.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(.22, t + d + .015); g.gain.exponentialRampToValueAtTime(.0001, t + d + .4); o.connect(g); g.connect(pctx.destination); o.start(t + d); o.stop(t + d + .45); });
}
function restDone() { haptic('timer'); chime(); }

/* ----- what's new ----- */
function showWhatsNew(next) {
  /* every version newer than the last one seen (all of them when nothing was ever seen), newest first, up to the running version */
  const seen = S.seenVersion, vs = Object.keys(CHANGELOG).filter(v => verCmp(v, APP_VERSION) <= 0 && (!seen || verCmp(v, seen) > 0)).sort((x, y) => verCmp(y, x));
  if (!vs.length || seen === APP_VERSION) return false;
  S.seenVersion = APP_VERSION; saveState();
  const body = vs.map(v => `<p class="muted wnv">Version ${v}</p><ul class="wn">${CHANGELOG[v].map(i => `<li>${esc(i)}</li>`).join('')}</ul>`).join('');
  openSheet('What’s new', body + `<button class="btn pri" style="margin-top:14px" data-action="wnok">Got it</button>`, { close: 'Close', onClose: () => { if (next) setTimeout(next, 340); } });
  return true;
}
actions.wnok = () => closeSheet();

/* ----- morning briefing ----- */
function sleepFor(date) {
  const c = getCI(date), w = (S.whoop || {})[date];
  if (c.sleepH != null) return { h: c.sleepH, src: c.src && c.src.sleepH === 'whoop' ? 'Whoop' : 'check-in', q: c.sleepQ };
  if (w && w.sleep && w.sleep.hours != null) return { h: w.sleep.hours, src: 'Whoop' };
  return null;
}
function planFor(date) {
  const c = ctxFor(date), i = DAY_INFO[c.key];
  if (c.phase === 'before') return { t: 'Block starts ' + fmtShort(BLOCK.start), s: 'Mobility and easy movement until then.' };
  if (c.phase === 'after') return { t: 'Block 1 complete', s: 'Write up the next block in Plan.' };
  if (c.slot && i.gym) return { t: `${i.name}: ${i.title}`, s: c.key === 'C' ? DAY_C.rounds[c.slot.w - 1] + ' rounds' : DAYS[c.key].length + ' exercises, week ' + c.slot.w + (c.slot.w === 4 ? ', deload' : '') };
  if (c.key === 'Z') return { t: 'Zone 2', s: '30–40 min easy, or a real practice block on the lanes.' };
  return { t: 'Rest + mobility', s: 'Four mobility drills, then walk and sleep.' };
}
function coachLine(date) {
  const y = yest(date), yc = getCI(y), z = typeof whoopZoneOn === 'function' ? whoopZoneOn(date) : null, sl = sleepFor(date), lane = bowlHrs(y);
  let t;
  if (z) t = { r: 'Red recovery. Drop the main lift to RPE 6 and cap it at 2 working sets, or swap to Zone 2.', y: 'Yellow recovery. Run the session as written, no top sets above RPE 7.', g: 'Green recovery. Run the session as written.' }[z];
  else if (yc.doms != null && yc.doms >= 7) t = `Soreness was ${yc.doms}/10 yesterday. Warm up longer and keep every set at RPE 6 or lower.`;
  else if (sl && sl.h < 6) t = `Short sleep (${fmtN(sl.h)} h). Keep it to RPE 7 and skip optional work.`;
  else if (yc.doms != null && yc.doms >= 5) t = `Soreness was ${yc.doms}/10 yesterday. Ease into the first sets before loading up.`;
  else if (sl && sl.h >= 7.5) t = `Well rested at ${fmtN(sl.h)} h. Good day to hit the main lift as written.`;
  else t = 'Nothing flags today. Run the plan as written.';
  if (lane >= 2) t += ` You had ${fmtN(lane)} h on the lanes yesterday, so count it as load.`;
  return t;
}
/* one line each, only when the optimise pass has the data: readiness band and the bedtime anchor */
function briefExtra(date) {
  let h = '';
  try {
    const rd = typeof optReadiness === 'function' ? optReadiness(date) : null, an = typeof optAnchor === 'function' ? optAnchor() : null;
    if (rd) h += `<div class="bf-r bf-s"><span>Ready</span><div>${rd.score}<small>${esc(OPT_RZ[rd.band][1])}</small></div></div>`;
    if (an) h += `<div class="bf-r bf-s"><span>Bed</span><div>${optHM(an.min)}<small>bedtime anchor, ± ${an.pm} min</small></div></div>`;
  } catch (e) { }
  return h;
}
function briefingHTML(date) {
  const h = new Date().getHours(), gr = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening', sl = sleepFor(date), p = planFor(date), b = bowlOf(date);
  return `<div class="bf-g">${gr}</div><div class="bf-d">${fmtDate(date, { weekday: 'long' })}<br>${fmtDate(date, { day: 'numeric', month: 'long' })}</div>
<div class="bf-l"><div class="bf-r"><span>Sleep</span><div>${sl ? `${fmtN(sl.h)} h<small>from ${sl.src}${sl.q ? ', quality ' + sl.q + '/5' : ''}</small>` : 'Not logged<small>Add it in the check-in</small>'}</div></div>
<div class="bf-r"><span>Today</span><div>${esc(p.t)}<small>${esc(p.s)}${b ? ' Lanes logged: ' + fmtN(b.hours) + ' h.' : ''}</small></div></div></div>
${briefExtra(date)}<div class="bf-c">${esc(coachLine(date))}</div>
<div class="bf-end"><button class="btn pri" data-action="briefcheck">Log check-in</button><button class="btn ghost" data-action="sheetclose">Later</button></div>`;
}
function showBriefing(mark) {
  const d = isoDate(); if (mark) { S.lastBriefDate = d; saveState(); }
  openSheet('Briefing', briefingHTML(d), { close: 'Close' });
  const sh = $('#sheets .sheet'); if (sh) sh.classList.add('full');
}
function maybeBrief() { if (S.lastBriefDate === isoDate() || ui.sheet) return false; showBriefing(true); return true; }
actions.briefing = () => showBriefing(false);
actions.briefcheck = () => { closeSheet(true); ui.logDate = isoDate(); go('log'); const i = $('[data-in=ci][data-k=bw]'); if (i) i.focus(); };

/* ----- adherence ring + streaks ----- */
const hasCI = d => { const c = S.checkins[d]; return !!c && ['sleepH', 'doms', 'bw', 'energy', 'sleepQ', 'hr'].some(k => c[k] != null); };
function adherence(today = isoDate()) {
  const pl = allSlots().filter(s => DAY_INFO[s.key].gym && s.date <= today), done = pl.filter(s => S.slotStatus[s.id] === 'done').length;
  let ss = 0; for (const s of pl.slice().sort((a, b) => a.date < b.date ? 1 : -1)) { if (S.slotStatus[s.id] === 'done') ss++; else if (s.date === today) continue; else break; }
  let cs = 0, d = today; if (!hasCI(d)) d = yest(d); while (hasCI(d)) { cs++; d = yest(d); }
  return { planned: pl.length, done, ss, cs };
}
function ringCard(today) {
  const a = adherence(today), p = a.planned ? a.done / a.planned : 0, C = 2 * Math.PI * 26;
  return `<button class="card adh-card" data-action="adhsheet" aria-label="Adherence: ${a.done} of ${a.planned} sessions. Check-in streak ${a.cs} days. Session streak ${a.ss}. Open breakdown"><svg class="adh" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="26" class="at"/><circle cx="32" cy="32" r="26" class="av" stroke-dasharray="${(C * p).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 32 32)"/><text x="32" y="37.5" text-anchor="middle">${a.planned ? Math.round(p * 100) + '%' : '–'}</text></svg><div class="kv"><b>${a.done}/${a.planned}</b><span>sessions so far</span></div><div class="kv"><b>${a.cs}</b><span>check-in streak</span></div><div class="kv"><b>${a.ss}</b><span>session streak</span></div>${chev}</button>`;
}
actions.adhsheet = () => {
  const today = isoDate(); let b = '<div class="card">';
  for (let w = 1; w <= BLOCK.weeks; w++) {
    const sl = allSlots().filter(s => s.w === w && DAY_INFO[s.key].gym), ws = addDays(BLOCK.start, (w - 1) * 7), we = addDays(ws, 6), pl = sl.filter(s => s.date <= today), dn = pl.filter(s => S.slotStatus[s.id] === 'done').length;
    let ci = 0, lh = 0; for (let d = ws; d <= we && d <= today; d = addDays(d, 1)) { if (hasCI(d)) ci++; lh += bowlHrs(d); }
    const dots = sl.map(s => `<i class="${S.slotStatus[s.id] === 'done' ? 'on' : S.slotStatus[s.id] === 'skipped' || s.date < today ? 'miss' : ''}"></i>`).join('');
    b += `<div class="row" style="align-items:flex-start;padding:12px 16px"><div class="grow"><div class="t">Week ${w}${w === 4 ? ' · deload' : ''}</div><div class="s">${ws > today ? 'Not started' : `${dn} of ${pl.length} sessions · ${ci} check-ins${lh ? ' · ' + fmtN(lh) + ' h lanes' : ''}`}</div></div><div class="dots" aria-hidden="true">${dots}</div></div>`;
  }
  const a = adherence(today);
  openSheet('Adherence', `<p class="muted" style="margin-top:0">Counts planned sessions up to today. Rest days never break the session streak.</p>${b}</div><div class="grid2" style="margin-top:12px"><div class="card pad kv"><b>${a.cs}</b><span>day check-in streak</span></div><div class="card pad kv"><b>${a.ss}</b><span>session streak</span></div></div>`);
};

/* ----- bowling log ----- */
function bowlToday(date) {
  const b = bowlOf(date);
  const inner = b ? `<div class="grow"><div class="t">Lanes: ${fmtN(b.hours)} h${b.games ? ', ' + b.games + ' games' : ''}</div><div class="s">Arm ${b.arm || '–'} · wrist ${b.wrist || '–'} · thumb ${b.thumb || '–'}${b.surface ? ' · ' + esc(b.surface) : ''}</div></div>${chev}` : `<div class="grow"><div class="t">Log bowling</div><div class="s">Games, hours and how the hand felt</div></div>${chev}`;
  return `<div class="sec">Lanes</div><div class="card"><button class="row" data-action="bowlopen" data-date="${date}">${inner}</button></div>`;
}
function bowlForm() {
  const b = ui.bowl, ch = k => `<div class="chips o cgrid" style="grid-template-columns:repeat(5,1fr)">${[1, 2, 3, 4, 5].map(i => `<button class="chip" data-action="bowlfeel" data-k="${k}" data-v="${i}" aria-pressed="${+b[k] === i}">${i}</button>`).join('')}</div>`;
  return `<p class="muted" style="margin-top:0">${fmtDate(b.date)}</p><div class="two"><div><div class="lbl" style="margin-top:0">Games</div><input data-in="bowl" data-k="games" inputmode="numeric" value="${esc(b.games ?? '')}" aria-label="Games"></div><div><div class="lbl" style="margin-top:0">Hours on lanes</div><input data-in="bowl" data-k="hours" inputmode="decimal" value="${esc(b.hours ?? '')}" aria-label="Hours on lanes"></div></div><div class="lbl">Surface / pattern</div><input data-in="bowl" data-k="surface" value="${esc(b.surface || '')}" placeholder="House shot, 40 ft" aria-label="Surface or pattern"><div class="lbl">Arm (1 rough, 5 great)</div>${ch('arm')}<div class="lbl">Wrist</div>${ch('wrist')}<div class="lbl">Thumb</div>${ch('thumb')}<div class="lbl">Notes</div><textarea data-in="bowl" data-k="notes" aria-label="Notes" placeholder="Ball, lane transition, anything that hurt">${esc(b.notes || '')}</textarea><div style="display:grid;gap:8px;margin-top:16px"><button class="btn pri" data-action="bowlsave">Save lane day</button>${bowlOf(b.date) ? '<button class="btn danger" data-action="bowldel">Delete</button>' : ''}</div>`;
}
actions.bowlopen = el => { const d = el.dataset.date || isoDate(); ui.bowl = Object.assign({ date: d }, bowlOf(d) || {}); openSheet('Log bowling', bowlForm(), { close: 'Cancel' }); };
inputs.bowl = el => { ui.bowl[el.dataset.k] = el.value; };
actions.bowlfeel = el => { const k = el.dataset.k, v = +el.dataset.v; ui.bowl[k] = +ui.bowl[k] === v ? null : v; haptic('tick'); setSheetBody(bowlForm()); };
actions.bowlsave = () => {
  const b = ui.bowl, g = num(b.games), h = num(b.hours); if (g == null && h == null) return toast('Add games or hours');
  PX().bowling[b.date] = { ...(PX().bowling[b.date] || {}), games: g, hours: h, surface: (b.surface || '').trim(), arm: b.arm || null, wrist: b.wrist || null, thumb: b.thumb || null, notes: (b.notes || '').trim(), u: Date.now() };
  saveState(); closeSheet(true); toast('Lane day saved'); haptic('success'); render();
};
actions.bowldel = () => { delete PX().bowling[ui.bowl.date]; saveState(); closeSheet(true); render(); };

/* ----- session recap ----- */
function buildRecap(s) {
  const st = sessionStats(s), prs = [], jumps = [], di = DAY_INFO[s.key];
  (s.ex || []).forEach(e => {
    const ds = e.sets.filter(x => x.done); if (!ds.length) return;
    const prev = exLogs(e.name).filter(l => l.sid !== s.id && l.date <= s.date); if (!prev.length) return;
    const rep = isRepEx(e.tgt), per = (e.tgt && e.tgt.per) || '', mx = (a, f) => Math.max(0, ...a.map(f));
    let cur = 0, old = 0, kind = 'weight';
    if (rep && bestE1(ds) && prev.some(l => bestE1(l.sets))) { cur = bestE1(ds); old = Math.max(...prev.map(l => bestE1(l.sets))); kind = 'e1RM'; }
    else if (mx(ds, x => x.w)) { cur = mx(ds, x => x.w); old = Math.max(...prev.map(l => mx(l.sets, x => x.w))); }
    else { cur = mx(ds, x => x.r); old = Math.max(...prev.map(l => mx(l.sets, x => x.r))); kind = per.startsWith('s') ? 'hold' : per === 'm' ? 'distance' : 'reps'; }
    if (r1(cur) > r1(old)) prs.push({ name: e.name, kind, val: r1(cur), prev: r1(old) });
    const tw = mx(ds, x => x.w), pw = mx(prev[0].sets, x => x.w); if (tw && pw && tw > pw * 1.1) jumps.push(e.name);
  });
  if (s.key === 'C') {
    const rs = (s.rounds || []).filter(Boolean), best = rs.length ? Math.min(...rs) : 0, old = Object.values(S.sessions).filter(o => o.key === 'C' && o.id !== s.id).flatMap(o => (o.rounds || []).filter(Boolean));
    if (best && old.length && best < Math.min(...old)) prs.push({ name: 'Fastest round', kind: 'time', val: fmtMS(best), prev: fmtMS(Math.min(...old)) });
  }
  let lvl = 'moderate', why;
  if (s.key === 'C') why = 'Conditioning day. Legs and grip carry the load.';
  else {
    const t0 = addDays(s.date, -28), pri = Object.values(S.sessions).filter(o => o.id !== s.id && o.status === 'done' && (o.ex || []).length && o.date >= t0 && o.date <= s.date).map(o => sessionStats(o).ton).filter(Boolean);
    if (!pri.length) why = 'No earlier sessions to compare with yet.';
    else { const avg = pri.reduce((a, b) => a + b, 0) / pri.length, pc = Math.round((st.ton / avg - 1) * 100); lvl = pc >= 25 ? 'high' : pc >= 10 ? 'moderate' : 'low'; why = `Tonnage ${pc >= 0 ? pc + '% above' : -pc + '% below'} your 4-week average.`; }
    if (jumps.length >= 2) lvl = 'high'; else if (jumps.length === 1 && lvl === 'low') lvl = 'moderate';
    if (jumps.length) why += ` ${jumps.slice(0, 2).join(' and ')} jumped more than 10%.`;
  }
  const timing = typeof optTimingLine === 'function' ? optTimingLine(s) : '';
  return { id: s.id, date: s.date, key: s.key, name: di.name, title: di.title, week: s.week, dur: Math.round(st.dur), sets: st.sets, ton: st.ton, rounds: st.rounds, prs, doms: { lvl, why }, timing, u: Date.now() };
}
const cap = t => t[0].toUpperCase() + t.slice(1);
const prTxt = p => p.kind === 'time' ? `${p.val} (was ${p.prev})` : `${p.val}${p.kind === 'reps' ? ' reps' : p.kind === 'hold' ? ' s' : p.kind === 'distance' ? ' m' : ' kg'} (+${r1(p.val - p.prev)})`;
function recapHTML(r) {
  const big = r.key === 'C' ? [r.rounds, 'rounds logged'] : [r.ton.toLocaleString('en-IE'), 'kg lifted'];
  return `<div class="rc"><div class="rc-l">${r.key}</div><div class="rc-top"><span class="rc-m">SPT</span><span>${fmtDate(r.date, { weekday: 'short', day: 'numeric', month: 'short' })}</span></div><div class="rc-t">${esc(r.title)}</div><div class="rc-s">${esc(r.name)}, week ${r.week}</div><div class="rc-n">${big[0]}<small>${big[1]}</small></div><div class="rc-g"><div class="kv"><b>${fmtDur(r.dur)}</b><span>duration</span></div><div class="kv"><b>${r.key === 'C' ? r.rounds : r.sets}</b><span>${r.key === 'C' ? 'rounds' : 'sets'}</span></div><div class="kv"><b>${r.prs.length}</b><span>PR${r.prs.length === 1 ? '' : 's'}</span></div></div>${r.prs.slice(0, 4).map(p => `<div class="rc-p"><span class="pill o">PR</span><b>${esc(p.name)}</b><span>${esc(prTxt(p))}</span></div>`).join('')}<div class="rc-d">Tomorrow’s soreness: <b>${r.doms.lvl}</b><small>${esc(r.doms.why)}</small></div>${r.timing ? `<div class="rc-d rc-tm">${esc(r.timing)}</div>` : ''}</div>`;
}
function showRecap(r) {
  ui.recap = r; ui.recapBlob = null;
  openSheet('Session recap', recapHTML(r) + `<div style="display:grid;gap:8px;margin-top:14px"><button class="btn pri" data-action="recapshare">Share as image</button></div>`, { close: 'Done' });
  recapBlob(r).then(b => { if (ui.recap === r) ui.recapBlob = b; }).catch(() => { });
}
actions.recapview = el => { const r = PX().recaps[el.dataset.id]; if (r) showRecap(r); };
function drawRecap(r) {
  const W = 1080, H = 1350, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d');
  const F = (w, s) => `${w} ${s}px -apple-system,"SF Pro Display","Segoe UI",Roboto,Inter,"Helvetica Neue",Arial,sans-serif`, ls = v => { if ('letterSpacing' in x) x.letterSpacing = v + 'px'; };
  const rr = (a, b, w, h, c) => { x.beginPath(); x.moveTo(a + c, b); x.arcTo(a + w, b, a + w, b + h, c); x.arcTo(a + w, b + h, a, b + h, c); x.arcTo(a, b + h, a, b, c); x.arcTo(a, b, a + w, b, c); x.closePath(); };
  const bg = x.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#07100D'); bg.addColorStop(.55, '#0A2A20'); bg.addColorStop(1, '#0B3D2E'); x.fillStyle = bg; x.fillRect(0, 0, W, H);
  x.fillStyle = 'rgba(255,255,255,.05)'; x.font = F(900, 1100); x.textAlign = 'right'; ls(-30); x.fillText(r.key, W + 60, 980);
  const mg = x.createLinearGradient(84, 84, 216, 216); mg.addColorStop(0, '#0B3D2E'); mg.addColorStop(1, '#0E7C5B'); rr(84, 84, 132, 132, 30); x.fillStyle = mg; x.fill(); x.strokeStyle = 'rgba(255,255,255,.14)'; x.lineWidth = 2; x.stroke();
  x.fillStyle = '#fff'; x.textAlign = 'center'; x.font = F(900, 46); ls(3); x.fillText('SPT', 150 + 1.5, 160); ls(0); x.fillStyle = '#F28C28'; rr(114, 178, 72, 8, 4); x.fill();
  x.textAlign = 'right'; x.fillStyle = '#A3B5AB'; x.font = F(600, 36); x.fillText(fmtDate(r.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }), W - 84, 160);
  x.textAlign = 'left'; x.fillStyle = '#fff'; x.font = F(800, 92); ls(-2); let tt = r.title; while (x.measureText(tt).width > W - 168 && tt.length > 4) tt = tt.slice(0, -1); x.fillText(tt, 84, 380); ls(0);
  x.fillStyle = '#A3B5AB'; x.font = F(600, 40); x.fillText(`${r.name}, week ${r.week}`, 84, 446);
  const big = r.key === 'C' ? [String(r.rounds), 'rounds logged'] : [r.ton.toLocaleString('en-IE'), 'kg lifted']; let fs = 340; x.font = F(900, fs); ls(-10); while (x.measureText(big[0]).width > W - 168 && fs > 120) { fs -= 10; x.font = F(900, fs); }
  x.fillStyle = '#fff'; x.fillText(big[0], 76, 800); ls(0); x.fillStyle = '#A3B5AB'; x.font = F(600, 46); x.fillText(big[1], 84, 902);
  x.fillStyle = '#F28C28'; rr(84, 936, 200, 16, 8); x.fill();
  [[fmtDur(r.dur), 'duration'], [String(r.key === 'C' ? r.rounds : r.sets), r.key === 'C' ? 'rounds' : 'sets'], [String(r.prs.length), r.prs.length === 1 ? 'PR' : 'PRs']].forEach((c, i) => { const cx = 84 + i * 316; x.fillStyle = '#fff'; x.font = F(800, 84); ls(-2); x.fillText(c[0], cx, 1034); ls(0); x.fillStyle = '#A3B5AB'; x.font = F(600, 32); x.fillText(c[1], cx, 1078); });
  r.prs.slice(0, 2).forEach((p, i) => { const y = 1146 + i * 58; x.fillStyle = '#F28C28'; rr(84, y - 36, 76, 46, 23); x.fill(); x.fillStyle = '#1A0F02'; x.font = F(800, 28); x.textAlign = 'center'; x.fillText('PR', 122, y - 3); x.textAlign = 'left'; x.fillStyle = '#fff'; x.font = F(700, 34); let n = p.name; while (x.measureText(n).width > 520 && n.length > 4) n = n.slice(0, -1); x.fillText(n, 180, y - 2); x.fillStyle = '#A3B5AB'; x.font = F(600, 34); x.textAlign = 'right'; x.fillText(prTxt(p), W - 84, y - 2); x.textAlign = 'left'; });
  x.fillStyle = '#A3B5AB'; x.font = F(600, 34); x.fillText('Tomorrow’s soreness: ' + r.doms.lvl, 84, 1290);
  return cv;
}
const recapBlob = r => new Promise((res, rej) => { try { drawRecap(r).toBlob(b => b ? res(b) : rej(new Error('blob')), 'image/png'); } catch (e) { rej(e); } });
actions.recapshare = async () => {
  const r = ui.recap; if (!r) return; let blob = ui.recapBlob; try { if (!blob) blob = await recapBlob(r); } catch (e) { return toast('Could not make the image'); }
  const name = `spt-${r.date}-${r.name.replace(/\s/g, '').toLowerCase()}.png`, f = new File([blob], name, { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [f] })) { try { await navigator.share({ files: [f], title: 'SPT session' }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  downloadBlob(blob, name); toast('Image saved');
};
{ const _fin = actions.finishok; actions.finishok = () => { const s = curSess; _fin(); if (s) { const r = buildRecap(s); PX().recaps[s.id] = r; saveState(); showRecap(r); } }; }

/* ----- previous-session ghost ----- */
function ghostHTML(e, ei, si) {
  if (!curSess) return ''; const l = exLogs(e.name).find(x => x.sid !== curSess.id && x.date <= curSess.date), p = l && l.sets[si]; if (!p) return '';
  const ty = e.tgt.load.type, st = e.sets[si], per = e.tgt.per || '';
  const t = ty === 'time' ? fmtN(p.r) + 's' : ty === 'distance' ? fmtN(p.r) + 'm' : (p.w != null ? fmtN(p.w) + '×' : '') + fmtN(p.r);
  const beat = st.done && (ty === 'time' || ty === 'distance' || p.w == null ? (st.r || 0) > (p.r || 0) : (st.w || 0) > (p.w || 0) || ((st.w || 0) === (p.w || 0) && (st.r || 0) > (p.r || 0)));
  return `<small class="gh">${beat ? '<b aria-label="beat last time">▲</b> ' : ''}prev ${t}${p.rpe ? ' @' + fmtN(p.rpe) : ''}</small>`;
}

/* ----- exercise library: pattern, equipment, cues ----- */
const EX = {
  'Trap bar deadlift': ['hinge', 'bar', 'Hips back, chest tall, brace hard, push the floor away. Finish with glutes, not by leaning back.|Reset every rep; stop the set when bar speed drops.|Skip straps on working sets. It is free grip work.'],
  'DB reverse lunge': ['lunge', 'db', 'Step back long, front shin near vertical, back knee drops straight down.|Push through the whole front foot, torso tall.|Weaker leg first, match reps on the other. This is slide-leg balance for bowling.'],
  'DB step-up': ['lunge', 'db', 'Whole foot on the box, no push from the trailing leg.|Drive up through the heel, stand tall, lower for 2 s.|Keep hips level. A dropping hip is the weakness to fix.'],
  'Leg press': ['squat', 'mach', 'Feet shoulder-width mid-platform. Lower to about 90 degrees with the lower back flat.|Press through mid-foot, stop short of locking out.|If your hips roll off the pad, you went too deep.'],
  'Sled push': ['cond', 'sled', 'Low body, 45 degree lean, short fast steps on the balls of the feet.|Hips low and steady, no bobbing.|RPE 7 is Hyrox practice, not a max. Hold the posts lightly to save your forearms.'],
  'Goblet squat': ['squat', 'db', 'Weight at the chest, elbows inside the knees at the bottom.|Sit between the hips, heels down, chest up.|Pause 1 s at the bottom for depth and control.'],
  'Romanian deadlift': ['hinge', 'bar', 'Soft knees, push hips back until the hamstrings load. Weight slides down the thighs.|Flat back, lats tight; stop at mid-shin or when the back would round.|Stand up with the glutes, not a lean.'],
  'Bulgarian split squat': ['lunge', 'db', 'Rear foot on the bench, front foot far enough that the shin stays vertical.|Drop straight down, push through the front heel.|Weaker leg first and copy its reps. Same slide-leg logic as lunges.'],
  'Hip thrust': ['hinge', 'bar', 'Upper back on the bench, shins vertical at the top.|Tuck the chin and ribs, drive through the heels, squeeze 1 s.|The glutes finish the rep, not the lower back.'],
  'Walking lunge': ['lunge', 'db', 'Long step, back knee brushes the floor, front knee tracks the toes.|Stay tall and keep steps even.|Hold DBs at your sides so the grip works too.'],
  'DB bench press': ['hpush', 'db', 'Shoulder blades pinched and down, feet planted, wrists over elbows.|Lower to the chest sides, elbows about 45 degrees, press up and slightly in.|If one arm lags, end the set. Protect the bowling-arm shoulder: no pinch at the front.'],
  'Chest-supported row': ['hpull', 'db', 'Chest on the pad. Pull the elbows to the hips, not the hands to the chest.|Squeeze the shoulder blades 1 s, lower for 2 s.|More pulling than pressing keeps a throwing shoulder healthy.'],
  'Half-kneeling landmine press': ['vpush', 'bar', 'Kneel with the pressing-side knee down, glute squeezed, ribs down.|Press up and slightly forward along the bar arc to an ear-height finish.|A shoulder-friendly press for the bowling arm. If the front of the shoulder pinches, cut the load.'],
  'Lat pulldown': ['vpull', 'mach', 'Chest up. Pull the elbows to your ribs, bar to the upper chest.|Do not lean back to move the weight; control the way up.|Neutral wrists spare the elbow.'],
  'Assisted pull-up': ['vpull', 'mach', 'Start from a hang with the shoulders down.|Chest to the bar, elbows to the ribs, lower for 3 s.|Use the least assistance that still gives clean reps.'],
  'Face pull': ['hpull', 'mach', 'Rope at forehead height. Pull to the face, hands finishing wide of the ears.|Rotate the thumbs back and squeeze the rear delts 1 s.|Light and high rep. Shoulder insurance for the bowling arm.'],
  'Incline DB press': ['hpush', 'db', 'Bench at 30 degrees. Press from the upper chest straight up.|Elbows about 45 degrees, wrists neutral.|Lower slowly and stop short of any shoulder pinch.'],
  'Single-arm cable row': ['hpull', 'mach', 'Sit or stand tall, pull the elbow past the ribs with a small natural turn.|Brace so the torso does not twist further.|Match reps on the non-bowling arm.'],
  'Seated DB shoulder press': ['vpush', 'db', 'Back supported, DBs at ear height, press up and slightly together.|Ribs down, no arching.|If the bowling shoulder pinches, swap to the landmine press.'],
  'Pallof press': ['core-anti-rot', 'mach', 'Stand side-on to the cable, handle at the chest, feet shoulder-width.|Press out, hold 2 s, do not let the torso turn toward the stack.|Bowling twists you one way all day. Take the extra set on the non-bowling side.'],
  'Side plank': ['core-lateral', 'bw', 'Elbow under the shoulder, feet stacked, hips in a straight line.|Push the floor away and keep the ribs down.|Match the weaker side’s time on both sides.'],
  'Standing anti-rotation hold': ['core-anti-rot', 'mach', 'Cable or band at chest height, handle at the sternum.|Resist the twist for the full time and breathe.|Choose a load where the hips stay square.'],
  'Dead bug': ['core-anti-rot', 'bw', 'Back flat, arms up, knees at 90 degrees.|Lower the opposite arm and leg slowly, lower back glued down.|Exhale as you reach. End the rep if the back arches.'],
  'Suitcase carry': ['core-lateral', 'db', 'One DB, walk tall without leaning toward the weight.|Ribs over hips, shoulders level.|Do both sides. Great for lateral core and grip.'],
  'Cable chop': ['core-anti-rot', 'mach', 'Step side-on, rotate hips and shoulders together, arms mostly straight.|Control the return; do not yank.|Train both directions so you are not only rotating the bowling way.'],
  "Farmer's carry": ['carry', 'db', 'Hips back to pick up, stand tall, shoulders down and back.|Short quick steps, no swinging, crush the handles.|Direct bowling grip work. No straps, both hands equal.'],
  'Plate pinch hold': ['carry', 'plate', 'Pinch two smooth plates together, fingers one side, thumb the other.|Arms hanging, shoulders down.|Thumb and finger strength is ball control. Stop if a thumb joint aches.'],
  'Dead hang': ['carry', 'bw', 'Hands just outside the shoulders, shoulders slightly active.|Breathe, no swinging.|Easy forearm endurance, and it decompresses the shoulders.'],
  'Wrist roller': ['carry', 'plate', 'Arms out at shoulder height, roll the rope up with the wrists only, then down.|Light weight. The forearms should burn.|Stop at any elbow tendon pain.'],
  'Towel pull-up hold': ['carry', 'bw', 'Drape a towel over the bar and hang from the ends.|Keep the shoulders packed.|Brutal for grip. Stop when your hands slip hard.'],
  'SkiErg': ['cond', 'erg', 'Hinge at the hips and use lats and core. Arms finish the stroke.|Drive down and through, let the handles rise on recovery.|Steady pace, exhale on the pull.'],
  'Rower': ['cond', 'erg', 'Legs, body, arms on the drive; arms, body, legs on the way back.|Handle to the lower ribs, wrists flat.|24–28 strokes a minute. Do not pull with the back.'],
  'Assault bike': ['cond', 'erg', 'Push and pull the handles, drive from legs and hips.|Shoulders relaxed; nasal breathing on easy efforts.|Low-impact conditioning when the legs are sore.'],
  'Sled pull': ['cond', 'sled', 'Walk backwards or hand over hand, keep the sled low.|Stay tall, drive through the heels.|Heavy pulling works the forearms. Treat it as grip training.'],
  /* Day C stations: names match DAY_C.steps labels exactly */
  'Row': ['cond', 'erg', 'Drive with the legs first, then lean back and finish with the arms. Handle to the lower ribs, wrists flat.|Hold a pace you can repeat for 4 rounds: 500 m should feel like RPE 7, not a sprint.'],
  'DB / sandbag walking lunge': ['lunge', 'db', 'Long step, back knee brushes the floor, torso tall, front knee over the toes.|Keep a steady rhythm and do not rush the last 5 m. Weaker leg should not drive the pace.'],
  'Wall balls': ['cond', 'ball', 'Squat to full depth with the ball at the chest, then drive up and throw to the target in one motion.|Catch it in the squat and breathe on every rep. Break early rather than failing a rep.'],
  'KB swing': ['hinge', 'kb', 'Hike the bell back, snap the hips forward and let the arms float it to chest height.|Hinge, do not squat. Squeeze the glutes at the top and keep the lats tight.'],
  'Run': ['cond', 'run', 'Land under the hips with short quick steps and relaxed shoulders.|Settle in the first 100 m. After the lunges and wall balls the legs lie, so judge pace by breathing, not feel.'],
  'Burpee broad jump': ['cond', 'bw', 'Chest to the floor, jump forward as far as you can, land soft.|Reset your stance each rep.|Keep a rhythm. If form drops, rest longer.']
};
const pat = n => EX[n] && EX[n][0], eqc = n => EX[n] && EX[n][1];
const howBtn = n => `<button class="how" data-action="how" data-ex="${esc(n)}">How</button>`;

/* ----- smart swap ----- */
actions.swap = el => {
  const ei = +el.dataset.ex, e = curSess.ex[ei], g = e.tgt.swapGroup, P = pat(e.name) || pat(e.orig), Q = eqc(e.name) || eqc(e.orig);
  const all = Object.values(LIB).flat().filter(n => n !== e.name), grp = n => Object.keys(LIB).find(k => LIB[k].includes(n));
  let c = all.filter(n => grp(n) === g && pat(n) === P);
  if (c.length < 2) c = c.concat(all.filter(n => !c.includes(n) && pat(n) === P));
  if (c.length < 2) c = c.concat(all.filter(n => !c.includes(n) && grp(n) === g));
  const sc = n => (exLogs(n).length ? 2 : 0) + (eqc(n) === Q ? 1 : 0);
  c = c.map((n, i) => [n, i]).sort((a, b) => sc(b[0]) - sc(a[0]) || a[1] - b[1]).slice(0, 3).map(x => x[0]);
  const rowB = (n, why) => `<button class="row swr" data-action="doswap" data-ex="${ei}" data-name="${esc(n)}"><div class="grow"><div class="t">${esc(n)}</div>${why ? `<div class="s">${why}</div>` : ''}</div></button>`;
  let b = e.name !== e.orig ? `<button class="btn ghost" style="margin-bottom:10px" data-action="doswap" data-ex="${ei}" data-name="${esc(e.orig)}">Back to ${esc(e.orig)}</button>` : '';
  b += `<div class="sec" style="margin-top:0">Like-for-like</div><div class="card">${c.map(n => rowB(n, [exLogs(n).length ? 'Logged before' : '', eqc(n) === Q ? 'same equipment' : ''].filter(Boolean).join(', '))).join('')}</div>`;
  b += `<div class="sec">All exercises</div><input type="search" data-in="swapq" placeholder="Search exercises" aria-label="Search exercises" autocomplete="off"><div class="card" id="swall" style="margin-top:10px">${all.map(n => rowB(n, '').replace('class="row swr"', `class="row swr" data-q="${esc(n.toLowerCase())}"`)).join('')}</div>`;
  openSheet('Swap ' + e.name, `<p class="muted" style="margin-top:0">Stays swapped for the rest of ${BLOCK.name}.</p>` + b, { close: 'Cancel' });
};
inputs.swapq = el => { const q = el.value.trim().toLowerCase(); $$('#swall .row').forEach(r => { r.style.display = !q || r.dataset.q.includes(q) ? '' : 'none'; }); };

/* ----- exercise How sheet with inline video ----- */
/* name -> YouTube id. Only IDs whose oEmbed lookup resolved (title + channel confirmed) are listed; everything else falls back to a YouTube search link. */
const VID = { 'Romanian deadlift': '_oyxCn2iSjU', 'Hip thrust': 'xDmFkJxPzeM', 'Lat pulldown': 'O94yEoGXtBY', 'Assisted pull-up': 'O94yEoGXtBY' };   /* Jeff Nippard */
const ytId = s => { s = (s || '').trim(); const m = s.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/)([\w-]{11})/); return m ? m[1] : /^[\w-]{11}$/.test(s) ? s : null; };
const vidFor = n => PX().videos[n] || VID[n] || null;
const ytWatch = (n, id) => id ? 'https://www.youtube.com/watch?v=' + id : 'https://www.youtube.com/results?search_query=' + encodeURIComponent(n + ' technique');
function howBody(n) {
  const x = EX[n], cues = x ? x[2].split('|') : ['Move with control, stay at the prescribed RPE and stop if anything pinches.'], ov = !!PX().videos[n];
  return `<div class="vid" id="vidbox"><div class="vidfb"><span>Loading video…</span></div></div><ul class="cues">${cues.map(c => `<li>${esc(c)}</li>`).join('')}</ul><details class="ov"><summary>Use a different video</summary><input id="vidurl" type="url" inputmode="url" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Paste a YouTube link" aria-label="YouTube link"><div class="two" style="margin-top:8px"><button class="btn sm" data-action="vidsave">Save video</button>${ov ? '<button class="btn sm ghost" data-action="vidreset">Reset to default</button>' : '<span></span>'}</div></details>`;
}
function mountVideo(n) {
  if (ui.howC) ui.howC(); ui.howC = null; const box = $('#vidbox'); if (!box) return; const id = vidFor(n);
  const fb = (m, lbl) => { const b = $('#vidbox'); if (b) b.innerHTML = `<div class="vidfb"><span>${m}</span><a class="btn sm" href="${ytWatch(n, id)}" target="_blank" rel="noopener">${lbl || 'Open in YouTube'}</a></div>`; };
  if (!id) return fb('No video saved for this one yet.', 'Search YouTube');
  if (navigator.onLine === false) return fb('You are offline. The cues below still work.');
  const f = document.createElement('iframe'); f.title = n + ' technique video'; f.loading = 'lazy'; f.allow = 'encrypted-media; picture-in-picture; fullscreen'; f.referrerPolicy = 'strict-origin-when-cross-origin';
  f.src = `https://www.youtube-nocookie.com/embed/${id}?playsinline=1&rel=0&modestbranding=1&enablejsapi=1&origin=${encodeURIComponent(location.origin)}`;
  box.innerHTML = ''; box.appendChild(f);
  let ok = false; const t0 = Date.now(), on = e => { if (e.origin === 'https://www.youtube-nocookie.com') ok = true; };
  window.addEventListener('message', on);
  const stop = () => { clearInterval(iv); window.removeEventListener('message', on); };
  const iv = setInterval(() => {
    if (ok) return stop();
    try { f.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*'); } catch (e) { }
    if (Date.now() - t0 > 6000) { stop(); fb('The video did not load.'); }
  }, 400);
  ui.howC = stop;
}
actions.how = el => { const n = el.dataset.ex; ui.how = n; openSheet(n, howBody(n), { close: 'Done', onClose: () => { if (ui.howC) ui.howC(); ui.howC = null; } }); mountVideo(n); };
actions.vidsave = () => { const id = ytId(($('#vidurl') || {}).value); if (!id) return toast('That is not a YouTube link'); PX().videos[ui.how] = id; saveState(); setSheetBody(howBody(ui.how)); mountVideo(ui.how); toast('Video saved'); };
actions.vidreset = () => { delete PX().videos[ui.how]; saveState(); setSheetBody(howBody(ui.how)); mountVideo(ui.how); toast('Back to the default video'); };

/* ----- weekly review ----- */
function isoWeek(d) { const t = parseISO(d); t.setDate(t.getDate() + 3 - (t.getDay() + 6) % 7); const j = new Date(t.getFullYear(), 0, 4); return t.getFullYear() + '-W' + pad2(1 + Math.round(((t - j) / 864e5 - 3 + (j.getDay() + 6) % 7) / 7)); }
function reviewData(mon) {
  const today = isoDate(), sun = addDays(mon, 6), inW = d => d >= mon && d <= sun;
  const slots = allSlots().filter(s => DAY_INFO[s.key].gym && inW(s.date) && s.date <= today), st = s => S.slotStatus[s.id];
  const done = slots.filter(s => st(s) === 'done'), skipped = slots.filter(s => st(s) === 'skipped'), missed = slots.filter(s => !st(s) && s.date < today);
  const ton = Object.values(S.sessions).filter(s => inW(s.date)).reduce((a, s) => a + sessionStats(s).ton, 0);
  const cis = Object.entries(S.checkins).filter(([d]) => inW(d)).map(e => e[1]), avg = (a, k) => { const v = a.map(c => c && c[k]).filter(x => x != null); return v.length ? r1(v.reduce((p, q) => p + q, 0) / v.length) : null; };
  let bh = 0, bg = 0, wr = []; for (let d = mon; d <= sun; d = addDays(d, 1)) { const b = bowlOf(d); if (b) { bh += +b.hours || 0; bg += +b.games || 0; } const w = (S.whoop || {})[d]; if (w && w.recovery) wr.push(w.recovery); }
  const lifts = MAIN_LIFTS.map(n => { const L = exLogs(n), cur = Math.max(0, ...L.filter(l => inW(l.date)).map(l => bestE1(l.sets))), pr = Math.max(0, ...L.filter(l => l.date < mon).map(l => bestE1(l.sets))); return { n, cur, d: pr ? cur - pr : null }; }).filter(l => l.cur).sort((a, b) => b.cur - a.cur).slice(0, 3);
  const bw = Math.floor(diffDays(mon, BLOCK.start) / 7) + 1;
  return { mon, sun, key: isoWeek(mon), planned: slots.length, done, skipped, missed, ton, doms: avg(cis, 'doms'), sleep: avg(cis, 'sleepH'), bh: r1(bh), bg, rec: avg(wr, 'score'), hrv: avg(wr, 'hrv_ms'), lifts, bw: bw >= 1 && bw <= BLOCK.weeks ? bw : null };
}
function reviewText(mon) {
  const d = reviewData(mon), f = PX().reviews[d.key] || {}, wd = s => fmtDate(s.date, { weekday: 'short' }), dash = v => v == null ? '-' : v;
  const L = [`SPT WEEKLY ${d.key} (${fmtShort(d.mon)}-${fmtShort(d.sun)})`, `Block 1 wk ${dash(d.bw)} | adherence ${d.done.length}/${d.planned}${d.planned ? ' (' + Math.round(d.done.length / d.planned * 100) + '%)' : ''}`,
    `Done: ${d.done.map(s => DAY_INFO[s.key].name.slice(-1) + ' ' + wd(s)).join(', ') || 'none'}`, `Skipped/missed: ${d.skipped.concat(d.missed).map(s => DAY_INFO[s.key].name.slice(-1) + ' ' + wd(s)).join(', ') || 'none'}`,
    `Tonnage: ${d.ton} kg`, `DOMS avg ${dash(d.doms)}/10 | sleep avg ${dash(d.sleep)} h`, `Lanes: ${d.bh} h, ${d.bg} games`];
  if (d.rec != null || d.hrv != null) L.push(`Whoop: recovery ${dash(d.rec != null ? Math.round(d.rec) : null)}% | HRV ${dash(d.hrv != null ? Math.round(d.hrv) : null)} ms`);
  L.push('e1RM: ' + (d.lifts.map(l => `${l.n} ${Math.round(l.cur)}${l.d != null ? ' (' + (l.d >= 0 ? '+' : '') + Math.round(l.d) + ')' : ' (new)'}`).join('; ') || 'none logged'));
  let t = L.join('\n');
  /* optimise lines (load ratio, lanes): appended after the fixed header and truncated to fit, never the header */
  const ex = []; try {
    if (typeof optWeeklyReview === 'function') { const w = optWeeklyReview(d.mon, d.sun > isoDate() ? isoDate() : d.sun); if (w && w.text) ex.push(w.text); }
    if (typeof optLaneBlock === 'function') { const b = optLaneBlock(); if (b) ex.push(b); }
  } catch (e) { }
  ex.forEach(x => { const room = 1200 - t.length - 1; if (room < 12) return; t += '\n' + (x.length > room ? x.slice(0, room - 1) + '…' : x); });
  let feel = (f.feel || '').replace(/\s+/g, ' ').trim();
  if (feel) { const room = 1200 - t.length - 7; if (room > 1) t += '\nFeel: ' + (feel.length > room ? feel.slice(0, Math.max(0, room - 1)) + '…' : feel); }
  return t.slice(0, 1200);
}
function reviewBody() {
  const mon = ui.rev, d = reviewData(mon), f = PX().reviews[d.key] || {}, cur = mon >= monOf(isoDate());
  const k = (v, l) => `<div class="card pad kv"><b>${v}</b><span>${l}</span></div>`;
  return `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px"><button class="ib" data-action="revnav" data-n="-1" aria-label="Previous week">‹</button><b>${d.key} · ${fmtShort(d.mon)} to ${fmtShort(d.sun)}</b><button class="ib" data-action="revnav" data-n="1" aria-label="Next week" ${cur ? 'disabled style="opacity:.3"' : ''}>›</button></div>
<div class="grid2">${k(`${d.done.length}/${d.planned}`, 'sessions done')}${k(d.ton.toLocaleString('en-IE'), 'kg lifted')}${k(d.doms ?? '–', 'avg soreness')}${k(d.sleep != null ? d.sleep + ' h' : '–', 'avg sleep')}${k(d.bh + ' h', `on lanes, ${d.bg} games`)}${d.rec != null ? k(Math.round(d.rec) + '%', 'avg recovery' + (d.hrv != null ? ', HRV ' + Math.round(d.hrv) : '')) : k(d.skipped.length + d.missed.length, 'skipped or missed')}</div>
<div class="sec">Top lifts, estimated 1RM</div><div class="card">${d.lifts.map(l => `<div class="row"><div class="grow t">${esc(l.n)}</div><b class="tn">${Math.round(l.cur)} kg</b><span class="pill ${l.d > 0 ? 'g' : ''}">${l.d == null ? 'new' : (l.d >= 0 ? '+' : '') + Math.round(l.d)}</span></div>`).join('') || '<div class="empty">No main lifts logged this week.</div>'}</div>
<div class="lbl">How did the week feel?</div><textarea data-in="revfeel" placeholder="Energy, niggles, what to change" aria-label="How did the week feel">${esc(f.feel || '')}</textarea>
<div style="display:grid;gap:8px;margin-top:14px"><button class="btn pri" data-action="revcopy">Copy for coach</button><button class="btn" data-action="revshare">Share</button></div>`;
}
function openReview(mon) { ui.rev = mon || monOf(isoDate()); const k = isoWeek(ui.rev), r = PX().reviews[k] || (S.reviews[k] = {}); r.seen = true; saveState(); openSheet('Weekly review', reviewBody()); }
actions.revopen = () => openReview();
actions.revnav = el => { const n = addDays(ui.rev, 7 * +el.dataset.n); if (n > monOf(isoDate())) return; ui.rev = n; const k = isoWeek(n); (PX().reviews[k] = PX().reviews[k] || {}).seen = true; setSheetBody(reviewBody()); };
inputs.revfeel = el => debounced('rf', () => { const k = isoWeek(ui.rev); (PX().reviews[k] = PX().reviews[k] || {}).feel = el.value; saveState(); });
async function copyText(t) { try { await navigator.clipboard.writeText(t); return true; } catch (e) { } try { const a = document.createElement('textarea'); a.value = t; a.style.cssText = 'position:fixed;top:0;opacity:0'; document.body.appendChild(a); a.select(); const ok = document.execCommand('copy'); a.remove(); return ok; } catch (e) { return false; } }
actions.revcopy = async () => { const fe = $('[data-in=revfeel]'); if (fe) { (PX().reviews[isoWeek(ui.rev)] = PX().reviews[isoWeek(ui.rev)] || {}).feel = fe.value; saveState(); } toast(await copyText(reviewText(ui.rev)) ? 'Copied. Paste it into the chat' : 'Could not copy. Use Share instead', { ms: 3200 }); haptic('tick'); };
actions.revshare = async () => { const t = reviewText(ui.rev); if (navigator.share) { try { await navigator.share({ text: t }); return; } catch (e) { if (e && e.name === 'AbortError') return; } } actions.revcopy(); };
function maybeReview() {
  const n = new Date(); if (n.getDay() !== 0 || n.getHours() < 18 || ui.sheet) return false;
  const k = isoWeek(monOf(isoDate())), r = PX().reviews[k] || (S.reviews[k] = {}); if (r.seen || r.pd === isoDate()) return false; r.pd = isoDate(); saveState();
  openSheet('Week review', `<p style="margin-top:0">The week is nearly done. See adherence, tonnage and lifts, then copy it for your coach.</p><div style="display:grid;gap:8px"><button class="btn pri" data-action="revopen">Open review</button><button class="btn ghost" data-action="sheetclose">Not now</button></div>`, { close: 'Close' }); return true;
}

/* ----- screen wrappers (keep existing templates untouched) ----- */
{
  const _t = screens.today;
  screens.today = () => {
    const date = isoDate(); let h = _t();
    h = h.replace(/<div class="datebig">([^<]*)<\/div>/, (m, a) => `<div class="datebig tb">${a}<button class="lnk" data-action="briefing">Briefing</button></div>`);
    h = h.replace(/<p class="sub">[^]*?<\/p>/, m => m + ringCard(date));
    const k = '<div class="sec">Quick check-in</div>', i = h.indexOf(k); return i < 0 ? h : h.slice(0, i) + bowlToday(date) + h.slice(i);
  };
  const _p = screens.plan;
  screens.plan = () => {
    let h = _p(); if (ui.plan.view !== 'week') return h;
    allSlots().filter(s => s.w === ui.plan.week).forEach(s => { const b = bowlOf(s.date); if (!b || !(b.hours || b.games)) return; const chip = `<span class="pill o">Lanes ${b.hours ? fmtN(b.hours) + ' h' : b.games + ' games'}</span>`; h = h.replace(new RegExp(`(data-slot="${s.id}">[^]*?)(<svg class="chev")`), (m, a, c) => a + chip + c); });
    return h;
  };
  const _g = screens.progress;
  screens.progress = () => {
    let h = _g(), n = 0; const mon = monOf(isoDate()), d = reviewData(mon);
    h = h.replace(/(Soreness [^<]*h<\/div>)/g, m => { const w = ++n, ws = addDays(BLOCK.start, (w - 1) * 7); let lh = 0; for (let x = ws; x <= addDays(ws, 6); x = addDays(x, 1)) lh += bowlHrs(x); return m + (lh ? `<div class="s" style="font-size:13px;color:var(--ink2)">Lanes ${fmtN(lh)} h</div>` : ''); });
    const rc = Object.values(PX().recaps).sort((a, b) => a.u < b.u ? 1 : -1).slice(0, 6);
    const add = `<div class="sec">Review</div><div class="card"><button class="row" data-action="revopen"><div class="grow"><div class="t">Weekly review</div><div class="s">${d.key} · ${d.done.length}/${d.planned} sessions · copy for your coach</div></div>${chev}</button></div>` + (rc.length ? `<div class="sec">Session recaps</div><div class="card">${rc.map(r => `<button class="row" data-action="recapview" data-id="${esc(r.id)}"><div class="grow"><div class="t">${esc(r.name)}: ${esc(r.title)}</div><div class="s">${fmtShort(r.date)} · ${r.key === 'C' ? r.rounds + ' rounds' : r.ton.toLocaleString('en-IE') + ' kg'}${r.prs.length ? ' · ' + r.prs.length + ' PR' + (r.prs.length > 1 ? 's' : '') : ''}</div></div>${chev}</button>`).join('')}</div>` : '');
    return h.replace('<p class="sub">Trends from what you log.</p>', m => m + add);
  };
}

/* ----- settings: feedback + Drive backup ----- */
const DRV = { tok: null, exp: 0, busy: false }, DAPI = 'https://www.googleapis.com/drive/v3/files', DUP = 'https://www.googleapis.com/upload/drive/v3/files';
function premiumSettingsHTML() {
  PX(); const d = S.drive, st = S.settings, tg = (k, l, s, on) => `<button class="row ${on ? 'on' : ''}" data-action="premtoggle" data-k="${k}" role="switch" aria-checked="${on}">${checkIco}<div class="grow"><div class="t">${l}</div><div class="s">${s}</div></div></button>`;
  const last = d.lastBackup ? fmtDate(isoDate(new Date(d.lastBackup)), { day: 'numeric', month: 'short' }) + ', ' + new Date(d.lastBackup).toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' }) : 'never';
  return `<div class="sec">Feedback</div><div class="card">${tg('haptics', 'Haptics', 'Taps on set confirm, timer end and finish', st.haptics !== false)}${tg('sound', 'Rest timer chime', 'Two soft tones. Plays alongside your music', st.sound !== false)}</div>
<div class="sec">Backup to Google Drive</div><div class="card pad"><div style="display:flex;gap:8px;flex-wrap:wrap"><span class="pill ${d.connected ? 'g' : ''}">${d.connected ? 'Connected' : 'Not connected'}</span><span class="pill">Last backup: ${last}</span>${d.err ? `<span class="pill o">${esc(d.err)}</span>` : ''}</div><div class="lbl">OAuth client ID</div><input data-in="drvid" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="123456-abc.apps.googleusercontent.com" value="${esc(d.clientId || '')}" aria-label="Google OAuth client ID"><div style="display:grid;gap:8px;margin-top:14px">${d.connected ? `<button class="btn pri" data-action="drivebackup">Back up now</button><button class="btn" data-action="driverestore">Restore from latest</button><button class="btn ghost danger" data-action="drivedisc">Disconnect</button>` : '<button class="btn pri" data-action="driveconnect">Connect Google Drive</button>'}</div><p class="muted" style="font-size:13px;margin:10px 0 0">Saves a JSON file to a Drive folder called SPT Backups. Needs a Web OAuth client ID; steps are in the README.</p></div>`;
}
actions.premtoggle = el => { const k = el.dataset.k; S.settings[k] = S.settings[k] === false; saveState(); if (S.settings[k] !== false) { if (k === 'sound') chime(); else haptic('tick'); } render(); };
inputs.drvid = el => debounced('drvid', () => { PX().drive.clientId = el.value.trim(); saveState(); });
function loadGIS() { return window.google && google.accounts && google.accounts.oauth2 ? Promise.resolve() : (DRV.p = DRV.p || new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = res; s.onerror = () => { DRV.p = null; rej(new Error('offline')); }; document.head.appendChild(s); })); }
function driveToken(prompt) {
  if (DRV.tok && Date.now() < DRV.exp - 60000) return Promise.resolve(DRV.tok);
  return loadGIS().then(() => new Promise((res, rej) => {
    const id = PX().drive.clientId; if (!id) return rej(new Error('noid')); const to = setTimeout(() => rej(new Error('timeout')), 20000);
    const c = google.accounts.oauth2.initTokenClient({ client_id: id, scope: 'https://www.googleapis.com/auth/drive.file', callback: r => { clearTimeout(to); if (r.error || !r.access_token) return rej(new Error(r.error || 'denied')); DRV.tok = r.access_token; DRV.exp = Date.now() + (+r.expires_in || 3600) * 1000; res(DRV.tok); }, error_callback: e => { clearTimeout(to); rej(new Error((e && e.type) || 'popup')); } });
    c.requestAccessToken({ prompt: prompt || '' });
  }));
}
async function gapi(url, o = {}) { const t = await driveToken(); const r = await fetch(url, Object.assign({}, o, { headers: Object.assign({ Authorization: 'Bearer ' + t }, o.headers) })); if (r.status === 401) { DRV.tok = null; throw new Error('auth'); } if (!r.ok) throw new Error('HTTP ' + r.status); return r; }
const driveErr = e => { const m = e && e.message || ''; return m === 'noid' ? 'Paste your OAuth client ID first' : m === 'offline' || !navigator.onLine ? 'Offline. Try again when connected' : /popup|timeout|denied|access_denied/.test(m) ? 'Google sign-in did not finish. Tap again' : m === 'auth' ? 'Google session expired. Tap again' : 'Drive error: ' + m; };
async function driveFolder() {
  if (S.drive.folderId) { try { const j = await (await gapi(`${DAPI}/${S.drive.folderId}?fields=id,trashed`)).json(); if (!j.trashed) return j.id; } catch (e) { if (!/HTTP 404/.test(e.message)) throw e; } }
  let j = await (await gapi(`${DAPI}?q=${encodeURIComponent("name='SPT Backups' and mimeType='application/vnd.google-apps.folder' and trashed=false")}&fields=files(id)`)).json(), id = j.files && j.files[0] && j.files[0].id;
  if (!id) { j = await (await gapi(`${DAPI}?fields=id`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'SPT Backups', mimeType: 'application/vnd.google-apps.folder' }) })).json(); id = j.id; }
  S.drive.folderId = id; saveState(); return id;
}
async function driveBackup(silent) {
  if (DRV.busy) return false; if (!navigator.onLine) { if (!silent) toast('Offline. Back up when you are connected'); return false; }
  DRV.busy = true; if (!silent) toast('Backing up…', { ms: 1500 });
  try {
    await driveToken(silent ? 'none' : '');
    const folder = await driveFolder(), name = `spt-backup-${isoDate()}.json`, body = JSON.stringify(await buildExport());
    const ex = (await (await gapi(`${DAPI}?q=${encodeURIComponent(`name='${name}' and '${folder}' in parents and trashed=false`)}&fields=files(id)`)).json()).files || [], bd = 'spt' + uid();
    const meta = ex[0] ? { name } : { name, parents: [folder], mimeType: 'application/json' };
    const mp = `--${bd}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${bd}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${bd}--`;
    const j = await (await gapi(`${DUP}${ex[0] ? '/' + ex[0].id : ''}?uploadType=multipart&fields=id`, { method: ex[0] ? 'PATCH' : 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + bd }, body: mp })).json();
    Object.assign(S.drive, { lastBackup: Date.now(), lastFile: j.id, lastName: name, err: '' }); saveState(); DRV.busy = false;
    if (!silent) toast('Backed up to Google Drive'); if (ui.tab === 'plan' && !ui.sheet) render(); return true;
  } catch (e) { DRV.busy = false; S.drive.err = silent ? '' : driveErr(e); saveState(); if (!silent) { toast(driveErr(e), { ms: 4500 }); if (ui.tab === 'plan' && !ui.sheet) render(); } else throw e; return false; }
}
actions.driveconnect = async () => {
  const f = $('[data-in=drvid]'); if (f) PX().drive.clientId = f.value.trim(); saveState(); if (!S.drive.clientId) return toast('Paste your OAuth client ID first'); if (!navigator.onLine) return toast('Offline. Try again when connected');
  try { await driveToken(''); S.drive.connected = true; S.drive.err = ''; saveState(); toast('Google Drive connected'); render(); } catch (e) { toast(driveErr(e), { ms: 4500 }); }
};
actions.drivebackup = () => driveBackup(false);
actions.drivedisc = () => { try { if (DRV.tok && window.google) google.accounts.oauth2.revoke(DRV.tok, () => { }); } catch (e) { } DRV.tok = null; Object.assign(S.drive, { connected: false, err: '' }); saveState(); render(); toast('Disconnected. Backups stay in Drive'); };
actions.driverestore = async () => {
  if (!navigator.onLine) return toast('Offline. Try again when connected');
  try {
    const folder = await driveFolder(), l = await (await gapi(`${DAPI}?q=${encodeURIComponent(`'${folder}' in parents and trashed=false and name contains 'spt-backup-'`)}&orderBy=modifiedTime desc&pageSize=1&fields=files(id,name,modifiedTime)`)).json(), f = l.files && l.files[0];
    if (!f) return toast('No backups found in SPT Backups');
    const o = await (await gapi(`${DAPI}/${f.id}?alt=media`)).json(); if (!o || o.version !== 2 || !o.state) throw new Error('not an SPT backup');
    pendingImport = o; const n = x => Object.keys(x || {}).length;
    openSheet('Restore from Drive', `<p style="margin-top:0">${esc(f.name)}. This adds to what is on this device and keeps your settings. If both have the same entry, the newer one wins.</p><div class="card"><div class="row"><div class="grow">Sessions</div><b class="tn">${n(o.state.sessions)}</b></div><div class="row"><div class="grow">Daily check-ins</div><b class="tn">${n(o.state.checkins)}</b></div><div class="row"><div class="grow">Photos</div><b class="tn">${(o.photos || []).length}</b></div></div><button class="btn pri" style="margin-top:14px" data-action="importok">Merge into this device</button>`, { close: 'Cancel' });
  } catch (e) { toast(driveErr(e), { ms: 4500 }); }
};
function driveAuto() {
  const d = PX().drive; if (!d.connected || !d.clientId || !navigator.onLine || (d.lastBackup && Date.now() - d.lastBackup < 7 * 864e5) || d.askDate === isoDate()) return;
  d.askDate = isoDate(); saveState();
  driveBackup(true).catch(() => toast('Weekly Drive backup is due', { action: 'drivebackup', label: 'Back up', ms: 12000 }));
}
mergeImport = (_m => async function (o) { await _m(o); const s = o.state || {}; ['recaps', 'bowling', 'reviews'].forEach(k => { PX()[k] = mergeKeyed(S[k], s[k]); }); S.videos = Object.assign({}, s.videos || {}, PX().videos); saveState(); })(mergeImport);

/* ----- init ----- */
function premiumInit() {
  PX(); const chain = () => { if (!maybeBrief()) maybeReview(); };
  if (!showWhatsNew(chain)) chain();
  setTimeout(driveAuto, 2500);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) chain(); });
}
document.addEventListener('DOMContentLoaded', premiumInit);
