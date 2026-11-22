// render.js - pretty static scenery, painted once per hole into an offscreen canvas.
// Pure looks: gameplay still only cares about the rects in courses.js.

function seededRandom(seed) {                       // mulberry32: same hole, same trees
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LAYER_SCALE = 2;                              // layers are 2x so the perspective ground stays crisp

function newLayer() {
  const c = document.createElement("canvas");
  c.width = W * LAYER_SCALE; c.height = H * LAYER_SCALE;
  const ctx = c.getContext("2d");
  ctx.scale(LAYER_SCALE, LAYER_SCALE);               // everything below still draws in 800x500 units
  return [c, ctx];
}

function blob(ctx, rx, ry, w, h, r, color) {     // rounded rect helper
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.roundRect(rx, ry, w, h, r); ctx.fill();
}

function strokePath(ctx, path, width, color) {
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = ctx.lineCap = "round";
  ctx.beginPath();
  path.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
}

function paintRough(ctx, rand) {
  ctx.fillStyle = "#3b7a2e"; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 3000; i++) {
    ctx.fillStyle = i % 2 ? "rgba(15,55,15,.22)" : "rgba(130,200,90,.14)";
    ctx.fillRect(rand() * W, rand() * H, 1 + rand() * 2, 2 + rand() * 3);
  }
}

function paintFairway(ctx, path) {
  strokePath(ctx, path, 150, "#4b9a3a");            // first cut
  const [fc, fx] = newLayer();
  strokePath(fx, path, 120, "#69b84f");
  fx.globalCompositeOperation = "source-atop";      // mowing stripes only where fairway exists
  for (let i = 0, x = -H; x < W; x += 36, i++) {
    fx.fillStyle = i & 1 ? "rgba(255,255,255,.09)" : "rgba(0,0,0,.07)";
    fx.beginPath(); fx.moveTo(x, 0); fx.lineTo(x + 36, 0); fx.lineTo(x + 36 - H, H); fx.lineTo(x - H, H); fx.fill();
  }
  ctx.drawImage(fc, 0, 0, W, H);
}

function paintTeeBox(ctx, [tx, ty], [cx, cy]) {
  ctx.save(); ctx.translate(tx, ty); ctx.rotate(Math.atan2(cy - ty, cx - tx));
  blob(ctx, -38, -26, 76, 52, 8, "#86d36a");
  ctx.fillStyle = "#e63946";
  [-16, 16].forEach(dy => { ctx.beginPath(); ctx.arc(-26, dy, 3.5, 0, 7); ctx.fill(); });   // tee markers
  ctx.restore();
}

function paintGreen(ctx, [cx, cy], cupR) {
  ctx.fillStyle = "#58b04a"; ctx.beginPath(); ctx.arc(cx, cy, 72, 0, 7); ctx.fill();      // fringe
  for (let r = 60, i = 0; r > 4; r -= 7, i++) {                                           // mown rings
    ctx.fillStyle = i & 1 ? "#72cd62" : "#7ad66a";
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
  }
  ctx.fillStyle = "#d9e2cc"; ctx.beginPath(); ctx.arc(cx, cy, cupR * 0.75, 0, 7); ctx.fill();  // cup rim
  ctx.fillStyle = "#050505"; ctx.beginPath(); ctx.arc(cx, cy, cupR * 0.6, 0, 7); ctx.fill();
}

function paintBunker(ctx, [x, y, w, h], rand) {
  const r = Math.min(w, h) * 0.3;
  blob(ctx, x - 6, y - 6, w + 12, h + 12, r + 6, "#3f8a33");   // grass lip
  blob(ctx, x, y, w, h, r, "#e9d79c");
  ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.clip();
  ctx.strokeStyle = "rgba(90,60,10,.25)"; ctx.lineWidth = 8; ctx.stroke();  // inner shade
  for (let i = 0; i < (w * h) / 40; i++) {
    ctx.fillStyle = rand() > 0.5 ? "#d4bf7f" : "#f7ecc4";
    ctx.fillRect(x + rand() * w, y + rand() * h, 2, 2);
  }
  ctx.restore();
}

function paintWater(ctx, [x, y, w, h], rand) {
  const r = Math.min(w, h) * 0.3;
  blob(ctx, x - 5, y - 5, w + 10, h + 10, r + 5, "#8d7b4f");   // muddy bank
  const grad = ctx.createLinearGradient(0, y, 0, y + h);
  grad.addColorStop(0, "#4aa0ec"); grad.addColorStop(1, "#1f5fae");
  blob(ctx, x, y, w, h, r, grad);
  ctx.strokeStyle = "rgba(255,255,255,.3)"; ctx.lineWidth = 1.5;
  for (let i = 0; i < (w * h) / 1500; i++) {                      // sparkle ripples
    const px = x + 8 + rand() * (w - 24), py = y + 8 + rand() * (h - 16);
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + 8 + rand() * 8, py); ctx.stroke();
  }
}

function paintHedge(ctx, [x, y, w, h], rand) {
  ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.fillRect(x + 4, y + 6, w, h);
  blob(ctx, x, y, w, h, 6, "#1d5320");
  const vertical = h > w, len = vertical ? h : w, thick = vertical ? w : h;
  const greens = ["#2b7a2e", "#246b27", "#378f38", "#1d5320"];
  for (let d = 0; d <= len; d += 7) {
    const cx = vertical ? x + thick / 2 + (rand() - 0.5) * 4 : x + d;
    const cy = vertical ? y + d : y + thick / 2 + (rand() - 0.5) * 4;
    ctx.fillStyle = greens[Math.floor(rand() * greens.length)];
    ctx.beginPath(); ctx.arc(cx, cy, thick * 0.62 + rand() * 3, 0, 7); ctx.fill();
    ctx.fillStyle = "rgba(190,255,150,.18)";
    ctx.beginPath(); ctx.arc(cx - 2, cy - 3, thick * 0.3, 0, 7); ctx.fill();
  }
}

// Trees are data, not paint: view3d.js draws them as upright billboards around the course border.
function buildTrees(h) {
  const rand = seededRandom(h.cup[0] * 3 + h.cup[1] * 5 + h.par * 11);
  const avoid = [...h.sand, ...h.water, ...h.walls];
  const trees = [];
  for (const out of [0, 55]) {                       // two rings: on the boundary, and a deeper one
    const edges = [[-out, -out, W + out, -out], [W + out, -out, W + out, H + out],
                   [W + out, H + out, -out, H + out], [-out, H + out, -out, -out]];
    for (const [x0, y0, x1, y1] of edges) {
      const len = Math.hypot(x1 - x0, y1 - y0);
      for (let d = 0; d < len; d += 30 + rand() * 14) {
        const x = x0 + ((x1 - x0) * d) / len + (rand() - 0.5) * 16;
        const y = y0 + ((y1 - y0) * d) / len + (rand() - 0.5) * 16;
        if (!inAny(avoid, x, y, 12)) trees.push({ x, y, r: 20 + rand() * 12 });
      }
    }
  }
  return trees;
}

function paintVignette(ctx) {
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, W * 0.65);
  v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,.35)");
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
}

function buildCourseLayer(h, cupR) {
  const [canvas, ctx] = newLayer();
  const rand = seededRandom(h.cup[0] * 7 + h.cup[1] * 13 + h.par);
  paintRough(ctx, rand);
  paintFairway(ctx, h.path || [h.tee, h.cup]);
  paintTeeBox(ctx, h.tee, h.cup);
  paintGreen(ctx, h.cup, cupR);
  h.sand.forEach(r => paintBunker(ctx, r, rand));
  h.water.forEach(r => paintWater(ctx, r, rand));
  h.walls.forEach(r => paintHedge(ctx, r, rand));
  paintVignette(ctx);
  return canvas;
}
