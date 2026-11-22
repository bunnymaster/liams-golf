// intro.js - the golf cart drop-off cutscene. Press 1 to skip (see game.js).
// Timeline (frames): cart arrives -> Liam hops out and walks to the tee -> cart drives away.

const INTRO = { frames: 420, arrive: 150, exit: 230, leave: 280, ballAt: 235 };
const clamp01 = t => Math.min(1, Math.max(0, t));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = t => 1 - (1 - t) ** 3;
const easeIn = t => t ** 3;

function introScene(t, [tx, ty]) {
  const y = ty < H / 2 ? ty + 50 : ty - 50;           // park on whichever side has room
  const stopX = tx + 70;
  const cartX = t < INTRO.leave
    ? lerp(-90, stopX, easeOut(clamp01(t / INTRO.arrive)))
    : lerp(stopX, W + 90, easeIn(clamp01((t - INTRO.leave) / (INTRO.frames - INTRO.leave))));
  const walk = clamp01((t - INTRO.arrive) / (INTRO.exit - INTRO.arrive));
  const moving = t < INTRO.arrive - 20 || t > INTRO.leave;
  return {
    cartX, cartY: y + (moving ? Math.sin(t * 0.6) * 0.8 : 0),
    inCart: t < INTRO.arrive,
    golferX: lerp(stopX - 4, tx - 14, easeOut(walk)),
    golferY: lerp(y - 5, ty, easeOut(walk)),
    ballVisible: t >= INTRO.ballAt,
  };
}

function roundedFill(color, x, y, w, h, r) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
}

function drawGolfer(x, y, bob = 0) {                  // top-down Liam, facing right
  ctx.fillStyle = "#0004"; ctx.beginPath(); ctx.ellipse(x + 2, y + 4, 8, 13, 0, 0, 7); ctx.fill();
  ctx.fillStyle = "#e63946"; ctx.beginPath(); ctx.ellipse(x, y + bob, 6, 12, 0, 0, 7); ctx.fill();   // shirt
  ctx.fillStyle = "#f1c27d"; ctx.beginPath(); ctx.arc(x + 1, y + bob, 6, 0, 7); ctx.fill();           // head
  ctx.fillStyle = "#fff";    ctx.beginPath(); ctx.arc(x, y + bob, 6.2, Math.PI * 0.55, Math.PI * 1.45); ctx.fill(); // cap
  ctx.fillRect(x + 4, y + bob - 3, 6, 6);                                                              // bill
}

function drawCart(x, y, driver) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = "#0004"; ctx.beginPath(); ctx.ellipse(3, 7, 38, 20, 0, 0, 7); ctx.fill();
  ctx.fillStyle = "#1c1c1c";
  [[-24, -21], [16, -21], [-24, 15], [16, 15]].forEach(([wx, wy]) => ctx.fillRect(wx, wy, 12, 6));  // wheels
  roundedFill("#f4f4f4", -32, -16, 64, 32, 8);        // body
  roundedFill("#a8cbe0", 17, -13, 8, 26, 3);          // windshield (front = right)
  roundedFill("#333", -10, -11, 14, 22, 3);           // bench seat
  ctx.fillStyle = "#8a6a3a";
  [-6, 7].forEach(by => { ctx.beginPath(); ctx.arc(-25, by, 6, 0, 7); ctx.fill(); });             // golf bags
  if (driver) drawGolfer(-3, -5);
  roundedFill("rgba(34,120,70,.62)", -29, -19, 52, 38, 6);                                         // see-through roof
  ctx.restore();
}

function drawIntro(t, tee) {
  const s = introScene(t, tee);
  drawCart(s.cartX, s.cartY, s.inCart);
  if (!s.inCart) drawGolfer(s.golferX, s.golferY, Math.sin(t * 0.5) * (t < INTRO.exit ? 1.2 : 0));
  return s.ballVisible;
}

// The cutscene is the one place we still look straight down at the course.
function drawFlagTopDown([cx, cy]) {
  const wave = Math.sin(Date.now() / 180) * 2.5;
  ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - 44); ctx.stroke();
  ctx.fillStyle = "#e63946"; ctx.beginPath(); ctx.moveTo(cx, cy - 44); ctx.lineTo(cx + 24, cy - 38 + wave); ctx.lineTo(cx, cy - 30); ctx.fill();
}

function drawBallTopDown(b) {
  ctx.fillStyle = "#0005"; ctx.beginPath(); ctx.ellipse(b.x + 1, b.y + 3, R, R * 0.6, 0, 0, 7); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.strokeStyle = "#222"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(b.x, b.y, R, 0, 7); ctx.fill(); ctx.stroke();
}

function renderIntro() {
  ctx.drawImage(g.layer, 0, 0, W, H);
  drawFlagTopDown(g.hole.cup);
  if (drawIntro(g.introT, g.hole.tee)) drawBallTopDown(g.ball);
  drawSkipHint();
}

function drawSkipHint() {
  ctx.font = "bold 14px monospace"; ctx.textAlign = "right";
  ctx.fillStyle = "#000"; ctx.fillText("Press 1 to skip intro", W - 13, H - 11);
  ctx.fillStyle = "#fff"; ctx.fillText("Press 1 to skip intro", W - 14, H - 12);
  ctx.textAlign = "left";
}
