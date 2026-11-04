/* ===== TRAIN ===== */
function trainSlot() {
  if (ui.trainSlot) { const s = allSlots().find(x => x.id === ui.trainSlot); if (s) return s; }
  const c = ctxFor(isoDate()); return c.slot && DAY_INFO[c.key].gym ? c.slot : null;
}
function fieldsFor(t) {
  const ty = t.load.type;
  if (ty === 'time') return [{ k: 'r', l: 'sec', st: 5 }, { k: 'rpe', l: 'RPE', st: .5 }];
  if (ty === 'distance') return [{ k: 'r', l: 'metres', st: 50 }, { k: 'rpe', l: 'RPE', st: .5 }];
  return [{ k: 'w', l: ty === 'bw' ? '+kg' : 'kg', st: 2.5 }, { k: 'r', l: t.per === 'm' ? 'metres' : 'reps', st: t.per === 'm' ? 5 : 1 }, { k: 'rpe', l: 'RPE', st: .5 }];
}
function setVal(e, st) {
  const ty = e.tgt.load.type, per = e.tgt.per || '';
  if (ty === 'time') return `${fmtN(st.r)}<i> ${per}</i>` + (st.rpe ? ` <i>@${fmtN(st.rpe)}</i>` : '');
  if (ty === 'distance') return `${fmtN(st.r)}<i> m</i>` + (st.rpe ? ` <i>@${fmtN(st.rpe)}</i>` : '');
  return (st.w != null ? `${fmtN(st.w)}<i> kg</i>` : '<i>– kg</i>') + ` × ${fmtN(st.r)}<i>${per === 'm' ? ' m' : ' ' + per}</i>` + (st.rpe ? ` <i>@${fmtN(st.rpe)}</i>` : '');
}
function padHTML(e, ei, si) {
  const st = e.sets[si], a = ui.act, fl = fieldsFor(e.tgt), k = (v, c = '') => `<button class="${c}" data-action="padk" data-k="${v}">${v === 'bs' ? '⌫' : v === 'minus' ? '−' : v === 'plus' ? '+' : v === 'next' ? 'Next' : v}</button>`;
  return `<div class="padx"><div class="flds">${fl.map(f => `<button class="fld" data-action="padf" data-f="${f.k}" aria-pressed="${a.f === f.k}"><small>${f.l}</small><b>${fmtN(st[f.k])}</b></button>`).join('')}</div><div class="keys">${k(1)}${k(2)}${k(3)}${k('minus', 'f')}${k(4)}${k(5)}${k(6)}${k('plus', 'f')}${k(7)}${k(8)}${k(9)}${k('next', 'f')}${k('.')}${k(0)}${k('bs', 'f')}<button class="f" style="background:var(--o);color:var(--onO);font-weight:800;font-size:15px" data-action="padok">Log</button></div>${!st.done && e.sets.length > 1 ? `<div class="acts"><button class="btn sm ghost" data-action="setdel" style="flex:1">Remove set</button></div>` : ''}</div>`;
}
function setHTML(s, ei, si) {
  const e = s.ex[ei], st = e.sets[si], act = ui.act && ui.act.ei === ei && ui.act.si === si;
  return `<div class="set ${st.done ? 'done' : ''} ${act ? 'act' : ''}" data-ex="${ei}" data-set="${si}"><button class="set-r" data-action="setrow" data-ex="${ei}" data-set="${si}" aria-label="Set ${si + 1}${st.done ? ', logged' : ''}"><span class="n">${si + 1}</span><span class="v ${st.done ? '' : 'pend'}">${setVal(e, st)}${ghostHTML(e, ei, si)}</span>${checkIco}</button>${act ? padHTML(e, ei, si) : ''}</div>`;
}
function exHeadHTML(s, ei) {
  const e = s.ex[ei], t = e.tgt, done = e.sets.filter(x => x.done).length, sg = suggestLoadFor(e);
  return `<div class="ex-h"><div style="flex:1;min-width:0"><button class="nm" data-action="exhist" data-ex="${esc(e.name)}">${esc(e.name)}</button>${e.name !== e.orig ? `<span class="pill o" style="margin-left:6px">swapped</span>` : ''}<div class="pr">${prescText(t)} · rest ${t.rest}s ${howBtn(e.name)}</div>${sg.why ? `<div class="sg">${esc(sg.why)}</div>` : ''}${t.note ? `<div class="pr">${esc(t.note)}</div>` : ''}${t.alt ? `<div class="pr">Alt: ${esc(t.alt)}</div>` : ''}</div><span class="pill ${done === e.sets.length ? 'g' : ''} tn">${done}/${e.sets.length}</span><button class="ib" data-action="exnote" data-ex="${ei}" aria-label="Notes">${ico('note')}</button><button class="ib" data-action="swap" data-ex="${ei}" aria-label="Swap exercise">${ico('swap')}</button></div>`;
}
const recDate = s => s && s.status === 'done' ? s.date : isoDate();
const suggestLoadFor = e => suggestLoad(e.name, e.tgt, recDate(curSess));
function exHTML(s, ei) {
  const e = s.ex[ei];
  if (e.skipped) return `<div class="card ex opt" data-exc="${ei}"><div class="row"><div class="grow"><div class="t">${esc(e.name)}</div><div class="s">Optional this week. Skipped.</div></div><button class="btn sm" data-action="exunskip" data-ex="${ei}">Do it</button></div></div>`;
  return `<div class="card ex" data-exc="${ei}"><div data-exh="${ei}">${exHeadHTML(s, ei)}</div>${e.sets.map((_, si) => setHTML(s, ei, si)).join('')}<button class="addset" data-action="setadd" data-ex="${ei}">+ Add set</button>${(e.note || ui.noteOpen === ei) ? `<div style="padding:0 14px 14px"><textarea data-in="exnote" data-ex="${ei}" placeholder="Notes for this exercise" aria-label="Exercise notes">${esc(e.note)}</textarea></div>` : ''}</div>`;
}
let curSess = null;
screens.train = () => {
  const slot = trainSlot();
  if (!slot) {
    const up = allSlots().filter(s => DAY_INFO[s.key].gym && s.date >= isoDate() && !S.slotStatus[s.id]).slice(0, 3);
    curSess = null; ui.trainSess = () => null;
    return `<h1>Train</h1><p class="sub">No session planned today.</p><div class="card">${up.length ? up.map(s => `<button class="row" data-action="startsession" data-slot="${s.id}"><div class="grow"><div class="t">${DAY_INFO[s.key].name}: ${DAY_INFO[s.key].title}</div><div class="s">${fmtDate(s.date, { weekday: 'long', day: 'numeric', month: 'short' })}</div></div>${chev}</button>`).join('') : '<div class="empty">Nothing left in this block.</div>'}</div><p class="muted" style="font-size:14px;margin-top:12px">Tap a session to train it early.</p>`;
  }
  const i = DAY_INFO[slot.key], s = sessionOf(slot);
  curSess = s; ui.trainSess = () => curSess;
  let h = `<h1>${i.name}</h1><p class="sub">${i.title} · week ${slot.w} · ${fmtDate(slot.date, { weekday: 'short', day: 'numeric', month: 'short' })}${s ? recChip(recDate(s)) : recChip(isoDate())}</p>`;
  if (!s) return h + `<div class="card pad"><p style="margin:0 0 12px">${slot.key === 'C' ? DAY_C.rounds[slot.w - 1] + ' rounds. Log each round time.' : DAYS[slot.key].length + ' exercises. Your sets save as you go.'}</p><button class="btn pri" data-action="startsession" data-slot="${slot.id}">Start session</button></div><button class="btn ghost" style="margin-top:10px" data-action="pickslot">Choose another session</button>`;
  const st = sessionStats(s);
  h += `<div class="sess-bar">${s.key === 'C' ? `<div class="kv"><b id="st-sets">${st.rounds}/${s.rounds.length}</b><span>rounds</span></div>` : `<div class="kv"><b id="st-sets">${st.sets}</b><span>sets</span></div><div class="kv"><b id="st-ton">${st.ton.toLocaleString('en-IE')}</b><span>kg lifted</span></div>`}<div class="kv"><b id="sesstime">${fmtDur(st.dur)}</b><span>time</span></div><div style="flex:1"></div>${s.status === 'done' ? '<span class="pill g">Complete</span>' : '<span class="pill">Draft</span>'}</div>`;
  if (s.key === 'C') h += roundsHTML(s, slot);
  else {
    if (s.key === 'B' && slot.w === 1) h += `<div class="rule">${DAY_B_CAP}</div>`;
    h += s.ex.map((_, ei) => exHTML(s, ei)).join('');
  }
  h += `<div class="lbl">Session notes</div><textarea data-in="sessnote" placeholder="How did it feel? Anything to change next time?" aria-label="Session notes">${esc(s.note)}</textarea>`;
  h += s.status === 'done' ? `<button class="btn" style="margin-top:14px" data-action="reopen">Reopen session</button>` : `<button class="btn pri" style="margin-top:14px" data-action="finish">Finish session</button>`;
  h += `<button class="btn ghost" style="margin-top:10px" data-action="pickslot">Choose another session</button><div style="height:80px"></div>`;
  return h;
};
screens.trainAfter = () => { };
function saveSess() { if (curSess) curSess.u = Date.now(); saveState(); }
function refreshSet(ei, si) { const el = $(`.set[data-ex="${ei}"][data-set="${si}"]`); if (el && curSess) el.outerHTML = setHTML(curSess, ei, si); }
function refreshHead(ei) { const el = $(`[data-exh="${ei}"]`); if (el && curSess) el.innerHTML = exHeadHTML(curSess, ei); }
function refreshStats() {
  if (!curSess) return; const st = sessionStats(curSess), a = $('#st-sets'), b = $('#st-ton');
  if (a) a.textContent = curSess.key === 'C' ? `${st.rounds}/${curSess.rounds.length}` : st.sets; if (b) b.textContent = st.ton.toLocaleString('en-IE');
}
function deact() { const o = ui.act; ui.act = null; if (o) refreshSet(o.ei, o.si); }
function activate(ei, si) {
  const e = curSess.ex[ei], st = e.sets[si];
  if (ui.act && ui.act.ei === ei && ui.act.si === si) return confirmSet();
  const prev = ui.act; ui.act = { ei, si, f: fieldsFor(e.tgt)[0].k, fresh: true, buf: null };
  if (!st.done && si > 0 && e.sets[si - 1].done) { const p = e.sets[si - 1]; st.w = p.w; st.r = p.r; st.rpe = p.rpe; }
  if (prev) refreshSet(prev.ei, prev.si); refreshSet(ei, si); vib(6);
}
function confirmSet() {
  const a = ui.act; if (!a) return; const e = curSess.ex[a.ei], st = e.sets[a.si];
  if (st.r == null) st.r = e.tgt.reps;
  const wasDone = st.done; st.done = true; ui.act = null; saveSess(); haptic('tick');
  refreshSet(a.ei, a.si); refreshHead(a.ei); refreshStats();
  if (!wasDone || true) startRest(e.tgt.rest || 90);
}
actions.setrow = el => activate(+el.dataset.ex, +el.dataset.set);
actions.padok = () => confirmSet();
actions.padf = el => { ui.act.f = el.dataset.f; ui.act.fresh = true; ui.act.buf = null; refreshSet(ui.act.ei, ui.act.si); };
actions.padk = el => {
  const a = ui.act; if (!a) return; const e = curSess.ex[a.ei], st = e.sets[a.si], fl = fieldsFor(e.tgt), k = el.dataset.k, f = a.f;
  const def = fl.find(x => x.k === f);
  if (k === 'next') { const i = fl.findIndex(x => x.k === f); a.f = fl[(i + 1) % fl.length].k; a.fresh = true; a.buf = null; }
  else if (k === 'minus' || k === 'plus') { const v = (st[f] || 0) + (k === 'plus' ? 1 : -1) * def.st; st[f] = Math.max(0, f === 'rpe' ? Math.min(10, r05(v)) : Math.round(v * 100) / 100); a.fresh = true; a.buf = null; }
  else if (k === 'bs') { let b = (a.buf ?? String(st[f] ?? '')).slice(0, -1); a.buf = b; a.fresh = false; st[f] = b ? num(b) : null; }
  else { let b = a.fresh ? '' : (a.buf ?? String(st[f] ?? '')); if (k === '.' && b.includes('.')) return; if (b.length >= 6) return; b += k; a.buf = b; a.fresh = false; st[f] = num(b === '.' ? '0.' : b); }
  vib(4); saveSess(); refreshSet(a.ei, a.si);
};
actions.setadd = el => {
  const ei = +el.dataset.ex, e = curSess.ex[ei], l = e.sets[e.sets.length - 1] || {}; e.sets.push({ w: l.w ?? null, r: l.r ?? e.tgt.reps, rpe: l.rpe ?? e.tgt.rpeTarget, done: false });
  saveSess(); render(); vib(6);
};
actions.setdel = () => { const a = ui.act; if (!a) return; curSess.ex[a.ei].sets.splice(a.si, 1); ui.act = null; saveSess(); render(); };
actions.exunskip = el => { curSess.ex[+el.dataset.ex].skipped = false; saveSess(); render(); };
actions.exnote = el => { const ei = +el.dataset.ex; ui.noteOpen = ui.noteOpen === ei ? null : ei; render(); const t = $(`textarea[data-ex="${ei}"]`); if (t && ui.noteOpen === ei) t.focus(); };
inputs.exnote = el => { const e = curSess.ex[+el.dataset.ex]; e.note = el.value; debounced('exn', saveSess); };
inputs.sessnote = el => { curSess.note = el.value; debounced('sn', saveSess); };
actions.pickslot = () => {
  const list = allSlots().filter(s => DAY_INFO[s.key].gym);
  openSheet('Choose a session', `<div class="card">${list.map(s => `<button class="row" data-action="startsession" data-slot="${s.id}"><div class="grow"><div class="t">${DAY_INFO[s.key].name} · week ${s.w}</div><div class="s">${fmtDate(s.date, { weekday: 'short', day: 'numeric', month: 'short' })} · ${DAY_INFO[s.key].title}</div></div>${slotStatusPill(S.slotStatus[s.id])}</button>`).join('')}</div>`);
};
/* swap */
actions.swap = el => {
  const ei = +el.dataset.ex, e = curSess.ex[ei], g = e.tgt.swapGroup, groups = [g, ...Object.keys(LIB).filter(x => x !== g)];
  let b = e.name !== e.orig ? `<button class="btn ghost" style="margin-bottom:10px" data-action="doswap" data-ex="${ei}" data-name="${esc(e.orig)}">Back to ${esc(e.orig)}</button>` : '';
  b += groups.map(gr => `<div class="sec" style="margin-top:${gr === g ? 0 : 16}px">${gr === g ? 'Same movement pattern' : gr[0].toUpperCase() + gr.slice(1)}</div><div class="card">${LIB[gr].filter(n => n !== e.name).map(n => `<button class="row" data-action="doswap" data-ex="${ei}" data-name="${esc(n)}"><div class="grow t">${esc(n)}</div></button>`).join('')}</div>`).join('');
  openSheet('Swap ' + e.name, `<p class="muted" style="margin-top:0">Stays swapped for the rest of ${BLOCK.name}.</p>` + b, { close: 'Cancel' });
};
actions.doswap = el => {
  const s = curSess, ei = +el.dataset.ex, e = s.ex[ei], nm = el.dataset.name;
  const sw = S.swaps[BLOCK.id] = S.swaps[BLOCK.id] || {}; if (nm === e.orig) delete sw[e.orig]; else sw[e.orig] = nm;
  const t = adaptPresc(basePrescFor(s, e), nm), done = e.sets.filter(x => x.done);
  if (done.length) {
    /* sets already logged belong to the exercise they were done on: keep them, put the swap in below with what's left */
    e.sets = done;
    s.ex.splice(ei + 1, 0, { name: nm, orig: e.orig, bi: e.bi, tgt: t, sets: freshSets(t, Math.max(1, t.sets - done.length), recDate(s)), note: '', skipped: false });
  } else {
    e.name = nm; e.tgt = t; e.sets = freshSets(t, t.sets, recDate(s));
  }
  ui.act = null; saveSess(); closeSheet(true); render(); toast(nm === e.orig ? 'Back to ' + nm : 'Swapped to ' + nm + ' · ' + prescText(t));
};
/* finish */
actions.finish = () => {
  const st = sessionStats(curSess), s = curSess;
  let b = `<div class="grid2" style="margin-bottom:12px"><div class="card pad kv"><b>${s.key === 'C' ? st.rounds : st.sets}</b><span>${s.key === 'C' ? 'rounds logged' : 'sets done'}</span></div><div class="card pad kv"><b>${fmtDur(st.dur)}</b><span>duration</span></div>${s.key === 'C' ? '' : `<div class="card pad kv"><b>${st.ton.toLocaleString('en-IE')}</b><span>kg tonnage</span></div><div class="card pad kv"><b>${s.ex.filter(e => e.sets.some(x => x.done)).length}/${s.ex.filter(e => !e.skipped).length}</b><span>exercises touched</span></div>`}</div>`;
  if (s.key === 'C') b += roundCheck(s) ? `<div class="rule">${roundCheck(s)}</div>` : '';
  b += `<button class="btn pri" data-action="finishok">Save and finish</button>`;
  openSheet('Finish session', b, { close: 'Back' });
};
actions.finishok = () => {
  const s = curSess; s.status = 'done'; s.end = Date.now(); S.slotStatus[s.slot] = 'done'; saveSess(); closeSheet(true); actions.restoff(); haptic('success'); toast('Session saved'); render(false);
};
actions.reopen = () => { curSess.status = 'draft'; curSess.end = null; delete S.slotStatus[curSess.slot]; saveSess(); render(); };

/* ===== Day C rounds ===== */
const fmtMS = s => s == null ? '' : Math.floor(s / 60) + ':' + pad2(Math.round(s % 60));
function parseMS(t) { t = String(t).trim(); if (!t) return null; const m = t.match(/^(\d+):(\d{1,2})$/); if (m) return +m[1] * 60 + +m[2]; const n = num(t); return n == null ? undefined : n * 60; }
function roundCheck(s) {
  const r = s.rounds; if (r[0] && r[2]) { const p = (r[2] / r[0] - 1) * 100; return p > 15 ? `Round 3 was ${Math.round(p)}% slower than round 1. Hold next week's loads.` : `Round 3 was ${p <= 0 ? 'no slower' : Math.round(p) + '% slower'} than round 1. Loads can progress.`; }
  return '';
}
function roundsHTML(s, slot) {
  const i = s.rounds.findIndex(x => !x), sw = ui.sw || { running: false, acc: 0 };
  let h = `<div class="rule">${DAY_C.rule}</div><div class="card pad"><div class="muted" style="margin-bottom:8px">Warm-up: ${DAY_C.warm}</div>${DAY_C.steps(slot.w).map(([a, b]) => `<div class="row" style="padding:6px 0;min-height:36px"><div class="grow t">${a} ${howBtn(a)}</div><span class="muted tn">${b}</span></div>`).join('')}<div class="muted" style="margin-top:6px;font-size:14px">Rest ${DAY_C.rest / 60} min after each round.</div></div>`;
  h += `<div class="card" style="margin-top:12px"><div class="sw" id="swtime">${fmtDur(swElapsed() / 1000)}</div><div style="padding:6px 14px 14px;display:flex;gap:8px"><button class="btn ${sw.running ? 'pri' : 'grn'}" data-action="swtoggle">${sw.running ? `Lap: finish round ${i < 0 ? s.rounds.length + 1 : i + 1}` : `Start round ${i < 0 ? s.rounds.length + 1 : i + 1}`}</button>${sw.running || sw.acc ? `<button class="btn sm ghost" style="width:auto" data-action="swreset">Reset</button>` : ''}</div>`;
  h += s.rounds.map((t, n) => `<div class="rd"><b class="tn">${n + 1}</b><input data-in="rdtime" data-i="${n}" inputmode="numeric" placeholder="m:ss" value="${fmtMS(t)}" aria-label="Round ${n + 1} time"><span class="muted tn" style="flex:1;text-align:right">${n > 0 && t && s.rounds[0] ? ((t / s.rounds[0] - 1) * 100 >= 0 ? '+' : '') + Math.round((t / s.rounds[0] - 1) * 100) + '% vs R1' : ''}</span></div>`).join('');
  h += `<button class="addset" data-action="rdadd">+ Add round</button></div>`;
  const rc = roundCheck(s); if (rc) h += `<div class="rule">${rc}</div>`;
  return h;
}
actions.swtoggle = () => {
  const s = curSess; ui.sw = ui.sw || { running: false, acc: 0, t0: 0 };
  if (!ui.sw.running) { ui.sw.running = true; ui.sw.t0 = Date.now(); vib(10); render(); return; }
  const t = swElapsed() / 1000; ui.sw = { running: false, acc: 0, t0: 0 };
  let i = s.rounds.findIndex(x => !x); if (i < 0) { s.rounds.push(null); i = s.rounds.length - 1; }
  s.rounds[i] = Math.round(t); saveSess(); vib([20, 40, 20]); if (i < s.rounds.length - 1 || true) startRest(DAY_C.rest); render();
};
actions.swreset = () => { ui.sw = null; render(); };
actions.rdadd = () => { curSess.rounds.push(null); saveSess(); render(); };
inputs.rdtime = (el, ev) => {
  if (ev.type !== 'change') return; const v = parseMS(el.value);
  if (v === undefined) return toast('Use m:ss, for example 6:30'); curSess.rounds[+el.dataset.i] = v == null ? null : Math.round(v); saveSess(); render();
};
