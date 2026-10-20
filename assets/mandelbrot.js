/* Fractal Lab: υπολογισμός και σχεδίαση του συνόλου Mandelbrot.
   MB.escapeCount  : ίδιος κανόνας με τον κώδικα Python (ακέραιος αριθμός βημάτων)
   MB.escapeSmooth : «ομαλός» αριθμός βημάτων για τον εξερευνητή, -1 για σημεία του συνόλου
   MB.Explorer     : εξερευνητής με zoom, που μοιράζει τη δουλειά σε Web Workers */
(function () {
  'use strict';

  // Όπως στην Python: z = 0, z = z*z + c, σταματάμε όταν |z| > 2.
  function escapeCount(cx, cy, maxIter) {
    let x = 0, y = 0;
    for (let n = 0; n < maxIter; n++) {
      const nx = x * x - y * y + cx;
      y = 2 * x * y + cy; x = nx;
      if (x * x + y * y > 4) return n;
    }
    return maxIter;
  }

  // Γρηγορότερη εκδοχή με ομαλό χρώμα: ν = n + 1 − log2(ln|z|).
  // Τα σημεία μέσα στην κύρια καρδιοειδή και στον κύκλο |c + 1| < 1/4 ανήκουν σίγουρα στο σύνολο.
  function escapeSmooth(cx, cy, maxIter) {
    const xq = cx - 0.25, q = xq * xq + cy * cy;
    if (q * (q + xq) <= 0.25 * cy * cy) return -1;
    if ((cx + 1) * (cx + 1) + cy * cy <= 0.0625) return -1;
    let x = 0, y = 0, x2 = 0, y2 = 0, ox = 0, oy = 0, check = 3, k = 0;
    for (let n = 1; n <= maxIter; n++) {
      y = 2 * x * y + cy; x = x2 - y2 + cx; x2 = x * x; y2 = y * y;
      if (x2 + y2 > 256) return n + 1 - Math.log2(0.5 * Math.log(x2 + y2));
      // Αν η ακολουθία ξαναπέσει στο ίδιο σημείο, έχει μπει σε κύκλο: ανήκει στο σύνολο.
      if (Math.abs(x - ox) + Math.abs(y - oy) < 1e-15) return -1;
      if (++k === check) { k = 0; check *= 2; ox = x; oy = y; }
    }
    return -1;
  }

  // Κυκλικές παλέτες: [θέση, [r, g, b]], η τελευταία ίδια με την πρώτη.
  const PALETTES = {
    ocean:  { name: 'Ωκεανός', stops: [[0, [0, 7, 100]], [0.16, [32, 107, 203]], [0.42, [237, 255, 255]], [0.6425, [255, 170, 0]], [0.8575, [0, 2, 0]], [1, [0, 7, 100]]] },
    fire:   { name: 'Φωτιά', stops: [[0, [12, 0, 4]], [0.22, [140, 12, 18]], [0.45, [240, 100, 12]], [0.65, [255, 214, 90]], [0.8, [255, 250, 225]], [1, [12, 0, 4]]] },
    violet: { name: 'Νεφέλωμα', stops: [[0, [10, 0, 34]], [0.25, [86, 30, 168]], [0.5, [222, 120, 255]], [0.66, [255, 232, 250]], [0.82, [80, 200, 230]], [1, [10, 0, 34]]] },
    forest: { name: 'Δάσος', stops: [[0, [3, 20, 14]], [0.3, [22, 118, 70]], [0.55, [176, 228, 122]], [0.7, [252, 246, 206]], [0.86, [96, 66, 30]], [1, [3, 20, 14]]] },
    gray:   { name: 'Μολύβι', stops: [[0, [10, 10, 14]], [0.5, [246, 246, 246]], [1, [10, 10, 14]]] }
  };
  const BY_COLOR = { blue: 'ocean', navy: 'ocean', cyan: 'ocean', teal: 'forest', green: 'forest', red: 'fire', orange: 'fire', yellow: 'fire', gold: 'fire', brown: 'fire',
    purple: 'violet', pink: 'violet', magenta: 'violet', gray: 'gray', grey: 'gray', black: 'gray', white: 'gray' };
  const N = 1024, luts = {};
  function lut(name) {
    if (luts[name]) return luts[name];
    const s = (PALETTES[name] || PALETTES.ocean).stops, out = new Uint8ClampedArray(N * 3);
    for (let i = 0, k = 0; i < N; i++) {
      const t = i / N;
      while (k < s.length - 2 && t > s[k + 1][0]) k++;
      const [t0, c0] = s[k], [t1, c1] = s[k + 1], f = (t - t0) / (t1 - t0), g = f * f * (3 - 2 * f);
      for (let j = 0; j < 3; j++) out[i * 3 + j] = c0[j] + (c1[j] - c0[j]) * g;
    }
    return (luts[name] = out);
  }
  const paletteFor = color => BY_COLOR[color] || (PALETTES[color] ? color : 'ocean');
  // Από τον αριθμό βημάτων ν στη θέση της παλέτας. Η ρίζα κρατά τα χρώματα ζωηρά και στα βαθιά zoom.
  const tOf = v => Math.sqrt(v) * 0.24 - 0.24;
  function colorize(vals, data, table, interior) {
    for (let i = 0, j = 0; i < vals.length; i++, j += 4) {
      const v = vals[i];
      if (v < 0) { data[j] = interior[0]; data[j + 1] = interior[1]; data[j + 2] = interior[2]; }
      else {
        let t = tOf(v); t -= Math.floor(t);
        const k = ((t * N) | 0) * 3;
        data[j] = table[k]; data[j + 1] = table[k + 1]; data[j + 2] = table[k + 2];
      }
      data[j + 3] = 255;
    }
  }

  // Μια εικόνα (w × h) μιας περιοχής, για μικρά σχέδια στη σελίδα.
  function renderTo(canvas, view, opts = {}) {
    const w = canvas.width, h = canvas.height, ctx = canvas.getContext('2d');
    const img = ctx.createImageData(w, h), vals = new Float32Array(w * h), d = view.w / w;
    const x0 = view.cx - view.w / 2 + d / 2, y0 = view.cy + d * h / 2 - d / 2, it = opts.maxIter || 400;
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) vals[r * w + c] = escapeSmooth(x0 + c * d, y0 - r * d, it);
    colorize(vals, img.data, lut(opts.palette || 'ocean'), opts.interior || [0, 0, 0]);
    ctx.putImageData(img, 0, 0);
    return canvas;
  }

  // 1234567 → «1,2 · 10⁶»
  const SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
  function sci(z) {
    const e = Math.floor(Math.log10(z)), m = z / Math.pow(10, e);
    return m.toFixed(1).replace('.', ',') + ' · 10' + String(e).split('').map(ch => SUP[ch]).join('');
  }

  // ---------- Workers ----------
  const WORKER_SRC = 'const escapeSmooth = ' + escapeSmooth.toString() + ';\n' +
    'onmessage = e => { const j = e.data, out = new Float32Array(j.w * j.rows);\n' +
    '  for (let r = 0; r < j.rows; r++) { const cy = j.y0 - (j.r0 + r) * j.d;\n' +
    '    for (let c = 0; c < j.w; c++) out[r * j.w + c] = escapeSmooth(j.x0 + c * j.d, cy, j.maxIter); }\n' +
    '  postMessage({ id: j.id, r0: j.r0, rows: j.rows, pass: j.pass, out }, [out.buffer]); };';
  function makePool() {
    const n = Math.max(1, Math.min(8, (navigator.hardwareConcurrency || 4) - 1));
    try {
      const url = URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' }));
      const pool = [];
      for (let i = 0; i < n; i++) pool.push(new Worker(url));
      return pool;
    } catch (e) { return []; }
  }

  // ---------- Εξερευνητής ----------
  class Explorer {
    constructor(el) {
      this.el = el; this.canvas = el.canvas; this.ctx = this.canvas.getContext('2d');
      this.palette = 'ocean'; this.detail = 250; this.interior = [0, 0, 0];
      this.view = { cx: -0.75, cy: 0, w: 3.6 }; this.gen = 0; this.queue = []; this.idle = [];
      this.passes = {}; this.onView = null; this.journey = null;
      this.pool = makePool();
      this.pool.forEach(w => { w.onmessage = e => { this.done(e.data); this.next(w); }; this.idle.push(w); });
      this.lowCanvas = document.createElement('canvas');
      new ResizeObserver(() => this.resize()).observe(this.canvas);
      this.bind();
      this.resize(true);
    }
    homeView() {
      const a = this.H / this.W || 0.55;
      return { cx: -0.75, cy: 0, w: Math.max(3.4, 2.6 / a) };
    }
    resize(first) {
      const r = this.canvas.getBoundingClientRect(), ratio = Math.min(window.devicePixelRatio || 1, 1.25);
      const W = Math.max(2, Math.round(r.width * ratio)), H = Math.max(2, Math.round(r.height * ratio));
      if (W === this.W && H === this.H) return;
      this.W = W; this.H = H; this.canvas.width = W; this.canvas.height = H; this.ratio = ratio;
      if (first) this.view = this.homeView();
      this.render('full'); this.hud();
    }
    // Όσο βαθύτερα, τόσο περισσότερες επαναλήψεις χρειάζονται τα σημεία κοντά στο σύνορο.
    maxIter() { const L = Math.max(0, Math.log10(3.4 / this.view.w)); return Math.round(this.detail * (1 + 0.3 * L + 0.08 * L * L)); }
    // Από pixel της οθόνης σε μιγαδικό αριθμό.
    toC(px, py) {
      const r = this.canvas.getBoundingClientRect(), d = this.view.w / r.width;
      return [this.view.cx + (px - r.left - r.width / 2) * d, this.view.cy - (py - r.top - r.height / 2) * d];
    }
    setView(v, mode = 'full') {
      this.view = { cx: v.cx, cy: v.cy, w: Math.min(8, Math.max(1e-13, v.w)) };
      this.render(mode);
      this.hud();
      if (this.onView) this.onView(this.view);
    }
    zoomAt(px, py, f, mode) {
      const [x, y] = this.toC(px, py), v = this.view;
      this.setView({ cx: x + (v.cx - x) * f, cy: y + (v.cy - y) * f, w: v.w * f }, mode);
    }
    // mode: 'quick' = μόνο χαμηλή ανάλυση, 'full' = χαμηλή και μετά πλήρης.
    render(mode = 'full', lowScale) {
      if (!this.W) return;
      const id = ++this.gen, it = this.maxIter(), v = this.view, list = [];
      this.queue = []; this.passes = {}; this.t0 = performance.now();
      const plan = [{ pass: 'low', s: lowScale || (mode === 'quick' ? this.quickScale || 0.25 : 0.25) }];
      if (mode !== 'quick') plan.push({ pass: 'full', s: 1 });
      for (const { pass, s } of plan) {
        const w = Math.max(1, Math.round(this.W * s)), h = Math.max(1, Math.round(this.H * s)), d = v.w / w;
        const x0 = v.cx - v.w / 2 + d / 2, y0 = v.cy + d * h / 2 - d / 2, rows = Math.max(1, Math.round(9000 / w));
        this.passes[pass] = { w, h, vals: new Float32Array(w * h), left: Math.ceil(h / rows), img: null };
        for (let r0 = 0; r0 < h; r0 += rows) list.push({ id, pass, w, x0, y0, d, r0, rows: Math.min(rows, h - r0), maxIter: it });
      }
      this.queue = list; this.busy(true);
      if (this.pool.length) { const idle = this.idle.splice(0); idle.forEach(w => this.next(w)); }
      else this.mainThread(id);
    }
    next(w) {
      const job = this.queue.shift();
      if (job) w.postMessage(job); else this.idle.push(w);
    }
    mainThread(id) {
      const step = () => {
        if (id !== this.gen) return;
        const end = performance.now() + 14;
        while (this.queue.length && performance.now() < end) {
          const j = this.queue.shift(), out = new Float32Array(j.w * j.rows);
          for (let r = 0; r < j.rows; r++) { const cy = j.y0 - (j.r0 + r) * j.d; for (let c = 0; c < j.w; c++) out[r * j.w + c] = escapeSmooth(j.x0 + c * j.d, cy, j.maxIter); }
          this.done({ id: j.id, r0: j.r0, rows: j.rows, pass: j.pass, out });
        }
        if (this.queue.length) setTimeout(step, 0);
      };
      step();
    }
    done(m) {
      if (m.id !== this.gen) return;
      const p = this.passes[m.pass]; if (!p) return;
      p.vals.set(m.out, m.r0 * p.w); p.left--;
      const table = lut(this.palette);
      if (m.pass === 'low') {
        if (!p.img) { this.lowCanvas.width = p.w; this.lowCanvas.height = p.h; p.img = this.lowCanvas.getContext('2d').createImageData(p.w, p.h); }
        colorize(m.out, p.img.data.subarray(m.r0 * p.w * 4, (m.r0 + m.rows) * p.w * 4), table, this.interior);
        if (p.left === 0) {
          this.lowCanvas.getContext('2d').putImageData(p.img, 0, 0);
          this.ctx.imageSmoothingEnabled = true; this.ctx.drawImage(this.lowCanvas, 0, 0, this.W, this.H);
          if (!this.passes.full) this.finished();
        }
      } else {
        const img = this.ctx.createImageData(p.w, m.rows);
        colorize(m.out, img.data, table, this.interior);
        this.ctx.putImageData(img, 0, m.r0);
        if (p.left === 0) this.finished();
      }
    }
    finished() {
      this.lastMs = performance.now() - this.t0;
      this.busy(false);
      if (this.journey) this.journeyFrame();
    }
    recolor() {
      const p = this.passes.full;
      if (p && p.left === 0) {
        const img = this.ctx.createImageData(p.w, p.h);
        colorize(p.vals, img.data, lut(this.palette), this.interior); this.ctx.putImageData(img, 0, 0);
      } else this.render('full');
    }
    setPalette(name) { this.palette = name; this.recolor(); }
    busy(on) { if (this.el.busy) this.el.busy.textContent = on ? 'υπολογισμός…' : ''; }
    hud() {
      const v = this.view, digits = Math.min(16, Math.max(3, Math.ceil(-Math.log10(v.w)) + 3));
      const f = x => (x < 0 ? '−' : '') + Math.abs(x).toFixed(digits).replace('.', ',');
      if (this.el.pos) this.el.pos.textContent = 'κέντρο ' + f(v.cx) + (v.cy < 0 ? ' − ' : ' + ') + f(Math.abs(v.cy)) + 'i';
      const z = this.homeView().w / v.w;
      if (this.el.zoom) this.el.zoom.textContent = 'μεγέθυνση × ' + (z < 1e4 ? z.toLocaleString('el-GR', { maximumFractionDigits: z < 10 ? 1 : 0 }) : sci(z));
      if (this.el.iter) this.el.iter.textContent = this.maxIter().toLocaleString('el-GR') + ' επαναλήψεις';
    }

    // ---------- Ταξίδι σε βάθος ----------
    startJourney(target, onEnd) {
      const v = this.view;
      this.journey = { from: { ...v }, target, t0: performance.now(), panMs: 2600, zoomPerSec: 0.42, onEnd };
      this.quickScale = 0.5; this.journeyFrame();
    }
    stopJourney() {
      if (!this.journey) return;
      const end = this.journey.onEnd; this.journey = null; this.quickScale = 0.25;
      this.render('full'); this.hud(); if (end) end();
    }
    journeyFrame() {
      const j = this.journey; if (!j) return;
      const t = performance.now() - j.t0, T = j.target;
      const startW = Math.min(j.from.w, 0.5);
      let v;
      if (t < j.panMs) {
        const a = t / j.panMs, e = a * a * (3 - 2 * a);
        v = { cx: j.from.cx + (T.cx - j.from.cx) * e, cy: j.from.cy + (T.cy - j.from.cy) * e, w: Math.exp(Math.log(j.from.w) + (Math.log(startW) - Math.log(j.from.w)) * e) };
      } else {
        const w = startW * Math.pow(10, -j.zoomPerSec * (t - j.panMs) / 1000);
        v = { cx: T.cx, cy: T.cy, w: Math.max(w, T.w) };
        if (w <= T.w) { this.view = v; this.hud(); if (this.onView) this.onView(v); this.stopJourney(); return; }
      }
      // Προσαρμόζουμε την ανάλυση ώστε κάθε καρέ να βγαίνει γρήγορα.
      if (this.lastMs > 110) this.quickScale = Math.max(0.25, this.quickScale * 0.85);
      else if (this.lastMs < 45) this.quickScale = Math.min(0.7, this.quickScale * 1.1);
      this.view = v; this.hud();
      this.render('quick');
    }

    // ---------- Ποντίκι, αφή, πληκτρολόγιο ----------
    bind() {
      const c = this.canvas, pts = new Map();
      let start = null, idleTimer = 0, raf = 0, pendingMode = null;
      const schedule = () => {
        clearTimeout(idleTimer);
        if (!raf) raf = requestAnimationFrame(() => { raf = 0; this.render('quick'); this.hud(); });
        idleTimer = setTimeout(() => { this.render('full'); if (this.onView) this.onView(this.view); }, 220);
      };
      const interact = () => { if (this.journey) this.stopJourney(); if (this.el.hint) this.el.hint.classList.add('gone'); };
      c.addEventListener('pointerdown', e => {
        interact(); c.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
        start = { view: { ...this.view }, pts: new Map(pts) };
      });
      c.addEventListener('pointermove', e => {
        if (!pts.has(e.pointerId)) return;
        pts.set(e.pointerId, [e.clientX, e.clientY]);
        const r = c.getBoundingClientRect(), s = start;
        if (pts.size === 1 && s.pts.size === 1) {
          const [x0, y0] = [...s.pts.values()][0], d = s.view.w / r.width;
          this.view = { cx: s.view.cx - (e.clientX - x0) * d, cy: s.view.cy + (e.clientY - y0) * d, w: s.view.w };
        } else if (pts.size === 2 && s.pts.size === 2) {
          const [a0, b0] = [...s.pts.values()], [a1, b1] = [...pts.values()];
          const d0 = Math.hypot(a0[0] - b0[0], a0[1] - b0[1]), d1 = Math.hypot(a1[0] - b1[0], a1[1] - b1[1]) || 1;
          const f = d0 / d1, mx = (a0[0] + b0[0]) / 2 - r.left - r.width / 2, my = (a0[1] + b0[1]) / 2 - r.top - r.height / 2;
          const nx = (a1[0] + b1[0]) / 2 - r.left - r.width / 2, ny = (a1[1] + b1[1]) / 2 - r.top - r.height / 2, d = s.view.w / r.width;
          const px = s.view.cx + mx * d, py = s.view.cy - my * d, w = s.view.w * f, nd = w / r.width;
          this.view = { cx: px - nx * nd, cy: py + ny * nd, w };
        } else return;
        schedule();
      });
      const up = e => { pts.delete(e.pointerId); start = { view: { ...this.view }, pts: new Map(pts) }; };
      c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
      c.addEventListener('wheel', e => {
        e.preventDefault(); interact();
        const f = Math.exp(Math.max(-2, Math.min(2, e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0016))));
        const [x, y] = this.toC(e.clientX, e.clientY), v = this.view;
        this.view = { cx: x + (v.cx - x) * f, cy: y + (v.cy - y) * f, w: Math.min(8, Math.max(1e-13, v.w * f)) };
        schedule();
      }, { passive: false });
      c.addEventListener('dblclick', e => { interact(); this.zoomAt(e.clientX, e.clientY, e.shiftKey ? 4 : 0.25); });
      c.addEventListener('keydown', e => {
        const v = this.view, k = e.key, s = v.w * 0.12;
        const moves = { ArrowLeft: [-s, 0], ArrowRight: [s, 0], ArrowUp: [0, s], ArrowDown: [0, -s] };
        if (moves[k]) { e.preventDefault(); interact(); this.setView({ cx: v.cx + moves[k][0], cy: v.cy + moves[k][1], w: v.w }); }
        else if (k === '+' || k === '=') { interact(); this.setView({ ...v, w: v.w / 2 }); }
        else if (k === '-' || k === '_') { interact(); this.setView({ ...v, w: v.w * 2 }); }
      });
    }
  }

  window.MB = { escapeCount, escapeSmooth, PALETTES, lut, paletteFor, colorize, renderTo, tOf, sci, Explorer };
})();
