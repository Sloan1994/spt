/* ===== helpers shared ===== */
const getCI = d => S.checkins[d] || {};
const srcWithout = (d, k) => { const s = Object.assign({}, getCI(d).src); delete s[k]; return s; };
function setCI(d, patch) { S.checkins[d] = Object.assign({}, S.checkins[d], patch, { u: Date.now() }); saveState(); }
const exLink = (n, cls = '') => `<button class="${cls}" data-action="exhist" data-ex="${esc(n)}">${esc(n)}</button>`;
function prescList(key, wk) {
  return DAYS[key].map((_, i) => slotPresc(key, wk, i));
}

/* ===== TODAY ===== */
screens.today = () => {
  const date = isoDate(), c = ctxFor(date), info = DAY_INFO[c.key], slot = c.slot, ci = getCI(date);
  let h = `<div class="datebig">${fmtDate(date)}</div><h1>Today</h1><p class="sub">${esc(dayLabel(c))}</p>`;
  if (localStorage.getItem(OLD_KEY) && !S.flags.oldDismissed) {
    h += `<div class="card pad" style="margin-bottom:12px"><b>Old tracker data found</b><div class="muted" style="font-size:14px;margin:4px 0 10px">SPT v2 starts clean. Save a copy of the old data before you forget. It stays untouched on this device.</div><div style="display:flex;gap:8px"><button class="btn sm pri" data-action="oldbackup">Download old data backup (JSON)</button><button class="btn sm ghost" data-action="olddismiss">Hide</button></div></div>`;
  }
  h += recoveryCard(date);
  /* hero */
  if (c.phase === 'in' && (c.key === 'A' || c.key === 'B' || c.key === 'C') && slot) {
    const s = sessionOf(slot), st = s ? sessionStats(s) : null, done = s && s.status === 'done';
    h += `<div class="hero${wzCls(date)}"><div class="letter">${c.key}</div><span class="tag" style="background:rgba(255,255,255,.16);color:#fff;position:relative">${info.name}</span><h2>${info.title}</h2><div class="meta">${c.key === 'C' ? DAY_C.rounds[slot.w - 1] + ' rounds' : DAYS[c.key].length + ' exercises'} · week ${slot.w}${slot.w === 4 ? ', deload' : ''}${c.status ? ' · ' + c.status : ''}</div><ul>`;
    if (c.key === 'C') {
      h += `<li><span style="opacity:1;font-weight:600">Warm-up</span><span style="white-space:normal;text-align:right">${esc(DAY_C.warm)}</span></li>`;
      DAY_C.steps(slot.w).forEach(([a, b]) => { h += `<li><b style="font-weight:600">${a}</b><span>${b}</span></li>`; });
    } else prescList(c.key, slot.w).forEach(p => { h += `<li><button data-action="exhist" data-ex="${esc(p.name)}">${esc(p.name)}${p.optional ? ' (optional)' : ''}</button><span>${p.sets}×${p.reps}${p.per}${p.load.type === 'kg' && p.load.value != null ? ' @' + p.load.value : ''}</span></li>`; });
    h += `</ul>`;
    if (c.key === 'B' && slot.w === 1) h += `<div class="meta" style="margin:-4px 0 12px">${DAY_B_CAP}</div>`;
    h += `<button class="btn pri" data-action="startsession" data-slot="${slot.id}">${done ? 'Review session' : s && st.sets + st.rounds ? `Continue session · ${st.sets + st.rounds} done` : 'Start session'}</button></div>`;
  } else if (c.phase === 'in') {
    const z = c.key === 'Z';
    h += `<div class="hero rest${wzCls(date)}"><div class="letter">${z ? 'Z2' : '–'}</div><h2>${c.moved ? 'Rest' : esc(info.name)}</h2><div class="meta">${c.moved ? 'Session moved to another day.' : esc(info.title)}</div>`;
    h += `<ul><li><span style="opacity:1">${z ? 'Easy conversational pace, 30–40 min. Nasal breathing if you can. Bowling counts if it was a real practice block.' : 'Walk, play, sleep. Do the mobility below.'}</span></li></ul>`;
    if (slot && z) h += `<button class="btn ${c.status === 'done' ? '' : 'pri'}" data-action="slotmark" data-slot="${slot.id}" data-st="${c.status === 'done' ? '' : 'done'}">${c.status === 'done' ? 'Done. Tap to undo' : 'Mark done'}</button>`;
    h += `</div>`;
  } else {
    h += `<div class="hero rest"><div class="letter">${c.phase === 'before' ? '…' : '✓'}</div><h2>${c.phase === 'before' ? 'Ready when you are' : 'Block complete'}</h2><div class="meta">${c.phase === 'before' ? `Day A starts ${fmtDate(BLOCK.start, { weekday: 'long', day: 'numeric', month: 'long' })}, in ${diffDays(BLOCK.start, date)} days.` : 'Write up the next block in Plan or with your coach.'}</div><button class="btn grn" data-action="tab" data-tab="plan">See the programme</button></div>`;
  }
  /* quick log */
  if (ci.sleepH == null || ci.doms == null) {
    h += `<div class="sec">Quick check-in</div><div class="card pad"><div class="lbl" style="margin-top:0">Sleep last night (hours)</div><input data-in="qsleep" inputmode="decimal" placeholder="7.5" value="${ci.sleepH ?? ''}" aria-label="Sleep hours"><div class="lbl">Soreness today (0 none, 10 worst)</div><div class="chips o" style="gap:4px">${[...Array(11).keys()].map(n => `<button class="chip" style="min-width:44px;flex:1" data-action="qdoms" data-v="${n}" aria-pressed="${ci.doms === n}">${n}</button>`).join('')}</div></div>`;
  } else h += `<div class="sec">Quick check-in</div><div class="card"><button class="row" data-action="tab" data-tab="log"><div class="grow"><div class="t">Logged for today</div><div class="s">Sleep ${fmtN(ci.sleepH)} h · soreness ${ci.doms}/10</div></div>${chev}</button></div>`;
  /* mobility */
  const ml = S.mobLog[date] || {}, md = MOBILITY.filter(m => ml[m.id]).length;
  h += `<div class="sec"><span>Daily mobility</span><span class="faint">${md}/${MOBILITY.length}</span></div><div class="card">${MOBILITY.map(m => `<button class="row ${ml[m.id] ? 'on' : ''}" data-action="mobtoggle" data-id="${m.id}">${checkIco}<div class="grow"><div class="t strike">${m.t}</div><div class="s">${m.d}</div></div></button>`).join('')}</div>`;
  /* recovery */
  if (c.phase === 'in') {
    const rc = recoveryFor(date, c.key);
    if (rc.text || rc.warn) h += `<div class="sec">Recovery</div><div class="card pad">${rc.text ? `<div>${rc.text}</div>` : ''}${rc.warn ? `<div class="muted" style="font-size:14px;${rc.text ? 'margin-top:6px' : ''}">${RECOVERY_NOTE}</div>` : ''}</div>`;
  }
  /* supplements */
  h += suppCard(date, c.key);
  /* rules */
  h += `<div class="sec">Rules for this block</div><div class="card pad">${GLOBAL_RULES.map(r => `<div class="reason">${r}</div>`).join('')}</div>`;
  return h;
};
function suppCard(date, key, title = 'Supplements') {
  const list = suppsFor(date, key), log = S.suppLog[date] || {}, nowHM = pad2(new Date().getHours()) + ':' + pad2(new Date().getMinutes()), today = date === isoDate();
  const n = list.filter(s => log[s.id]).length;
  return `<div class="sec"><span>${title}</span><span class="faint">${n}/${list.length}</span></div><div class="card">${list.map(s => {
    const due = today && s.time && s.time <= nowHM && !log[s.id];
    return `<button class="row ${log[s.id] ? 'on' : ''}" data-action="supptoggle" data-id="${s.id}" data-date="${date}">${checkIco}<div class="grow"><div class="t strike">${esc(s.name)} <span class="muted" style="font-weight:500">${esc(s.dose)}</span></div><div class="s">${esc(s.when)}${s.time ? ' · ' + s.time : ''}${due ? ' · <b style="color:var(--o)">due</b>' : ''}</div></div></button>`;
  }).join('') || '<div class="empty">No supplements set up for this day.</div>'}</div>`;
}
actions.oldbackup = () => {
  try { const raw = localStorage.getItem(OLD_KEY); downloadBlob(new Blob([raw], { type: 'application/json' }), 'spt-old-data-backup-' + isoDate() + '.json'); toast('Old data saved'); } catch (e) { toast('Could not read old data'); }
};
actions.olddismiss = () => { S.flags.oldDismissed = true; saveState(); render(); };
actions.startsession = el => { const slot = allSlots().find(s => s.id === el.dataset.slot); if (!slot) return; ensureSession(slot); ui.trainSlot = slot.id; ui.act = null; closeSheet(true); vib(10); go('train'); };
actions.slotmark = el => { const id = el.dataset.slot; if (el.dataset.st) S.slotStatus[id] = el.dataset.st; else delete S.slotStatus[id]; saveState(); vib(8); closeSheet(true); render(); };
actions.qdoms = el => { setCI(isoDate(), { doms: +el.dataset.v }); vib(6); render(); };
inputs.qsleep = el => { const v = num(el.value); debounced('qsleep', () => { if (v != null && v >= 0 && v <= 24) { setCI(isoDate(), { sleepH: v, src: srcWithout(isoDate(), 'sleepH') }); if (getCI(isoDate()).doms != null) render(); } }); };
actions.mobtoggle = el => { const d = isoDate(); const m = S.mobLog[d] = S.mobLog[d] || {}; m[el.dataset.id] = !m[el.dataset.id]; if (!m[el.dataset.id]) delete m[el.dataset.id]; saveState(); vib(6); render(); };
actions.supptoggle = el => { const d = el.dataset.date, m = S.suppLog[d] = S.suppLog[d] || {}; if (m[el.dataset.id]) delete m[el.dataset.id]; else m[el.dataset.id] = Date.now(); saveState(); vib(6); render(); };

/* ===== PLAN ===== */
function slotStatusPill(st) { return st === 'done' ? '<span class="pill g">Done</span>' : st === 'skipped' ? '<span class="pill">Skipped</span>' : ''; }
screens.plan = () => {
  const P = ui.plan; let h = '';
  const back = (to, label) => `<button class="xbtn" style="text-align:left;margin-left:-8px" data-action="planview" data-view="${to}">‹ ${label}</button>`;
  if (P.view === 'block') {
    h += back('main', 'Plan') + `<h1>${BLOCK.name}</h1><p class="sub">${fmtDate(BLOCK.start, { day: 'numeric', month: 'short' })} to ${fmtDate(addDays(BLOCK.start, 27), { day: 'numeric', month: 'short', year: 'numeric' })}</p><div class="card">`;
    for (let w = 1; w <= BLOCK.weeks; w++) {
      const sl = allSlots().filter(s => s.w === w && DAY_INFO[s.key].gym), dn = sl.filter(s => S.slotStatus[s.id] === 'done').length;
      h += `<button class="row" data-action="planview" data-view="week" data-week="${w}"><div class="grow"><div class="t">Week ${w}${w === 4 ? ' · deload' : ''}</div><div class="s">${WEEK_FOCUS[w - 1]}</div></div><span class="pill ${dn === 3 ? 'g' : ''}">${dn}/3</span>${chev}</button>`;
    }
    return h + '</div>';
  }
  if (P.view === 'week') {
    const w = P.week; h += back('block', BLOCK.name) + `<h1>Week ${w}${w === 4 ? ', deload' : ''}</h1><p class="sub">${WEEK_FOCUS[w - 1]}</p><div class="card">`;
    allSlots().filter(s => s.w === w).forEach(s => {
      const i = DAY_INFO[s.key], st = S.slotStatus[s.id], moved = S.slotDate[s.id];
      h += `<button class="row" data-action="daysheet" data-slot="${s.id}"><div style="width:44px"><div class="t">${fmtDate(s.date, { weekday: 'short' })}</div><div class="s">${fmtDate(s.date, { day: 'numeric', month: 'short' })}</div></div><div class="grow"><div class="t">${i.name}${moved ? ' <span class="pill o">moved</span>' : ''}</div><div class="s">${i.title}</div></div>${slotStatusPill(st)}${chev}</button>`;
    });
    return h + '</div>';
  }
  /* main */
  h += `<h1>Plan</h1><p class="sub">Programme, settings and your data.</p><div class="sec" style="margin-top:6px">Programme</div><div class="card"><button class="row" data-action="planview" data-view="block"><div class="grow"><div class="t">${BLOCK.name}</div><div class="s">4 weeks from ${fmtShort(BLOCK.start)}. Week 4 is a deload.</div></div>${chev}</button><div class="row"><div class="grow"><div class="t">Block start</div><div class="s">Pick the Monday week 1 begins</div></div><input type="date" data-in="blockstart" value="${BLOCK.start}" style="width:150px" aria-label="Block start date"></div></div>`;
  h += settingsHTML();
  return h;
};
actions.planview = el => { ui.plan.view = el.dataset.view; if (el.dataset.week) ui.plan.week = +el.dataset.week; render(false); $('#screen').scrollTop = 0; };
actions.daysheet = el => openDaySheet(el.dataset.slot);
function openDaySheet(id) {
  const s = allSlots().find(x => x.id === id); if (!s) return; const i = DAY_INFO[s.key], st = S.slotStatus[id];
  let b = `<p class="sub" style="margin-bottom:10px">${fmtDate(s.date)} · week ${s.w}</p>`;
  if (s.key === 'A' || s.key === 'B') {
    b += `<div class="card">` + prescList(s.key, s.w).map(p => `<div class="row" style="align-items:flex-start;padding:10px 16px"><div class="grow">${exLink(p.name, 't')}<div class="s">${prescText(p)} · rest ${p.rest}s${p.optional ? ' · optional this week' : ''}</div>${p.note ? `<div class="s">${esc(p.note)}</div>` : ''}${p.alt ? `<div class="s">Alt: ${esc(p.alt)}</div>` : ''}</div>${howBtn(p.name)}</div>`).join('') + '</div>';
    if (s.key === 'B' && s.w === 1) b += `<div class="rule">${DAY_B_CAP}</div>`;
  } else if (s.key === 'C') {
    b += `<div class="card pad"><div class="muted" style="margin-bottom:6px">Warm-up: ${DAY_C.warm}</div><b>${DAY_C.rounds[s.w - 1]} rounds</b>${DAY_C.steps(s.w).map(([a, c]) => `<div class="reason">${a}, ${c} ${howBtn(a)}</div>`).join('')}<div class="muted" style="margin-top:6px">Rest ${DAY_C.rest / 60} min between rounds.</div></div><div class="rule">${DAY_C.rule}</div>`;
  } else b += `<div class="card pad">${i.title}. Mobility checklist still applies.</div>`;
  b += `<div style="display:grid;gap:8px;margin-top:14px">`;
  if (i.gym) b += `<button class="btn pri" data-action="startsession" data-slot="${id}">${sessionOf(s) ? 'Open session' : 'Start session'}</button>`;
  b += `<div class="two"><button class="btn ${st === 'done' ? 'grn' : ''}" data-action="slotmark" data-slot="${id}" data-st="${st === 'done' ? '' : 'done'}">${st === 'done' ? 'Done ✓' : 'Mark done'}</button><button class="btn ${st === 'skipped' ? 'grn' : ''}" data-action="slotmark" data-slot="${id}" data-st="${st === 'skipped' ? '' : 'skipped'}">${st === 'skipped' ? 'Skipped ✓' : 'Skip'}</button></div>`;
  b += `<div class="lbl" style="margin-bottom:0">Move this session to another day</div><div style="display:flex;gap:8px"><input type="date" id="movedate" value="${s.date}" aria-label="New date"><button class="btn sm" data-action="slotmove" data-slot="${id}">Move</button></div>`;
  if (S.slotDate[id]) b += `<button class="btn ghost sm" data-action="slotmove" data-slot="${id}" data-reset="1" style="width:100%">Put back on ${fmtShort(slotDefault(s.w, s.d))}</button>`;
  openSheet(`${i.name}${i.gym ? ': ' + i.title : ''}`, b + '</div>');
}
actions.slotmove = el => {
  const id = el.dataset.slot, s = allSlots().find(x => x.id === id), nd = el.dataset.reset ? slotDefault(s.w, s.d) : $('#movedate').value;
  if (!/^\d{4}-\d\d-\d\d$/.test(nd)) return toast('Pick a date');
  if (nd === slotDefault(s.w, s.d)) delete S.slotDate[id]; else S.slotDate[id] = nd;
  const ss = S.sessions['s-' + id]; if (ss) ss.date = nd;
  saveState(); closeSheet(true); toast('Moved to ' + fmtShort(nd)); render();
};

/* ===== SETTINGS ===== */
function settingsHTML() {
  const t = S.settings.targets, th = S.settings.theme;
  let h = whoopSettingsHTML() + `<div class="sec">Appearance</div><div class="seg">${['system', 'light', 'dark'].map(x => `<button data-action="theme" data-v="${x}" aria-pressed="${th === x}">${x[0].toUpperCase() + x.slice(1)}</button>`).join('')}</div>`;
  h += `<div class="sec">Daily nutrition targets</div><div class="card pad"><div class="grid2">${[['kcal', 'Calories'], ['p', 'Protein (g)'], ['c', 'Carbs (g)'], ['f', 'Fat (g)']].map(([k, l]) => `<div><div class="lbl" style="margin-top:0">${l}</div><input inputmode="numeric" data-in="target" data-k="${k}" value="${t[k]}" aria-label="${l}"></div>`).join('')}</div></div>`;
  h += `<div class="sec"><span>Supplements</span><button data-action="suppedit" data-id="">Add</button></div><div class="card">${S.settings.supps.map(s => `<button class="row" data-action="suppedit" data-id="${s.id}"><div class="grow"><div class="t">${esc(s.name)}</div><div class="s">${esc(s.dose)} · ${esc(s.when)}${s.time ? ' · ' + s.time : ''}</div></div>${chev}</button>`).join('')}</div>`;
  h += premiumSettingsHTML();
  h += `<div class="sec">Data</div><div class="card"><button class="row" data-action="export"><div class="grow"><div class="t">Export everything</div><div class="s">JSON with progress photos included</div></div>${chev}</button><label class="row" style="cursor:pointer"><div class="grow"><div class="t">Import from a backup</div><div class="s">Merges with what is on this device</div></div>${chev}<input type="file" accept="application/json,.json" data-in="importfile" style="position:absolute;opacity:0;width:1px;height:1px"></label>`;
  if (localStorage.getItem(OLD_KEY)) h += `<button class="row" data-action="oldbackup"><div class="grow"><div class="t">Download old data backup</div><div class="s">From the previous tracker, left untouched</div></div>${chev}</button>`;
  h += `</div><div class="sec">About</div><div class="card"><div class="row"><div class="grow t">SPT</div><span class="muted tn">v${APP_VERSION}</span></div><div class="row"><div class="grow t">Cache version</div><span class="muted tn" id="cachever">…</span></div></div>`;
  return h;
}
inputs.blockstart = el => {
  if (!el.value) return; const m = monOf(el.value); S.settings.blockStart = m; S.slotDate = {};
  Object.values(S.sessions).forEach(s => { const sl = allSlots().find(x => x.id === s.slot); if (sl) s.date = sl.date; });
  saveState(); toast('Block starts Monday ' + fmtShort(m)); render();
};
actions.theme = el => { S.settings.theme = el.dataset.v; saveState(); applyTheme(); render(); };
inputs.target = el => debounced('tg' + el.dataset.k, () => { const v = num(el.value); if (v != null && v > 0) { S.settings.targets[el.dataset.k] = v; saveState(); } });
actions.suppedit = el => {
  const s = S.settings.supps.find(x => x.id === el.dataset.id) || { id: '', name: '', dose: '', when: '', time: '', rule: 'daily' };
  const f = (k, l, t = 'text') => `<div class="lbl">${l}</div><input data-k="${k}" type="${t}" value="${esc(s[k])}" aria-label="${l}">`;
  openSheet(s.id ? 'Edit supplement' : 'New supplement', `<div id="sf">${f('name', 'Name')}${f('dose', 'Dose')}${f('when', 'When')}${f('time', 'Reminder time', 'time')}<div class="lbl">Shows on</div><select data-k="rule" aria-label="Shows on">${[['daily', 'Every day'], ['asneeded', 'Every day, as needed'], ['B', 'Day B only'], ['Csauna', 'Day C and sauna days']].map(([v, l]) => `<option value="${v}" ${s.rule === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div><div style="display:grid;gap:8px;margin-top:16px"><button class="btn pri" data-action="suppsave" data-id="${s.id}">Save supplement</button>${s.id ? `<button class="btn danger" data-action="suppdel" data-id="${s.id}">Delete</button>` : ''}</div>`, { close: 'Cancel' });
};
actions.suppsave = el => {
  const v = {}; $$('#sf [data-k]').forEach(i => v[i.dataset.k] = i.value.trim()); if (!v.name) return toast('Add a name');
  if (el.dataset.id) Object.assign(S.settings.supps.find(x => x.id === el.dataset.id), v); else S.settings.supps.push(Object.assign({ id: uid() }, v));
  saveState(); closeSheet(true); render();
};
actions.suppdel = el => { S.settings.supps = S.settings.supps.filter(x => x.id !== el.dataset.id); saveState(); closeSheet(true); render(); };
screens.planAfter = () => { if (swReg || 'caches' in window) caches.keys().then(k => { const e = $('#cachever'); if (e) e.textContent = (k.find(x => x.startsWith('spt-')) || 'none (online)').replace('spt-', ''); }).catch(() => { }); };
