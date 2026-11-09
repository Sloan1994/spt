'use strict';
/* ===== SPT v2 — core ===== */
const APP_VERSION = '2.4.0', STATE_KEY = 'spt-v2', OLD_KEY = 'training-app-v1';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad2 = n => String(n).padStart(2, '0');
function isoDate(d = new Date()) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function parseISO(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function addDays(s, n) { const d = parseISO(s); d.setDate(d.getDate() + n); return isoDate(d); }
function diffDays(a, b) { const x = parseISO(a), y = parseISO(b); return Math.round((Date.UTC(x.getFullYear(), x.getMonth(), x.getDate()) - Date.UTC(y.getFullYear(), y.getMonth(), y.getDate())) / 864e5); }
function monOf(s) { const d = parseISO(s); return addDays(s, -((d.getDay() + 6) % 7)); }
const fmtDate = (s, o = { weekday: 'long', day: 'numeric', month: 'long' }) => parseISO(s).toLocaleDateString('en-IE', o);
const fmtShort = s => parseISO(s).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' });
const r1 = n => Math.round(n * 10) / 10, r05 = n => Math.round(n * 2) / 2;
const fmtN = n => (n == null || n === '' || isNaN(n)) ? '–' : String(r1(+n));
const fmtDur = s => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return h ? `${h}:${pad2(m)}:${pad2(x)}` : `${m}:${pad2(x)}`; };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const num = v => { const n = parseFloat(v); return isNaN(n) ? null : n; };
function vib(p = 12) { try { navigator.vibrate && navigator.vibrate(p); } catch (e) { } }
let actx; function beep(f = 880, ms = 140) { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); const o = actx.createOscillator(), g = actx.createGain(); o.frequency.value = f; g.gain.value = .12; o.connect(g); g.connect(actx.destination); o.start(); o.stop(actx.currentTime + ms / 1000); } catch (e) { } }
const timers = {};
function debounced(key, fn, ms = 300) { clearTimeout(timers[key]); timers[key] = setTimeout(fn, ms); }

/* icons */
const IC = {
  today: '<circle cx="12" cy="12" r="8.5"/><path d="M8 12.5l3 3 5-6"/>',
  train: '<path d="M3 9.5v5M6 7v10M18 7v10M21 9.5v5M6 12h12"/>',
  log: '<path d="M6 3.5h12v17H6z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  progress: '<path d="M4 19V5M4 19h16"/><path d="M7.5 15l3.5-4.5 3 2.5 4.5-6"/>',
  plan: '<rect x="4" y="5.5" width="16" height="14.5" rx="3"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
  swap: '<path d="M7 7h11l-3-3M17 17H6l3 3"/>',
  note: '<path d="M5 19l1-4L16.5 4.5a2 2 0 013 3L9 18z"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  cam: '<path d="M4 8h3l1.5-2.5h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  bolt: '<path d="M13 3L5 13.5h6L10 21l9-11h-6z"/>',
  scan: '<path d="M4 8V5h3M17 4h3v3M20 16v3h-3M7 20H4v-3M4 12h16"/>',
  hist: '<path d="M4 12a8 8 0 108-8 8 8 0 00-6 2.7M4 4v3.5h3.5M12 8v4.5l3 2"/>'
};
const ico = (n, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${IC[n] || ''}</svg>`;
const chev = '<svg class="chev" viewBox="0 0 8 14"><path d="M1 1l6 6-6 6"/></svg>';
const checkIco = '<span class="check"><svg viewBox="0 0 16 16"><path d="M3 8.5l3.5 3.5L13 4.5"/></svg></span>';

/* ===== state ===== */
function defaultState() {
  return {
    version: 2,
    settings: {
      theme: 'dark', blockStart: '2026-11-02', whoop: { url: '', key: '', connected: false, since: '', last: 0, seeded: false }, targets: { kcal: 2600, p: 190, c: 300, f: 80 },
      supps: [
        { id: 'creatine', name: 'Creatine', dose: '5 g', when: 'Any time, daily', time: '08:00', rule: 'daily' },
        { id: 'd3', name: 'Vitamin D3', dose: '2000–4000 IU', when: 'With a meal', time: '12:30', rule: 'daily' },
        { id: 'omega', name: 'Omega-3 (EPA+DHA)', dose: '2–3 g', when: 'With a meal', time: '12:30', rule: 'daily' },
        { id: 'mag', name: 'Magnesium glycinate', dose: '300–400 mg', when: '60 min before bed', time: '21:30', rule: 'daily' },
        { id: 'whey', name: 'Whey', dose: '1 scoop', when: 'As needed', time: '', rule: 'asneeded' },
        { id: 'collagen', name: 'Collagen + vitamin C', dose: '15 g', when: '45–60 min before Day B', time: '', rule: 'B' },
        { id: 'lytes', name: 'Electrolytes', dose: '1 serving', when: 'Day C and sauna days', time: '', rule: 'Csauna' }
      ]
    },
    slotStatus: {}, slotDate: {}, swaps: {}, sessions: {}, checkins: {}, suppLog: {}, mobLog: {}, food: {}, foodCache: {}, photos: [], flags: {}, whoop: {}, u: 0
  };
}
let S = loadState();
function loadState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw) { const o = JSON.parse(raw); if (o && o.version === 2) { const d = defaultState(); const m = Object.assign(d, o); m.settings = Object.assign(d.settings, o.settings || {}); m.settings.targets = Object.assign(d.settings.targets, (o.settings || {}).targets || {}); m.settings.whoop = Object.assign(d.settings.whoop, (o.settings || {}).whoop || {}); if (!m.whoop || typeof m.whoop !== 'object') m.whoop = {}; return m; } }
  } catch (e) { console.warn('state load failed', e); }
  return defaultState();
}
function saveState() {
  try { S.u = Date.now(); localStorage.setItem(STATE_KEY, JSON.stringify(S)); return true; }
  catch (e) { toast(e && (e.name === 'QuotaExceededError' || e.code === 22) ? 'Storage full. Export your data, then free some space.' : 'Could not save. Changes may be lost.', { ms: 6000 }); return false; }
}

/* ===== theme ===== */
function applyTheme() {
  const t = S.settings.theme, h = document.documentElement;
  if (t === 'light' || t === 'dark') h.setAttribute('data-theme', t); else h.removeAttribute('data-theme');
  const dark = t === 'dark' || (t !== 'light' && !matchMedia('(prefers-color-scheme: light)').matches);
  const m = $('meta[name=theme-color]'); if (m) m.setAttribute('content', dark ? '#07100D' : '#EFF3F0');
}
matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', applyTheme);

/* ===== UI state, router ===== */
const ui = { tab: 'today', logDate: isoDate(), trainSlot: null, act: null, rest: null, sw: null, plan: { view: 'main', week: null }, lift: 'Trap bar deadlift', cmp: [null, null], sheet: null };
const TABS = [['today', 'Today'], ['train', 'Train'], ['log', 'Log'], ['progress', 'Progress'], ['plan', 'Plan']];
const screens = {};  // filled in later modules
function renderNav() {
  $('#nav').innerHTML = TABS.map(([k, l]) => `<button data-action="tab" data-tab="${k}" ${ui.tab === k ? 'aria-current="page"' : ''} aria-label="${l}">${ico(k)}<span>${l}</span></button>`).join('');
}
function render(keepScroll = true) {
  const el = $('#screen'), top = keepScroll ? el.scrollTop : 0;
  el.innerHTML = screens[ui.tab]();
  el.scrollTop = top;
  if (screens[ui.tab + 'After']) screens[ui.tab + 'After']();
  updateTick();
}
function go(tab) { if (ui.tab !== tab) { ui.tab = tab; renderNav(); render(false); } else render(false); }

/* ===== toast ===== */
function toast(msg, o = {}) {
  const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status');
  t.innerHTML = `<span style="flex:1">${esc(msg)}</span>` + (o.action ? `<button data-action="${o.action}">${esc(o.label || 'OK')}</button>` : '');
  $('#toasts').appendChild(t);
  if (o.ms !== 0) setTimeout(() => t.remove(), o.ms || 2600);
  return t;
}

/* ===== bottom sheet ===== */
function openSheet(title, body, o = {}) {
  closeSheet(true);
  const root = $('#sheets');
  root.innerHTML = `<div class="scrim" data-action="sheetclose"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="grab"><i></i></div><div class="sh-t"><h2>${esc(title)}</h2><button class="xbtn" data-action="sheetclose">${o.close || 'Done'}</button></div><div class="sh-b">${body}</div></div>`;
  root.style.pointerEvents = 'auto';
  document.body.classList.add('lock');
  requestAnimationFrame(() => requestAnimationFrame(() => { $('.scrim', root)?.classList.add('in'); $('.sheet', root)?.classList.add('in'); }));
  ui.sheet = { title, onClose: o.onClose };
  return $('.sh-b', root);
}
function sheetBody() { return $('#sheets .sh-b'); }
function setSheetBody(html) { const b = sheetBody(); if (b) b.innerHTML = html; }
function closeSheet(instant) {
  const root = $('#sheets'); if (!root.firstChild) return;
  const cb = ui.sheet && ui.sheet.onClose; ui.sheet = null;
  const done = () => { root.innerHTML = ''; root.style.pointerEvents = 'none'; document.body.classList.remove('lock'); };
  if (instant) done(); else { $('.sheet', root)?.classList.remove('in'); $('.scrim', root)?.classList.remove('in'); setTimeout(done, 280); }
  if (cb) cb();
}
let drag = null;
function dragStart(e) {
  const g = e.target.closest('.grab,.sh-t'); if (!g || e.target.closest('button')) return;
  const sh = g.closest('.sheet'); drag = { sh, y0: e.clientY, dy: 0, id: e.pointerId, t: performance.now() }; sh.classList.add('drag');
  try { g.setPointerCapture(e.pointerId); } catch (_) { }
}
function dragMove(e) { if (!drag || e.pointerId !== drag.id) return; drag.dy = Math.max(0, e.clientY - drag.y0); drag.sh.style.transform = `translateY(${drag.dy}px)`; }
function dragEnd(e) {
  if (!drag) return; const { sh, dy, t } = drag; drag = null; sh.classList.remove('drag');
  const v = dy / Math.max(1, performance.now() - t);
  if (dy > sh.offsetHeight * .3 || v > .6) { sh.style.transform = ''; closeSheet(); } else sh.style.transform = '';
}

/* ===== delegated events ===== */
const actions = {};   // name -> fn(el, event)
const inputs = {};    // name -> fn(el, event) for input/change
function bindEvents() {
  const app = $('#app');
  app.addEventListener('click', e => {
    const el = e.target.closest('[data-action]'); if (!el) return;
    const fn = actions[el.dataset.action]; if (fn) fn(el, e);
  });
  const inp = e => { const el = e.target.closest('[data-in]'); if (el && inputs[el.dataset.in]) inputs[el.dataset.in](el, e); };
  app.addEventListener('input', inp); app.addEventListener('change', inp);
  app.addEventListener('pointerdown', dragStart); app.addEventListener('pointermove', dragMove);
  app.addEventListener('pointerup', dragEnd); app.addEventListener('pointercancel', dragEnd);
}
actions.tab = el => { vib(5); go(el.dataset.tab); $('#screen').scrollTop = 0; };
actions.sheetclose = () => closeSheet();

/* ===== service worker ===== */
let swReg;
function registerSW() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  navigator.serviceWorker.register('sw.js').then(reg => {
    if (!reg) return;
    swReg = reg;
    const check = () => { if (reg.waiting && navigator.serviceWorker.controller) toast('Update available', { action: 'reload', label: 'Reload', ms: 0 }); };
    check();
    reg.addEventListener('updatefound', () => { const n = reg.installing; n && n.addEventListener('statechange', () => { if (n.state === 'installed') check(); }); });
  }).catch(e => console.warn('SW register failed', e));
  let reloading = false; const hadCtrl = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloading || !hadCtrl) return; reloading = true; location.reload(); });
}
actions.reload = () => { if (swReg && swReg.waiting) swReg.waiting.postMessage('SKIP_WAITING'); else location.reload(); };

/* ===== ticker (timers update in place) ===== */
function updateTick() {
  const now = Date.now();
  if (ui.rest) {
    const R = ui.rest, left = Math.ceil((R.end - now) / 1000), over = Math.floor((now - R.end) / 1000), rb = $('#restbar');
    /* 3-2-1 pips, then the finish alert; if it's missed, remind at +15 s and +30 s */
    if (left > 0 && left <= 3 && !R.pips[left] && !document.hidden) { R.pips[left] = 1; if (typeof restPip === 'function') restPip(left); }
    if (left <= 0 && !R.fired) { R.fired = true; restDone(); }
    if (R.fired && over >= 15 * (R.rep + 1) && R.rep < 2 && !document.hidden) { R.rep++; if (typeof restRemind === 'function') restRemind(); }
    if (rb) {
      if (!rb.classList.contains('show') || rb.dataset.k !== String(R.id)) { rb.dataset.k = R.id; rb.classList.add('show'); rb.innerHTML = `<div class="restin"><button class="tm" data-action="restadd" aria-label="Add 30 seconds"><small id="rlbl">Rest · tap for +30s</small><span id="rt"></span></button><button class="btn sm ghost" data-action="restadd">+30s</button><button class="ib" data-action="restoff" aria-label="Dismiss rest timer">${ico('x')}</button><div class="bar"><i id="rbar"></i></div></div>`; }
      const t = $('#rt'), bar = $('#rbar'), box = $('.restin', rb), lb = $('#rlbl');
      if (t) t.textContent = left > 0 ? fmtDur(left) : '+' + fmtDur(Math.max(0, over));
      if (lb) lb.textContent = left > 0 ? 'Rest · tap for +30s' : 'Rest over · next set';
      if (bar) bar.style.width = Math.max(0, Math.min(100, left / R.total * 100)) + '%';
      if (box) { box.classList.toggle('done', left <= 0); box.classList.toggle('last', left > 0 && left <= 3); }
    }
    if (over > 180) actions.restoff();
  }
  const el = $('#sesstime'); if (el && ui.trainSess) { const s = ui.trainSess(); if (s && s.start) el.textContent = fmtDur(((s.end || now) - s.start) / 1000); }
  const sw = $('#swtime'); if (sw && ui.sw) sw.textContent = fmtDur(swElapsed() / 1000).replace(/^(\d+:\d\d)$/, '$1');
}
setInterval(updateTick, 250);
function startRest(sec) { document.body.classList.add('resting'); ui.rest = { id: uid(), end: Date.now() + sec * 1000, total: sec, fired: false, pips: {}, rep: 0 }; if (typeof restWake === 'function') restWake(true); updateTick(); }
actions.restadd = () => { const R = ui.rest; if (!R) return; if (R.fired) { R.end = Date.now() + 30000; R.total = 30; } else { R.end += 30000; R.total += 30; } R.fired = false; R.pips = {}; R.rep = 0; vib(8); if (typeof restWake === 'function') restWake(true); updateTick(); };
actions.restoff = () => { ui.rest = null; if (typeof restWake === 'function') restWake(false); document.body.classList.remove('resting'); const rb = $('#restbar'); rb.classList.remove('show'); rb.innerHTML = ''; delete rb.dataset.k; };
function swElapsed() { return ui.sw ? (ui.sw.running ? ui.sw.acc + Date.now() - ui.sw.t0 : ui.sw.acc) : 0; }
