// distance.js - the DISTANCE bar, the third meter (after power and speed).
// While you aim/power/speed it previews how far a clean shot goes next to the pin. Once speed is locked it
// bounces: stop it HIGH for a longer, higher shot, LOW for a short one, middle for a normal shot.
// The prediction replays step()'s flight and friction rules on flat grass (no hedges/sand), so it stays honest.

const DIST_BAR = { x: 200, y: 108, w: 400, h: 16 };   // below the HUD strip and the yellow message line

// Total distance (map units) a clean strike travels: flight, landing plug, then rolling to a stop.
function predictDistance(club, power) {
  let v = club.maxV * power, air = airFrames(club, power), x = 0;
  const airMax = air;
  while (v >= 0.06) {
    const flying = air > 0;
    if (flying) air--;
    const landing = flying && air === 0;
    x += v;
    if (landing) v *= 1 - (1 - LANDING_GRIP) * clamp01(airMax / 30);
    v *= 1 - (flying && !landing ? FRICTION.air : FRICTION.grass);
  }
  return x;
}

const toYards = units => Math.round(units / 2);

// Power that the current bar state would send into the ball (clean strike).
function previewPower() {
  if (g.phase === "power") return g.t;
  if (g.phase === "speed") return g.power;
  if (g.phase === "distance") return Math.min(MAX_BOOST, g.power * boostOf(g.t));
  return 0;
}

function drawDistanceBar() {
  const { x, y, w, h } = DIST_BAR, club = CLUBS[g.club];
  const range = predictDistance(club, MAX_BOOST);          // bar's full width = the biggest shot this club can ever hit
  const power = previewPower();
  const shot = power > 0 ? predictDistance(club, power) : 0;
  const pin = Math.hypot(g.hole.cup[0] - g.ball.x, g.hole.cup[1] - g.ball.y);
  const live = g.phase === "distance";

  ctx.fillStyle = "#0009"; ctx.fillRect(x - 6, y - 22, w + 12, h + 42);
  ctx.fillStyle = "#1c2b3a"; ctx.fillRect(x, y, w, h);
  const grad = ctx.createLinearGradient(x, 0, x + w, 0);
  grad.addColorStop(0, "#4cc9f0"); grad.addColorStop(1, live ? "#f72585" : "#4361ee");
  ctx.fillStyle = grad; ctx.fillRect(x, y, w * Math.min(1, shot / range), h);

  const tick = (dist, color, width) => {
    const tx = x + w * Math.min(1, dist / range);          // pinned to the right end if beyond the bar
    ctx.strokeStyle = color; ctx.lineWidth = width;
    ctx.beginPath(); ctx.moveTo(tx, y - 2); ctx.lineTo(tx, y + h + 3); ctx.stroke();   // stays clear of the label above
  };
  if (live) tick(predictDistance(club, g.power), "#fff", 2);   // white tick = a normal (middle) click
  tick(pin, "#ff4d4d", 3);
  ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.strokeRect(x, y, w, h);

  ctx.font = "bold 12px monospace"; ctx.textAlign = "left";
  ctx.fillStyle = "#fff";
  ctx.fillText(live ? `DISTANCE: stop HIGH = further + higher   ${toYards(shot)}y` : `DISTANCE  shot ${toYards(shot)}y / ${club.name} max ${toYards(range)}y`, x, y - 8);
  ctx.fillStyle = "#ff9b9b"; ctx.fillText(pin > range ? `pin ${toYards(pin)}y: too far, take a longer club` : `pin ${toYards(pin)}y`, x, y + h + 13);
}
