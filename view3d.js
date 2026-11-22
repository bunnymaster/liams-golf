// view3d.js - behind-the-golfer perspective view.
// The game is still 2D top-down underneath (physics, hazards, cup). This file only DRAWS it:
// a camera sits behind the ball looking down the aim line. Ground = the top-down course texture
// projected into perspective (mode-7 style); hedges are extruded boxes; trees/flag/ball are billboards.
// Liam is drawn from behind with a swing driven by the power bar.

const VIEW = { f: 400, hz: 175, camH: 70, back: 120, near: 14, wallH: 26, res: 2 };   // higher camera = ponds/bunkers stay readable
const POSE = { back: 170, through: -140 };          // club swing angles in degrees (backswing / follow-through)
const SWING_FRAMES = 8;                              // downswing length before the ball is struck
const FOG = [196, 228, 245];                         // horizon colour, distant things fade into it
const GOLFER = { shoulder: [-29, 48], club: [-8, 3] };// side-on figure, local units, y up, origin = ball; club head rests just behind it
const CLOUDS = [[0.4, 70, 1], [1.9, 40, 0.8], [3.0, 85, 1.2], [4.2, 55, 0.9], [5.4, 75, 1.1]]; // angle, y, size
const AIM_PHASES = ["aim", "power", "speed", "distance", "swing"];

let fr = { x: 0, y: 0, cs: 1, sn: 0 };               // this frame's camera
let groundPixels = null;
const gw = W / VIEW.res, gh = Math.ceil((H - VIEW.hz) / VIEW.res);
const groundCv = Object.assign(document.createElement("canvas"), { width: gw, height: gh });
const groundCtx = groundCv.getContext("2d");
const groundImg = groundCtx.createImageData(gw, gh);

// ---------- Helpers ----------
const angleDiff = (to, from) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
const fogAmount = d => clamp01((d - 120) / 1200);
const tint = (rgb, d) => {
  const k = fogAmount(d);
  return `rgb(${rgb.map((c, i) => Math.round(c + (FOG[i] - c) * k)).join()})`;
};

function project(x, y, z = 0) {                      // world -> screen
  const dx = x - fr.x, dy = y - fr.y;
  const d = dx * fr.cs + dy * fr.sn, l = -dx * fr.sn + dy * fr.cs;
  const k = VIEW.f / Math.max(d, 0.001);
  return { d, k, x: W / 2 + l * k, y: VIEW.hz + (VIEW.camH - z) * k };
}

function setGroundSource(layer) {
  groundPixels = layer.getContext("2d").getImageData(0, 0, layer.width, layer.height).data;
}

// ---------- Camera + pose (called once per game frame) ----------
function snapCamera() {
  const b = g.ball;
  g.cam = { x: b.x - Math.cos(g.aim) * VIEW.back, y: b.y - Math.sin(g.aim) * VIEW.back, yaw: g.aim };
}

function updateCamera() {
  const c = g.cam, b = g.ball, chasing = g.phase === "roll" || g.phase === "sunk";
  const goalYaw = chasing ? (speedOf(b) > 1 ? Math.atan2(b.vy, b.vx) : c.yaw) : g.aim;
  c.yaw += angleDiff(goalYaw, c.yaw) * (chasing ? 0.05 : 0.25);
  const follow = chasing ? 0.07 : 0.4;               // lazy while the ball flies, so you SEE it fly away
  c.x += (b.x - Math.cos(c.yaw) * VIEW.back - c.x) * follow;
  c.y += (b.y - Math.sin(c.yaw) * VIEW.back - c.y) * follow;
}

function updatePose() {
  const p = g.phase;
  if (p === "power") g.alpha = POSE.back * g.t;                       // bar fills = club goes back
  else if (p === "speed" || p === "distance") g.alpha = POSE.back * g.power;   // held at the top while the later bars run
  else if (p === "swing") g.alpha = g.alpha0 * (1 - g.swingT / SWING_FRAMES);
  else if (p === "roll" || p === "sunk") g.alpha += (POSE.through - g.alpha) * 0.3;
  else g.alpha += (0 - g.alpha) * 0.08;
}

function updateView() {
  if (AIM_PHASES.includes(g.phase)) g.stand = { x: g.ball.x, y: g.ball.y };   // Liam stays where he hit from
  updatePose();
  updateCamera();
}

// ---------- Sky + ground ----------
function drawSky(yaw) {
  const { f, hz } = VIEW;
  const sky = ctx.createLinearGradient(0, 0, 0, hz);
  sky.addColorStop(0, "#3f86d6"); sky.addColorStop(1, `rgb(${FOG})`);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, hz + 2);

  ctx.fillStyle = "rgba(255,255,255,.85)";
  CLOUDS.forEach(([a, y, s]) => {
    const x = W / 2 + angleDiff(a, yaw) * f;
    if (Math.abs(x - W / 2) > W) return;
    [[0, 0, 46], [34, 6, 34], [-34, 8, 30]].forEach(([ox, oy, r]) => {
      ctx.beginPath(); ctx.ellipse(x + ox * s, y + oy * s, r * s, r * s * 0.45, 0, 0, 7); ctx.fill();
    });
  });

  const off = yaw * f;                                // hills slide as you turn
  [["#86b394", 22, 0.012], ["#5f9a6a", 10, 0.021]].forEach(([color, base, freq]) => {
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, hz + 1);
    for (let x = 0; x <= W; x += 8) ctx.lineTo(x, hz - base - 9 * Math.sin((x + off) * freq) - 5 * Math.sin((x + off) * freq * 2.7 + 1));
    ctx.lineTo(W, hz + 1); ctx.fill();
  });
}

function drawGround() {
  const { f, hz, camH, res } = VIEW, out = groundImg.data, Q = LAYER_SCALE, srcW = W * Q;
  const rx = -fr.sn, ry = fr.cs;                      // camera "right" vector in world space
  for (let row = 0; row < gh; row++) {
    const d = (f * camH) / (row * res + res / 2);     // how far ahead this screen row looks
    const fog = fogAmount(d), unit = d / f;           // world units per screen pixel
    const left = (-W / 2 + res / 2) * unit;
    let wx = fr.x + fr.cs * d + rx * left, wy = fr.y + fr.sn * d + ry * left;
    const stepX = rx * unit * res, stepY = ry * unit * res;
    let o = row * gw * 4;
    for (let col = 0; col < gw; col++, wx += stepX, wy += stepY, o += 4) {
      // Beyond the course edge: stretch the edge pixels outward and darken them gradually (no hard seam).
      const cx = Math.min(W - 0.01, Math.max(0, wx)), cy = Math.min(H - 0.01, Math.max(0, wy));
      const dim = 1 - Math.min(0.4, Math.max(Math.abs(wx - cx), Math.abs(wy - cy)) / 150);
      const i = (((cy * Q) | 0) * srcW + ((cx * Q) | 0)) * 4;
      const r = groundPixels[i] * dim, gr = groundPixels[i + 1] * dim, b = groundPixels[i + 2] * dim;
      out[o] = r + (FOG[0] - r) * fog;
      out[o + 1] = gr + (FOG[1] - gr) * fog;
      out[o + 2] = b + (FOG[2] - b) * fog;
      out[o + 3] = 255;
    }
  }
  groundCtx.putImageData(groundImg, 0, 0);
  ctx.drawImage(groundCv, 0, hz, W, gh * res);
}

// ---------- 3D-ish objects ----------
function camPt(x, y, z) {                             // world -> camera space [forward, right, up]
  const dx = x - fr.x, dy = y - fr.y;
  return [dx * fr.cs + dy * fr.sn, -dx * fr.sn + dy * fr.cs, z];
}

function fillPoly(poly, color) {                      // clip against the near plane, project, fill
  const pts = [];
  poly.forEach((a, i) => {
    const b = poly[(i + 1) % poly.length], ina = a[0] >= VIEW.near, inb = b[0] >= VIEW.near;
    if (ina) pts.push(a);
    if (ina !== inb) {
      const t = (VIEW.near - a[0]) / (b[0] - a[0]);
      pts.push([VIEW.near, lerp(a[1], b[1], t), lerp(a[2], b[2], t)]);
    }
  });
  if (pts.length < 3) return;
  ctx.beginPath();
  pts.forEach(([d, l, z], i) => {
    const k = VIEW.f / d, x = W / 2 + l * k, y = VIEW.hz + (VIEW.camH - z) * k;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = color; ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,.25)"; ctx.lineWidth = 1; ctx.stroke();
}

const SIDE_SHADE = [1.0, 0.78, 0.92, 0.68];           // per wall face, fake lighting
const HEDGE = [43, 122, 46];

// Leaf clumps scattered over a quad (a, b = bottom edge, c, d = top edge) so hedges don't look like flat boxes.
function leafDots(a, b, c, d, rgb) {
  const len = Math.hypot(b[1] - a[1], b[0] - a[0]) + 1;
  const count = Math.min(120, Math.round((len * VIEW.wallH) / 70));
  for (let n = 1; n <= count; n++) {
    const u = 0.07 + 0.86 * ((n * 0.7548776662) % 1), v = 0.1 + 0.8 * ((n * 0.5698402909) % 1);   // stable scatter, inset from the edges
    const bu = [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
    const tu = [lerp(d[0], c[0], u), lerp(d[1], c[1], u), lerp(d[2], c[2], u)];
    const pt = [lerp(bu[0], tu[0], v), lerp(bu[1], tu[1], v), lerp(bu[2], tu[2], v)];
    if (pt[0] < VIEW.near) continue;
    const k = VIEW.f / pt[0];
    ctx.fillStyle = tint(rgb.map(c => c * (n % 2 ? 1.3 : 0.75)), pt[0]);
    ctx.beginPath(); ctx.arc(W / 2 + pt[1] * k, VIEW.hz + (VIEW.camH - pt[2]) * k, (2.6 + (n % 3) * 0.6) * k, 0, 7); ctx.fill();
  }
}

function drawWall([x, y, w, h]) {
  const c = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  const lo = c.map(([px, py]) => camPt(px, py, 0)), hi = c.map(([px, py]) => camPt(px, py, VIEW.wallH));
  [0, 1, 2, 3]
    .map(i => ({ i, j: (i + 1) % 4, d: (lo[i][0] + lo[(i + 1) % 4][0]) / 2 }))
    .sort((a, b) => b.d - a.d)                        // far faces first
    .forEach(({ i, j, d }) => {
      const rgb = HEDGE.map(v => v * SIDE_SHADE[i]);
      fillPoly([lo[i], lo[j], hi[j], hi[i]], tint(rgb, Math.max(d, 1)));
      leafDots(lo[i], lo[j], hi[j], hi[i], rgb);
    });
  const topRgb = HEDGE.map(v => Math.min(255, v * 1.25));
  fillPoly(hi, tint(topRgb, Math.max(hi[0][0], 1)));
  leafDots(hi[0], hi[1], hi[2], hi[3], topRgb);
}

function drawTree(t) {
  const p = project(t.x, t.y);
  const grow = clamp01((p.d - 100) / 60);            // trees near the camera shrink away instead of blocking the view
  if (grow < 0.03) return;
  const k = p.k * grow, r = t.r * k, cy = p.y - (30 + t.r * 0.7) * k;
  if (p.x + r < 0 || p.x - r > W) return;
  ctx.fillStyle = "rgba(0,0,0,.28)"; ctx.beginPath(); ctx.ellipse(p.x, p.y, r * 1.1, r * 0.3, 0, 0, 7); ctx.fill();
  ctx.fillStyle = tint([84, 56, 28], p.d); ctx.fillRect(p.x - 4 * k, cy, 8 * k, p.y - cy);
  [[[26, 90, 30], 1, 0], [[40, 120, 42], 0.78, -0.14], [[64, 155, 60], 0.5, -0.28]].forEach(([col, s, off]) => {
    ctx.fillStyle = tint(col, p.d); ctx.beginPath(); ctx.arc(p.x + off * r * 0.3, cy + off * r, r * s, 0, 7); ctx.fill();
  });
}

function drawFlag3d() {
  const p = project(g.hole.cup[0], g.hole.cup[1]);
  if (p.d < VIEW.near) return;
  const k = p.k, top = p.y - 44 * k, wave = Math.sin(Date.now() / 180) * 2.5 * k;
  ctx.strokeStyle = "#fff"; ctx.lineWidth = Math.max(1, 1.6 * k);
  ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, top); ctx.stroke();
  ctx.fillStyle = "#e63946"; ctx.beginPath();
  ctx.moveTo(p.x, top); ctx.lineTo(p.x + 24 * k, top + 6 * k + wave); ctx.lineTo(p.x, top + 14 * k); ctx.fill();
}

function drawBall3d() {
  const b = g.ball;
  if (g.phase === "sunk") return;                     // it's in the cup!
  const peak = Math.min(75, 18 + b.airMax * 1.3);      // longer flights arc higher
  const lift = b.air > 0 ? peak * Math.sin(Math.PI * (1 - b.air / b.airMax)) : 0;
  const p = project(b.x, b.y, R + lift), ground = project(b.x, b.y, 0);
  if (p.d < VIEW.near) return;
  ctx.fillStyle = "rgba(0,0,0,.35)";
  ctx.beginPath(); ctx.ellipse(ground.x, ground.y, R * ground.k * 1.1, R * ground.k * 0.4, 0, 0, 7); ctx.fill();
  const rad = Math.max(2, R * p.k);
  const shine = ctx.createRadialGradient(p.x - rad * 0.3, p.y - rad * 0.3, rad * 0.1, p.x, p.y, rad);
  shine.addColorStop(0, "#fff"); shine.addColorStop(1, "#b9bec4");
  ctx.fillStyle = shine; ctx.beginPath(); ctx.arc(p.x, p.y, rad, 0, 7); ctx.fill();
}

// ---------- Liam, seen from behind (side-on), swinging ----------
function limb(color, width, pts) {
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
}

function disc(color, x, y, r) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }

function rotate([x, y], degClockwise) {              // y-up coordinates, so clockwise = negative angle
  const a = (-degClockwise * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return [x * c - y * s, x * s + y * c];
}

function drawGolfer3d() {
  const p = project(g.stand.x, g.stand.y);
  if (p.d < VIEW.near * 2) return;
  const [sx, sy] = GOLFER.shoulder;
  const reach = [GOLFER.club[0] - sx, GOLFER.club[1] - sy];                  // shoulder -> clubhead at address
  // Arms swing about the shoulder; the wrist hinges extra mid-backswing so the club lifts clear of his feet.
  const cock = 60 * Math.sin(clamp01(g.alpha / POSE.back) * Math.PI);
  const armV = rotate([reach[0] * 0.4, reach[1] * 0.4], g.alpha);            // + alpha = backswing (clockwise)
  const shaftV = rotate([reach[0] * 0.6, reach[1] * 0.6], g.alpha + cock);
  const hands = [sx + armV[0], sy + armV[1]], head = [hands[0] + shaftV[0], hands[1] + shaftV[1]];

  ctx.save();
  ctx.translate(p.x, p.y); ctx.scale(p.k, -p.k);      // local units, y up
  ctx.lineCap = ctx.lineJoin = "round";
  ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.beginPath(); ctx.ellipse(-30, 0, 24, 5, 0, 0, 7); ctx.fill();
  limb("#2f4b7c", 8, [[-33, 27], [-44, 2]]);          // legs
  limb("#3a5a94", 8, [[-33, 27], [-26, 2]]);
  disc("#fff", -45, 1.5, 4.5); disc("#fff", -25, 1.5, 4.5);   // shoes
  limb("#e63946", 13, [[-33, 27], [-29, 47]]);        // torso
  disc("#f1c27d", -25, 57, 5.5);                      // head
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.ellipse(-25.5, 59.5, 6.2, 3.6, 0, 0, 7); ctx.fill();
  ctx.fillRect(-21, 58, 7, 2);                        // cap + bill
  limb("#d02f3b", 5, [[sx, sy], hands]);              // arms
  disc("#f1c27d", hands[0], hands[1], 2.6);
  limb("#cfd3d8", 1.8, [hands, head]);                // shaft
  disc("#3a3a3a", head[0], head[1], 2.6);             // club head
  ctx.restore();
}

// ---------- Aim guide + minimap ----------
function drawAimDots() {
  if (!AIM_PHASES.includes(g.phase)) return;
  const b = g.ball;
  for (let d = 30; d <= 280; d += 22) {
    const p = project(b.x + Math.cos(g.aim) * d, b.y + Math.sin(g.aim) * d);
    if (p.d < VIEW.near) continue;
    ctx.fillStyle = `rgba(255,255,255,${1 - d / 340})`;
    ctx.beginPath(); ctx.ellipse(p.x, p.y, 3.2 * p.k, 1.3 * p.k, 0, 0, 7); ctx.fill();
  }
}

function drawMinimap() {                               // top-down overview so you can still read the hole
  const mw = 200, mh = (mw * H) / W, mx = 12, my = H - mh - 12, k = mw / W;
  const dot = (x, y, color, r) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(mx + x * k, my + y * k, r, 0, 7); ctx.fill(); };
  ctx.globalAlpha = 0.92; ctx.drawImage(g.layer, mx, my, mw, mh); ctx.globalAlpha = 1;
  ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.strokeRect(mx, my, mw, mh);
  const b = g.ball;
  ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(mx + b.x * k, my + b.y * k);
  ctx.lineTo(mx + (b.x + Math.cos(g.aim) * 90) * k, my + (b.y + Math.sin(g.aim) * 90) * k); ctx.stroke();
  dot(g.hole.cup[0], g.hole.cup[1], "#e63946", 4);
  dot(b.x, b.y, "#fff", 3.5);
}

// ---------- Scene ----------
function sceneObjects() {
  const dist = (x, y) => Math.hypot(x - fr.x, y - fr.y);
  const objs = [
    ...g.hole.walls.map(w => ({ depth: dist(Math.min(Math.max(fr.x, w[0]), w[0] + w[2]), Math.min(Math.max(fr.y, w[1]), w[1] + w[3])), draw: () => drawWall(w) })),
    ...g.trees.map(t => ({ depth: dist(t.x, t.y), draw: () => drawTree(t) })),
    { depth: dist(...g.hole.cup), draw: drawFlag3d },
    { depth: dist(g.ball.x, g.ball.y), draw: drawBall3d },
    { depth: dist(g.stand.x, g.stand.y) - 1, draw: drawGolfer3d },   // drawn just after the ball
  ];
  return objs.sort((a, b) => b.depth - a.depth);      // painter's algorithm: far to near
}

function renderScene() {
  const c = g.cam;
  fr = { x: c.x, y: c.y, cs: Math.cos(c.yaw), sn: Math.sin(c.yaw) };
  drawSky(c.yaw);
  drawGround();
  drawAimDots();
  sceneObjects().forEach(o => o.draw());
  drawMinimap();
}
