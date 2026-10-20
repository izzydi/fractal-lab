/* Fractal Lab: σχεδίαση 2D σχημάτων σε καμβά και σε SVG.
   Σχήματα: polygons = [[ [x,y], ... ], ...], segments = [[ [x1,y1], [x2,y2] ], ...], path = [[x,y], ...].
   Οι συντεταγμένες είναι μαθηματικές (ο άξονας y προς τα πάνω). */
(function () {
  function bounds(shapes) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const add = p => { if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0]; if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1]; };
    for (const poly of shapes.polygons || []) for (const p of poly) add(p);
    for (const s of shapes.segments || []) { add(s[0]); add(s[1]); }
    for (const p of shapes.path || []) add(p);
    if (minX === Infinity) return null;
    return { minX, maxX, minY, maxY };
  }
  const len = s => Math.hypot(s[1][0] - s[0][0], s[1][1] - s[0][1]);

  function drawCanvas(canvas, shapes, color, opts = {}) {
    const rect = canvas.getBoundingClientRect(), ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * ratio); canvas.height = Math.round(rect.height * ratio);
    const ctx = canvas.getContext('2d'); ctx.scale(ratio, ratio);
    const b = bounds(shapes); if (!b) return;
    const w = rect.width, h = rect.height, pad = opts.pad ?? 22;
    const scale = Math.min((w - 2 * pad) / Math.max(1e-9, b.maxX - b.minX), (h - 2 * pad) / Math.max(1e-9, b.maxY - b.minY));
    ctx.translate(w / 2, h / 2); ctx.scale(scale, -scale); ctx.translate(-(b.minX + b.maxX) / 2, -(b.minY + b.maxY) / 2);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const polys = shapes.polygons || [];
    if (polys.length) {
      // Μεγαλύτερα σχήματα πιο σκούρα, μικρότερα πιο ανοιχτά, για να φαίνονται τα επίπεδα.
      const areas = polys.map(p => Math.abs(p.reduce((a, q, i) => { const r = p[(i + 1) % p.length]; return a + q[0] * r[1] - r[0] * q[1]; }, 0)) / 2);
      const maxA = Math.max(...areas), minA = Math.min(...areas);
      polys.forEach((poly, i) => {
        ctx.beginPath(); poly.forEach((p, j) => j ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath();
        const t = maxA > minA ? (Math.log(areas[i]) - Math.log(minA)) / (Math.log(maxA) - Math.log(minA)) : 1;
        ctx.globalAlpha = opts.shade === false ? (opts.fillAlpha ?? 0.9) : 0.45 + 0.5 * t;
        ctx.fillStyle = color; ctx.fill();
        ctx.globalAlpha = 1; ctx.strokeStyle = opts.edge ?? 'rgba(31,42,92,.55)'; ctx.lineWidth = (opts.edgeWidth ?? 0.8) / scale; ctx.stroke();
      });
    }
    const segs = shapes.segments || [];
    if (segs.length) {
      ctx.strokeStyle = color;
      if (opts.widthByLength) {
        for (const s of segs) { ctx.beginPath(); ctx.moveTo(s[0][0], s[0][1]); ctx.lineTo(s[1][0], s[1][1]); ctx.lineWidth = Math.max(1 / scale, len(s) * opts.widthByLength); ctx.stroke(); }
      } else {
        ctx.beginPath(); for (const s of segs) { ctx.moveTo(s[0][0], s[0][1]); ctx.lineTo(s[1][0], s[1][1]); }
        ctx.lineWidth = (opts.lineWidth ?? 2.2) / scale; ctx.stroke();
      }
    }
    const path = shapes.path || [];
    if (path.length > 1) {
      ctx.beginPath(); path.forEach((p, j) => j ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
      ctx.strokeStyle = color; ctx.lineWidth = (opts.lineWidth ?? 2) / scale; ctx.stroke();
    }
  }

  function drawSVG(svg, shapes, color, opts = {}) {
    const b = bounds(shapes); if (!b) return;
    const pad = (opts.pad ?? 0.04) * Math.max(b.maxX - b.minX, b.maxY - b.minY);
    const W = b.maxX - b.minX + 2 * pad, H = b.maxY - b.minY + 2 * pad, unit = Math.max(W, H);
    svg.setAttribute('viewBox', (b.minX - pad) + ' ' + (-(b.maxY + pad)) + ' ' + W + ' ' + H);
    const f = v => v.toFixed(4), P = p => f(p[0]) + ' ' + f(-p[1]);
    let html = '';
    for (const poly of shapes.polygons || []) html += '<path d="M' + poly.map(P).join('L') + 'Z" fill="' + (opts.fill ?? color) + '" fill-opacity="' + (opts.fillOpacity ?? 0.85) + '" stroke="' + (opts.edge ?? color) + '" stroke-width="' + f(unit * (opts.edgeWidth ?? 0.004)) + '" stroke-linejoin="round"/>';
    const segs = shapes.segments || [];
    if (segs.length) {
      if (opts.widthByLength) for (const s of segs) html += '<path d="M' + P(s[0]) + 'L' + P(s[1]) + '" stroke="' + color + '" stroke-width="' + f(Math.max(unit * 0.003, len(s) * opts.widthByLength)) + '" stroke-linecap="round"/>';
      else html += '<path d="' + segs.map(s => 'M' + P(s[0]) + 'L' + P(s[1])).join('') + '" fill="none" stroke="' + color + '" stroke-width="' + f(unit * (opts.lineWidth ?? 0.012)) + '" stroke-linecap="round" stroke-linejoin="round"/>';
    }
    const path = shapes.path || [];
    if (path.length > 1) html += '<path d="M' + path.map(P).join('L') + '" fill="none" stroke="' + color + '" stroke-width="' + f(unit * (opts.lineWidth ?? 0.012)) + '" stroke-linecap="round" stroke-linejoin="round"/>';
    svg.innerHTML = html;
  }

  window.FL2D = { bounds, drawCanvas, drawSVG };
})();
