/* Fractal Lab: ο Mandelbulb με ray marching στην κάρτα γραφικών (WebGL).
   MBB.escapeCount3 : ίδιος κανόνας με τον κώδικα Python, για ένα σημείο του χώρου
   MBB.Renderer     : σχεδιάζει τον Mandelbulb σε έναν καμβά
   MBB.Explorer     : περιστροφή, zoom, ζωντανή δύναμη, προσαρμογή ανάλυσης */
(function () {
  'use strict';

  // Όπως στην Python: v = 0, v = vⁿ + c, σταματάμε όταν |v| > 2.
  function escapeCount3(cx, cy, cz, n, maxIter) {
    let x = 0, y = 0, z = 0;
    for (let i = 0; i < maxIter; i++) {
      const r = Math.sqrt(x * x + y * y + z * z);
      if (r === 0) { x = 0; y = 0; z = 0; }
      else {
        const th = Math.acos(z / r) * n, ph = Math.atan2(y, x) * n, rn = Math.pow(r, n);
        x = rn * Math.sin(th) * Math.cos(ph); y = rn * Math.sin(th) * Math.sin(ph); z = rn * Math.cos(th);
      }
      x += cx; y += cy; z += cz;
      if (x * x + y * y + z * z > 4) return i;
    }
    return maxIter;
  }

  // Παλέτες: τρία χρώματα που αναμειγνύονται με βάση την «τροχιά» κάθε σημείου.
  const PALETTES = {
    coral:  { name: 'Κοράλλι', A: [0.10, 0.20, 0.30], B: [0.02, 0.10, 0.30], C: [0.30, 0.10, 0.02], mode: 0, swatch: ['#1a3350', '#0d2a5c', '#7a3510'] },
    lava:   { name: 'Λάβα', A: [0.30, 0.04, 0.02], B: [0.08, 0.01, 0.01], C: [0.95, 0.50, 0.08], mode: 0, swatch: ['#5a0c06', '#1c0303', '#f08a1c'] },
    ice:    { name: 'Πάγος', A: [0.35, 0.55, 0.70], B: [0.08, 0.22, 0.45], C: [0.85, 0.92, 1.00], mode: 0, swatch: ['#7fa7c8', '#1d4a80', '#e8f2ff'] },
    gold:   { name: 'Χρυσός', A: [0.45, 0.30, 0.06], B: [0.16, 0.08, 0.02], C: [0.95, 0.80, 0.40], mode: 0, swatch: ['#8a5a14', '#33180a', '#f5d27a'] },
    rainbow:{ name: 'Ιριδίζον', A: [0, 0, 0], B: [0, 0, 0], C: [0, 0, 0], mode: 1, swatch: ['#ff5a7a', '#ffd84d', '#3fd0ff', '#a070ff'] }
  };

  const VS = 'attribute vec2 aPos; void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }';
  const FS = `
precision highp float;
uniform vec2 uRes;
uniform vec3 uCamPos, uCamRight, uCamUp, uCamFwd;
uniform float uFL, uPower, uSliceOn, uSlice, uShadows, uMode;
uniform int uIter;
uniform vec3 uPalA, uPalB, uPalC;

// Εκτιμητής απόστασης του Mandelbulb: d ≈ 0,5 · r · ln r / |dr|.
float bulb(vec3 p, out vec4 trap) {
  vec3 w = p; float m = dot(w, w), dz = 1.0;
  trap = vec4(abs(w), m);
  for (int i = 0; i < 16; i++) {
    if (i >= uIter) break;
    float r = max(sqrt(m), 1e-6);
    float th = acos(clamp(w.z / r, -1.0, 1.0)) * uPower;
    float ph = atan(w.y, w.x) * uPower;
    dz = uPower * pow(r, uPower - 1.0) * dz + 1.0;
    w = p + pow(r, uPower) * vec3(sin(th) * cos(ph), sin(th) * sin(ph), cos(th));
    trap = min(trap, vec4(abs(w), m));
    m = dot(w, w);
    if (m > 256.0) break;
  }
  return 0.25 * log(m) * sqrt(m) / dz;
}
// Με την «τομή»: ό,τι είναι πάνω από το επίπεδο z = uSlice αφαιρείται.
float map(vec3 p, out vec4 trap, out float cut) {
  float d = bulb(p, trap); cut = 0.0;
  if (uSliceOn > 0.5) { float s = p.z - uSlice; if (s > d) { d = s; cut = 1.0; } }
  return d;
}
float mapD(vec3 p) { vec4 t; float c; return map(p, t, c); }
vec3 normalAt(vec3 p, float e) {
  vec2 k = vec2(1.0, -1.0);
  return normalize(k.xyy * mapD(p + k.xyy * e) + k.yyx * mapD(p + k.yyx * e) + k.yxy * mapD(p + k.yxy * e) + k.xxx * mapD(p + k.xxx * e));
}
float softShadow(vec3 ro, vec3 rd) {
  float res = 1.0, t = 0.004;
  for (int i = 0; i < 40; i++) {
    float h = mapD(ro + rd * t);
    res = min(res, 10.0 * h / t);
    if (res < 0.002) break;
    t += clamp(h, 0.004, 0.12);
    if (t > 2.5) break;
  }
  return clamp(res, 0.0, 1.0);
}
float occlusion(vec3 p, vec3 n) {
  float occ = 0.0, sca = 1.0;
  for (int i = 0; i < 5; i++) { float h = 0.008 + 0.05 * float(i); occ += (h - mapD(p + n * h)) * sca; sca *= 0.7; }
  return clamp(1.0 - 2.6 * occ, 0.0, 1.0);
}
vec3 surfaceColor(vec4 trap, float cut) {
  vec3 col;
  if (uMode > 0.5) col = 0.55 + 0.45 * cos(6.2832 * (vec3(0.0, 0.33, 0.67) + trap.w * 0.9 + trap.x * 0.35));
  else {
    col = vec3(0.01);
    col = mix(col, uPalA, clamp(trap.y, 0.0, 1.0));
    col = mix(col, uPalB, clamp(trap.z * trap.z, 0.0, 1.0));
    col = mix(col, uPalC, clamp(pow(trap.w, 6.0), 0.0, 1.0));
    col *= 0.9;
  }
  // Η επιφάνεια της τομής: χρώμα από την τροχιά κάθε εσωτερικού σημείου.
  if (cut > 0.5) {
    float k = clamp(sqrt(trap.w) * 1.15, 0.0, 1.0);
    vec3 inner = uMode > 0.5 ? 0.5 + 0.4 * cos(6.2832 * (vec3(0.0, 0.33, 0.67) + k * 1.3))
                             : mix(uPalB * 1.8 + 0.03, uPalC * 1.25 + 0.06, k);
    col = inner * 0.5;
  }
  return col;
}
void main() {
  vec2 uv = (2.0 * gl_FragCoord.xy - uRes) / uRes.y;
  vec3 ro = uCamPos, rd = normalize(uCamFwd * uFL + uv.x * uCamRight + uv.y * uCamUp);
  // Φόντο: σκούρο, με απαλή λάμψη στο κέντρο.
  vec3 bg = mix(vec3(0.002, 0.003, 0.008), vec3(0.02, 0.028, 0.07), clamp(1.0 - 0.5 * length(uv), 0.0, 1.0));
  vec3 col = bg;
  // Η ακτίνα μπαίνει στη σφαίρα ακτίνας 1,25 που περικλείει τον Mandelbulb;
  float b = dot(ro, rd), c = dot(ro, ro) - 1.5625, h = b * b - c;
  float glow = 0.0;
  if (h > 0.0) {
    h = sqrt(h);
    float t = max(-b - h, 0.0), tmax = -b + h, pix = 1.2 / (uRes.y * uFL);
    vec4 trap; float cut = 0.0; bool hit = false; float steps = 0.0;
    for (int i = 0; i < 180; i++) {
      vec3 p = ro + rd * t;
      float d = map(p, trap, cut);
      float eps = max(0.00025, pix * t);
      if (d < eps) { hit = true; break; }
      t += d; steps += 1.0;
      if (t > tmax) break;
    }
    glow = steps / 180.0;
    if (hit) {
      vec3 p = ro + rd * t;
      float eps = max(0.00025, pix * t);
      vec3 n = normalAt(p, eps * 0.5);
      vec3 lig = normalize(0.62 * uCamRight + 0.72 * uCamUp - 0.32 * uCamFwd);
      vec3 hal = normalize(lig - rd);
      float dif = clamp(dot(n, lig), 0.0, 1.0);
      float sha = (uShadows > 0.5 && dif > 0.0) ? softShadow(p + n * eps * 2.0, lig) : 1.0;
      float occ = occlusion(p, n) * (1.0 - 0.6 * glow);
      float sky = 0.55 + 0.45 * dot(n, uCamUp);
      float bac = clamp(0.5 - 0.5 * dot(n, lig), 0.0, 1.0);
      float fre = pow(clamp(1.0 + dot(rd, n), 0.0, 1.0), 3.0);
      float spe = pow(clamp(dot(n, hal), 0.0, 1.0), 40.0) * dif * sha;
      vec3 base = surfaceColor(trap, cut);
      vec3 lin = 4.3 * vec3(1.00, 0.88, 0.74) * dif * sha
               + 1.2 * vec3(0.32, 0.42, 0.62) * sky * occ
               + 0.5 * vec3(0.45, 0.32, 0.28) * bac * occ
               + 2.0 * vec3(0.50, 0.65, 1.00) * fre * occ;
      col = base * lin + 2.2 * vec3(1.0, 0.92, 0.8) * spe;
      col = mix(col, bg, 1.0 - exp(-0.02 * t * t));
    } else {
      col += vec3(0.25, 0.35, 0.75) * pow(glow, 2.2) * 0.9;
    }
  }
  col = 1.0 - exp(-1.6 * col);               // απαλό «tone mapping»
  col = pow(col, vec3(0.4545));              // διόρθωση gamma
  col = mix(col, col * col * (3.0 - 2.0 * col), 0.35); // λίγο περισσότερη αντίθεση
  col *= 1.0 - 0.25 * dot(uv * 0.5, uv * 0.5); // βινιέτα
  gl_FragColor = vec4(col, 1.0);
}`;

  class Renderer {
    constructor(canvas) {
      this.canvas = canvas;
      const gl = canvas.getContext('webgl', { antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' }) ||
                 canvas.getContext('experimental-webgl', { preserveDrawingBuffer: true });
      if (!gl) throw new Error('no-webgl');
      this.gl = gl;
      // Αν η κάρτα γραφικών «χάσει» τον καμβά, δείχνουμε την έτοιμη εικόνα.
      canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); const x = canvas.closest('.xp'); if (x) x.classList.add('no-gl'); });
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
      const pr = gl.createProgram();
      gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
      gl.useProgram(pr); this.pr = pr;
      const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(pr, 'aPos'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      this.u = {};
      for (const n of ['uRes', 'uCamPos', 'uCamRight', 'uCamUp', 'uCamFwd', 'uFL', 'uPower', 'uSliceOn', 'uSlice', 'uShadows', 'uMode', 'uIter', 'uPalA', 'uPalB', 'uPalC']) this.u[n] = gl.getUniformLocation(pr, n);
    }
    // Κάμερα σε τροχιά γύρω από την αρχή, με τον άξονα z προς τα πάνω.
    static camera(s) {
      const dist = Math.max(1.45, 3.3 / s.zoom), fl = 1.75 * Math.max(1, s.zoom * 1.45 / 3.3);
      const cp = Math.cos(s.pitch), pos = [dist * cp * Math.cos(s.yaw), dist * cp * Math.sin(s.yaw), dist * Math.sin(s.pitch)];
      const fwd = pos.map(v => -v / dist), up0 = [0, 0, 1];
      let right = [fwd[1] * up0[2] - fwd[2] * up0[1], fwd[2] * up0[0] - fwd[0] * up0[2], fwd[0] * up0[1] - fwd[1] * up0[0]];
      const rl = Math.hypot(...right) || 1; right = right.map(v => v / rl);
      const up = [right[1] * fwd[2] - right[2] * fwd[1], right[2] * fwd[0] - right[0] * fwd[2], right[0] * fwd[1] - right[1] * fwd[0]];
      return { pos, fwd, right, up, fl };
    }
    draw(s, w, h) {
      const gl = this.gl, u = this.u, c = Renderer.camera(s), p = PALETTES[s.palette] || PALETTES.coral;
      if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
      gl.viewport(0, 0, w, h);
      gl.uniform2f(u.uRes, w, h);
      gl.uniform3fv(u.uCamPos, c.pos); gl.uniform3fv(u.uCamRight, c.right); gl.uniform3fv(u.uCamUp, c.up); gl.uniform3fv(u.uCamFwd, c.fwd);
      gl.uniform1f(u.uFL, c.fl); gl.uniform1f(u.uPower, s.power); gl.uniform1i(u.uIter, s.iter);
      gl.uniform1f(u.uSliceOn, s.sliceOn ? 1 : 0); gl.uniform1f(u.uSlice, s.slice); gl.uniform1f(u.uShadows, s.shadows ? 1 : 0);
      gl.uniform1f(u.uMode, p.mode); gl.uniform3fv(u.uPalA, p.A); gl.uniform3fv(u.uPalB, p.B); gl.uniform3fv(u.uPalC, p.C);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    // Μια «φωτογραφία» σε έναν άλλον καμβά (για τα σχέδια της σελίδας).
    snapshot(s, target) {
      const w0 = this.canvas.width, h0 = this.canvas.height;
      this.draw(s, target.width, target.height);
      target.getContext('2d').drawImage(this.canvas, 0, 0);
      this.canvas.width = w0; this.canvas.height = h0;
    }
  }

  const SCALES = [0.35, 0.5, 0.65, 0.8, 1];

  class Explorer {
    constructor(el, renderer) {
      this.el = el; this.r = renderer; this.canvas = renderer.canvas;
      this.s = { yaw: 0.75, pitch: 0.38, zoom: 1.3, power: 8, iter: 9, palette: 'coral', sliceOn: false, slice: 0, shadows: true };
      this.autoRotate = true; this.animate = false; this.phase = 0; this.dragging = false;
      this.q = 2; this.frames = 0; this.fpsT = performance.now(); this.fps = 0; this.lastMove = 0; this.still = false;
      this.dirty = true; this.onPower = null;
      this.bind();
      this.loop = this.loop.bind(this); this.prev = performance.now();
      requestAnimationFrame(this.loop);
    }
    set(patch) { Object.assign(this.s, patch); this.dirty = true; this.still = false; this.lastMove = performance.now(); }
    moving() { return this.autoRotate && !this.dragging || this.animate || this.dragging || performance.now() - this.lastMove < 250; }
    size(scale) {
      const r = this.canvas.getBoundingClientRect(), ratio = Math.min(window.devicePixelRatio || 1, 1.25) * scale;
      return [Math.max(2, Math.round(r.width * ratio)), Math.max(2, Math.round(r.height * ratio))];
    }
    loop(now) {
      const dt = Math.min(0.1, (now - this.prev) / 1000); this.prev = now;
      if (this.autoRotate && !this.dragging) { this.s.yaw += dt * 0.16; this.dirty = true; }
      if (this.animate) {
        this.phase += dt * 0.42; this.s.power = 5 - 3 * Math.cos(this.phase); this.dirty = true;
        if (this.onPower) this.onPower(this.s.power);
      }
      if (this.dirty) {
        const mv = this.moving();
        if (mv) {
          const [w, h] = this.size(SCALES[this.q]);
          this.r.draw({ ...this.s, shadows: this.s.shadows && this.q >= 3 }, w, h);
          this.still = false; this.frames++;
        } else if (!this.still) {
          // Όταν όλα σταματήσουν, ένα καρέ σε πλήρη ανάλυση και με σκιές.
          const [w, h] = this.size(1); this.r.draw(this.s, w, h); this.still = true;
        }
        this.dirty = mv;
      }
      // Προσαρμογή ανάλυσης ανάλογα με τα καρέ ανά δευτερόλεπτο.
      if (now - this.fpsT > 1000) {
        this.fps = this.frames * 1000 / (now - this.fpsT); this.frames = 0; this.fpsT = now;
        if (this.moving()) {
          if (this.fps < 24 && this.q > 0) this.q--;
          else if (this.fps > 55 && this.q < SCALES.length - 1) this.q++;
        }
        this.hud();
      }
      requestAnimationFrame(this.loop);
    }
    hud() {
      const e = this.el, s = this.s;
      if (e.power) e.power.textContent = 'n = ' + s.power.toFixed(1).replace('.', ',');
      if (e.iter) e.iter.textContent = s.iter + ' επαναλήψεις';
      if (e.res) e.res.textContent = this.moving() ? 'ανάλυση ' + Math.round(SCALES[this.q] * 100) + '% · ' + Math.round(this.fps) + ' καρέ/δευτ.' : 'πλήρης ανάλυση';
    }
    bind() {
      const c = this.canvas, pts = new Map();
      let start = null;
      const touch = () => { this.lastMove = performance.now(); this.dirty = true; this.still = false; if (this.el.hint) this.el.hint.classList.add('gone'); };
      c.addEventListener('pointerdown', e => { c.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); this.dragging = true; start = { s: { ...this.s }, pts: new Map(pts) }; touch(); });
      c.addEventListener('pointermove', e => {
        if (!pts.has(e.pointerId)) return;
        pts.set(e.pointerId, [e.clientX, e.clientY]);
        const st = start;
        if (pts.size === 1 && st.pts.size === 1) {
          const [x0, y0] = [...st.pts.values()][0], k = 0.0065 / Math.sqrt(Math.max(1, this.s.zoom));
          this.s.yaw = st.s.yaw - (e.clientX - x0) * k;
          this.s.pitch = Math.max(-1.5, Math.min(1.5, st.s.pitch + (e.clientY - y0) * k));
        } else if (pts.size === 2 && st.pts.size === 2) {
          const [a0, b0] = [...st.pts.values()], [a1, b1] = [...pts.values()];
          const f = Math.hypot(a1[0] - b1[0], a1[1] - b1[1]) / (Math.hypot(a0[0] - b0[0], a0[1] - b0[1]) || 1);
          this.s.zoom = Math.max(0.6, Math.min(40, st.s.zoom * f));
        }
        touch();
      });
      const up = e => { pts.delete(e.pointerId); this.dragging = pts.size > 0; start = { s: { ...this.s }, pts: new Map(pts) }; touch(); };
      c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
      c.addEventListener('wheel', e => { e.preventDefault(); this.s.zoom = Math.max(0.6, Math.min(40, this.s.zoom * Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.04 : 0.0012)))); touch(); }, { passive: false });
      c.addEventListener('dblclick', e => { this.s.zoom = Math.max(0.6, Math.min(40, this.s.zoom * (e.shiftKey ? 1 / 1.8 : 1.8))); touch(); });
      c.addEventListener('keydown', e => {
        const s = this.s, k = e.key;
        if (k === 'ArrowLeft') s.yaw += 0.12; else if (k === 'ArrowRight') s.yaw -= 0.12;
        else if (k === 'ArrowUp') s.pitch = Math.min(1.5, s.pitch + 0.1); else if (k === 'ArrowDown') s.pitch = Math.max(-1.5, s.pitch - 0.1);
        else if (k === '+' || k === '=') s.zoom = Math.min(40, s.zoom * 1.25); else if (k === '-' || k === '_') s.zoom = Math.max(0.6, s.zoom / 1.25);
        else return;
        e.preventDefault(); touch();
      });
      new ResizeObserver(() => { this.dirty = true; this.still = false; }).observe(c);
    }
    // Εικόνα σε υψηλή ανάλυση για αποθήκευση.
    shot(name) {
      const r = this.canvas.getBoundingClientRect(), k = Math.min(1.5, 1800 / r.width);
      this.r.draw(this.s, Math.round(r.width * k), Math.round(r.height * k));
      this.canvas.toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); });
      this.dirty = true; this.still = false;
    }
  }

  window.MBB = { escapeCount3, PALETTES, Renderer, Explorer };
})();
