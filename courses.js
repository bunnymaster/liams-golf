// Static game data: constants, clubs and courses. No logic in here, just numbers.
// Rect format: [x, y, w, h] on an 800x500 canvas.
// `path` is the fairway centreline (purely cosmetic: it shows the "intended" route).

const W = 800, H = 500, R = 5;   // canvas size, ball radius

// loft = max airtime in frames (at full power); airAt = power needed to leave the ground at all.
// While airborne the ball clears sand, water and walls, so hit hard enough and you can fly over the lake.
const CLUBS = [
  { name: "Putter", maxV: 4.5, loft: 20, airAt: 0.85, err: 0.10, desc: "Straight and forgiving. Only hops at near full power." },
  { name: "Wedge",  maxV: 6.5, loft: 45, airAt: 0.25, err: 0.25, desc: "Lifts off easily. High lob over water and walls." },
  { name: "Iron",   maxV: 9,   loft: 40, airAt: 0.40, err: 0.30, desc: "All-rounder. Flies at 40%+ power." },
  { name: "Driver", maxV: 12,  loft: 50, airAt: 0.50, err: 0.40, desc: "Bombs it. Flies at 50%+ power, wild if timing is off." },
];

const DIFFS = {
  easy: {
    label: "Easy", bar: 0.012, sweet: 0.55, cupR: 16, cupV: 6,
    holes: [
      { par: 3, tee: [100, 250], cup: [680, 250], walls: [], sand: [], water: [] },
      { par: 3, tee: [100, 420], cup: [690, 90],  walls: [], sand: [[330, 180, 140, 120]], water: [] },
      { par: 3, tee: [100, 250], cup: [700, 250], walls: [], sand: [], water: [[360, 170, 90, 160]] },
    ],
  },
  medium: {
    label: "Medium", bar: 0.02, sweet: 0.40, cupR: 12, cupV: 5,
    holes: [
      { par: 4, tee: [80, 420], cup: [720, 80],  walls: [[360, 130, 20, 370]], sand: [[560, 200, 120, 100]], water: [],
        path: [[80, 420], [250, 200], [370, 70], [560, 100], [720, 80]] },
      { par: 4, tee: [80, 250], cup: [720, 250], walls: [], sand: [[600, 150, 80, 200]], water: [[320, 110, 120, 280]],
        path: [[80, 250], [250, 60], [500, 60], [720, 250]] },
      { par: 4, tee: [80, 80],  cup: [720, 420], walls: [[250, 0, 20, 320], [500, 180, 20, 320]], sand: [[380, 200, 90, 100]], water: [],
        path: [[80, 80], [200, 300], [260, 400], [400, 250], [510, 100], [620, 150], [720, 420]] },
    ],
  },
  hard: {
    label: "Hard", bar: 0.03, sweet: 0.26, cupR: 9, cupV: 4,
    holes: [
      { par: 5, tee: [60, 440], cup: [740, 60],  walls: [[200, 100, 20, 400], [420, 0, 20, 380], [620, 120, 20, 380]], sand: [[260, 380, 110, 70]], water: [],
        path: [[60, 440], [150, 200], [210, 50], [330, 200], [430, 440], [530, 300], [630, 60], [740, 60]] },
      { par: 4, tee: [60, 250], cup: [740, 250], walls: [[500, 150, 20, 200]], sand: [[600, 200, 100, 100]], water: [[250, 0, 80, 200], [250, 300, 80, 200]],
        path: [[60, 250], [380, 250], [480, 110], [560, 110], [640, 250], [740, 250]] },
      { par: 5, tee: [60, 60],  cup: [740, 440], walls: [[100, 300, 500, 20]], sand: [[650, 300, 100, 100]], water: [[200, 150, 400, 60]],
        path: [[60, 60], [50, 250], [80, 380], [400, 400], [740, 440]] },
    ],
  },

  // ---- Past Hard: faster bars, tinier green zone, tinier cup (the ball must be nearly stopped to drop). ----
  expert: {
    label: "Expert", bar: 0.035, sweet: 0.22, cupR: 8, cupV: 3.5,
    holes: [
      { par: 6, tee: [60, 440], cup: [740, 60],     // zigzag of hedges, gaps alternate bottom/top
        walls: [[160, 0, 20, 360], [320, 140, 20, 360], [480, 0, 20, 360], [640, 140, 20, 360]], sand: [[200, 400, 100, 60]], water: [],
        path: [[60, 440], [170, 430], [330, 70], [490, 430], [650, 70], [740, 60]] },
      { par: 5, tee: [60, 250], cup: [740, 250],    // river with a narrow bridge, then a hedge and bunkers
        walls: [[520, 100, 20, 300]], sand: [[560, 150, 120, 60], [560, 290, 120, 60]], water: [[300, 0, 100, 210], [300, 290, 100, 210]],
        path: [[60, 250], [350, 250], [470, 250], [480, 70], [600, 70], [740, 250]] },
      { par: 6, tee: [60, 440], cup: [630, 110],    // island green ringed by water
        walls: [[300, 150, 20, 350]], sand: [[100, 200, 120, 100]], water: [[500, 20, 260, 40], [500, 160, 260, 40], [500, 60, 40, 100], [720, 60, 40, 100]],
        path: [[60, 440], [200, 250], [310, 100], [500, 110], [630, 110]] },
    ],
  },
  brutal: {
    label: "Brutal", bar: 0.04, sweet: 0.18, cupR: 7, cupV: 3,
    holes: [
      { par: 6, tee: [50, 450], cup: [750, 50],     // five-hedge maze
        walls: [[120, 0, 20, 380], [240, 120, 20, 380], [360, 0, 20, 380], [480, 120, 20, 380], [600, 0, 20, 380]],
        sand: [[650, 200, 100, 120]], water: [[140, 430, 100, 70]],
        path: [[50, 450], [130, 440], [250, 60], [370, 440], [490, 60], [610, 440], [700, 150], [750, 50]] },
      { par: 5, tee: [60, 250], cup: [740, 250],    // pinball hedges, then a 40px bridge
        walls: [[200, 50, 20, 160], [200, 290, 20, 160], [360, 0, 20, 200], [360, 300, 20, 200], [520, 100, 20, 120], [520, 280, 20, 120]],
        sand: [[650, 190, 70, 120]], water: [[600, 0, 40, 230], [600, 270, 40, 230]],
        path: [[60, 250], [280, 250], [440, 250], [620, 250], [740, 250]] },
      { par: 6, tee: [60, 60], cup: [740, 440],     // four ponds to weave around (or fly over)
        walls: [[500, 0, 20, 100]], sand: [[680, 300, 100, 80]], water: [[150, 100, 120, 300], [350, 0, 100, 260], [350, 330, 100, 170], [550, 150, 100, 300]],
        path: [[60, 60], [210, 50], [310, 100], [310, 295], [400, 295], [500, 295], [520, 120], [600, 100], [700, 120], [730, 300], [740, 440]] },
    ],
  },
  monstrous: {
    label: "Monstrous", bar: 0.05, sweet: 0.14, cupR: 6.5, cupV: 2.5,
    holes: [
      { par: 7, tee: [40, 250], cup: [760, 250],    // the gauntlet: eight hedges, two bunkers, two pools
        walls: [[120, 0, 20, 200], [120, 300, 20, 200], [240, 100, 20, 300], [360, 0, 20, 200], [360, 300, 20, 200], [480, 100, 20, 300], [600, 0, 20, 200], [600, 300, 20, 200]],
        sand: [[140, 210, 90, 80], [380, 210, 90, 80]], water: [[640, 100, 40, 100], [640, 300, 40, 100]],
        path: [[40, 250], [130, 250], [250, 60], [370, 250], [490, 440], [610, 250], [760, 250]] },
      { par: 6, tee: [50, 450], cup: [750, 50],     // archipelago: water walls with thin gaps
        walls: [], sand: [], water: [[150, 0, 90, 330], [150, 400, 90, 100], [320, 170, 90, 330], [320, 0, 90, 100], [490, 0, 90, 330], [490, 400, 90, 100], [660, 100, 60, 400]],
        path: [[50, 450], [190, 365], [280, 365], [365, 135], [450, 135], [535, 365], [600, 365], [690, 60], [750, 50]] },
      { par: 7, tee: [60, 250], cup: [740, 250],    // pinball bunker, ending in a 100px corridor between pools
        walls: [[160, 150, 20, 200], [280, 0, 20, 180], [280, 320, 20, 180], [400, 150, 20, 200], [520, 0, 20, 180], [520, 320, 20, 180], [640, 150, 20, 200]],
        sand: [[190, 200, 80, 100], [430, 200, 80, 100], [550, 200, 80, 100]], water: [[680, 0, 60, 200], [680, 300, 60, 200]],
        path: [[60, 250], [170, 100], [290, 250], [410, 100], [530, 250], [650, 100], [670, 250], [740, 250]] },
    ],
  },
  nightmare: {
    label: "Nightmare", bar: 0.06, sweet: 0.10, cupR: 6, cupV: 2.2,
    holes: [
      { par: 6, tee: [40, 250], cup: [760, 250],    // the needle: a 60px lane between two lakes, with baffles
        walls: [[250, 220, 20, 30], [400, 250, 20, 30], [550, 220, 20, 30]], sand: [[710, 200, 40, 100]], water: [[100, 0, 600, 220], [100, 280, 600, 220]],
        path: [[40, 250], [700, 250], [760, 250]] },
      { par: 8, tee: [50, 50], cup: [750, 450],     // full maze with bunkers and a pool by the exit
        walls: [[120, 0, 20, 400], [240, 100, 20, 400], [360, 0, 20, 400], [480, 100, 20, 400], [600, 0, 20, 400]],
        sand: [[140, 420, 90, 70], [380, 420, 90, 70], [500, 20, 90, 70]], water: [[620, 420, 100, 80]],
        path: [[50, 50], [130, 450], [250, 50], [370, 450], [490, 50], [610, 450], [730, 380], [750, 450]] },
      { par: 7, tee: [60, 250], cup: [740, 250],    // the lake: a stepping-stone island in the middle, hedges guarding the green
        walls: [[660, 0, 20, 170], [660, 330, 20, 170]], sand: [[620, 180, 40, 140]], water: [[200, 0, 400, 200], [200, 300, 400, 200], [200, 200, 160, 100], [440, 200, 160, 100]],
        path: [[60, 250], [400, 250], [740, 250]] },
    ],
  },
};
