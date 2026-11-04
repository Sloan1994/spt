/* ===== programme seed data ===== */
/* Spec said "Mon 3 Nov 2026" but 3 Nov 2026 is a Tuesday. Default to Monday 2 Nov; changeable in Plan. */
const BLOCK = { id: 'b1', name: 'Block 1 Rebuild', get start() { return S.settings.blockStart || '2026-11-02'; }, weeks: 4 };
const WEEK_FOCUS = ['Settle in. Nothing above RPE 7.', 'Add load. Nothing above RPE 7.', 'Peak week. RPE 8 on the main lift only.', 'Deload. Half the sets, easy effort.'];
const DAY_BY_WD = ['A', 'Z', 'B', 'R', 'C', 'Z', 'M'];
const DAY_INFO = {
  A: { name: 'Day A', title: 'Lower + core', gym: true },
  B: { name: 'Day B', title: 'Upper + grip + erg', gym: true },
  C: { name: 'Day C', title: 'Hyrox conditioning + power', gym: true },
  Z: { name: 'Zone 2', title: 'Zone 2, 30–40 min, or bowling', gym: false },
  R: { name: 'Rest', title: 'Rest or bowling', gym: false },
  M: { name: 'Rest + mobility', title: 'Rest and mobility', gym: false }
};
const GLOBAL_RULES = ['Nothing above RPE 7 in weeks 1–2.', 'RPE 8 allowed on the main lift only, in week 3.', 'Rest 2–3 min on main lifts, 60–90 s on accessories.'];
const MOBILITY = [
  { id: 'hip', t: '90/90 hip switches', d: '10 per side' },
  { id: 'couch', t: 'Couch stretch', d: '60 s per side' },
  { id: 'tspine', t: 'T-spine open-book', d: '8 per side' },
  { id: 'wrist', t: 'Wrist flexor + extensor stretch, forearm roll', d: '45 s each, roll 60 s' }
];
const RECOVERY = {
  5: 'After Day C: sauna 15 min, ice 3 min, twice. Finish cold.',
  6: 'Evening: sauna 20 min, cold 2–3 min, twice. Finish warm. Done 90 min before bed.',
  0: 'Evening: sauna 20 min, cold 2–3 min, twice. Finish warm. Done 90 min before bed.',
  2: 'Evening: sauna only, 20 min.', 4: 'Evening: sauna only, 20 min.'
};
const RECOVERY_NOTE = 'No ice bath within 4–6 h of Day A or B.';
function recoveryFor(date, key) {
  const wd = parseISO(date).getDay();
  let t = RECOVERY[wd];
  if (wd === 0) t = RECOVERY[0];           // Sunday
  if (wd === 6) t = RECOVERY[6];           // Saturday
  return { text: t || '', warn: key === 'A' || key === 'B' };
}
/* [sets, reps, loadValue] per week; rpe per week */
function X(name, group, rest, type, w, rpe, o = {}) { return Object.assign({ name, swapGroup: group, rest, type, w, rpe }, o); }
const DAYS = {
  A: [
    X('Trap bar deadlift', 'lower', 180, 'kg', [[3, 5, 72.5], [3, 5, 77.5], [4, 5, 82.5], [2, 5, 70]], [6, 7, 8, 6], { main: true }),
    X('DB reverse lunge', 'lower', 90, 'rpe', [[3, 8], [3, 8], [3, 10], [2, 8]], [6, 6, 7, 6], { per: '/leg', note: 'Start with the weaker leg. 12–16 kg DBs.', alt: 'DB step-up' }),
    X('Leg press', 'lower', 90, 'kg', [[3, 10, 90], [3, 10, 100], [3, 12, 100], [2, 10, 80]], [6, 7, 7, 6]),
    X('Sled push', 'lower', 90, 'kg', [[3, 20, 50], [3, 20, 60], [4, 20, 60], [2, 20, 50]], [7, 7, 7, 6], { per: 'm', note: '20 m per set.' }),
    X('Pallof press', 'core', 60, 'rpe', [[3, 10], [3, 12], [3, 12], [2, 10]], [6, 6, 6, 6], { per: '/side', note: 'Extra set on the non-bowling side.', alt: 'Standing anti-rotation hold 2×20 s, or dead bug 2×10' }),
    X('Side plank', 'core', 60, 'time', [[3, 30], [3, 40], [3, 45], [2, 30]], [6, 6, 6, 6], { per: 's/side' })
  ],
  B: [
    X('DB bench press', 'upper', 120, 'rpe', [[3, 8], [3, 8], [4, 8], [2, 8]], [6, 7, 7, 6], { main: true }),
    X('Chest-supported row', 'upper', 90, 'rpe', [[3, 10], [3, 10], [4, 10], [2, 10]], [6, 7, 7, 6]),
    X('Half-kneeling landmine press', 'upper', 90, 'rpe', [[3, 8], [3, 8], [3, 10], [2, 8]], [6, 7, 7, 6], { per: '/side' }),
    X('Lat pulldown', 'upper', 90, 'rpe', [[3, 10], [3, 10], [3, 12], [2, 10]], [6, 7, 7, 6], { alt: 'Assisted pull-up' }),
    X('Face pull', 'upper', 60, 'rpe', [[3, 15], [3, 15], [3, 20], [2, 15]], [6, 6, 6, 6]),
    X("Farmer's carry", 'grip', 90, 'kg', [[3, 30, 20], [3, 30, 24], [4, 30, 24], [2, 30, 20]], [7, 7, 7, 6], { per: 'm', perKg: '/hand', note: '30 m per set.' }),
    X('Plate pinch hold', 'grip', 60, 'time', [[3, 20], [3, 25], [3, 30], [2, 20]], [6, 6, 6, 6], { per: 's/hand', optWk1: true }),
    X('SkiErg', 'conditioning', 60, 'distance', [[5, 250], [5, 250], [6, 250], [3, 250]], [7, 7, 7, 6], { per: 'm', note: '1:1 work to rest.', optWk1: true })
  ]
};
const DAY_B_CAP = 'Week 1: keep it to 45 minutes. Plate pinch and SkiErg are optional.';
const DAY_C = {
  rounds: [3, 4, 4, 2],
  warm: '800 m easy run or row, then 2 × 5 broad jumps.',
  steps: wk => [
    ['Row', '500 m'], ['Sled pull', `20 m @ ${wk === 3 ? 70 : 60} kg`], ['DB / sandbag walking lunge', '20 m @ 20 kg'],
    ['Wall balls', `× 20 @ ${wk === 3 ? 9 : 6} kg`], ['KB swing', '× 15 @ 20 kg'], ['Run', '400 m']
  ],
  rest: 180,
  rule: "Round 3 must be no more than 15% slower than round 1, or next week's loads hold."
};
const LIB = {
  lower: ['Trap bar deadlift', 'DB reverse lunge', 'DB step-up', 'Leg press', 'Sled push', 'Goblet squat', 'Romanian deadlift', 'Bulgarian split squat', 'Hip thrust', 'Walking lunge'],
  upper: ['DB bench press', 'Chest-supported row', 'Half-kneeling landmine press', 'Lat pulldown', 'Assisted pull-up', 'Face pull', 'Incline DB press', 'Single-arm cable row', 'Seated DB shoulder press'],
  core: ['Pallof press', 'Side plank', 'Standing anti-rotation hold', 'Dead bug', 'Suitcase carry', 'Cable chop'],
  grip: ["Farmer's carry", 'Plate pinch hold', 'Dead hang', 'Wrist roller', 'Towel pull-up hold'],
  conditioning: ['SkiErg', 'Rower', 'Assault bike', 'Sled pull', 'Burpee broad jump']
};
const MAIN_LIFTS = ['Trap bar deadlift', 'Leg press', 'DB bench press', 'Chest-supported row', 'Lat pulldown'];

/* ===== per-exercise prescription profile, used when an exercise is swapped in =====
 * t: load type ('rpe' = pick the weight by feel, 'bw' = bodyweight (+kg), 'time', 'distance')
 * reps: per week [w1, w2, w3, w4 deload]; sets always come from the slot so weekly volume and deloads are kept. */
const S_ = (t, reps, rest, o = {}) => Object.assign({ t, reps, rest }, o);
const SPEC = {
  'Trap bar deadlift': S_('rpe', [5, 5, 5, 5], 180), 'DB reverse lunge': S_('rpe', [8, 8, 10, 8], 90, { per: '/leg' }), 'DB step-up': S_('rpe', [8, 8, 10, 8], 90, { per: '/leg' }),
  'Leg press': S_('rpe', [10, 10, 12, 10], 90), 'Sled push': S_('rpe', [20, 20, 20, 20], 90, { per: 'm', note: '20 m per set.' }), 'Goblet squat': S_('rpe', [10, 10, 12, 10], 90),
  'Romanian deadlift': S_('rpe', [8, 8, 10, 8], 120), 'Bulgarian split squat': S_('rpe', [8, 8, 10, 8], 90, { per: '/leg' }), 'Hip thrust': S_('rpe', [10, 10, 12, 10], 90),
  'Walking lunge': S_('rpe', [10, 10, 12, 10], 90, { per: '/leg' }),
  'DB bench press': S_('rpe', [8, 8, 8, 8], 120), 'Chest-supported row': S_('rpe', [10, 10, 10, 10], 90), 'Half-kneeling landmine press': S_('rpe', [8, 8, 10, 8], 90, { per: '/side' }),
  'Lat pulldown': S_('rpe', [10, 10, 12, 10], 90), 'Assisted pull-up': S_('rpe', [8, 8, 10, 8], 90), 'Face pull': S_('rpe', [15, 15, 20, 15], 60), 'Incline DB press': S_('rpe', [8, 8, 10, 8], 120),
  'Single-arm cable row': S_('rpe', [10, 10, 12, 10], 90, { per: '/side' }), 'Seated DB shoulder press': S_('rpe', [8, 8, 10, 8], 90),
  'Pallof press': S_('rpe', [10, 12, 12, 10], 60, { per: '/side' }), 'Side plank': S_('time', [30, 40, 45, 30], 60, { per: 's/side' }),
  'Standing anti-rotation hold': S_('time', [20, 25, 30, 20], 60, { per: 's/side' }), 'Dead bug': S_('bw', [8, 10, 10, 8], 60, { per: '/side' }),
  'Suitcase carry': S_('rpe', [30, 30, 30, 30], 90, { per: 'm', perKg: '/side', note: '30 m per side.' }), 'Cable chop': S_('rpe', [10, 12, 12, 10], 60, { per: '/side' }),
  "Farmer's carry": S_('rpe', [30, 30, 30, 30], 90, { per: 'm', perKg: '/hand', note: '30 m per set.' }), 'Plate pinch hold': S_('time', [20, 25, 30, 20], 60, { per: 's/hand' }),
  'Dead hang': S_('time', [30, 40, 45, 30], 60, { per: 's' }), 'Wrist roller': S_('time', [30, 40, 45, 30], 60, { per: 's' }), 'Towel pull-up hold': S_('time', [15, 20, 25, 15], 90, { per: 's' }),
  'SkiErg': S_('distance', [250, 250, 250, 250], 60, { per: 'm', note: '1:1 work to rest.' }), 'Rower': S_('distance', [250, 250, 250, 250], 60, { per: 'm', note: '1:1 work to rest.' }),
  'Assault bike': S_('time', [45, 45, 60, 45], 60, { per: 's', note: '1:1 work to rest.' }), 'Sled pull': S_('rpe', [20, 20, 20, 20], 90, { per: 'm', note: '20 m per set.' }),
  'Burpee broad jump': S_('bw', [5, 5, 6, 5], 90)
};
/* anything not in the table (e.g. hotel-gym variants) gets a sensible guess from its name */
function specFor(n) {
  if (SPEC[n]) return SPEC[n];
  if (/treadmill|interval|sprint|boxing|march|bike/i.test(n)) return S_('time', [45, 45, 60, 45], 60, { per: 's' });
  if (/hold|hang|plank/i.test(n)) return S_('time', [30, 40, 45, 30], 60, { per: 's' });
  if (/carry|walk/i.test(n)) return S_('rpe', [30, 30, 30, 30], 90, { per: 'm' });
  if (/push-up|pike|jump/i.test(n)) return S_('bw', [8, 10, 12, 8], 90);
  return S_('rpe', [10, 10, 12, 10], 90);
}
const libGroup = n => Object.keys(LIB).find(k => LIB[k].includes(n));
/* the slot's prescription re-shaped for exercise `nm`: its own reps, load type, rest and notes; the slot's sets, RPE and week kept */
function adaptPresc(p, nm) {
  if (!nm || nm === p.name) return p;
  const sp = specFor(nm), wi = p.deload ? 3 : Math.max(0, Math.min(3, (p.wk || 1) - 1));
  return Object.assign({}, p, {
    name: nm, base: p.name, reps: sp.reps[wi], per: sp.per || '', perKg: sp.perKg || '', load: { type: sp.t, value: null },
    rest: sp.rest, note: sp.note || '', alt: '', swapGroup: libGroup(nm) || p.swapGroup
  });
}
/* what a slot actually prescribes, with the block's swaps applied. Use this for anything shown or logged. */
function slotPresc(key, wk, i) { const p = presc(key, wk, i); return adaptPresc(p, (S.swaps[BLOCK.id] || {})[p.name]); }

function presc(key, wk, i) {
  const x = DAYS[key][i], w = x.w[wk - 1];
  return {
    name: x.name, wk, sets: w[0], reps: w[1], per: x.per || '', perKg: x.perKg || '', load: { type: x.type, value: w[2] != null ? w[2] : null },
    rpeTarget: x.rpe[wk - 1], rest: x.rest, note: x.note || '', swapGroup: x.swapGroup, alt: x.alt || '', main: !!x.main, optional: !!(x.optWk1 && wk === 1)
  };
}
function prescText(p) {
  let s = `${p.sets} × ${p.reps}${p.per}`;
  if (p.load.type === 'kg' && p.load.value != null) s += ` @ ${p.load.value} kg${p.perKg || ''}`;
  if (p.load.type !== 'time' && p.load.type !== 'distance') s += ` · RPE ${p.rpeTarget}`;
  return s;
}

/* ===== schedule ===== */
const slotId = (w, d) => w + '-' + d;
function slotDefault(w, d) { return addDays(BLOCK.start, (w - 1) * 7 + d); }
function slotEff(w, d) { return S.slotDate[slotId(w, d)] || slotDefault(w, d); }
function allSlots() { const a = []; for (let w = 1; w <= BLOCK.weeks; w++) for (let d = 0; d < 7; d++) a.push({ w, d, id: slotId(w, d), key: DAY_BY_WD[d], date: slotEff(w, d) }); return a; }
function ctxFor(date) {
  const slots = allSlots().filter(s => s.date === date);
  const gym = slots.find(s => DAY_INFO[s.key].gym), main = gym || slots[0];
  const dd = diffDays(date, BLOCK.start), endD = BLOCK.weeks * 7;
  const out = { date, slot: main || null, key: main ? main.key : 'R', w: main ? main.w : null, status: main ? S.slotStatus[main.id] || null : null, moved: false, phase: dd < 0 ? 'before' : dd >= endD ? 'after' : 'in' };
  if (!main && out.phase === 'in') { out.w = Math.floor(dd / 7) + 1; out.key = 'R'; out.moved = true; }
  return out;
}
function dayLabel(c) {
  if (c.phase === 'before') return `Block 1 starts ${fmtDate(BLOCK.start, { weekday: 'short', day: 'numeric', month: 'short' })}`;
  if (c.phase === 'after') return 'Block 1 complete';
  const i = DAY_INFO[c.key]; return `${BLOCK.name} · Week ${c.w}${c.w === 4 ? ' (deload)' : ''} · ${i.name}`;
}
function sessionOf(slot) { return S.sessions['s-' + slot.id] || null; }
function ensureSession(slot) {
  const id = 's-' + slot.id;
  if (S.sessions[id]) return S.sessions[id];
  const s = { id, slot: slot.id, date: slot.date, key: slot.key, week: slot.w, status: 'draft', start: Date.now(), end: null, note: '', ex: [], rounds: [], u: Date.now() };
  if (slot.key === 'A' || slot.key === 'B') {
    s.ex = DAYS[slot.key].map((x, i) => {
      const p = slotPresc(slot.key, slot.w, i);
      return { name: p.name, orig: x.name, bi: i, tgt: p, sets: freshSets(p), note: '', skipped: p.optional };
    });
  } else if (slot.key === 'C') s.rounds = Array.from({ length: DAY_C.rounds[slot.w - 1] }, () => null);
  S.sessions[id] = s; saveState();
  return s;
}

/* ===== history, progression, e1RM ===== */
function exLogs(name) {
  const out = [];
  Object.values(S.sessions).forEach(s => (s.ex || []).forEach(e => {
    if (e.name !== name) return; const ds = e.sets.filter(x => x.done);
    if (ds.length) out.push({ date: s.date, sid: s.id, sets: ds, tgt: e.tgt, e });
  }));
  return out.sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : 0);
}
const e1rm = (w, r) => (!w || !r || r > 10) ? 0 : r === 1 ? w : w * (1 + r / 30);
function bestE1(sets) { let b = 0; sets.forEach(s => { b = Math.max(b, e1rm(s.w, s.r)); }); return b; }
const isRepEx = t => !t || !(t.per === 'm' || (t.per || '').startsWith('s'));
function setsSummary(sets) {
  const n = sets.length, r = Math.round(sets.reduce((a, s) => a + (s.r || 0), 0) / n), top = Math.max(...sets.map(s => s.w || 0)), rp = Math.max(...sets.map(s => s.rpe || 0));
  return `${n}×${r}${top ? ' @ ' + fmtN(top) + 'kg' : ''}${rp ? ' RPE ' + fmtN(rp) : ''}`;
}
function suggestLoad(name, p, date = isoDate()) {
  const r = suggestLoadBase(name, p, whoopRed(date));
  return whoopRed(date) ? Object.assign({}, r, { why: (r.why ? r.why + ' · ' : '') + 'recovery red: holding' }) : r;
}
function suggestLoadBase(name, p, hold) {
  const last = exLogs(name)[0], lastTxt = last ? `Last: ${setsSummary(last.sets)}` : '';
  if (p.load.type === 'kg' && p.load.value != null) return { kg: p.load.value, why: lastTxt ? `${lastTxt}. Prescribed ${p.load.value}kg` : `Prescribed ${p.load.value}kg` };
  if (p.load.type === 'time' || p.load.type === 'distance') return { kg: null, why: lastTxt };
  if (!last) return { kg: null, why: p.load.type === 'bw' ? '' : `First time: pick a weight that feels like RPE ${p.rpeTarget}` };
  const top = Math.max(...last.sets.map(s => s.w || 0));
  if (!top) return { kg: null, why: lastTxt };
  const tr = last.tgt ? last.tgt.reps : p.reps, trpe = last.tgt ? last.tgt.rpeTarget : p.rpeTarget;
  const hit = last.sets.every(s => (s.r || 0) >= tr) && last.sets.length >= (last.tgt ? last.tgt.sets : 1);
  const maxR = Math.max(...last.sets.map(s => s.rpe || 0)), allLow = last.sets.every(s => (s.rpe || 0) <= trpe - 1);
  const step = p.swapGroup === 'lower' ? 5 : 2.5;
  if (hit && allLow && !hold) return { kg: r05(top + step), why: `${lastTxt} → try ${r05(top + step)}kg` };
  if (maxR >= trpe + 1) return { kg: r05(top * .95), why: `${lastTxt} (felt hard) → try ${r05(top * .95)}kg` };
  return { kg: top, why: hit ? `${lastTxt} → hold ${top}kg` : `${lastTxt} (reps missed) → hold ${top}kg` };
}
function sessionStats(s) {
  let sets = 0, ton = 0;
  (s.ex || []).forEach(e => e.sets.forEach(x => { if (x.done) { sets++; if (x.w && x.r && isRepEx(e.tgt)) ton += x.w * x.r; } }));
  return { sets, ton: Math.round(ton), dur: s.start ? ((s.end || Date.now()) - s.start) / 1000 : 0, rounds: (s.rounds || []).filter(Boolean).length };
}
const swapsFor = orig => (S.swaps[BLOCK.id] || {})[orig];
/* n un-logged sets for prescription p, pre-filled with the suggested load */
function freshSets(p, n = p.sets, date) {
  const sg = suggestLoad(p.name, p, date), out = [];
  for (let k = 0; k < n; k++) out.push({ w: sg.kg, r: p.reps, rpe: p.rpeTarget, done: false });
  return out;
}
/* base (unswapped) prescription for a session exercise */
function basePrescFor(s, e) {
  const i = e.bi != null ? e.bi : DAYS[s.key].findIndex(x => x.name === e.orig);
  return i >= 0 ? presc(s.key, s.week, i) : (e.tgt.base ? Object.assign({}, e.tgt, { name: e.tgt.base }) : e.tgt);
}
/* one-time repair: drafts made before swaps changed the prescription still carry the original exercise's targets */
function repairSwappedDrafts() {
  let ch = false;
  Object.values(S.sessions).forEach(s => (s.ex || []).forEach(e => {
    if (s.status === 'done' || e.name === e.orig || (e.tgt && e.tgt.name === e.name)) return;
    const t = adaptPresc(basePrescFor(s, e), e.name), left = e.sets.filter(x => !x.done).length;
    e.tgt = t; e.sets = e.sets.filter(x => x.done).concat(freshSets(t, left, s.date)); ch = true;
  }));
  if (ch) saveState();
}

/* ===== supplements for a day ===== */
function suppsFor(date, key) {
  const wd = parseISO(date).getDay(), sauna = [2, 4, 5, 6, 0].includes(wd);
  return S.settings.supps.filter(s => s.rule === 'daily' || s.rule === 'asneeded' || (s.rule === 'B' && key === 'B') || (s.rule === 'Csauna' && (key === 'C' || sauna)));
}
