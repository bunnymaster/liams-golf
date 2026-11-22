// LIAM'S GOLF - game logic. Data: courses.js | course paint: render.js | cart cutscene: intro.js | camera view: view3d.js
const FRICTION = { grass: 0.02, sand: 0.08, air: 0.004 };
const POP_SPEED = 1.8;                            // minimum speed of the hop out when a ball lands in a hedge
const WALL_BOUNCE = 0.8;                           // speed kept (reversed) when the ball bounces off a hedge or the border
const LANDING_GRIP = 0.5;                         // speed kept after a full-height flight (small hops lose far less)
const MAX_OVER_PAR = 5;                           // pick up the ball after par + this
const BAR = { px: 750, py: 100, pw: 24, ph: 300, sx: 250, sy: 450, sw: 340, sh: 30 };

const $ = id => document.getElementById(id);
const cv = $("game"), ctx = cv.getContext("2d");
const keys = {};
const METER_PHASES = ["power", "speed", "distance"];   // the three bars, in order
const MAX_BOOST = 1.5;                            // distance bar: stop it high = up to 1.5x power (further AND higher)
const boostOf = t => 0.5 + t;                     // 0.5 (low click) .. 1.0 (middle = normal shot) .. 1.5 (high click)
const BAR_LOCKOUT = 9;                            // frames a fresh bar ignores input (stops double-tap / double-click skips)
const g = { diff: null, holeIdx: 0, scores: [], club: 0, phase: "menu", msg: "", msgT: 0, lock: 0, t: 0, dir: 1, timing: 0.5, boost: 1 };

// ---------- Small helpers ----------
const inRect = (x, y, [rx, ry, rw, rh], pad = 0) => x > rx - pad && x < rx + rw + pad && y > ry - pad && y < ry + rh + pad;
const inAny = (list, x, y, pad) => list.some(r => inRect(x, y, r, pad));
const speedOf = b => Math.hypot(b.vx, b.vy);
const aimAtCup = () => Math.atan2(g.hole.cup[1] - g.ball.y, g.hole.cup[0] - g.ball.x);
const say = (text, frames = 120) => { g.msg = text; g.msgT = frames; };

// ---------- Overlay menus ----------
function overlay(html) { const o = $("overlay"); o.innerHTML = html; o.style.display = html ? "flex" : "none"; }

function button(label, sub, onclick, parent = "overlay") {
  const b = document.createElement("button");
  b.className = "btn";
  b.innerHTML = `${label}<small>${sub || ""}</small>`;
  b.onclick = onclick;
  $(parent).appendChild(b);
}

function showMenu() {
  g.phase = "menu";
  g.onClub = null;
  overlay(`<h2>Pick your level</h2><p>Playing as <b>${g.user}</b>. 3 holes, fewest strokes wins.</p><div id="levels" class="levels"></div>`);
  Object.entries(DIFFS).forEach(([key, d]) =>
    button(d.label, `${d.holes.length} holes | par ${d.holes.reduce((n, h) => n + h.par, 0)}`, () => startRound(key), "levels"));
}

function showClubs(next) {
  g.phase = "menu";
  overlay(`<h2>Pick your club</h2><p>You can switch any time while aiming (Up/Down or 1-4).</p>`);
  g.onClub = i => { g.club = i; g.onClub = null; next(); };   // buttons and number keys share this
  CLUBS.forEach((c, i) => button(`${i + 1}. ${c.name}`, c.desc, () => g.onClub(i)));
}

function showScorecard() {
  g.phase = "menu";
  const rows = g.scores.map((s, i) => `<p>Hole ${i + 1}: ${s} (par ${g.diff.holes[i].par})</p>`).join("");
  const total = g.scores.reduce((a, b) => a + b, 0);
  const par = g.diff.holes.reduce((a, h) => a + h.par, 0);
  const d = total - par;
  overlay(`<h2>${g.user}: ${g.diff.label} complete!</h2>${rows}<p><b>Total: ${total} (${d === 0 ? "even" : d > 0 ? "+" + d : d})</b></p>`);
  button("Play again", "", showMenu);
}

// ---------- Round flow ----------
function startRound(key) {
  g.diff = DIFFS[key];
  g.scores = [];
  loadHole(0);
  g.phase = "intro";                 // cart drop-off first, then club pick
  g.introT = 0;
  overlay("");
  say(`Welcome to the ${g.diff.label} course, ${g.user}!`, 150);
}

function endIntro() {
  showClubs(() => {
    g.phase = "aim";
    overlay("");
    say(`Hole 1, par ${g.hole.par}. Good luck, ${g.user}!`);
  });
}

function loadHole(i) {
  g.holeIdx = i;
  g.hole = g.diff.holes[i];
  g.layer = buildCourseLayer(g.hole, g.diff.cupR);
  g.trees = buildTrees(g.hole);
  setGroundSource(g.layer);
  const [x, y] = g.hole.tee;
  g.ball = { x, y, vx: 0, vy: 0, air: 0 };
  g.last = { x, y };
  g.stand = { x, y };
  g.strokes = 0;
  g.aim = aimAtCup();                // only a starting direction for a fresh hole; after that, aiming is manual
  g.alpha = 0;                       // club swing angle (view3d.js)
  g.phase = "aim";
  snapCamera();
  overlay("");
  say(`Hole ${i + 1}, par ${g.hole.par}. Good luck, ${g.user}!`);
}

function finishHole(strokes) {
  g.scores.push(strokes);
  g.phase = "sunk";
  g.wait = 90;
  const d = strokes - g.hole.par;
  say(strokes === 1 ? "HOLE IN ONE!!!" : ["Eagle!", "Birdie!", "Par.", "Bogey.", "Double bogey."][d + 2] || "In the hole!", 90);
}

// ---------- Swing: Enter / click advances the meter ----------
function action() {
  if (g.lock > 0) return;
  g.lock = BAR_LOCKOUT;
  if (g.phase === "aim")        { g.phase = "power"; g.t = 0; g.dir = 1; }
  else if (g.phase === "power") { g.power = g.t; g.phase = "speed"; g.t = 0; g.dir = 1; }
  else if (g.phase === "speed") { g.timing = g.t; g.phase = "distance"; g.t = 0; g.dir = 1; }
  else if (g.phase === "distance") { g.boost = boostOf(g.t); g.alpha0 = g.alpha; g.swingT = 0; g.phase = "swing"; }  // downswing, then hit()
  else g.lock = 0;                                  // not a swing phase: nothing happened, don't block the next press
}

// Below the club's lift-off power the ball rolls; above it, airtime grows from a small hop up to full loft.
function airFrames(club, power) {
  if (power < club.airAt) return 0;
  const t = Math.min(1.5, (power - club.airAt) / (1 - club.airAt));   // above 1 = boosted: higher than the club's normal loft
  return Math.round(lerp(club.loft * 0.35, club.loft, t));
}

function hit() {
  const club = CLUBS[g.club], { sweet } = g.diff;
  const off = (g.timing - 0.5) * 2;                              // speed bar: -1 (left) .. +1 (right)
  const miss = Math.max(0, (Math.abs(off) - sweet) / (1 - sweet)); // 0 inside the sweet spot
  const angle = g.aim + Math.sign(off) * miss * club.err;
  const power = Math.min(MAX_BOOST, Math.max(g.power, 0.05) * g.boost) * (1 - 0.3 * miss);
  const b = g.ball, v = club.maxV * power;
  g.last = { x: b.x, y: b.y };
  b.vx = Math.cos(angle) * v;
  b.vy = Math.sin(angle) * v;
  b.air = b.airMax = airFrames(club, power);
  g.strokes++;
  g.phase = "roll";
  say((miss === 0 ? "Pure strike!" : off > 0 ? "Sliced right!" : "Hooked left!") + (b.air ? " It's airborne!" : ""), 80);
}

function penalty(text) {
  const b = g.ball;
  g.strokes++;
  Object.assign(b, g.last, { vx: 0, vy: 0, air: 0 });   // back to the old spot; your aim is left alone
  g.phase = "aim";
  say(text + " +1 stroke");
}

// ---------- Physics (one frame) ----------
function step() {
  const b = g.ball, h = g.hole, flying = b.air > 0;
  if (flying) b.air--;
  const landing = flying && b.air === 0;

  b.x += b.vx;
  if (!flying && inAny(h.walls, b.x, b.y, R)) { b.x -= b.vx; bounce(b, "vx"); }
  b.y += b.vy;
  if (!flying && inAny(h.walls, b.x, b.y, R)) { b.y -= b.vy; bounce(b, "vy"); }

  if (b.x < R || b.x > W - R) { b.x = Math.min(W - R, Math.max(R, b.x)); bounce(b, "vx"); }
  if (b.y < R || b.y > H - R) { b.y = Math.min(H - R, Math.max(R, b.y)); bounce(b, "vy"); }

  if (landing) {
    const keep = 1 - (1 - LANDING_GRIP) * clamp01(b.airMax / 30);   // low hop ~ keeps speed, big lob plugs
    b.vx *= keep; b.vy *= keep;
    popOutOfWall(b, h.walls);                       // came down inside a hedge: bounce out, no penalty
  }
  if (flying && !landing) return applyFriction(b, FRICTION.air);

  if (inAny(h.water, b.x, b.y)) return penalty("Splash!");
  applyFriction(b, inAny(h.sand, b.x, b.y) ? FRICTION.sand : FRICTION.grass);

  const dist = Math.hypot(b.x - h.cup[0], b.y - h.cup[1]);
  if (dist < g.diff.cupR && speedOf(b) < g.diff.cupV) { Object.assign(b, { x: h.cup[0], y: h.cup[1], vx: 0, vy: 0 }); return finishHole(g.strokes); }

  if (speedOf(b) < 0.06) {
    b.vx = b.vy = 0;
    if (g.strokes >= h.par + MAX_OVER_PAR) { say("Pick up! Too many strokes."); return finishHole(g.strokes); }
    g.phase = "aim";                                    // you aim the next shot yourself (no auto-aim)
  }
}

// Hedges and the course border: reflect that axis, lose a bit of speed, and make it obvious (message + blip).
function bounce(b, axis) {
  b[axis] *= -WALL_BOUNCE;
  boing(b);
}

function boing(b) {
  if (speedOf(b) < 1.2) return;                     // a slow crawl against a hedge shouldn't spam boings
  say("Boing!", 30);
  blip(220 + 40 * Math.min(speedOf(b), 8));
}

// A ball that lands inside a hedge hops out through the nearest face, heading away from the hedge.
function popOutOfWall(b, walls) {
  const wall = walls.find(w => inRect(b.x, b.y, w, R));
  if (!wall) return;
  const [x, y, w, h] = wall;
  const exits = [                                     // [distance to leave, axis, edge position, direction away]
    [b.x - (x - R), "x", x - R, -1], [x + w + R - b.x, "x", x + w + R, 1],
    [b.y - (y - R), "y", y - R, -1], [y + h + R - b.y, "y", y + h + R, 1],
  ];
  const limit = { x: W, y: H };
  const onCourse = ([, axis, edge]) => edge >= R && edge <= limit[axis] - R;   // a hedge flush to the border has no exit that way
  const [, axis, edge, away] = exits.filter(onCourse).reduce((best, e) => (e[0] < best[0] ? e : best));
  const v = "v" + axis;
  b[axis] = edge;
  b[v] = away * Math.max(Math.abs(b[v]) * WALL_BOUNCE, POP_SPEED);
  boing(b);
}

let audio = null;
function blip(freq) {                               // tiny WebAudio sound, no files needed
  try {
    audio = audio || new AudioContext();
    const osc = audio.createOscillator(), vol = audio.createGain(), now = audio.currentTime;
    osc.frequency.setValueAtTime(freq, now); osc.frequency.exponentialRampToValueAtTime(freq / 2, now + 0.15);
    vol.gain.setValueAtTime(0.15, now); vol.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(vol); vol.connect(audio.destination); osc.start(now); osc.stop(now + 0.16);
  } catch (e) { /* no audio available: silently skip */ }
}

function applyFriction(b, mu) { b.vx *= 1 - mu; b.vy *= 1 - mu; }

// ---------- Per-frame update ----------
function update() {
  if (g.msgT > 0) g.msgT--;
  if (g.lock > 0) g.lock--;
  updateView();
  if (g.phase === "intro") {
    if (++g.introT >= INTRO.frames) endIntro();
  } else if (g.phase === "aim") {
    const turn = keys.Shift ? 0.004 : 0.02;
    if (keys.ArrowLeft) g.aim -= turn;
    if (keys.ArrowRight) g.aim += turn;
  } else if (METER_PHASES.includes(g.phase)) {
    g.t += g.dir * g.diff.bar * (g.phase === "power" ? 1 : 1.2);
    if (g.t >= 1) { g.t = 1; g.dir = -1; } else if (g.t <= 0) { g.t = 0; g.dir = 1; }
  } else if (g.phase === "swing") {
    if (++g.swingT >= SWING_FRAMES) hit();
  } else if (g.phase === "roll") {
    step();
  } else if (g.phase === "sunk" && --g.wait <= 0) {
    g.holeIdx + 1 < g.diff.holes.length ? loadHole(g.holeIdx + 1) : showScorecard();
  }
}

// ---------- Rendering ----------
function drawBars() {
  const { px, py, pw, ph, sx, sy, sw, sh } = BAR;
  const grad = ctx.createLinearGradient(0, py + ph, 0, py);
  grad.addColorStop(0, "#3ddc84"); grad.addColorStop(0.6, "#ffd93d"); grad.addColorStop(1, "#e63946");
  ctx.fillStyle = grad; ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = "#fff"; ctx.lineWidth = 3;
  const my = py + ph * (1 - (g.phase === "power" ? g.t : g.power));
  ctx.beginPath(); ctx.moveTo(px - 6, my); ctx.lineTo(px + pw + 6, my); ctx.stroke();
  ctx.fillStyle = "#fff"; ctx.font = "bold 13px monospace"; ctx.fillText("POWER", px - 8, py - 8);
  const airY = py + ph * (1 - CLUBS[g.club].airAt);        // above this line the ball takes off
  ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(px - 10, airY); ctx.lineTo(px + pw + 10, airY); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = "#fff"; ctx.fillText("AIR", px - 42, airY + 4);
  if (g.phase !== "speed") return;
  ctx.fillStyle = "#6b1d1d"; ctx.fillRect(sx, sy, sw, sh);
  ctx.fillStyle = "#3ddc84"; ctx.fillRect(sx + sw / 2 - (g.diff.sweet * sw) / 2, sy, g.diff.sweet * sw, sh);
  ctx.beginPath(); ctx.moveTo(sx + g.t * sw, sy - 6); ctx.lineTo(sx + g.t * sw, sy + sh + 6); ctx.stroke();
  ctx.fillStyle = "#fff"; ctx.fillText("SPEED (stop in the green)", sx + 50, sy - 12);
}

function drawHud() {
  ctx.fillStyle = "#0009"; ctx.fillRect(0, 0, W, 28);
  ctx.fillStyle = "#fff"; ctx.font = "bold 15px monospace";
  const yards = Math.round(Math.hypot(g.hole.cup[0] - g.ball.x, g.hole.cup[1] - g.ball.y) / 2);
  ctx.fillText(`${g.user} | ${g.diff.label} | Hole ${g.holeIdx + 1}/${g.diff.holes.length} | Par ${g.hole.par} | Strokes ${g.strokes} | Pin ${yards}y | Club: ${CLUBS[g.club].name}`, 12, 19);
  if (g.msgT > 0) {
    ctx.font = "bold 26px monospace"; ctx.textAlign = "center";
    ctx.fillStyle = "#000"; ctx.fillText(g.msg, W / 2 + 2, 82);
    ctx.fillStyle = "#ffd93d"; ctx.fillText(g.msg, W / 2, 80);
    ctx.textAlign = "left";
  }
}

function render() {
  if (!g.hole) { ctx.fillStyle = "#2e8b4a"; ctx.fillRect(0, 0, W, H); return; }
  if (g.phase === "intro") renderIntro(); else renderScene();
  if (METER_PHASES.includes(g.phase)) drawBars();
  if (g.phase === "aim" || METER_PHASES.includes(g.phase)) drawDistanceBar();
  drawHud();
}

// ---------- Input ----------
const inGame = () => g.phase !== "menu";

addEventListener("keydown", e => {
  keys[e.key] = true;
  if (!inGame()) {
    if (g.onClub && !e.repeat && /^[1-4]$/.test(e.key)) g.onClub(+e.key - 1);
    return;
  }
  if (g.phase === "intro") { if (e.key === "1") endIntro(); return; }
  if (e.key === "Enter") { e.preventDefault(); if (!e.repeat) action(); }   // holding Enter must not rush through every bar
  else if (e.key === "Escape" && METER_PHASES.includes(g.phase)) g.phase = "aim";
  else if (g.phase === "aim") {
    if (/^[1-4]$/.test(e.key)) g.club = +e.key - 1;
    if (e.key === "ArrowUp")   g.club = (g.club + 1) % CLUBS.length;
    if (e.key === "ArrowDown") g.club = (g.club + CLUBS.length - 1) % CLUBS.length;
    if (e.key.startsWith("Arrow")) e.preventDefault();
  }
});
addEventListener("keyup", e => { keys[e.key] = false; });
cv.addEventListener("mousedown", () => inGame() && action());

// ---------- Boot ----------
// Fixed 60 updates/second no matter the monitor's refresh rate (120Hz screens would run the game 2x fast).
const STEP_MS = 1000 / 60;
let lastTime = performance.now(), lag = 0;
(function loop(now) {
  lag += Math.min(100, now - lastTime);
  lastTime = now;
  for (; lag >= STEP_MS; lag -= STEP_MS) if (inGame()) update();
  render();
  requestAnimationFrame(loop);
})(lastTime);
showUsername(showMenu);
