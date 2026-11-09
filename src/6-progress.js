/* ===== charts (hand-rolled SVG) ===== */
function niceRange(lo, hi) { if (lo === hi) { lo -= 1; hi += 1; } const p = (hi - lo) * .12; return [lo - p, hi + p]; }
const axl = (v, span = 100) => span < 6 ? r1(v) : Math.round(v);
function chartSVG(o) {
  const W = 340, H = o.h || 160, L = 34, R = o.y2 ? 30 : 10, T = 10, B = 22, iw = W - L - R, ih = H - T - B;
  const xs = o.series.flatMap(s => s.pts.map(p => p[0])); if (!xs.length) return '';
  const x0 = o.xmin ?? Math.min(...xs), x1 = o.xmax ?? Math.max(...xs), dx = (x1 - x0) || 1;
  const rng = (ax, key) => { if (o[key]) return o[key]; const ys = o.series.filter(s => (s.axis || 1) === ax).flatMap(s => s.pts.map(p => p[1])); return ys.length ? niceRange(Math.min(...ys), Math.max(...ys)) : [0, 1]; };
  const r1_ = rng(1, 'yr'), r2_ = o.y2 ? rng(2, 'yr2') : null;
  const px = x => L + (o.single ? iw / 2 : (x - x0) / dx * iw), py = (y, ax) => { const r = ax === 2 ? r2_ : r1_; return T + ih - (y - r[0]) / ((r[1] - r[0]) || 1) * ih; };
  let g = '';
  for (let i = 0; i <= 3; i++) {
    const y = T + ih * i / 3, v1 = r1_[1] - (r1_[1] - r1_[0]) * i / 3;
    g += `<line class="gl" x1="${L}" x2="${W - R}" y1="${y}" y2="${y}"/><text x="${L - 5}" y="${y + 3}" text-anchor="end">${axl(v1, r1_[1] - r1_[0])}</text>`;
    if (r2_) g += `<text x="${W - R + 5}" y="${y + 3}">${axl(r2_[1] - (r2_[1] - r2_[0]) * i / 3, r2_[1] - r2_[0])}</text>`;
  }
  (o.xt || []).forEach((t, i, a) => { g += `<text x="${px(t[0])}" y="${H - 6}" text-anchor="${a.length < 2 || o.single ? 'middle' : i === 0 ? 'start' : i === a.length - 1 ? 'end' : 'middle'}">${esc(t[1])}</text>`; });
  if (o.bars) {
    const bw = Math.min(26, iw / o.bars.length * .6);
    o.bars.forEach(b => { const x = px(b[0]), y = py(b[1], 1), y0 = py(r1_[0], 1); g += `<rect x="${x - bw / 2}" y="${y}" width="${bw}" height="${Math.max(0, y0 - y)}" rx="4" style="fill:${b[2] || 'var(--g2)'}"/>`; });
  }
  o.series.forEach(s => {
    const ax = s.axis || 1, pts = s.pts.map(p => [px(p[0]), py(p[1], ax)]);
    if (pts.length > 1 && !s.dots) g += `<polyline fill="none" points="${pts.map(p => p.join(',')).join(' ')}" style="stroke:${s.color};stroke-width:${s.w || 2.2};stroke-linejoin:round;stroke-linecap:round" ${s.dash ? 'stroke-dasharray="4 4"' : ''}/>`;
    if (!s.nodots) pts.forEach(p => { g += `<circle cx="${p[0]}" cy="${p[1]}" r="${s.r || 3}" style="fill:${s.color}"/>`; });
  });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label || 'chart')}">${g}</svg>` + (o.legend ? `<div class="legend">${o.legend.map(l => `<span><i style="background:${l[1]}"></i>${esc(l[0])}</span>`).join('')}</div>` : '');
}
const chartCard = (title, sub, body, empty) => `<div class="sec"><span>${title}</span><span class="faint" style="font-weight:500">${sub || ''}</span></div><div class="card pad">${body || `<div class="muted" style="text-align:center;padding:14px 0;font-size:15px">${empty}</div>`}</div>`;
const dateTicks = (ds, ref) => { if (!ds.length) return []; const a = ds[0], b = ds[ds.length - 1]; return a === b ? [[ref(a), fmtShort(a)]] : [[ref(a), fmtShort(a)], [ref(b), fmtShort(b)]]; };

screens.progress = () => {
  const today = isoDate(); let h = `<h1>Progress</h1><p class="sub">Trends from what you log.</p>`;
  /* weekly summaries */
  const cur = Math.max(1, Math.min(BLOCK.weeks, Math.floor(diffDays(today, BLOCK.start) / 7) + 1));
  h += `<div class="hl">`;
  for (let w = 1; w <= cur; w++) {
    const ws = addDays(BLOCK.start, (w - 1) * 7), we = addDays(ws, 6), done = allSlots().filter(s => s.w === w && DAY_INFO[s.key].gym && S.slotStatus[s.id] === 'done').length, sick = allSlots().filter(s => s.w === w && DAY_INFO[s.key].gym && S.slotStatus[s.id] === 'sick').length, plan = 3 - sick;
    const cis = Object.entries(S.checkins).filter(([d]) => d >= ws && d <= we).map(e => e[1]), avg = k => { const v = cis.map(c => c[k]).filter(x => x != null); return v.length ? r1(v.reduce((a, b) => a + b, 0) / v.length) : '–'; };
    h += `<div class="card wk"><div class="muted" style="font-size:13px;font-weight:600">Week ${w}${w === 4 ? ' deload' : ''}</div><div class="kv" style="margin:6px 0"><b>${plan ? Math.round(done / plan * 100) : 0}%</b><span>adherence · ${done}/${plan} sessions${sick ? ' · ' + sick + ' sick' : ''}</span></div><div class="s" style="font-size:13px;color:var(--ink2)">Soreness ${avg('doms')} · sleep ${avg('sleepH')} h</div>${whoopWeek(ws, we)}</div>`;
  }
  h += `</div>`;
  /* bodyweight */
  const bw = Object.entries(S.checkins).filter(([, c]) => c.bw).sort().slice(-60), t0 = bw.length ? bw[0][0] : today;
  let body = '';
  if (bw.length > 1) {
    const raw = bw.map(([d, c]) => [diffDays(d, t0), c.bw]), ma = raw.map((p, i) => { const sl = raw.slice(Math.max(0, i - 6), i + 1); return [p[0], sl.reduce((a, b) => a + b[1], 0) / sl.length]; });
    body = chartSVG({ label: 'Bodyweight', series: [{ pts: raw, color: 'var(--ink3)', r: 2.2, w: 1.2 }, { pts: ma, color: 'var(--o)', nodots: true, w: 2.6 }], xt: dateTicks(bw.map(x => x[0]), d => diffDays(d, t0)), legend: [['Daily', 'var(--ink3)'], ['7-day average', 'var(--o)']] });
  }
  h += chartCard('Bodyweight', bw.length ? fmtN(bw[bw.length - 1][1].bw) + ' kg' : '', body, 'Log your weight on at least two days to see a trend.');
  /* lifts */
  const logs = exLogs(ui.lift).slice().reverse(), lp = logs.map((l, i) => [i, r1(bestE1(l.sets) || Math.max(...l.sets.map(x => x.w || 0)))]).filter(p => p[1] > 0);
  h += `<div class="sec"><span>Estimated 1RM</span></div><div class="hl" style="margin-bottom:8px">${MAIN_LIFTS.map(l => `<button class="chip" data-action="lift" data-l="${esc(l)}" aria-pressed="${ui.lift === l}" style="white-space:nowrap">${esc(l)}</button>`).join('')}</div><div class="card pad">${lp.length ? chartSVG({ label: 'Estimated 1RM ' + ui.lift, series: [{ pts: lp, color: 'var(--g2)' }], single: lp.length === 1, xt: lp.length ? [[0, fmtShort(logs[0].date)], ...(lp.length > 1 ? [[lp.length - 1, fmtShort(logs[lp.length - 1].date)]] : [])] : [] }) + `<div class="s muted" style="margin-top:6px;font-size:13px">Best set today: ${lp[lp.length - 1][1]} kg, Epley estimate. <button style="color:var(--o);font-weight:600;min-height:44px" data-action="exhist" data-ex="${esc(ui.lift)}">All sets</button></div>` : `<div class="muted" style="text-align:center;padding:14px 0">Log ${esc(ui.lift)} to see its estimated 1RM.</div>`}</div>`;
  /* weekly volume */
  const vols = {}; Object.values(S.sessions).forEach(s => { const k = monOf(s.date); vols[k] = (vols[k] || 0) + sessionStats(s).ton; });
  const wkeys = []; for (let i = 7; i >= 0; i--) wkeys.push(addDays(monOf(today), -7 * i));
  const bars = wkeys.map((k, i) => [i, vols[k] || 0, i === 7 ? 'var(--o)' : 'var(--g2)']), anyV = bars.some(b => b[1] > 0);
  h += chartCard('Weekly volume', 'kg lifted', anyV ? chartSVG({ label: 'Weekly volume', series: [{ pts: bars.map(b => [b[0], b[1]]), color: 'transparent', nodots: true }], bars, yr: [0, Math.max(...bars.map(b => b[1])) * 1.1 || 1], xt: [[0, fmtShort(wkeys[0])], [7, 'This wk']] }) : '', 'Finish a session to see weekly tonnage.');
  /* sleep vs doms */
  const days = []; for (let i = 27; i >= 0; i--) days.push(addDays(today, -i)); const sl = [], dm = [];
  days.forEach((d, i) => { const c = S.checkins[d]; if (c && c.sleepH != null) sl.push([i, c.sleepH]); if (c && c.doms != null) dm.push([i, c.doms]); });
  h += chartCard('Sleep vs soreness', 'last 28 days', sl.length + dm.length > 2 ? chartSVG({ label: 'Sleep vs soreness', y2: true, yr: [4, 10], yr2: [0, 10], xmin: 0, xmax: 27, series: [{ pts: sl, color: 'var(--g2)' }, { pts: dm, color: 'var(--o)', axis: 2 }], xt: [[0, fmtShort(days[0])], [27, 'Today']], legend: [['Sleep (h, left)', 'var(--g2)'], ['Soreness (0–10, right)', 'var(--o)']] }) : '', 'Log sleep and soreness for a few days to compare them.');
  h += whoopCharts(today);
  /* Day C */
  const cs = Object.values(S.sessions).filter(s => s.key === 'C' && s.rounds.some(Boolean)).sort((a, b) => a.week - b.week), colors = ['var(--g2)', 'var(--o)', '#5AA9E6', '#C58AF9'];
  const ser = []; for (let r = 0; r < 4; r++) { const pts = cs.filter(s => s.rounds[r]).map(s => [s.week, s.rounds[r] / 60]); if (pts.length) ser.push({ pts, color: colors[r], name: 'Round ' + (r + 1) }); }
  h += chartCard('Day C round times', 'minutes', ser.length ? chartSVG({ label: 'Day C round times', series: ser, xmin: 1, xmax: 4, xt: [1, 2, 3, 4].map(w => [w, 'Wk ' + w]), legend: ser.map(s => [s.name, s.color]) }) : '', 'Log round times on Day C to compare weeks.');
  /* photos */
  h += `<div class="sec"><span>Progress photos</span><button data-action="addphoto">Add photo</button></div><input type="file" id="phfile" accept="image/*" capture="environment" data-in="photofile" style="display:none">`;
  h += S.photos.length ? `<div class="ph">${S.photos.slice().sort((a, b) => a.date < b.date ? 1 : -1).map(p => `<button data-action="photoview" data-id="${p.id}" aria-label="Photo from ${p.date}"><img data-ph="${p.id}" alt="Progress photo ${p.date}"><div class="s faint" style="font-size:12px;margin-top:3px;text-align:left">${fmtShort(p.date)}</div></button>`).join('')}</div>` : `<div class="card"><div class="empty">Take a front, side and back photo every two weeks, same light, same spot.</div></div>`;
  if (S.photos.length > 1) {
    const ps = S.photos.slice().sort((a, b) => a.date < b.date ? -1 : 1), A = ui.cmp[0] || ps[0].id, B = ui.cmp[1] || ps[ps.length - 1].id, opt = sel => ps.map(p => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${fmtDate(p.date, { day: 'numeric', month: 'short', year: 'numeric' })}</option>`).join('');
    h += `<div class="sec">Compare</div><div class="two"><select data-in="cmp" data-i="0" aria-label="First photo">${opt(A)}</select><select data-in="cmp" data-i="1" aria-label="Second photo">${opt(B)}</select></div><div class="cmp"><img data-ph="${A}" alt="First photo"><img data-ph="${B}" alt="Second photo"></div>`;
  }
  return h;
};
screens.progressAfter = hydratePhotos;
actions.lift = el => { ui.lift = el.dataset.l; render(); };
inputs.cmp = el => { ui.cmp[+el.dataset.i] = el.value; if (!ui.cmp[0]) ui.cmp[0] = $('[data-in=cmp][data-i="0"]').value; if (!ui.cmp[1]) ui.cmp[1] = $('[data-in=cmp][data-i="1"]').value; render(); };

/* ===== photos in IndexedDB ===== */
let pdb;
function photoDB() { return pdb || (pdb = new Promise((res, rej) => { const r = indexedDB.open('spt-v2-photos', 1); r.onupgradeneeded = () => r.result.createObjectStore('photos', { keyPath: 'id' }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); })); }
async function idb(mode, fn) { const db = await photoDB(); return new Promise((res, rej) => { const tx = db.transaction('photos', mode), st = tx.objectStore('photos'), rq = fn(st); tx.oncomplete = () => res(rq && rq.result); tx.onerror = () => rej(tx.error); }); }
const putPhoto = (id, blob) => idb('readwrite', s => s.put({ id, blob }));
const getPhoto = id => idb('readonly', s => s.get(id));
const delPhoto = id => idb('readwrite', s => s.delete(id));
const urls = {};
async function photoURL(id) { if (urls[id]) return urls[id]; try { const r = await getPhoto(id); if (r && r.blob) return urls[id] = URL.createObjectURL(r.blob); } catch (e) { console.warn(e); } return ''; }
async function hydratePhotos() { for (const im of $$('img[data-ph]')) { const u = await photoURL(im.dataset.ph); if (u) im.src = u; } }
actions.addphoto = () => $('#phfile').click();
async function resizeJPEG(file, max = 1200) {
  let bmp; try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { bmp = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); }); }
  const w0 = bmp.width || bmp.naturalWidth, h0 = bmp.height || bmp.naturalHeight, k = Math.min(1, max / Math.max(w0, h0)), cv = document.createElement('canvas'); cv.width = Math.round(w0 * k); cv.height = Math.round(h0 * k);
  cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
  return new Promise(res => cv.toBlob(b => res({ blob: b, w: cv.width, h: cv.height }), 'image/jpeg', .85));
}
inputs.photofile = async el => {
  const f = el.files && el.files[0]; if (!f) return;
  try { const { blob, w, h } = await resizeJPEG(f), id = uid(); await putPhoto(id, blob); S.photos.push({ id, date: isoDate(), w, h }); saveState(); toast('Photo saved'); render(); } catch (e) { console.error(e); toast('Could not save that photo'); }
  el.value = '';
};
actions.photoview = el => {
  const p = S.photos.find(x => x.id === el.dataset.id); if (!p) return;
  openSheet(fmtDate(p.date, { day: 'numeric', month: 'long', year: 'numeric' }), `<img data-ph="${p.id}" alt="Progress photo" style="width:100%;border-radius:14px;background:var(--surf3);aspect-ratio:${p.w || 3}/${p.h || 4}"><button class="btn danger" style="margin-top:12px" data-action="photodel" data-id="${p.id}">Delete photo</button>`);
  hydratePhotos();
};
actions.photodel = async el => { const id = el.dataset.id; await delPhoto(id).catch(() => { }); S.photos = S.photos.filter(p => p.id !== id); if (urls[id]) { URL.revokeObjectURL(urls[id]); delete urls[id]; } ui.cmp = [null, null]; saveState(); closeSheet(true); render(); };

/* ===== exercise history sheet ===== */
actions.exhist = el => {
  const name = el.dataset.ex, logs = exLogs(name);
  if (!logs.length) return openSheet(name, `<div class="empty">No sets logged for ${esc(name)} yet.</div>`);
  const asc = logs.slice().reverse(), rep = isRepEx(logs[0].tgt);
  const metric = l => bestE1(l.sets) || Math.max(...l.sets.map(x => x.w || 0)) || Math.max(...l.sets.map(x => x.r || 0));
  const unit = asc.some(l => bestE1(l.sets)) ? 'Estimated 1RM, kg' : asc.some(l => l.sets.some(x => x.w)) ? 'Top weight, kg' : (logs[0].tgt && logs[0].tgt.per.startsWith('s') ? 'Best hold, s' : 'Best reps');
  const pts = asc.map((l, i) => [i, r1(metric(l))]);
  let b = `<div class="card pad"><div class="muted" style="font-size:13px;margin-bottom:4px">${unit}</div>${pts.length > 1 ? chartSVG({ label: name + ' trend', h: 130, series: [{ pts, color: 'var(--g2)' }], xt: [[0, fmtShort(asc[0].date)], [pts.length - 1, fmtShort(asc[asc.length - 1].date)]] }) : `<b style="font-size:26px">${pts[0][1]}</b>`}</div><div class="card" style="margin-top:12px">`;
  b += logs.map(l => `<div class="row" style="align-items:flex-start;padding:10px 16px"><div style="width:62px" class="s">${fmtShort(l.date)}</div><div class="grow tn" style="font-size:15px">${l.sets.map(x => `<div>${setVal({ tgt: l.tgt || { load: { type: 'kg' }, per: '' } }, x).replace(/<\/?i>/g, '')}</div>`).join('')}</div></div>`).join('');
  openSheet(name, b + '</div>');
};

/* ===== export / import ===== */
function downloadBlob(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000); }
const blobToDataURL = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); });
async function buildExport() {
  const photos = []; for (const p of S.photos) { try { const r = await getPhoto(p.id); if (r && r.blob) photos.push({ id: p.id, date: p.date, w: p.w, h: p.h, dataUrl: await blobToDataURL(r.blob) }); } catch (e) { } }
  const st = Object.assign({}, S, { settings: Object.assign({}, S.settings, { whoop: Object.assign({}, S.settings.whoop, { key: '' }) }) });   /* never export the Worker app key */
  return { version: 2, app: 'SPT', exportedAt: new Date().toISOString(), state: st, photos };
}
actions.export = async () => {
  try { const o = await buildExport(); downloadBlob(new Blob([JSON.stringify(o)], { type: 'application/json' }), `spt-export-${isoDate()}.json`); toast(`Exported ${S.photos.length} photos and all logs`); } catch (e) { console.error(e); toast('Export failed'); }
};
let pendingImport = null;
inputs.importfile = async el => {
  const f = el.files && el.files[0]; el.value = ''; if (!f) return;
  try {
    const o = JSON.parse(await f.text());
    if (!o || o.version !== 2 || !o.state || typeof o.state !== 'object') throw new Error('bad');
    pendingImport = o; const s = o.state, n = x => Object.keys(x || {}).length;
    openSheet('Import backup', `<p style="margin-top:0">Exported ${esc(o.exportedAt ? fmtDate(isoDate(new Date(o.exportedAt)), { day: 'numeric', month: 'long', year: 'numeric' }) : 'earlier')}. This adds to what is on this device and keeps your current settings. If both have the same entry, the newer one wins.</p><div class="card"><div class="row"><div class="grow">Sessions</div><b class="tn">${n(s.sessions)}</b></div><div class="row"><div class="grow">Daily check-ins</div><b class="tn">${n(s.checkins)}</b></div><div class="row"><div class="grow">Days with food logged</div><b class="tn">${n(s.food)}</b></div><div class="row"><div class="grow">Photos</div><b class="tn">${(o.photos || []).length}</b></div></div><button class="btn pri" style="margin-top:14px" data-action="importok">Merge into this device</button>`, { close: 'Cancel' });
  } catch (e) { toast('That file is not an SPT v2 backup', { ms: 4000 }); }
};
function mergeKeyed(a, b) { a = a || {}; Object.entries(b || {}).forEach(([k, v]) => { if (!(k in a)) a[k] = v; else if (v && typeof v === 'object' && !Array.isArray(v) && (v.u || 0) > (a[k].u || 0)) a[k] = v; }); return a; }
async function mergeImport(o) {
  const s = o.state, stats = { added: 0 };
  ['sessions', 'checkins', 'suppLog', 'mobLog', 'slotStatus', 'slotDate', 'foodCache', 'whoop'].forEach(k => { S[k] = mergeKeyed(S[k], s[k]); });
  Object.entries(s.swaps || {}).forEach(([b, m]) => { S.swaps[b] = Object.assign({}, m, S.swaps[b] || {}); });
  Object.entries(s.food || {}).forEach(([d, arr]) => { const cur = S.food[d] = S.food[d] || []; arr.forEach(e => { if (!cur.some(x => x.id === e.id)) cur.push(e); }); });
  for (const p of o.photos || []) { if (S.photos.some(x => x.id === p.id)) continue; try { const blob = await (await fetch(p.dataUrl)).blob(); await putPhoto(p.id, blob); S.photos.push({ id: p.id, date: p.date, w: p.w, h: p.h }); } catch (e) { console.warn('photo import', e); } }
  saveState();
}
actions.importok = async () => { if (!pendingImport) return; await mergeImport(pendingImport); pendingImport = null; closeSheet(true); toast('Backup merged'); render(); };
