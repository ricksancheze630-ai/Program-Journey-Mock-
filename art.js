// Program Journey: procedural "kid's sketchbook" pencil renderer.
// Every scene is drawn from primitives with a seeded RNG, so a scene looks the same each time you see it.
// The `dread` value (0 to ~1.4) controls degradation: shakier lines, more passes, heavier shading, and things in the corners.
"use strict";

const Sketch = (() => {
  const W = 960, H = 540;
  let ctx, R, D = { jit: 1, passes: 1, dread: 0 };
  let grain = null;

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  const rnd = (a = 0, b = 1) => a + (b - a) * R();
  const pick = arr => arr[Math.floor(R() * arr.length)];

  // ---------- primitives ----------
  const GRAPHITE = a => `rgba(38,34,40,${a})`;
  function ln(x1, y1, x2, y2, o = {}) {
    const passes = o.passes ?? D.passes, j = (o.j ?? 1) * D.jit;
    for (let p = 0; p < passes; p++) {
      const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
      const ov = o.exact ? 0 : rnd(0, 3);
      const sx = x1 - dx / len * ov + rnd(-j, j), sy = y1 - dy / len * ov + rnd(-j, j);
      const ex = x2 + dx / len * ov + rnd(-j, j), ey = y2 + dy / len * ov + rnd(-j, j);
      const bend = rnd(-1, 1) * j * 1.6 + rnd(-1, 1) * len * 0.012;
      const mx = (sx + ex) / 2 + nx * bend, my = (sy + ey) / 2 + ny * bend;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(mx, my, ex, ey);
      ctx.lineWidth = (o.w ?? 1.4) * rnd(.7, 1.15);
      ctx.strokeStyle = o.c ?? GRAPHITE((o.a ?? .78) * rnd(.7, 1));
      ctx.stroke();
    }
  }
  function poly(pts, closed, o) { for (let i = 0; i < pts.length - (closed ? 0 : 1); i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; ln(a[0], a[1], b[0], b[1], o); } }
  function rect(x, y, w, h, o) { poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], true, o); }
  function ell(cx, cy, rx, ry, o = {}) {
    const passes = o.passes ?? D.passes, j = (o.j ?? 1) * D.jit;
    for (let p = 0; p < passes; p++) {
      const ph1 = rnd(0, 6.3), ph2 = rnd(0, 6.3), a0 = rnd(0, 6.3), turn = rnd(1.02, 1.12);
      ctx.beginPath();
      for (let i = 0; i <= 40; i++) {
        const t = a0 + (i / 40) * Math.PI * 2 * turn;
        const k = 1 + (Math.sin(t * 2 + ph1) * .04 + Math.sin(t * 3 + ph2) * .03) * (1 + j * .3);
        const x = cx + Math.cos(t) * rx * k + rnd(-j, j) * .3, y = cy + Math.sin(t) * ry * k + rnd(-j, j) * .3;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.lineWidth = (o.w ?? 1.4) * rnd(.75, 1.1);
      ctx.strokeStyle = o.c ?? GRAPHITE((o.a ?? .78) * rnd(.7, 1));
      ctx.stroke();
    }
  }
  function hatch(x, y, w, h, o = {}) {
    const gap = (o.gap ?? 9) / (1 + D.dread * .6);
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    const dir = o.dir ?? 1;
    for (let k = -h; k < w + h; k += gap * rnd(.8, 1.2)) {
      if (dir > 0) ln(x + k, y + h, x + k + h, y, { w: .8, a: o.a ?? .32, passes: 1, j: .6 });
      else ln(x + k, y, x + k + h, y + h, { w: .8, a: o.a ?? .32, passes: 1, j: .6 });
    }
    ctx.restore();
  }
  function hatchEll(cx, cy, rx, ry, o = {}) {
    ctx.save(); ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.clip();
    hatch(cx - rx, cy - ry, rx * 2, ry * 2, o);
    if (o.cross) hatch(cx - rx, cy - ry, rx * 2, ry * 2, { ...o, dir: -1 });
    ctx.restore();
  }
  function scribble(x, y, w, h, n, o = {}) {
    for (let i = 0; i < n; i++) {
      const sx = x + rnd(0, w), sy = y + rnd(0, h);
      ln(sx, sy, sx + rnd(-w * .3, w * .3), sy + rnd(-h * .3, h * .3), { w: o.w ?? 1, a: o.a ?? .5, passes: 1 });
    }
  }
  function glowDot(x, y, r, color = "rgba(255,206,84,.95)") {
    ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = r * 4; ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  const RED = a => `rgba(196,38,34,${a})`;
  function redSun(x, y, r, bleed = 0) {
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
    for (let k = -r; k < r; k += 3.5) ln(x + k, y + r, x + k + r, y - r, { c: RED(.55), w: 1.2, passes: 1, j: .5 });
    ctx.restore();
    ell(x, y, r, r, { c: RED(.85), w: 1.8 });
    for (let i = 0; i < bleed; i++) { const bx = x + rnd(-r * .8, r * .8); ln(bx, y + r * .7, bx + rnd(-3, 3), y + r + rnd(10, 40), { c: RED(.5), w: 1.6, passes: 1 }); }
  }
  function words(t, x, y, size = 18, a = .7, rot = 0) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot + rnd(-.03, .03));
    ctx.font = `${size}px "Comic Sans MS", "Chalkboard SE", "Bradley Hand", cursive`;
    ctx.fillStyle = GRAPHITE(a); ctx.fillText(t, 0, 0); ctx.restore();
  }

  // ---------- figures ----------
  const HEIGHT = { you: .82, dad: 1.15, mom: 1.04, bro: .6, janitor: 1.12, chef: 1.22, kid: .7 };
  // o: { monster, wrongFace, traits:{eyes,claws,legs,ears,heart}, shade, back, smile }
  function person(x, y, s, kind, o = {}) {
    const Ht = HEIGHT[kind] * 220 * s, hr = Ht * .1;
    const headY = y - Ht + hr, neck = headY + hr, shoulder = neck + Ht * .06, hip = y - Ht * .44;
    const t = o.traits || {}, m = o.monster;
    if (m) {
      // looming shadow around the thing
      hatchEll(x, y - Ht * .55, Ht * .42, Ht * .62, { a: .28, gap: 7, cross: D.dread > .6 });
      ln(x - hr * .6, headY - hr * .6, x - hr * 1.5, headY - hr * 2.2, { w: 2 });
      ln(x + hr * .6, headY - hr * .6, x + hr * 1.5, headY - hr * 2.2, { w: 2 });
    }
    // legs
    const legSpread = Ht * .11;
    if (t.legs || m) {
      for (const sgn of [-1, 1]) poly([[x + sgn * hr * .3, hip], [x + sgn * legSpread * .3, hip + Ht * .2], [x + sgn * legSpread * 1.6, hip + Ht * .27], [x + sgn * legSpread, y]], false, { w: 1.6 });
    } else {
      ln(x - hr * .3, hip, x - legSpread, y, { w: 1.6 }); ln(x + hr * .3, hip, x + legSpread, y, { w: 1.6 });
    }
    // body
    if (kind === "mom") poly([[x, neck], [x - Ht * .14, hip + Ht * .1], [x + Ht * .14, hip + Ht * .1]], true, { w: 1.5 });
    else if (kind === "chef" || kind === "janitor") rect(x - Ht * .1, shoulder - 2, Ht * .2, hip - shoulder + 6, { w: 1.4 });
    else { ln(x, neck, x, hip, { w: 1.7 }); rect(x - Ht * .08, shoulder, Ht * .16, (hip - shoulder) * .95, { w: 1.1, a: .55 }); }
    if (o.shade) hatch(x - Ht * .12, shoulder, Ht * .24, hip - shoulder + 4, { a: Math.min(.5, o.shade * .45), gap: 6 });
    if (t.heart && !o.back) { hatchEll(x - Ht * .02, shoulder + Ht * .07, Ht * .045, Ht * .045, { a: .8, gap: 2.5, cross: true }); }
    // arms
    const armLen = m ? Ht * .55 : Ht * .36;
    const hands = [[x - Ht * .2, shoulder + armLen * .85], [x + Ht * .2, shoulder + armLen * .85]];
    if (o.armsUp) { hands[0] = [x - Ht * .24, headY - hr]; hands[1] = [x + Ht * .24, headY - hr]; }
    if (o.handsDown) { hands[0] = [x - Ht * .07, hip + Ht * .05]; hands[1] = [x + Ht * .07, hip + Ht * .05]; }
    ln(x, shoulder, hands[0][0], hands[0][1], { w: 1.5 }); ln(x, shoulder, hands[1][0], hands[1][1], { w: 1.5 });
    if (t.claws || m) for (const [hx, hy] of hands) for (let c = -1; c <= 1; c++) ln(hx, hy, hx + c * hr * .35, hy + hr * .55, { w: 1.2 });
    // head
    ell(x, headY, hr, hr * 1.05, { w: 1.6 });
    if (t.ears || m) { poly([[x - hr * .9, headY - hr * .2], [x - hr * 1.6, headY - hr * 1.3], [x - hr * .55, headY - hr * .8]], false, { w: 1.3 }); poly([[x + hr * .9, headY - hr * .2], [x + hr * 1.6, headY - hr * 1.3], [x + hr * .55, headY - hr * .8]], false, { w: 1.3 }); }
    // face
    if (!o.back) {
      if (o.wrongFace) {
        scribble(x - hr * .7, headY - hr * .6, hr * 1.4, hr * 1.2, 14, { a: .6 });
        glowDot(x - hr * .1 + rnd(-2, 2), headY - hr * .2, 1.6, "rgba(40,20,20,.9)"); glowDot(x + hr * .55, headY + hr * .1, 1.6, "rgba(40,20,20,.9)");
      } else if (m || t.eyes) {
        glowDot(x - hr * .35, headY - hr * .1, m ? 3 : 2.2); glowDot(x + hr * .35, headY - hr * .1, m ? 3 : 2.2);
        if (m) ln(x - hr * .5, headY + hr * .45, x + hr * .5, headY + hr * .45, { w: 1.2 });
      } else {
        ctx.fillStyle = GRAPHITE(.85);
        ctx.beginPath(); ctx.arc(x - hr * .35, headY - hr * .1, 1.8, 0, 7); ctx.arc(x + hr * .35, headY - hr * .1, 1.8, 0, 7); ctx.fill();
      }
      if (!m && !o.wrongFace) {
        if (o.smile) { ctx.beginPath(); ctx.arc(x, headY + hr * .2, hr * .35, .2, Math.PI - .2); ctx.strokeStyle = GRAPHITE(.7); ctx.lineWidth = 1.2; ctx.stroke(); }
        else ln(x - hr * .25, headY + hr * .45, x + hr * .25, headY + hr * .45, { w: 1, passes: 1 });
      }
    }
    // identifying props (they stay on the monster: that's the clue)
    if (kind === "dad") { ell(x - hr * .38, headY - hr * .1, hr * .3, hr * .24, { w: 1.1, passes: 1 }); ell(x + hr * .38, headY - hr * .1, hr * .3, hr * .24, { w: 1.1, passes: 1 }); if (o.crack) ln(x + hr * .2, headY - hr * .3, x + hr * .55, headY + hr * .05, { w: .8, passes: 1 }); }
    if (kind === "mom") { for (let i = -2; i <= 2; i++) ln(x + i * hr * .3, headY - hr * .9, x + i * hr * .45, headY + hr * 1.6, { w: .9, a: .6, passes: 1 }); rect(hands[1][0] - 6, hands[1][1] - 10, 14, 18, { w: 1.1 }); }
    if (kind === "bro") { ln(x - hr, headY - hr * .5, x + hr * 1.4, headY - hr * .55, { w: 1.5 }); hatch(hands[0][0] - 3, hands[0][1] - 9, 6, 10, { a: .5, gap: 2 }); ell(hands[0][0], hands[0][1] - 11, 3, 3, { c: RED(.8), w: 1.2, passes: 1 }); }
    if (kind === "janitor") {
      rect(x - hr * 1.1, headY - hr * 1.3, hr * 2.2, hr * .6, { w: 1.2 }); // cap
      ln(hands[1][0], hands[1][1], hands[1][0] + 14, y + 4, { w: 1.6 }); scribble(hands[1][0] + 4, y - 14, 22, 18, 10, { a: .6 });
      ell(x - Ht * .08, hip - 4, 7, 7, { w: 1 }); for (let k = 0; k < 4; k++) ln(x - Ht * .08 + rnd(-4, 4), hip + 2, x - Ht * .08 + rnd(-6, 6), hip + 12, { w: .9, passes: 1 });
    }
    if (kind === "chef") {
      rect(x - hr * .9, headY - hr * 3, hr * 1.8, hr * 2.1, { w: 1.3 });
      for (let i = 0; i < 3; i++) ell(x - hr * .6 + i * hr * .6, headY - hr * 3, hr * .5, hr * .4, { w: 1, passes: 1 });
      scribble(x - hr, headY - hr * .8, hr * 2, hr * 1.6, 18, { a: .35 }); // the face stays in the steam
    }
    return { headY, hr, hands, Ht };
  }
  function youOpts(st) {
    const it = st.items || [];
    return { traits: { eyes: it.includes("glasses"), claws: it.includes("gloves"), legs: it.includes("sneakers"), ears: it.includes("seashell"), heart: it.includes("locket") },
      shade: Math.max(0, (10 - st.hum) / 10) };
  }
  function familyRow(st, x, y, s, gap) {
    let i = 0;
    person(x, y, s, "you", youOpts(st));
    for (const k of ["dad", "mom", "bro"]) if (st.withYou(k)) { i++; person(x + gap * i, y + rnd(-3, 3), s, k, { wrongFace: st.has("glasses") }); }
  }

  // ---------- set pieces ----------
  function floorLine(y) { ln(0, y, W, y + rnd(-6, 6), { w: 1.2, a: .6 }); }
  function windowBox(x, y, w, h, o = {}) {
    rect(x, y, w, h); ln(x + w / 2, y, x + w / 2, y + h, { w: 1 }); ln(x, y + h / 2, x + w, y + h / 2, { w: 1 });
    if (o.sun) { ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); redSun(x + w * .5, y + h * .8, Math.min(w, h) * .35, o.bleed || 0); ctx.restore(); }
    if (o.warm) { ctx.fillStyle = "rgba(255,200,90,.18)"; ctx.fillRect(x, y, w, h); }
  }
  function door(x, y, w, h, o = {}) { rect(x, y, w, h); ell(x + w * .8, y + h * .55, 3, 3, { w: 1, passes: 1 }); if (o.dark) hatch(x, y, w, h, { a: .35, gap: 6 }); if (o.ajar) { hatch(x, y, w * .3, h, { a: .7, gap: 3 }); } }
  function stairs(x, y, steps, sw, sh, dir = 1) {
    let cx = x, cy = y;
    for (let i = 0; i < steps; i++) { ln(cx, cy, cx, cy - sh); ln(cx, cy - sh, cx + sw * dir, cy - sh); cx += sw * dir; cy -= sh; }
    ln(x - 10 * dir, y - 60, cx - 10 * dir, cy - 60, { w: 1.8 }); // banister
    for (let i = 0; i <= steps; i += 2) ln(x + i * sw * dir, y - i * sh, x + i * sw * dir - 10 * dir, y - i * sh - 60, { w: 1, a: .55 });
  }
  function tv(x, y, w, h, staticOn) {
    rect(x, y, w, h, { w: 1.8 }); rect(x + 8, y + 8, w - 16, h - 16, { w: 1.1 });
    ln(x + w * .3, y + h, x + w * .2, y + h + 20); ln(x + w * .7, y + h, x + w * .8, y + h + 20);
    if (staticOn) scribble(x + 10, y + 10, w - 20, h - 20, 60, { a: .5, w: .8 });
    else { ln(x + w * .25, y + h * .75, x + w * .45, y + h * .3, { w: 1 }); ln(x + w * .45, y + h * .3, x + w * .65, y + h * .75, { w: 1 }); rect(x + w * .37, y + h * .55, w * .16, h * .2, { w: .8 }); }
  }
  function couch(x, y, w) { rect(x, y - 70, w, 50); rect(x - 20, y - 50, 24, 50); rect(x + w - 4, y - 50, 24, 50); rect(x, y - 30, w, 30); hatch(x, y - 70, w, 50, { a: .18, gap: 12 }); }
  function victorian(cx, base, sc, o = {}) {
    const w = 330 * sc, fh = 95 * sc, x = cx - w / 2;
    for (let f = 0; f < 3; f++) rect(x, base - fh * (f + 1), w, fh, { w: 1.6 });
    poly([[x - 20 * sc, base - fh * 3], [cx - 40 * sc, base - fh * 3 - 110 * sc], [x + w + 20 * sc, base - fh * 3]], false, { w: 1.7 });
    // turret
    const tx = x + w - 70 * sc; rect(tx, base - fh * 3 - 60 * sc, 60 * sc, 60 * sc); poly([[tx - 6 * sc, base - fh * 3 - 60 * sc], [tx + 30 * sc, base - fh * 3 - 140 * sc], [tx + 66 * sc, base - fh * 3 - 60 * sc]], false);
    // brick hint
    for (let i = 0; i < 26; i++) { const bx = x + rnd(5, w - 30), by = base - rnd(5, fh * 3 - 10); ln(bx, by, bx + 16, by, { w: .8, a: .35, passes: 1 }); }
    // porch
    ln(x - 30 * sc, base - fh * .65, x + w * .6, base - fh * .65, { w: 1.4 }); for (let i = 0; i < 6; i++) ln(x - 25 * sc + i * w * .12, base - fh * .65, x - 25 * sc + i * w * .12, base);
    // windows
    for (let f = 0; f < 3; f++) for (let k = 0; k < 4; k++) {
      const wx = x + 25 * sc + k * 75 * sc, wy = base - fh * (f + 1) + 22 * sc;
      if (f === 0 && k === 1) continue;
      windowBox(wx, wy, 44 * sc, 52 * sc, { warm: f === 0 && o.warm });
      if (f === 2 && k === 3 && o.curtain) { hatch(wx + 2, wy + 2, 18 * sc, 48 * sc, { a: .5, gap: 3 }); ell(wx + 32 * sc, wy + 22 * sc, 5 * sc, 6 * sc, { a: .25, w: 1, passes: 1 }); }
    }
    door(x + 25 * sc + 75 * sc, base - 70 * sc, 40 * sc, 70 * sc);
    return { x, w, fh };
  }
  function mountains(y, sun) {
    poly([[0, y], [120, y - 70], [210, y - 30], [330, y - 110], [460, y - 40], [560, y - 90], [700, y - 20], [820, y - 80], [960, y - 30]], false, { w: 1.1, a: .55 });
    if (sun) redSun(sun.x, y - 40, sun.r, sun.bleed || 0);
  }
  function birds(n, x, y) { for (let i = 0; i < n; i++) { const bx = x + rnd(-80, 80), by = y + rnd(-30, 30); ln(bx - 8, by - 4, bx, by, { w: 1, passes: 1 }); ln(bx, by, bx + 8, by - 4, { w: 1, passes: 1 }); } }
  function wallpaperFaces(x, y, w, h, glasses, smileFace) {
    for (let gx = x + 30; gx < x + w - 10; gx += 62) for (let gy = y + 30; gy < y + h - 10; gy += 66) {
      const r = 13; ell(gx, gy, r, r * 1.1, { w: 1, a: .55, passes: 1 });
      ctx.beginPath(); ctx.arc(gx, gy + 3, r * .45, .3, Math.PI - .3); ctx.strokeStyle = GRAPHITE(.5); ctx.lineWidth = 1; ctx.stroke();
      if (glasses) { ell(gx - 5, gy - 3, 4, 3.5, { w: .9, passes: 1, a: .7 }); ell(gx + 5, gy - 3, 4, 3.5, { w: .9, passes: 1, a: .7 }); }
      else { ctx.fillStyle = GRAPHITE(.6); ctx.fillRect(gx - 5, gy - 4, 2, 2); ctx.fillRect(gx + 4, gy - 4, 2, 2); }
      ln(gx - 20, gy + 30, gx + 20, gy + 30, { w: .6, a: .25, passes: 1 });
    }
    if (smileFace) {
      const { fx, fy } = smileFace; ctx.fillStyle = "rgba(239,233,218,.9)"; ctx.fillRect(fx - 26, fy - 30, 52, 60);
      ell(fx, fy, 18, 20, { w: 1.6 }); ctx.beginPath(); ctx.arc(fx, fy + 4, 9, .25, Math.PI - .25); ctx.strokeStyle = GRAPHITE(.8); ctx.lineWidth = 1.4; ctx.stroke();
      glowDot(fx - 6, fy - 5, 1.8, smileFace.glow ? undefined : "rgba(40,30,30,.9)"); glowDot(fx + 6, fy - 5, 1.8, smileFace.glow ? undefined : "rgba(40,30,30,.9)");
    }
  }

  // ---------- corner things: the art itself becomes the horror ----------
  function cornerThings(dread) {
    const corners = [[40, 40], [W - 60, 50], [50, H - 60], [W - 70, H - 70]];
    if (dread > .25) { const [cx, cy] = pick(corners); hatchEll(cx, cy, 40, 30, { a: .45, gap: 3, cross: true }); glowDot(cx - 8, cy, 1.8, "rgba(240,235,220,.95)"); glowDot(cx + 8, cy, 1.8, "rgba(240,235,220,.95)"); }
    if (dread > .5) { const side = R() < .5 ? 0 : W; const fy = rnd(120, H - 160); for (let f = 0; f < 4; f++) { const yy = fy + f * 14; const dx = side ? -1 : 1; poly([[side, yy], [side + dx * rnd(40, 70), yy - 6], [side + dx * rnd(80, 110), yy + 6], [side + dx * rnd(95, 125), yy + 14]], false, { w: 1.3 }); } }
    if (dread > .75) { const fx = R() < .5 ? rnd(60, 160) : rnd(W - 160, W - 60); ctx.save(); ctx.globalAlpha = .55; hatch(fx - 12, H * .18, 24, H * .6, { a: .6, gap: 3 }); ell(fx, H * .16, 14, 18, { w: 1.2 }); ctx.restore(); }
    if (dread > 1.0) { for (let i = 0; i < 5; i++) { const x = rnd(20, W - 20), y = R() < .5 ? rnd(10, 40) : rnd(H - 40, H - 10); ell(x, y, 8, 9, { w: .9, passes: 1, a: .5 }); ell(x - 3, y - 2, 2.5, 2, { w: .7, passes: 1 }); ell(x + 3, y - 2, 2.5, 2, { w: .7, passes: 1 }); } }
  }
  function paper() {
    if (!grain) {
      grain = document.createElement("canvas"); grain.width = W; grain.height = H;
      const g = grain.getContext("2d"), img = g.createImageData(W, H), r = mulberry32(7);
      for (let i = 0; i < img.data.length; i += 4) { const v = 228 + r() * 16; img.data[i] = v + 6; img.data[i + 1] = v + 2; img.data[i + 2] = v - 10; img.data[i + 3] = 255; }
      g.putImageData(img, 0, 0);
    }
    ctx.drawImage(grain, 0, 0);
  }
  function vignette(dread) {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * .3, W / 2, H / 2, W * .65);
    g.addColorStop(0, "rgba(30,24,24,0)"); g.addColorStop(1, `rgba(30,24,24,${.12 + dread * .45})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  // ---------- scenes ----------
  const scenes = {
    exterior(st) {
      mountains(330, { x: 760, r: 34 }); birds(5, 250, 110);
      ln(0, 470, W, 466); for (let i = 0; i < 40; i++) { const gx = rnd(0, W), gy = rnd(475, 530); ln(gx, gy, gx + rnd(-3, 3), gy - rnd(6, 14), { w: .8, passes: 1, a: .5 }); }
      victorian(470, 470, 1, { warm: true, curtain: true });
      ell(120, 360, 50, 80, { a: .6 }); ln(120, 440, 120, 470, { w: 2 }); ell(840, 380, 40, 60, { a: .6 }); ln(840, 440, 840, 470, { w: 2 });
    },
    yard(st) {
      mountains(300, { x: 700, r: 36 - st.chores.length * 3 });
      ln(0, 420, W, 418); rect(60, 150, 220, 270); poly([[50, 150], [170, 70], [290, 150]], true); windowBox(110, 200, 50, 60, { warm: true });
      // trash cans, car, mower
      rect(320, 350, 40, 70); ell(340, 350, 22, 6); rect(370, 360, 36, 60);
      poly([[480, 420], [480, 370], [530, 340], [650, 340], [700, 370], [720, 420]], true); ell(530, 420, 20, 20); ell(680, 420, 20, 20);
      rect(780, 395, 60, 25); ell(790, 420, 8, 8); ell(830, 420, 8, 8); ln(840, 395, 890, 330, { w: 1.6 });
      for (let i = 0; i < 50; i++) { const gx = rnd(0, W), gy = rnd(430, 530); ln(gx, gy, gx + rnd(-3, 3), gy - rnd(5, 14), { w: .8, passes: 1, a: .5 }); }
      person(430, 470, 1, "you", youOpts(st));
    },
    kitchen(st) {
      floorLine(470); rect(80, 330, 800, 30); rect(80, 360, 800, 110); hatch(80, 360, 800, 110, { a: .15, gap: 14 });
      for (let s = 0; s < 2; s++) ln(560, 120 + s * 70, 900, 120 + s * 70, { w: 1.4 });
      // stock on shelves
      for (let i = 0; i < 4; i++) { rect(580 + i * 26, 70, 8, 50); ln(584 + i * 26, 70, 584 + i * 26, 60, { c: "rgba(220,140,40,.8)", w: 1.4, passes: 1 }); }
      rect(700, 80, 50, 40); words("POP", 705, 108, 14); rect(780, 150, 20, 40); rect(810, 150, 20, 40); rect(840, 150, 20, 40);
      rect(600, 150, 70, 40); hatch(600, 150, 70, 40, { a: .3, gap: 5 }); words("COFFEE", 690, 185, 12, .5);
      person(300, 330, 1.05, "chef", {});
      for (let i = 0; i < 6; i++) { const sx = 300 + rnd(-40, 40); ln(sx, 150, sx + rnd(-20, 20), 60, { w: 1, a: .25, passes: 1 }); }
      windowBox(420, 90, 90, 110, { sun: true });
      person(700, 470, .9, "you", youOpts(st));
    },
    couch(st) {
      const night = st.flags.asleep;
      floorLine(470); windowBox(80, 90, 140, 170, { sun: true, bleed: night ? 4 : 0 });
      tv(640, 210, 200, 140, night); ln(620, 370, 860, 370, { w: 1.6 }); rect(630, 370, 220, 100);
      couch(250, 440, 300);
      if (st.flags.movie && !night) { person(300, 420, .75, "dad", { }); person(380, 420, .72, "mom", {}); person(460, 430, .75, "you", youOpts(st)); person(560, 470, .7, "bro", {}); scribble(565, 455, 60, 15, 6, { a: .4 }); }
      else if (night) {
        if (st.withYou("dad") || st.fam.dad === "asleep") person(300, 420, .75, "dad", { wrongFace: st.has("glasses") });
        if (st.withYou("mom")) person(380, 420, .72, "mom", { wrongFace: st.has("glasses") });
        person(470, 470, .8, "you", youOpts(st)); if (st.withYou("bro")) person(530, 470, .7, "bro", { wrongFace: st.has("glasses") });
      }
    },
    closet(st) {
      floorLine(480); rect(250, 40, 460, 440, { w: 2 }); hatch(250, 40, 460, 440, { a: .12 + st.floor * .06, gap: 10 });
      for (let s = 0; s < 3; s++) ln(560, 110 + s * 60, 705, 110 + s * 60);
      scribble(570, 80, 120, 25, 12, { a: .4 }); scribble(570, 140, 120, 25, 12, { a: .4 });
      rect(470, 400, 120, 70); words("LOST & FOUND", 478, 440, 15, .8);
      // contents peeking: whatever hasn't been taken yet
      if (!st.has("glasses")) { ell(500, 395, 9, 7, { w: 1.1 }); ell(522, 395, 9, 7, { w: 1.1 }); }
      if (!st.has("locket") && st.floor >= 3) { ell(560, 392, 6, 7, { c: RED(.7) }); }
      ell(340, 465, 32, 12); rect(310, 440, 60, 25);
      person(400, 480, 1.05, "janitor", { smile: true });
      familyRow(st, 700, 500, .78, 58);
    },
    hall(st) {
      // corridor in one-point perspective
      const vx = 480, vy = 230;
      poly([[0, 0], [vx - 80, vy - 70], [vx + 80, vy - 70], [W, 0]], false, { a: .5 }); poly([[0, H], [vx - 80, vy + 70], [vx + 80, vy + 70], [W, H]], false, { a: .5 });
      rect(vx - 80, vy - 70, 160, 140);
      for (let i = 0; i < 3; i++) { const t = .25 + i * .22; const lx = (vx - 80) * t, rx = W - (W - vx - 80) * t; door(lx, 80 + 120 * t, 60 - 30 * t, 260 - 120 * t, { dark: i === 2 || st.floor > 1 }); door(rx - (60 - 30 * t), 80 + 120 * t, 60 - 30 * t, 260 - 120 * t, { ajar: i === 1 && st.floor > 0 }); }
      if (st.floor >= 2) for (let i = 0; i < 12; i++) { const x = rnd(380, 580), y = rnd(320, 400); ln(x, y, x + rnd(-30, 30), y + rnd(-2, 2), { w: .8, a: .4, passes: 1 }); }
      if (st.floor === 0) windowBox(vx - 30, vy - 40, 60, 60, { sun: true, bleed: 2 });
      familyRow(st, 430, 520, .95, 70);
    },
    dining(st) {
      floorLine(470); rect(160, 300, 620, 30); ln(180, 330, 180, 450, { w: 1.6 }); ln(760, 330, 760, 450, { w: 1.6 });
      for (let i = 0; i < 5; i++) { const px = 230 + i * 120; ell(px, 300, 30, 8, { w: 1.1 }); rect(px - 20, 230, 40, 70, { a: .5 }); }
      words("5", 222, 220, 16, .5); door(820, 170, 100, 300, { dark: true }); ell(840, 320, 8, 10, { w: 1.6 }); rect(810, 450, 40, 20); // pet door
      familyRow(st, 300, 520, .85, 70);
    },
    stairs(st) {
      floorLine(500); stairs(220, 500, 10, 52, 38, 1);
      hatch(0, 0, W, 120, { a: .2 + st.floor * .07, gap: 8 });
      let k = 0; const pos = [[330, 422], [380, 384], [280, 460], [430, 346]];
      person(pos[0][0], pos[0][1], .7, "you", youOpts(st));
      for (const m of ["dad", "mom", "bro"]) if (st.withYou(m)) { k++; person(pos[k][0], pos[k][1], .7, m, { wrongFace: st.has("glasses") }); }
      if (st.has("sneakers")) for (let i = 0; i < 6; i++) { const fx = 250 + i * 40, fy = 495 - i * 30; ell(fx, fy, 6, 3, { a: .7, w: 1, passes: 1 }); }
    },
    momroom(st) {
      floorLine(480); for (let i = 0; i < 40; i++) { const px = rnd(20, W - 60), py = rnd(20, 420); const r = rnd(-.3, .3); ctx.save(); ctx.translate(px, py); ctx.rotate(r); rect(0, 0, 38, 50, { w: .8, a: .55, passes: 1 }); for (let l = 0; l < 4; l++) ln(5, 10 + l * 9, 32, 10 + l * 9, { w: .5, a: .35, passes: 1 }); ctx.restore(); }
      words("ch. 12", 420, 70, 22, .7, -.05); familyRow(st, 380, 520, .9, 75);
    },
    broroom(st) {
      floorLine(480); for (let i = 0; i < 9; i++) for (let j = 0; j < 5; j++) rect(i * 106, j * 90, 104, 88, { w: .8, a: .3 + ((i + j) % 2) * .15, passes: 1 });
      rect(700, 260, 70, 50, { w: 2 }); hatch(700, 260, 70, 50, { a: .8, gap: 3 }); for (let i = 0; i < 4; i++) ln(705, 268 + i * 11, 765, 268 + i * 11, { c: "rgba(230,225,210,.7)", w: 1, passes: 1 });
      ell(300, 470, 10, 10, { c: RED(.8) }); ell(300, 450, 7, 7, { c: RED(.8) });
      words("YOUR TURN", 360, 120, 30, .6, .04); familyRow(st, 420, 520, .9, 70);
    },
    yourroom(st) {
      floorLine(480); rect(80, 330, 260, 80); rect(80, 300, 50, 40); windowBox(420, 80, 120, 140, { sun: true, bleed: 2 });
      rect(700, 120, 140, 240, { w: 2.2 }); hatch(700, 120, 140, 240, { a: .4, gap: 5 }); words("(back of mirror)", 705, 380, 13, .45);
      familyRow(st, 420, 520, .9, 70);
    },
    laundry(st) {
      rect(80, 200, 140, 160); ell(150, 280, 45, 45); rect(260, 200, 140, 160); ell(330, 280, 45, 45);
      if (st.flags.dryerEyes) { glowDot(318, 280, 2.2); glowDot(342, 280, 2.2); }
      for (let r = 0; r < 7; r++) { const y = 340 + r * 28; ctx.beginPath(); for (let x = 0; x <= W; x += 20) { const yy = y + Math.sin(x / 40 + r) * 5 + rnd(-1.5, 1.5); x ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); } ctx.strokeStyle = GRAPHITE(.5); ctx.lineWidth = 1.1; ctx.stroke(); }
      for (let i = 0; i < 5; i++) { const sx = rnd(450, 900), sy = rnd(360, 500); poly([[sx, sy], [sx + 14, sy], [sx + 14, sy + 10], [sx + 24, sy + 14]], false, { w: 1.1, passes: 1 }); }
      hatchEll(700, 420, 70, 18, { a: .4, gap: 4 });
      stairs(760, 340, 4, 40, 40, 1);
      person(560, 470, .8, "you", youOpts(st)); let i = 0; for (const m of ["dad", "mom", "bro"]) if (st.withYou(m)) { i++; person(560 - i * 70, 470, .8, m, { wrongFace: st.has("glasses") }); }
    },
    wallpaper(st) { wallpaperFaces(0, 0, W, H - 70, true); floorLine(H - 70); familyRow(st, 420, 520, .85, 70); },
    billiards(st) {
      ln(480, 0, 480, 110, { w: 1.2 }); poly([[400, 150], [440, 110], [520, 110], [560, 150]], true); ctx.fillStyle = "rgba(255,210,110,.14)"; ctx.beginPath(); ctx.moveTo(400, 150); ctx.lineTo(260, 400); ctx.lineTo(700, 400); ctx.lineTo(560, 150); ctx.fill();
      rect(220, 300, 520, 140, { w: 2 }); rect(240, 314, 480, 112, { w: 1 }); ln(240, 440, 240, 500, { w: 2 }); ln(720, 440, 720, 500, { w: 2 });
      for (let i = 0; i < 6; i++) ell(560 + (i % 3) * 18, 350 + Math.floor(i / 3) * 18, 8, 8, { w: 1 }); ell(330, 370, 9, 9, { w: 1.6 }); glowDot(330, 370, 2, "rgba(40,30,30,.9)");
      ctx.save(); ctx.globalAlpha = .5; hatchEll(160, 260, 90, 220, { a: .55, gap: 4, cross: true }); ctx.restore();
      rect(800, 80, 120, 160, { w: 1.8 }); words("bar", 840, 260, 14, .5);
      familyRow(st, 820, 520, .8, -70);
    },
    mirror(st) {
      ell(480, 260, 170, 220, { w: 2.4 }); ell(480, 260, 182, 232, { w: 1.2, a: .5 });
      ctx.save(); ctx.beginPath(); ctx.ellipse(480, 260, 165, 215, 0, 0, Math.PI * 2); ctx.clip();
      hatch(300, 40, 360, 440, { a: .1 + (14 - st.hum) * .022, gap: 6 });
      if (st.hum <= 2) { /* only the hallway */ poly([[330, 470], [430, 220], [530, 220], [630, 470]], false, { a: .5 }); }
      else { const o = youOpts(st); o.traits.eyes = o.traits.eyes || st.hum < 9; o.traits.ears = o.traits.ears || st.hum < 6; o.traits.claws = o.traits.claws || st.hum < 4; person(480, 470, 1.45, "you", { ...o, shade: (14 - st.hum) / 9, smile: st.hum < 6 }); }
      ctx.restore();
    },
    fight(st) {
      const f = st.fight; floorLine(480);
      hatch(0, 0, W, H, { a: .12 + D.dread * .1, gap: 10 });
      if (f && f.done === "saved") { person(560, 470, 1.25, f.who, { crack: f.who === "dad" }); person(300, 480, 1.15, "you", { ...youOpts(st), handsDown: true }); return; }
      if (f && f.done === "gone") { const dx = 560, dy = 470; scribble(dx - 80, dy - 20, 160, 26, 40, { a: .55 }); dropDoodle(f.who, dx, dy - 8); person(300, 480, 1.15, "you", { ...youOpts(st), back: false }); return; }
      if (f && f.done === "fled") { door(700, 150, 120, 330, { ajar: true }); person(300, 480, 1.15, "you", youOpts(st)); return; }
      person(580, 470, 1.25, f ? f.who : "dad", { monster: true, crack: f && f.who === "dad", armsUp: f && f.cower });
      person(280, 490, 1.15, "you", { ...youOpts(st), back: true, handsDown: f && f.lowered });
    },
    roof(st) {
      mountains(380, { x: 480, r: 80, bleed: 0 });
      poly([[0, 540], [300, 420], [960, 420], [960, 540]], true, { w: 1.8 }); for (let i = 0; i < 10; i++) ln(60 + i * 90, 540, 300 + i * 66, 420, { w: .7, a: .35, passes: 1 });
      rect(80, 300, 90, 130, { w: 2 }); door(95, 320, 60, 110, { dark: true });
      familyRow(st, 420, 500, .95, 75);
    },
    // endings
    end_golden(st) {
      floorLine(470); windowBox(80, 90, 140, 170, { warm: true }); ctx.save(); ctx.beginPath(); ctx.rect(80, 90, 140, 170); ctx.clip(); ell(150, 240, 40, 40, { c: "rgba(230,140,40,.8)" }); ctx.restore();
      tv(640, 210, 200, 140, false); words("THE END", 690, 290, 18, .7); couch(250, 440, 300);
      person(300, 420, .75, "dad", { smile: true }); person(380, 420, .72, "mom", { smile: true }); person(460, 430, .75, "you", { smile: true }); person(560, 470, .7, "bro", { smile: true });
      rect(300, 470, 260, 20); ell(410, 462, 12, 9, { w: 1.4 }); ell(438, 462, 12, 9, { w: 1.4 }); ln(422, 462, 426, 462, { w: 1 });
    },
    end_door(st) {
      wallpaperFaces(0, 0, W, 300, false, { fx: 700, fy: 150 }); floorLine(470); ln(0, 300, W, 300, { w: 1.5 });
      couch(250, 440, 300); tv(640, 320, 160, 110, false);
      person(300, 420, .75, "dad", {}); person(380, 420, .7, "mom", {}); person(460, 430, .62, "kid", {}); words("next movie night", 40, 520, 16, .55);
    },
    end_full(st) {
      mountains(380, { x: 480, r: 80, bleed: 6 });
      poly([[0, 540], [300, 420], [960, 420], [960, 540]], true, { w: 1.8 });
      person(560, 480, 1.1, "you", { ...youOpts({ ...st, items: ["glasses", "gloves", "sneakers", "seashell", "locket"] }), shade: 1, back: true });
      const drops = st.drops; drops.forEach((d, i) => dropDoodle(d, 420 - i * 60, 500));
    },
    end_house(st) { wallpaperFaces(0, 0, W, H, true, { fx: 480, fy: 260, glow: true }); },
    end_sundown(st) { ctx.fillStyle = "rgba(20,16,18,.92)"; ctx.fillRect(0, 0, W, H); for (let i = 0; i < 6; i++) { glowDot(rnd(100, 860), rnd(80, 460), 2, "rgba(240,235,220,.9)"); } words("click.", 440, 290, 26, .9); ctx.fillStyle = "rgba(240,235,220,.7)"; ctx.fillText("click.", 440, 290); },
    end_dryer(st) { rect(330, 80, 300, 380, { w: 2.2 }); ell(480, 260, 110, 110, { w: 2.2 }); ell(480, 260, 92, 92, { w: 1.2 }); hatchEll(480, 260, 90, 90, { a: .5, gap: 4 }); glowDot(458, 255, 3); glowDot(500, 255, 3); words("DELICATE", 510, 120, 16, .7); ell(560, 110, 18, 18); ln(560, 110, 570, 96); },
    end_blanket(st) { floorLine(470); couch(250, 440, 380); poly([[230, 400], [330, 300], [500, 290], [650, 330], [650, 410]], true, { w: 1.6 }); hatch(240, 300, 410, 110, { a: .25, gap: 7 }); person(760, 470, 1.05, "janitor", { smile: true }); },
    end_voice(st) { stairs(200, 520, 6, 60, 50, 1); door(620, 100, 140, 260, { ajar: true }); ctx.save(); ctx.beginPath(); ctx.rect(560, 280, 120, 200); ctx.clip(); ell(600, 380, 30, 34, { w: 1.5 }); for (let i = 0; i < 9; i++) ln(580 + i * 5, 392, 580 + i * 5, 400, { w: 1, passes: 1 }); ctx.restore(); },
  };
  function dropDoodle(k, x, y) {
    if (k === "dad") { ell(x - 12, y, 10, 8, { w: 1.4 }); ell(x + 12, y, 10, 8, { w: 1.4 }); ln(x - 2, y, x + 2, y, { w: 1 }); ln(x + 6, y - 6, x + 18, y + 6, { w: .8 }); }
    if (k === "mom") { rect(x - 6, y - 22, 12, 34, { w: 1.2 }); ln(x, y + 12, x - 6, y + 22, { w: 1 }); ln(x, y + 12, x + 6, y + 22, { w: 1 }); }
    if (k === "bro") { ell(x, y - 10, 6, 6, { c: RED(.85), w: 1.4 }); poly([[x - 7, y + 8], [x - 4, y - 4], [x + 4, y - 4], [x + 7, y + 8]], true, { c: RED(.85), w: 1.4 }); }
  }

  function render(canvas, sceneKey, st, seedStr, wobble = 0) {
    ctx = canvas.getContext("2d");
    D.dread = st.dread();
    D.jit = .7 + D.dread * 3.6;
    D.passes = 1 + Math.round(D.dread * 1.6);
    R = mulberry32(hash(seedStr) + wobble);
    ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round";
    paper();
    (scenes[sceneKey] || scenes.hall)(st);
    if (!sceneKey.startsWith("end_") && sceneKey !== "exterior" && sceneKey !== "yard" && sceneKey !== "kitchen") cornerThings(D.dread);
    vignette(D.dread);
    ctx.restore();
  }
  return { render, W, H };
})();
