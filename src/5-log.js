/* ===== LOG ===== */
const OFF_FIELDS = 'code,product_name,brands,serving_size,serving_quantity,nutriments,nutriscore_grade,nova_group,image_front_small_url,categories_tags';
const dayTotals = d => (S.food[d] || []).reduce((a, e) => ({ kcal: a.kcal + e.kcal, p: a.p + e.p, c: a.c + e.c, f: a.f + e.f }), { kcal: 0, p: 0, c: 0, f: 0 });
function chipRow(k, from, to, cur) {
  const n = to - from + 1, a = []; for (let i = from; i <= to; i++) a.push(`<button class="chip" data-action="cichip" data-k="${k}" data-v="${i}" aria-pressed="${cur === i}">${i}</button>`);
  return `<div class="chips o cgrid" style="grid-template-columns:repeat(${n > 6 ? 6 : n},1fr)">${a.join('')}</div>`;
}
screens.log = () => {
  const d = ui.logDate, ci = getCI(d), today = d === isoDate(), c = ctxFor(d), t = S.settings.targets, tot = dayTotals(d);
  let h = `<h1>Log</h1><div style="display:flex;align-items:center;justify-content:space-between;margin:2px 0 6px"><button class="ib" data-action="logday" data-n="-1" aria-label="Previous day">‹</button><b>${today ? 'Today' : fmtDate(d, { weekday: 'short', day: 'numeric', month: 'short' })}</b><button class="ib" data-action="logday" data-n="1" aria-label="Next day" ${today ? 'disabled style="opacity:.3"' : ''}>›</button></div>`;
  const inp = (k, l, ph, mode = 'decimal') => `<div><div class="lbl" style="margin-top:0">${l}${ci.src && ci.src[k] === 'whoop' ? ' <span class="pill g" style="font-weight:600">from Whoop</span>' : ''}</div><input data-in="ci" data-k="${k}" inputmode="${mode}" placeholder="${ph}" value="${ci[k] ?? ''}" aria-label="${l}"></div>`;
  h += `<div class="sec" style="margin-top:8px">Check-in</div><div class="card pad"><div class="two">${inp('bw', 'Bodyweight (kg)', '84.5')}${inp('sleepH', 'Sleep (hours)', '7.5')}</div><div class="lbl">Sleep quality (1 poor, 5 great)</div>${chipRow('sleepQ', 1, 5, ci.sleepQ, 'o')}<div class="lbl">Soreness (0 none, 10 worst)</div>${chipRow('doms', 0, 10, ci.doms, 'o')}<div class="lbl">Energy (1 flat, 5 buzzing)</div>${chipRow('energy', 1, 5, ci.energy, 'o')}${feelSickHTML(d)}<div class="two" style="margin-top:10px">${inp('hr', 'Resting HR (optional)', '52', 'numeric')}<div></div></div><div class="lbl">Note</div><textarea data-in="ci" data-k="note" placeholder="Anything worth remembering" aria-label="Note">${esc(ci.note || '')}</textarea></div>`;
  h += suppCard(d, c.key);
  const bar = (l, v, tg, u) => `<div class="mb ${v > tg ? 'over' : ''}"><b>${Math.round(v)}<small>${u}</small></b><div class="tr"><i style="width:${Math.min(100, v / tg * 100)}%"></i></div><span>${l} of ${tg}</span></div>`;
  h += `<div class="sec">Nutrition</div><div class="card pad"><div class="bars">${bar('kcal', tot.kcal, t.kcal, '')}${bar('Protein', tot.p, t.p, 'g')}${bar('Carbs', tot.c, t.c, 'g')}${bar('Fat', tot.f, t.f, 'g')}</div></div>`;
  h += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px"><button class="btn grn" data-action="scan">${ico('scan')} Scan barcode</button><button class="btn" data-action="foodsearch">Search food</button></div><button class="btn ghost" style="margin-top:8px;min-height:44px" data-action="quickadd">Quick add calories and macros</button>`;
  const fl = S.food[d] || [];
  h += `<div class="card" style="margin-top:12px">${fl.length ? fl.map(e => `<button class="row" data-action="foodentry" data-id="${e.id}"><div class="grow"><div class="t">${esc(e.name)}</div><div class="s">${esc(e.qtyText || '')} P ${Math.round(e.p)} · C ${Math.round(e.c)} · F ${Math.round(e.f)}</div></div><b class="tn">${Math.round(e.kcal)}</b></button>`).join('') : '<div class="empty">Nothing logged yet. Scan a barcode or search to add food.</div>'}</div>`;
  return h;
};
actions.logday = el => { const n = addDays(ui.logDate, +el.dataset.n); if (n > isoDate()) return; ui.logDate = n; render(false); };
inputs.ci = el => {
  const k = el.dataset.k;
  debounced('ci' + k, () => { const v = k === 'note' ? el.value : num(el.value); setCI(ui.logDate, { [k]: v == null || v === '' ? null : v, src: srcWithout(ui.logDate, k) }); });
};
actions.cichip = el => { const k = el.dataset.k, v = +el.dataset.v; setCI(ui.logDate, { [k]: getCI(ui.logDate)[k] === v ? null : v }); vib(6); render(); };
actions.foodentry = el => {
  const d = ui.logDate, e = (S.food[d] || []).find(x => x.id === el.dataset.id); if (!e) return;
  openSheet(e.name, `<p class="muted" style="margin-top:0">${esc(e.brand || '')} ${esc(e.qtyText || '')}</p><div class="card pad"><div class="bars"><div class="kv"><b>${Math.round(e.kcal)}</b><span>kcal</span></div><div class="kv"><b>${Math.round(e.p)}</b><span>protein</span></div><div class="kv"><b>${Math.round(e.c)}</b><span>carbs</span></div><div class="kv"><b>${Math.round(e.f)}</b><span>fat</span></div></div></div><button class="btn danger" style="margin-top:12px" data-action="fooddel" data-id="${e.id}">Remove entry</button>`);
};
actions.fooddel = el => { const d = ui.logDate; S.food[d] = (S.food[d] || []).filter(x => x.id !== el.dataset.id); saveState(); closeSheet(true); render(); };
actions.quickadd = () => openSheet('Quick add', `<div id="qf"><div class="lbl" style="margin-top:0">Name</div><input data-k="name" placeholder="Lunch" aria-label="Name"><div class="two"><div><div class="lbl">Calories</div><input data-k="kcal" inputmode="numeric" aria-label="Calories"></div><div><div class="lbl">Protein (g)</div><input data-k="p" inputmode="decimal" aria-label="Protein"></div><div><div class="lbl">Carbs (g)</div><input data-k="c" inputmode="decimal" aria-label="Carbs"></div><div><div class="lbl">Fat (g)</div><input data-k="f" inputmode="decimal" aria-label="Fat"></div></div></div><button class="btn pri" style="margin-top:16px" data-action="quickok">Add to ${ui.logDate === isoDate() ? 'today' : fmtShort(ui.logDate)}</button>`, { close: 'Cancel' });
actions.quickok = () => {
  const v = {}; $$('#qf [data-k]').forEach(i => v[i.dataset.k] = i.value); const kcal = num(v.kcal);
  if (kcal == null) return toast('Enter calories');
  addFood({ name: v.name.trim() || 'Quick add', kcal, p: num(v.p) || 0, c: num(v.c) || 0, f: num(v.f) || 0, qtyText: '' });
};
function addFood(e) { const d = ui.logDate; (S.food[d] = S.food[d] || []).push(Object.assign({ id: uid(), t: Date.now() }, e)); saveState(); closeSheet(true); toast('Added to ' + (d === isoDate() ? 'today' : fmtShort(d))); vib(10); if (ui.tab === 'log') render(); }

/* ===== Open Food Facts ===== */
async function fetchJSON(url, ms = 8000) {
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), ms);
  try { const r = await fetch(url, { signal: ac.signal }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); } finally { clearTimeout(to); }
}
const OFF_KEYS = ['energy-kcal_100g', 'energy_100g', 'proteins_100g', 'carbohydrates_100g', 'sugars_100g', 'fat_100g', 'saturated-fat_100g', 'fiber_100g', 'salt_100g'];
function slimProduct(p, code) {
  const n = {}; OFF_KEYS.forEach(k => { if (p.nutriments && p.nutriments[k] != null) n[k] = +p.nutriments[k]; });
  return { code: code || p.code, product_name: p.product_name || '', brands: p.brands || '', serving_size: p.serving_size || '', serving_quantity: p.serving_quantity != null ? +p.serving_quantity : null, nutriments: n, nutriscore_grade: p.nutriscore_grade || '', nova_group: p.nova_group != null ? +p.nova_group : null, image_front_small_url: p.image_front_small_url || '', categories_tags: p.categories_tags || [] };
}
async function lookupBarcode(code) {
  code = String(code).replace(/\D/g, ''); if (code.length < 6) return toast('That does not look like a barcode');
  const t = toast('Looking up ' + code + '…', { ms: 9000 });
  try {
    const j = await fetchJSON(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${OFF_FIELDS}`);
    t.remove();
    if (j.status !== 1 || !j.product) { if (S.foodCache[code]) return showVerdict(S.foodCache[code]); toast('Not in Open Food Facts. Add it by hand.', { ms: 4000 }); return actions.quickadd(); }
    const sp = slimProduct(j.product, code); S.foodCache[code] = sp; saveState(); showVerdict(sp);
  } catch (e) {
    t.remove();
    if (S.foodCache[code]) { toast('Offline: using saved copy'); return showVerdict(S.foodCache[code]); }
    toast(e.name === 'AbortError' ? 'Lookup timed out. Try again or add by hand.' : 'Could not reach Open Food Facts. Check your connection.', { ms: 4000 });
  }
}
function energyKcal(n) { if (n['energy-kcal_100g'] != null) return n['energy-kcal_100g']; if (n['energy_100g'] != null) return n['energy_100g'] / 4.184; return null; }
/* pure verdict: product in Open Food Facts shape */
function scoreFood(product, goals = { focus: 'recomposition' }) {
  const n = (product && product.nutriments) || {}, kcal = energyKcal(n), prot = n['proteins_100g'], sug = n['sugars_100g'];
  const nova = product && product.nova_group != null ? +product.nova_group : null, ns = (product && product.nutriscore_grade || '').toUpperCase();
  if (kcal == null || prot == null) return { grade: 'amber', headline: 'Not enough data to judge', reasons: ['Open Food Facts has no calories or protein for this product.'] };
  const cats = [].concat(product.categories_tags || [], String(product.categories || '').split(',')).join(' ').toLowerCase();
  const nova4 = nova === 4, fruit = /fruit/.test(cats) && !nova4;  /* fruit exemption does not apply to ultra-processed products */
  const dens = kcal > 0 ? prot / kcal * 100 : (prot > 0 ? 99 : 0), pl = dens >= 10 ? 'strong' : dens >= 5 ? 'ok' : 'low';
  const sl = sug == null ? 'unknown' : fruit ? 'ignored' : sug >= 15 ? 'high' : sug >= 5 ? 'moderate' : 'low';
  const reasons = [`Protein: ${r1(dens)} g per 100 kcal (${pl === 'strong' ? 'strong' : pl === 'ok' ? 'ok' : 'low'})`];
  if (sl === 'ignored') reasons.push(`Sugar: ${r1(sug)} g per 100 g, natural fruit sugar so not counted against it`);
  else if (sl !== 'unknown') reasons.push(`Sugar: ${r1(sug)} g per 100 g (${sl})`);
  reasons.push(nova == null ? 'Processing level unknown' : nova4 ? 'Ultra-processed (NOVA 4)' : `Processing: NOVA ${nova}`);
  if (ns && /^[A-E]$/.test(ns)) reasons.push('Nutri-Score ' + ns);
  const sh = sl === 'high';
  let grade = 'amber', headline;
  if ((nova4 && pl === 'low') || (sh && pl === 'low')) { grade = 'red'; headline = nova4 && sh ? 'Ultra-processed, mostly sugar' : nova4 ? 'Ultra-processed, little protein' : 'High sugar, little protein'; }
  else if (pl === 'strong' && !sh && (nova == null || nova <= 3)) { grade = 'green'; headline = sl === 'moderate' ? 'Strong protein, moderate sugar' : 'Good protein hit, low sugar'; }
  else if (pl === 'strong') headline = sh ? 'Strong protein but high sugar' : 'Good protein, but ultra-processed';
  else if (pl === 'ok') headline = sh ? 'Some protein, but high sugar' : nova4 ? 'Decent protein, but ultra-processed' : 'Decent protein, check the rest';
  else headline = nova != null && nova <= 2 ? 'Whole food, low protein' : 'Low protein, middling otherwise';
  return { grade, headline, reasons };
}
function servingG(p) { if (p.serving_quantity > 0) return p.serving_quantity; const m = /([\d.,]+)\s*(g|ml)/i.exec(p.serving_size || ''); return m ? parseFloat(m[1].replace(',', '.')) : 0; }
function perG(p, g) { const n = p.nutriments, f = g / 100; return { kcal: (energyKcal(n) || 0) * f, p: (n['proteins_100g'] || 0) * f, c: (n['carbohydrates_100g'] || 0) * f, f: (n['fat_100g'] || 0) * f, sug: (n['sugars_100g'] || 0) * f }; }
function showVerdict(p, sv = 1) {
  ui.verdict = { p, sv }; const v = scoreFood(p, { focus: 'recomposition' }), sg = servingG(p), g = sg || 100, a = perG(p, 100), b = perG(p, g), tot = perG(p, g * sv);
  const row = (l, x, y) => `<div class="row" style="min-height:40px"><div class="grow">${l}</div><span class="tn" style="width:80px;text-align:right">${r1(x)}</span><span class="tn" style="width:90px;text-align:right">${r1(y)}</span></div>`;
  const body = `<div style="display:flex;gap:12px;align-items:center;margin-bottom:10px">${p.image_front_small_url ? `<img class="thumb" style="width:64px;height:64px" src="${esc(p.image_front_small_url)}" alt="">` : ''}<div style="min-width:0"><div class="muted" style="font-size:14px">${esc(p.brands)}</div><span class="vd ${v.grade}">${v.grade === 'green' ? 'Good fit' : v.grade === 'amber' ? 'Okay' : 'Poor fit'}</span></div></div><div style="font-size:20px;font-weight:800;letter-spacing:-.01em;margin-bottom:6px">${esc(v.headline)}</div>${v.reasons.map(r => `<div class="reason">${esc(r)}</div>`).join('')}<div class="card" style="margin-top:14px"><div class="row" style="min-height:36px"><div class="grow s">Per</div><span class="s" style="width:80px;text-align:right">100 g</span><span class="s" style="width:90px;text-align:right">${sg ? esc(p.serving_size || sg + ' g') : '100 g'}</span></div>${row('Calories', a.kcal, b.kcal)}${row('Protein (g)', a.p, b.p)}${row('Carbs (g)', a.c, b.c)}${row('Fat (g)', a.f, b.f)}</div><div style="display:flex;align-items:center;justify-content:space-between;margin:14px 0"><b>Servings</b><div style="display:flex;align-items:center;gap:6px"><button class="btn sm" data-action="svstep" data-d="-0.5" aria-label="Fewer servings">−</button><b class="tn" style="min-width:44px;text-align:center;font-size:20px">${sv}</b><button class="btn sm" data-action="svstep" data-d="0.5" aria-label="More servings">+</button></div></div><button class="btn pri" data-action="verdictadd">Add to ${ui.logDate === isoDate() ? 'today' : fmtShort(ui.logDate)}: ${Math.round(tot.kcal)} kcal</button>`;
  if (sheetBody() && ui.sheet && ui.sheet.title === (p.product_name || 'Product')) setSheetBody(body); else openSheet(p.product_name || 'Product', body);
}
actions.svstep = el => { const sv = Math.max(.5, ui.verdict.sv + +el.dataset.d); showVerdict(ui.verdict.p, sv); };
actions.verdictadd = () => {
  const { p, sv } = ui.verdict, g = servingG(p) || 100, t = perG(p, g * sv);
  if (p.code) { S.foodCache[p.code] = p; }
  addFood({ name: p.product_name || 'Food', brand: p.brands, kcal: t.kcal, p: t.p, c: t.c, f: t.f, qtyText: `${sv} × ${p.serving_size || g + ' g'} · `, barcode: p.code });
};
/* search */
actions.foodsearch = () => {
  const rec = Object.values(S.foodCache).slice(-8).reverse();
  openSheet('Search food', `<input id="fq" data-in="fsearch" type="search" placeholder="Greek yoghurt, oats, whey…" aria-label="Search food" autocomplete="off" enterkeyhint="search"><div id="fres" style="margin-top:12px">${foodList(rec, 'Recent')}</div>`, { close: 'Close' });
  setTimeout(() => $('#fq')?.focus(), 350);
};
function foodList(arr, title) {
  if (!arr.length) return '';
  ui.found = arr;
  return `<div class="sec" style="margin-top:0">${title}</div><div class="card">${arr.map((p, i) => `<button class="row" data-action="foodpick" data-i="${i}">${p.image_front_small_url ? `<img class="thumb" src="${esc(p.image_front_small_url)}" alt="" loading="lazy">` : '<span class="thumb"></span>'}<div class="grow"><div class="t" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.product_name || 'Unnamed')}</div><div class="s">${esc(p.brands || '')} · ${Math.round(energyKcal(p.nutriments) || 0)} kcal/100 g</div></div></button>`).join('')}</div>`;
}
let searchAC;
inputs.fsearch = el => {
  const q = el.value.trim(); debounced('fs', async () => {
    const box = $('#fres'); if (!box) return; if (q.length < 2) return;
    box.innerHTML = '<div class="empty">Searching…</div>'; if (searchAC) searchAC.abort();
    const ac = searchAC = new AbortController(), to = setTimeout(() => ac.abort(), 8000);
    try {
      const r = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=20&fields=${OFF_FIELDS}`, { signal: ac.signal });
      if (!r.ok) throw new Error('HTTP ' + r.status); const j = await r.json(); clearTimeout(to);
      const arr = (j.products || []).filter(p => p.product_name && p.nutriments).map(p => slimProduct(p));
      if ($('#fres')) $('#fres').innerHTML = arr.length ? foodList(arr, 'Results') : '<div class="empty">No matches. Try a simpler word, or add it by hand.</div>';
    } catch (e) { clearTimeout(to); if (e.name === 'AbortError' && searchAC !== ac) return; if ($('#fres')) $('#fres').innerHTML = `<div class="empty">${e.name === 'AbortError' ? 'Search timed out.' : 'Could not reach Open Food Facts.'} Check your connection, or use quick add.</div>`; }
  }, 450);
};
actions.foodpick = el => { const p = ui.found[+el.dataset.i]; if (p) showVerdict(p); };

/* ===== barcode scanner (zxing-wasm, lazy) ===== */
const ZX_URL = 'https://cdn.jsdelivr.net/npm/zxing-wasm@3.1.6/dist/iife/reader/index.js';
let zxP;
function loadZX() { return zxP || (zxP = new Promise((res, rej) => { if (window.ZXingWASM) return res(window.ZXingWASM); const s = document.createElement('script'); s.src = ZX_URL; s.crossOrigin = 'anonymous'; s.onload = () => { try { window.ZXingWASM.setZXingModuleOverrides({ locateFile: (p, pre) => p.endsWith('.wasm') ? 'https://cdn.jsdelivr.net/npm/zxing-wasm@3.1.6/dist/reader/' + p : pre + p }); } catch (e) { } res(window.ZXingWASM); }; s.onerror = () => { zxP = null; rej(new Error('zxing load failed')); }; document.head.appendChild(s); })); }
const scan = { stream: null, raf: 0, on: false, torch: false };
actions.scan = async () => {
  openSheet('Scan barcode', `<div class="scanbox"><video id="scv" playsinline muted autoplay></video></div><p id="scmsg" class="muted" style="text-align:center;margin:10px 0">Starting camera…</p><div style="display:flex;gap:8px"><button class="btn sm" id="torchb" data-action="torch" style="display:none">${ico('bolt')} Torch</button></div><div class="lbl">Or type the barcode</div><div style="display:flex;gap:8px"><input id="manbc" inputmode="numeric" placeholder="5000112637922" aria-label="Barcode number"><button class="btn sm pri" data-action="manbc">Look up</button></div>`, { close: 'Close', onClose: stopScan });
  const msg = t => { const m = $('#scmsg'); if (m) m.textContent = t; };
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return msg('Camera not available here. Type the barcode instead.');
  try {
    scan.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false });
    const v = $('#scv'); if (!v) return stopScan(); v.srcObject = scan.stream; await v.play().catch(() => { });
    const tr = scan.stream.getVideoTracks()[0], caps = tr.getCapabilities ? tr.getCapabilities() : {}; if (caps.torch) $('#torchb').style.display = '';
    msg('Loading scanner…'); const Z = await loadZX(); if (!$('#scv')) return;
    msg('Point at a barcode'); scan.on = true; scanLoop(Z, v);
  } catch (e) {
    msg(e && e.name === 'NotAllowedError' ? 'Camera permission denied. Allow it in Settings, or type the barcode.' : e && /zxing/.test(e.message) ? 'Scanner could not load (offline?). Type the barcode instead.' : 'Camera unavailable. Type the barcode instead.');
  }
};
function scanLoop(Z, v) {
  const cv = document.createElement('canvas'), cx = cv.getContext('2d', { willReadFrequently: true }); let busy = false, last = 0, fails = 0;
  const tick = async t => {
    if (!scan.on) return; scan.raf = requestAnimationFrame(tick);
    if (busy || t - last < 120 || v.readyState < 2 || !v.videoWidth) return; busy = true; last = t;
    try {
      const w = Math.min(720, v.videoWidth), h = Math.round(w * v.videoHeight / v.videoWidth); cv.width = w; cv.height = h; cx.drawImage(v, 0, 0, w, h);
      const res = await Z.readBarcodes(cx.getImageData(0, 0, w, h), { formats: ['EAN13', 'EAN8', 'UPCA', 'UPCE', 'Code128'], tryHarder: true, maxNumberOfSymbols: 1 });
      const hit = res.find(r => r.isValid && r.text);
      if (hit && scan.on) { vib(40); beep(); stopScan(); closeSheet(true); lookupBarcode(hit.text); }
    } catch (e) { console.warn('decode', e); if (++fails >= 3) { stopScan(); const m = $('#scmsg'); if (m) m.textContent = 'Scanner failed to start. Type the barcode instead.'; } } finally { busy = false; }
  };
  scan.raf = requestAnimationFrame(tick);
}
function stopScan() { scan.on = false; cancelAnimationFrame(scan.raf); if (scan.stream) scan.stream.getTracks().forEach(t => t.stop()); scan.stream = null; scan.torch = false; }
actions.torch = async () => { try { const tr = scan.stream.getVideoTracks()[0]; scan.torch = !scan.torch; await tr.applyConstraints({ advanced: [{ torch: scan.torch }] }); } catch (e) { toast('Torch not available'); } };
actions.manbc = () => { const v = $('#manbc').value; stopScan(); closeSheet(true); lookupBarcode(v); };
