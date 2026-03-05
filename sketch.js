import p5     from 'p5';
import chroma from 'chroma-js';
import { jsPDF } from 'jspdf';

/* ───── PRNG ───── */
function mulberry32(s) {
  s = s >>> 0;
  return () => {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function lrp(a, b, t) { return a + (b - a) * Math.max(0, Math.min(1, t)); }
function clamp01(v) { return Math.max(0, Math.min(1, v)); }
function clampN(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/* ═══════════════════════════════════════════════════════════
   PARAMETERS — V5 DRAMATIC SYSTEM (MASTER + AVANCERET)
   ═══════════════════════════════════════════════════════════ */
const P = {
  beer:         'Fruited Berliner Weisse',
  seed:         42,

  /* ─── MASTER — Beer Data → Design ─── */
  abv:          2.5,    // ABV → form character (angular↔liquid)
  ebc:          13,     // EBC → palette & contrast strategy
  struktur:     0.72,   // Density → cell count & spacing
  krop:         0.88,   // Fylde → mass, thickness, viscosity
  membran:      0.55,   // Membrane → wall thickness (STRONGEST slider)
  gaering:      0.28,   // Chaos → warp, distortion, liquid flow
  kulsyre:      0.42,   // CO₂ → holes, bubbles, microstructure
  filamenter:   0.23,   // Threads → filament network density
  udtryk:       0.18,   // Expression → complexity, mutation, glow

  /* ─── AVANCERET — Direct Design Overrides ─── */
  form:         0.11,   // Blob mode: 0=cells → 0.25=blobs → 0.5=bands → 0.75=slime → 1=diffusion
  kanal:        -0.30,  // Band direction & strength
  skalering:    0.50,   // Scale variance
  dWarpAmt: 0.12, dWarpFreq: 0.56, dCellSize: 0.5, dFill: 0.77, dMembran: 0.5,
  dSoftness: 0.5, dVoids: 0.13, dThreads: 0.5, dMutation: 0.5, dStretch: 0.5,
  dCluster: 0.5, dContrast: 0.5, dGlow: 0.5,

  /* ─── MORPHOLOGY (hidden — driven internally by MASTER+AVANCERET) ─── */
  mMass: 0.50, mConnectivity: 0.00, mPerforation: 0.00,
  mAniso: 0.00, mMembraneBreak: 0.00, mFieldBlend: 0.00,

  /* ─── INTERNAL (computed) ─── */
  formMode: 0, genType: 0, regime: 0,

  /* ─── COLOURS ─── */
  color1: '#c785a8', color2: '#aa0000', color3: '#e89ca9', color4: '#bd7f9f',

  negative:     false,
  negativeMode: 0,
};
window.SOUR_PARAMS = P;

/* ─── BATCH alias: P.batch ↔ P.seed (UI slider stays 'seed') ─── */
Object.defineProperty(P, 'batch', {
  get() { return P.seed; },
  set(v) { P.seed = v; },
  enumerable: false, configurable: true,
});

/* ═══════════════════════════════════════════════════════════
   BEER PRESETS — Dramatically differentiated per style
   All presets use: abv, ebc, struktur, krop, membran, gaering,
   kulsyre, filamenter, udtryk, form, kanal, skalering + colors
   ═══════════════════════════════════════════════════════════ */
const BEERS = {
  'Fruited Berliner Weisse': {
    abv: 2.5, ebc: 13,
    struktur: 0.72, krop: 0.88, membran: 0.55, gaering: 0.28,
    kulsyre: 0.42, filamenter: 0.23, udtryk: 0.18,
    form: 0.11, kanal: -0.30, skalering: 0.50,
    dWarpAmt: 0.12, dWarpFreq: 0.56, dFill: 0.77, dSoftness: 0.50,
    dStretch: 0.50, dVoids: 0.13, dThreads: 0.50, dGlow: 0.50,
    color1: '#c785a8', color2: '#aa0000', color3: '#e89ca9', color4: '#bd7f9f',
    labelColors: { shape: '#240000', letters: '#ff7ec4', text: '#694d6a', logo: '#694d6a', stroke: '#ff7ec4' },
    jitter: { gaering: 0.25, udtryk: 0.25, filamenter: 0.20, kulsyre: 0.20 },
  },
  'Imperial Stout': {
    abv: 6.5, ebc: 12,
    struktur: 0.60, krop: 0.75, membran: 0.70, gaering: 0.40,
    kulsyre: 0.12, filamenter: 0.05, udtryk: 0.50,
    form: 0.20, kanal: 0.00, skalering: 0.10,
    color1: '#cc2266', color2: '#881144', color3: '#ffaacc', color4: '#fff5f8',
    jitter: { krop: 0.15, membran: 0.15, gaering: 0.12 },
  },
  'IPA': {
    abv: 10.0, ebc: 18,
    struktur: 0.35, krop: 0.65, membran: 0.60, gaering: 0.80,
    kulsyre: 0.50, filamenter: 0.10, udtryk: 0.70,
    form: 0.30, kanal: 0.10, skalering: 0.35,
    color1: '#4477aa', color2: '#223366', color3: '#88bbdd', color4: '#e8eef5',
    jitter: { gaering: 0.20, kulsyre: 0.18, udtryk: 0.15, struktur: 0.12 },
  },
  'IPA – New England / Hazy': {
    abv: 9.0, ebc: 28,
    struktur: 0.40, krop: 0.85, membran: 0.75, gaering: 0.40,
    kulsyre: 0.10, filamenter: 0.08, udtryk: 0.35,
    form: 0.22, kanal: 0.00, skalering: 0.15,
    color1: '#7733aa', color2: '#443388', color3: '#cc88dd', color4: '#f0eaf5',
    jitter: { krop: 0.10, membran: 0.12, gaering: 0.12 },
  },
  'Triple IPA – New England / Hazy': {
    abv: 0.5, ebc: 5,
    struktur: 0.70, krop: 0.20, membran: 0.25, gaering: 0.08,
    kulsyre: 0.05, filamenter: 0.00, udtryk: 0.10,
    form: 0.00, kanal: 0.00, skalering: 0.05,
    color1: '#bd8332', color2: '#8acb10', color3: '#dcc8ac', color4: '#ffffff',
    jitter: { struktur: 0.10, gaering: 0.05, udtryk: 0.05 },
  },
  'Pastry Stout': {
    abv: 5.5, ebc: 10,
    struktur: 0.50, krop: 0.40, membran: 0.35, gaering: 0.35,
    kulsyre: 0.55, filamenter: 0.60, udtryk: 0.30,
    form: 0.00, kanal: -0.40, skalering: 0.15,
    color1: '#44aaaa', color2: '#226666', color3: '#88ddcc', color4: '#f2f0e8',
    jitter: { filamenter: 0.18, kulsyre: 0.15, kanal: 0.20 },
  },
  'Brown Ale': {
    abv: 8.0, ebc: 21,
    struktur: 0.49, krop: 0.70, membran: 0.15, gaering: 0.55,
    kulsyre: 0.34, filamenter: 0.20, udtryk: 0.55,
    form: 0.18, kanal: 0.00, skalering: 0.50,
    dWarpAmt: 0.50, dWarpFreq: 0.50, dFill: 0.50, dSoftness: 0.50,
    dStretch: 0.53, dVoids: 0.50, dThreads: 0.50, dGlow: 0.50,
    color1: '#e1a17a', color2: '#655749', color3: '#ccaa66', color4: '#f5efe8',
    labelColors: { shape: '#ffffff', letters: '#611f1f', text: '#611f1f', logo: '#611f1f', stroke: '#ffffff' },
    jitter: { krop: 0.15, gaering: 0.15, udtryk: 0.12 },
  },
  'Wheat Beer – Hefeweizen': {
    abv: 4.5, ebc: 6,
    struktur: 0.55, krop: 0.45, membran: 0.45, gaering: 0.65,
    kulsyre: 0.70, filamenter: 0.30, udtryk: 0.60,
    form: 0.10, kanal: 0.00, skalering: 0.20,
    color1: '#ff4488', color2: '#ee6633', color3: '#55ccaa', color4: '#fdf0f5',
    jitter: { kulsyre: 0.22, gaering: 0.22, udtryk: 0.20 },
  },
  'Smoked Beer': {
    abv: 6.0, ebc: 18,
    struktur: 0.48, krop: 0.58, membran: 0.55, gaering: 0.45,
    kulsyre: 0.18, filamenter: 0.18, udtryk: 0.45,
    form: 0.15, kanal: 0.00, skalering: 0.15,
    color1: '#cc1133', color2: '#22aaaa', color3: '#ffddcc', color4: '#f0f5f2',
    jitter: { gaering: 0.15, udtryk: 0.12, krop: 0.12 },
  },
  'German Pilsner': {
    abv: 5.0, ebc: 8,
    struktur: 0.65, krop: 0.35, membran: 0.30, gaering: 0.25,
    kulsyre: 0.25, filamenter: 0.15, udtryk: 0.20,
    form: 0.05, kanal: 0.00, skalering: 0.10,
    color1: '#ddaa33', color2: '#aa7722', color3: '#ffdd88', color4: '#fcf5e8',
    jitter: { struktur: 0.12, kulsyre: 0.10, gaering: 0.10 },
  },
};
window.SOUR_BEERS = BEERS;

/* ═══════════════════════════════════════════════════════════
   PALETTES — All light backgrounds
   ═══════════════════════════════════════════════════════════ */
const PALETTES = [
  { color1:'#dd3355', color2:'#991133', color3:'#ff8899', color4:'#f8f0ee' },
  { color1:'#cc2266', color2:'#881144', color3:'#ffaacc', color4:'#fff5f8' },
  { color1:'#ff6644', color2:'#cc3322', color3:'#ffaa88', color4:'#fef5f0' },
  { color1:'#ee8833', color2:'#cc6611', color3:'#ffcc88', color4:'#fdf8f0' },
  { color1:'#44aa66', color2:'#226644', color3:'#88ddaa', color4:'#f0f8f2' },
  { color1:'#3388bb', color2:'#225577', color3:'#77ccee', color4:'#eef5fa' },
  { color1:'#7744bb', color2:'#553399', color3:'#bb88ee', color4:'#f3eef8' },
  { color1:'#aa3388', color2:'#772266', color3:'#dd88bb', color4:'#f8eef5' },
  { color1:'#44aaaa', color2:'#227777', color3:'#88ddcc', color4:'#eef8f5' },
  { color1:'#887744', color2:'#665533', color3:'#ccbb88', color4:'#f5f2ea' },
  { color1:'#cc4466', color2:'#993355', color3:'#ff99aa', color4:'#f8f0f2' },
  { color1:'#5588cc', color2:'#334488', color3:'#88bbee', color4:'#f0f3f8' },
];
window.SOUR_PALETTES = PALETTES;

/* ═══════════════════════════════════════════════════════════
   REGIME — ABV-primary selection, simplified
   ═══════════════════════════════════════════════════════════ */
function computeRegime() {
  const ta = clamp01((P.abv - 0.5) / 11.5);
  const te = clamp01((P.ebc - 3) / 27);
  const scores = new Array(8).fill(0);

  // ABV is primary driver — low=angular, high=liquid
  // FOAM(0): bubbly, light, airy
  scores[0] = (1 - ta) * 0.35 + P.kulsyre * 0.35 + (1 - P.krop) * 0.30;
  // TISSUE(1): dense, packed, thick organic
  scores[1] = P.krop * 0.40 + P.membran * 0.35 + (1 - P.kulsyre) * 0.25;
  // SMEAR(2): liquid flow, high chaos
  scores[2] = ta * 0.40 + P.gaering * 0.40 + P.udtryk * 0.20;
  // GRAIN(3): directional, thread-rich
  scores[3] = P.filamenter * 0.50 + P.kulsyre * 0.25 + (1 - P.krop) * 0.25;
  // CRYSTAL(4): clean, angular, wireframe
  scores[4] = (1 - ta) * 0.30 + (1 - P.membran) * 0.35 + (1 - P.krop) * 0.35;
  // GEL(5): large merged blobs, smooth
  scores[5] = ta * 0.25 + P.membran * 0.35 + P.krop * 0.40;
  // CLUSTER(6): dense center, sparse surrounds
  scores[6] = P.gaering * 0.35 + P.krop * 0.30 + te * 0.35;
  // FIBER(7): fiber network dominant
  scores[7] = P.filamenter * 0.50 + P.gaering * 0.30 + P.membran * 0.20;

  let maxScore = -1, maxIdx = 0;
  for (let i = 0; i < 8; i++) {
    if (scores[i] > maxScore) { maxScore = scores[i]; maxIdx = i; }
  }
  P.regime = maxIdx;
  applyRegimeParams(maxIdx);
}

function applyRegimeParams(regime) {
  // Reset all mode flags
  P.microCellScale = 0; P.microCellWall = 0.1; P.microCellFill = 0;
  P.anisotropy = 0; P.anisotropyAngle = 0;
  P.clusterIntensity = 0; P.clusterCount = 1;
  P.fiberDominance = 0; P.voidConnect = 0;
  P.sizeBimodal = 0; P.sizeSkew = 0;
  P.formMode = 0; P.metaSmooth = 0; P.bandAmt = 0; P.bandFreq = 1.0;

  switch (regime) {
    case 0: // FOAM
      P.fillMode = 4; P.membraneStyle = 4; P.threadStyle = 0;
      P.voidMode = 0; P.voidLayers = 1;
      P.sizeSkew = lrp(0, 0.6, P.struktur);
      break;
    case 1: // TISSUE
      P.fillMode = P.krop > 0.7 ? 5 : 2; P.membraneStyle = 3; P.threadStyle = 3;
      P.voidMode = 3; P.voidLayers = 1;
      P.anisotropy = lrp(0, 0.2, P.gaering);
      break;
    case 2: // SMEAR
      P.fillMode = 0; P.membraneStyle = 0;
      P.threadStyle = P.udtryk > 0.6 ? 6 : 0;
      P.voidMode = 0; P.voidLayers = 1;
      P.anisotropy = lrp(0.3, 0.9, P.udtryk);
      P.anisotropyAngle = lrp(-0.5, 0.5, P.gaering) * Math.PI;
      P.fiberDominance = lrp(0, 0.5, P.udtryk);
      P.sizeSkew = lrp(0, 0.4, P.udtryk);
      break;
    case 3: // GRAIN
      P.fillMode = 1; P.membraneStyle = 1;
      P.threadStyle = P.filamenter > 0.55 ? 5 : 1;
      P.voidMode = 2; P.voidLayers = 2;
      P.microCellScale = lrp(0.003, 0.012, P.kulsyre);
      P.microCellWall = lrp(0.06, 0.2, P.membran);
      P.microCellFill = lrp(0.1, 0.6, 1 - P.krop);
      P.anisotropy = lrp(0.2, 0.7, P.filamenter);
      P.anisotropyAngle = -Math.PI / 2;
      P.voidConnect = lrp(0, 0.5, P.kulsyre);
      P.sizeBimodal = lrp(0, 0.8, P.kulsyre);
      P.sizeSkew = 0.3;
      break;
    case 4: // CRYSTAL
      P.fillMode = 1; P.membraneStyle = 5; P.threadStyle = 0;
      P.voidMode = 3; P.voidLayers = 1;
      P.anisotropy = lrp(0, 0.3, P.gaering);
      P.sizeBimodal = lrp(0, 0.4, P.gaering);
      break;
    case 5: // GEL
      P.fillMode = 5; P.membraneStyle = 3; P.threadStyle = 0;
      P.voidMode = 0; P.voidLayers = 1;
      P.anisotropy = lrp(0, 0.3, P.gaering);
      P.sizeSkew = lrp(0.1, 0.5, P.struktur);
      break;
    case 6: // CLUSTER
      P.fillMode = P.krop > 0.6 ? 3 : 0; P.membraneStyle = 0; P.threadStyle = 4;
      P.voidMode = 1; P.voidLayers = P.kulsyre > 0.4 ? 2 : 1;
      P.microCellScale = lrp(0, 0.008, P.krop);
      P.microCellWall = 0.12; P.microCellFill = 0.3;
      P.clusterIntensity = lrp(0.3, 0.9, P.gaering);
      P.clusterCount = Math.floor(1 + P.gaering * 4);
      P.sizeBimodal = lrp(0.3, 0.9, P.krop);
      P.sizeSkew = 0.2;
      break;
    case 7: // FIBER
      P.fillMode = 0; P.membraneStyle = 0;
      P.threadStyle = P.filamenter > 0.7 ? 6 : 0;
      P.voidMode = 0; P.voidLayers = 1;
      P.anisotropy = lrp(0.4, 0.9, P.filamenter);
      P.anisotropyAngle = lrp(-0.3, 0.3, P.gaering) * Math.PI;
      P.fiberDominance = lrp(0.5, 1.0, P.filamenter);
      break;
  }

  const beer = BEERS[P.beer];
  if (beer && beer._zoneModeOverride) {
    P.zoneMode = beer._zoneModeOverride;
    P.zoneSplit = beer._zoneSplitOverride || 0.5;
    P.zoneContrast = beer._zoneContrastOverride || 0.0;
  } else {
    P.zoneMode = 0; P.zoneSplit = 0.5; P.zoneContrast = 0.0;
  }
}

/* ═══════════════════════════════════════════════════════════
   MASTER → INTERNAL — V5 Dramatic Curves
   Every slider: ultra-aggressive pow() curves, massive ranges.
   Morphology effects folded in (no separate panel).
   ═══════════════════════════════════════════════════════════ */
function masterToInternal() {
  const ta = clamp01((P.abv - 0.5) / 11.5);   // 0..1 from ABV
  const te = clamp01((P.ebc - 3) / 27);        // 0..1 from EBC
  const g = P.gaering, k = P.krop, c = P.kulsyre;
  const s = P.struktur, u = P.udtryk;
  const m = P.membran, f = P.filamenter;

  /* ═══════════════════════════════════════════════
     ABV → FORM CHARACTER (primary shape identity)
     Low ABV → angular/geometric, tight
     High ABV → liquid, organic, flowing
     ═══════════════════════════════════════════════ */
  const abvLiquid = Math.pow(ta, 0.5);  // fast ramp to liquid
  const abvDiffBase = lrp(0.30, 0.75, abvLiquid);
  const abvWarpBase = lrp(0.0, 0.12, Math.pow(ta, 0.6));
  const abvFillBoost = lrp(0.0, 0.15, abvLiquid);
  const abvSizeBoost = lrp(0.8, 1.5, abvLiquid);

  /* ═══════════════════════════════════════════════
     EBC → PALETTE & CONTRAST STRATEGY
     Low EBC → pastel, low contrast, subtle
     High EBC → bold, saturated, high contrast
     ═══════════════════════════════════════════════ */
  // These are computed here but applied in cellMapping as multipliers
  P._ebcContrast   = lrp(0.75, 2.5, Math.pow(te, 0.65));
  P._ebcSaturation = lrp(0.65, 2.8, Math.pow(te, 0.65));
  P._ebcGlow       = lrp(0.05, 0.50, te);
  P._ebcBloom      = lrp(0.0, 0.25, te);
  P._ebcGrain      = lrp(0.008, 0.06, te);

  /* ═══════════════════════════════════════════════
     STRUKTUR (density) → cell count & scale
     0=huge sparse cells  1=tiny dense cells
     ═══════════════════════════════════════════════ */
  P.scale          = lrp(0.15, 8.0, Math.pow(s, 0.7));
  P.cultureDensity = lrp(0.95, 0.05, Math.pow(s, 0.6));

  /* ═══════════════════════════════════════════════
     KROP (body/fylde) → fill mass & viscosity
     0=wireframe/empty  1=overfilled/gel
     ═══════════════════════════════════════════════ */
  P.nutrientFill   = lrp(0.05, 1.4, Math.pow(k, 0.5)) + abvFillBoost;
  P.diffusion      = clamp01(lrp(0.30, 0.85, Math.pow(k, 0.50)) + abvDiffBase * 0.2);
  P.mConnectivity  = k > 0.60 ? lrp(0, 0.45, Math.pow((k - 0.60) / 0.40, 0.6)) : 0;

  /* ═══════════════════════════════════════════════
     MEMBRAN → wall thickness (THE STRONGEST SLIDER)
     0=invisible edges  1=massive fat gel walls
     ═══════════════════════════════════════════════ */
  P.membraneThickness = lrp(0.002, 3.5, Math.pow(m, 0.6));

  /* ═══════════════════════════════════════════════
     GAERING (chaos) → ALL warp & distortion
     0=perfect geometry  1=extreme liquid chaos
     ═══════════════════════════════════════════════ */
  P.fermentChaos   = lrp(0.0, 1.0, Math.pow(g, 0.55));
  P.directWarpBoost = lrp(0.0, 0.60, Math.pow(g, 0.50));
  P.liquidWarp      = lrp(0.0, 1.0, Math.pow(g, 0.45)) + abvWarpBase;
  P.smearStr        = lrp(0.0, 0.55, Math.pow(g, 0.55));

  /* ═══════════════════════════════════════════════
     KULSYRE (CO₂) → holes, bubbles, microstructure
     0=completely solid  1=swiss cheese + sparkle
     ═══════════════════════════════════════════════ */
  P.voidDensity     = lrp(0.0, 0.98, Math.pow(c, 0.35));
  P.voidMinRadius   = lrp(0.02, 0.55, Math.pow(c, 0.50));
  P.voidMaxRadius   = lrp(0.10, 1.2, Math.pow(c, 0.45));
  P.voidSoftness    = lrp(0.02, 0.85, c);
  P.voidBias        = 0.45;
  P._kulsyreBubbleCount = Math.min(64, Math.floor(c * 40));
  P.mPerforation    = c > 0.50 ? lrp(0, 0.45, Math.pow((c - 0.50) / 0.50, 0.6)) : 0;
  // Micro-cell overlay at high kulsyre
  if (c > 0.50) {
    P.microCellScale = lrp(0, 0.010, (c - 0.50) * 2);
    P.microCellWall = lrp(0.06, 0.18, c);
    P.microCellFill = lrp(0.1, 0.5, 1 - k);
  }

  /* ═══════════════════════════════════════════════
     FILAMENTER → thread / filament network
     0=none  1=dense web
     ═══════════════════════════════════════════════ */
  P.threadDensity   = lrp(0.0, 0.98, Math.pow(f, 0.35));
  P.threadThickness = lrp(0.02, 1.2, Math.pow(f, 0.50));
  P.threadWaviness  = lrp(0.02, 1.2, f);
  P.threadContrast  = lrp(0.10, 1.0, Math.pow(f, 0.40));
  P.threadAttach    = lrp(0.90, 0.10, f);
  // High filamenter drives fiberDominance
  if (f > 0.45) {
    P.fiberDominance = clampN(P.fiberDominance + lrp(0, 0.70, (f - 0.45) / 0.55), 0, 1);
  }

  /* ═══════════════════════════════════════════════
     UDTRYK (expression) → complexity & art direction
     0=clean, minimal  1=maximal complexity, wild
     ═══════════════════════════════════════════════ */
  P.colonyMutation   = lrp(0.0, 1.0, Math.pow(u, 0.5));
  P.colonyMutation   = clampN(P.colonyMutation + te * 0.20, 0, 1);
  P.fluorescence     = lrp(0.0, 1.0, Math.pow(u, 0.50)) + P._ebcGlow;
  P.bloom            = lrp(0.0, 0.80, Math.pow(u, 0.55)) + P._ebcBloom;
  P.cellTexture      = lrp(0.0, 0.85, Math.pow(u, 0.55));
  P.microscopeNoise  = lrp(0.005, 0.15, u * 0.7) + P._ebcGrain;
  P.lensAberration   = lrp(0.0, 0.35, Math.pow(u, 0.70));
  P.bgBlur           = lrp(0.0, 0.25, u * 0.5);
  P.bgStyle          = 0;
  P.stainIntensity   = lrp(0.0, 0.55, Math.pow(te, 0.6));
  // Udtryk drives internal field blend (organic noise at high expression)
  P.mFieldBlend      = u > 0.50 ? lrp(0, 0.50, Math.pow((u - 0.50) / 0.50, 0.6)) : 0;
  // Udtryk drives membrane break (at extreme values)
  P.mMembraneBreak   = u > 0.70 ? lrp(0, 0.35, (u - 0.70) / 0.30) : 0;

  /* ─── Slide stretch from udtryk ─── */
  P.slideStretch = u > 0.5 ? lrp(0, 1.2, Math.pow((u - 0.5) * 2, 1.1)) : 0;
  const beer = BEERS[P.beer];
  if (beer && beer.slideStretch !== undefined) P.slideStretch = beer.slideStretch;
  P.directionalBias = P.slideStretch;

  /* ═══════════════════════════════════════════════
     REGIME — apply mode flags (non-destructive)
     ═══════════════════════════════════════════════ */
  applyRegimeParams(P.regime);

  // Kulsyre override: always allow voids when kulsyre active
  if (P.kulsyre > 0.05) {
    P.voidMode = Math.min(P.voidMode, 2);
    P.voidLayers = Math.max(P.voidLayers, 1);
  }

  /* ═══════════════════════════════════════════════
     MULTI-GENERATOR PIPELINE (form slider)
     ═══════════════════════════════════════════════ */
  if      (P.form < 0.20) P.genType = 0;   // Voronoi
  else if (P.form < 0.40) P.genType = 1;   // Metaball
  else if (P.form < 0.60) P.genType = 2;   // Bands
  else if (P.form < 0.80) P.genType = 3;   // Slime-mold
  else                     P.genType = 4;   // Diffusion
  P.formMode = P.genType;

  // Kanal: directional bias
  const kv = clamp01(Math.abs(P.kanal));
  if (kv > 0.10) {
    P.anisotropy      = clampN(P.anisotropy + kv * 0.70, 0, 1);
    P.anisotropyAngle = P.kanal > 0 ? -Math.PI / 2 : 0;
    P.fiberDominance  = clampN(P.fiberDominance + kv * 0.40, 0, 1);
    if (kv > 0.55) P.threadStyle = 5;
    else           P.threadStyle = P.kanal > 0 ? 1 : 2;
  }

  // Band params
  P.bandFreq     = P.genType === 2 ? lrp(1.5, 14.0, P.struktur) : lrp(1.2, 10.0, kv);
  P.bandContrast = lrp(0.5, 2.5, clamp01(P.krop * 0.7 + kv * 0.3));
  P.bandAmt      = P.genType === 2 ? 1.0 : Math.pow(kv, 0.75);

  // Bubble params
  P.bubbleRim    = lrp(0.012, 0.07, clamp01(P.form * 0.55 + 0.18 - P.membraneThickness * 0.04));
  P.bubbleGlow   = lrp(0.05, 0.95, clamp01(P.form * 0.55 + P.fluorescence * 0.45));
  P.bubbleInner  = lrp(0.00, 0.90, clamp01(P.form * 0.70 + P.stainIntensity * 0.30));

  // Metaball smooth-merge
  P.metaSmooth   = P.genType === 1
    ? clamp01(0.3 + P.krop * 0.7)
    : clamp01(Math.pow(clamp01(P.form * 0.65 + P.diffusion * 0.35), 1.2));

  // Scale variance from Størrelse slider (merged skalering into dCellSize)
  // dCellSize now ALSO drives scale variance for dramatic size spread
  const _szDev = Math.abs((P.dCellSize - 0.5) * 2);
  P.scaleVariance = lrp(0.0, 4.5, Math.pow(_szDev, 0.45));
  P.sizeBimodal   = clampN(P.sizeBimodal + _szDev * 0.65, 0, 1);

  /* ═══════════════════════════════════════════════
     AVANCERET OVERRIDES — applied LAST, strongest layer
     Simplified: fewer sliders, more dramatic per slider.
     Each defaults to 0.5 (= no effect).
     ═══════════════════════════════════════════════ */
  const _DTHR = 0.03;
  function _dPush(cur, lo, hi, d) {
    const dev = (d - 0.5) * 2;
    if (Math.abs(dev) < _DTHR) return cur;
    const t = Math.pow(Math.abs(dev), 0.35);    // ULTRA aggressive curve — visible at 10% travel
    return lrp(cur, dev > 0 ? hi : lo, t);
  }

  // 1. Forvrængning (warp) — bypass fermentChaos bottleneck
  P.fermentChaos    = _dPush(P.fermentChaos,      0.0,  1.0,   P.dWarpAmt);
  P.directWarpBoost = P.directWarpBoost + Math.pow(clamp01(Math.max(0, (P.dWarpAmt - 0.5) * 2)), 0.55) * 1.5;
  P.liquidWarp      = P.liquidWarp      + Math.pow(clamp01(Math.max(0, (P.dWarpAmt - 0.5) * 2)), 0.45) * 2.0;

  // 2. Frekvens (warp frequency)
  P.warpFreqMul     = _dPush(1.0,                 0.02, 15.0,  P.dWarpFreq);

  // 3. Størrelse — cell size + scale variance (merged)
  P.scale           = _dPush(P.scale,              12.0, 0.08,  P.dCellSize);
  P.cultureDensity  = _dPush(P.cultureDensity,     0.03, 0.99,  P.dCellSize);

  // 4. Fylde — fill + mutation combined (more fill = bigger organic blobs)
  P.nutrientFill    = _dPush(P.nutrientFill,       0.01, 1.8,   P.dFill);
  P.colonyMutation  = _dPush(P.colonyMutation,     0.0,  1.0,   P.dFill);
  // High fill also pushes membrane thickness down and diffusion up → blobby
  if (P.dFill > 0.55) {
    const fillPush = (P.dFill - 0.55) / 0.45;
    P.membraneThickness *= lrp(1.0, 0.15, fillPush);
    P.diffusion = clamp01(P.diffusion + fillPush * 0.40);
    P.metaSmooth = clamp01(P.metaSmooth + fillPush * 0.50);
  }

  // 5. Blødhed — gradient bleeding: drives diffusion + smear + softPow + membrane thinning
  P.diffusion       = _dPush(P.diffusion,          0.02, 1.0,   P.dSoftness);
  P.membraneThickness = _dPush(P.membraneThickness, 0.002, 4.0, P.dSoftness < 0.5 ? P.dSoftness : 0.5);
  // Above 0.5: softness thins membrane, adds smear, pushes blob merging
  if (P.dSoftness > 0.52) {
    const softPush = Math.pow((P.dSoftness - 0.5) / 0.5, 0.4);
    P.smearStr     = P.smearStr + softPush * 0.80;
    P.membraneThickness *= lrp(1.0, 0.05, softPush);
    P.metaSmooth   = clamp01(P.metaSmooth + softPush * 0.60);
    P.liquidWarp   = P.liquidWarp + softPush * 0.50;
    P.bloom        = P.bloom + softPush * 0.35;
  }
  // Below 0.5: hardens edges, thickens membrane
  if (P.dSoftness < 0.48) {
    const hardPush = Math.pow((0.5 - P.dSoftness) / 0.5, 0.4);
    P.membraneThickness = _dPush(P.membraneThickness, P.membraneThickness, 5.0, 1.0 - P.dSoftness);
  }

  // 6. Stræk — horizontal vs vertical orientation
  const _dsDev = (P.dStretch - 0.5) * 2;
  if (Math.abs(_dsDev) > _DTHR) {
    const _dsT = Math.pow(Math.abs(_dsDev), 0.40);
    P.slideStretch  = lrp(P.slideStretch, _dsDev > 0 ? 1.5 : -1.5, _dsT);
    P.anisotropy    = clampN(P.anisotropy + Math.abs(_dsDev) * 0.45, 0, 1);
    P.directionalBias = P.slideStretch;
  }

  // 7. Porer — DRAMATIC voids: swiss cheese, holes, perforations
  P.voidDensity     = _dPush(P.voidDensity,        0.0,  0.98,  P.dVoids);
  P.voidMinRadius   = _dPush(P.voidMinRadius || 0.08, 0.02, 0.65, P.dVoids);
  P.voidMaxRadius   = _dPush(P.voidMaxRadius || 0.20, 0.10, 1.5,  P.dVoids);
  P.voidSoftness    = _dPush(P.voidSoftness  || 0.20, 0.02, 0.95, P.dVoids);
  // Extra: at high voids, also perforate and thin membrane
  if (P.dVoids > 0.55) {
    const voidPush = (P.dVoids - 0.55) / 0.45;
    P.mPerforation   = clampN(P.mPerforation + voidPush * 0.80, 0, 1);
    P.voidLayers     = Math.max(P.voidLayers, Math.ceil(voidPush * 3));
    P.microCellScale = Math.max(P.microCellScale || 0, voidPush * 0.015);
  }

  // 8. Netværk — DRAMATIC threads: dense web, visible fibers
  P.threadDensity   = _dPush(P.threadDensity,      0.0,  0.98,  P.dThreads);
  P.threadThickness = _dPush(P.threadThickness || 0.25, 0.02, 1.5, P.dThreads);
  P.threadWaviness  = _dPush(P.threadWaviness  || 0.20, 0.02, 1.5, P.dThreads);
  P.threadContrast  = _dPush(P.threadContrast  || 0.30, 0.10, 1.0, P.dThreads);
  // Extra: at high threads, also push fiber dominance and connectivity
  if (P.dThreads > 0.55) {
    const threadPush = (P.dThreads - 0.55) / 0.45;
    P.fiberDominance  = clampN((P.fiberDominance || 0) + threadPush * 0.90, 0, 1);
    P.mConnectivity   = clampN(P.mConnectivity + threadPush * 0.55, 0, 1);
    P.threadAttach    = clampN(0.15, 0, 1);
  }

  // 9. Glow / fluorescence / bloom — HOT at max
  P.fluorescence    = _dPush(P.fluorescence,        0.0,  1.0,   P.dGlow);
  P.bloom           = _dPush(P.bloom,               0.0,  2.0,   P.dGlow);
  P.lensAberration  = _dPush(P.lensAberration,      0.0,  0.45,  P.dGlow);
  // Contrast/saturation also boosted by glow
  P.contrastMul     = _dPush(1.0,                  0.15, 5.0,   P.dGlow);
  P.saturationMul   = _dPush(1.0,                  0.10, 4.5,   P.dGlow);

  // Morphology: aniso from mAniso (hidden slider, but still wired)
  if (P.mAniso > 0.01) {
    P.anisotropy = clampN(P.anisotropy + P.mAniso * 0.75, 0, 1);
  }
  // Morphology: mass from mMass (hidden, still wired)
  // (applied as uMassField in shader, handled by cellMapping)
}

/* ═══════════════════════════════════════════════════════════
   APPLY PRESET
   ═══════════════════════════════════════════════════════════ */
function applyPreset(name) {
  const b = BEERS[name];
  if (!b) { console.warn('[SOUR] applyPreset: beer not found:', name); return; }
  console.log('[SOUR] applyPreset:', name);
  P.beer = name;
  const keys = ['abv','ebc','gaering','krop','kulsyre','struktur','udtryk',
                'membran','filamenter','form','kanal','skalering',
                'color1','color2','color3','color4'];
  keys.forEach(k => { if (b[k] !== undefined) P[k] = b[k]; });
  P.negative = false;
  P.negativeMode = 0;
  // Reset all avanceret overrides to neutral first
  P.dWarpAmt = P.dWarpFreq = P.dCellSize = P.dFill = 0.5;
  P.dSoftness = P.dVoids = P.dThreads = P.dStretch = P.dGlow = 0.5;
  // Legacy: keep these at neutral so old presets don't break
  P.dMembran = P.dMutation = P.dCluster = P.dContrast = 0.5;
  // Then apply any preset-specific avanceret overrides
  const dKeys = ['dWarpAmt','dWarpFreq','dCellSize','dFill','dMembran',
                 'dSoftness','dVoids','dThreads','dMutation','dStretch',
                 'dCluster','dContrast','dGlow'];
  dKeys.forEach(k => { if (b[k] !== undefined) P[k] = b[k]; });
  // Reset morphology (now hidden / internal)
  P.mMass = 0.50; P.mConnectivity = 0.00; P.mPerforation = 0.00;
  P.mAniso = 0.00; P.mMembraneBreak = 0.00; P.mFieldBlend = 0.00;
  // Apply per-beer label colours if defined
  if (b.labelColors) {
    const COMP = window.SOUR_COMPOSITION;
    if (COMP) {
      COMP.labelColors = { ...b.labelColors };
      window.SOUR_APPLY_LABEL_COLORS_SILENT?.();
    }
  }
}
window.SOUR_APPLY_PRESET = applyPreset;

/* ═══════════════════════════════════════════════════════════
   CONTROLLED RANDOMIZE — preserves style identity
   ═══════════════════════════════════════════════════════════ */
const DEFAULT_JITTER = {
  abv: 1.0, ebc: 3,
  gaering: 0.18, krop: 0.16, kulsyre: 0.16,
  struktur: 0.12, udtryk: 0.18,
  membran: 0.14, filamenter: 0.16,
};
const LIMITS = {
  abv:[0.5,12], ebc:[3,30],
  gaering:[0,1], krop:[0,1], kulsyre:[0,1], struktur:[0,1],
  udtryk:[0,1], membran:[0,1], filamenter:[0,1],
};

function randomizeControlled() {
  const base = BEERS[P.beer] || BEERS['SOUR'];
  const j = { ...DEFAULT_JITTER, ...(base.jitter || {}) };
  P.seed = Math.floor(Math.random() * 9999) + 1;
  const params = ['abv','ebc','gaering','krop','kulsyre','struktur','udtryk',
                  'membran','filamenter'];
  params.forEach(key => {
    const baseVal = base[key];
    const jit = j[key] || DEFAULT_JITTER[key] || 0.12;
    const [lo, hi] = LIMITS[key];
    const spread = (Math.random() - 0.5) * 2 * jit;
    P[key] = clampN(baseVal + spread, lo, hi);
    if (key === 'ebc') P[key] = Math.round(P[key]);
    if (key === 'abv') P[key] = +P[key].toFixed(1);
  });

  // Randomize form / kanal (moderate variation)
  P.form = clampN((base.form || 0) + (Math.random() - 0.5) * 0.5, 0, 1);
  P.kanal = clampN((base.kanal || 0) + (Math.random() - 0.5) * 0.8, -1, 1);
  P.skalering = 0;

  // Randomize avanceret overrides (centered on 0.5 with moderate spread)
  const dParams = ['dWarpAmt','dWarpFreq','dCellSize','dFill',
                   'dSoftness','dVoids','dThreads','dStretch','dGlow'];
  dParams.forEach(k => {
    P[k] = clampN(0.5 + (Math.random() - 0.5) * 0.7, 0, 1);
  });
  // Legacy neutrals
  P.dMembran = P.dMutation = P.dCluster = P.dContrast = 0.5;

  // Morphology stays at neutral (driven internally)
  P.mMass = 0.50; P.mConnectivity = 0.00; P.mPerforation = 0.00;
  P.mAniso = 0.00; P.mMembraneBreak = 0.00; P.mFieldBlend = 0.00;

  randomizePalette(base);
  P.negative = false;
  P.negativeMode = 0;
}

function randomizePalette(base) {
  const hueShift = (Math.random() - 0.5) * 80;
  const sJitter = 0.08, lJitter = 0.06;
  function shiftColor(hex, keepLight) {
    try {
      let [h, s, l] = chroma(hex).hsl();
      h = ((h || 0) + hueShift + 360) % 360;
      s = clampN(s + (Math.random()-0.5)*sJitter*2, 0.10, 0.85);
      l = keepLight
        ? clampN(l + (Math.random()-0.5)*0.04, 0.88, 0.97)
        : clampN(l + (Math.random()-0.5)*lJitter*2, 0.15, 0.75);
      return chroma.hsl(h, s, l).hex();
    } catch (_) { return hex; }
  }
  P.color1 = shiftColor(base.color1, false);
  P.color2 = shiftColor(base.color2, false);
  P.color3 = shiftColor(base.color3, false);
  P.color4 = shiftColor(base.color4, true);
}
window.SOUR_RANDOMIZE = randomizeControlled;

/* ═══════════════════════════════════════════════════════════
   PARAMETER MAPPING → shader — V5 Dramatic
   ═══════════════════════════════════════════════════════════ */
const MAX_BLOBS = 150;

function cellMapping() {
  masterToInternal();
  const te = (P.ebc-3)/27, ta = (P.abv-0.5)/11.5;
  const sn = (P.scale-0.4)/3.6;
  const scaleRef = Math.max(0.3, P.scale / 1.5);

  const baseCount = lrp(6, 135, Math.pow(P.cultureDensity, 0.7));
  const scaleInv  = lrp(2.2, 0.28, sn);
  const blobCount = Math.max(4, Math.round(baseCount * scaleInv));
  const sp = Math.pow(sn, 1.3);
  const radiusMinBase = lrp(20, 140, sp);
  const radiusMaxBase = lrp(65, 400, sp);
  const sv = P.scaleVariance || 0;
  const radiusMin = radiusMinBase * Math.max(0.05, 1.0 - sv * 0.75);
  const radiusMax = radiusMaxBase * (1.0 + sv * 1.8);
  const rimWidth   = lrp(0.02, 0.78, Math.pow(P.membraneThickness, 0.75));
  const fillRadius = lrp(0.25, 2.2, Math.pow(P.nutrientFill, 0.55));
  const softPow    = lrp(6.0, 0.08, P.diffusion);       // ultra-soft at max
  const abvMul     = lrp(0.5, 4.2, ta);
  const warpAmp    = lrp(0.0, 0.40, P.fermentChaos * P.fermentChaos) * abvMul
                   + (P.directWarpBoost || 0);
  const microWarp  = lrp(0.0, 0.16, P.fermentChaos) * abvMul;
  const cellWarpAmp = lrp(0.0, 1.4, P.colonyMutation);  // doubled for depth
  const sq = P.slideStretch;
  let squeezeX = sq > 0 ? lrp(1.0, 2.5, sq) : lrp(1.0, 0.40, -sq);
  let squeezeY = sq > 0 ? lrp(1.0, 0.40, sq) : lrp(1.0, 2.5, -sq);

  // Morphology aniso boost to squeeze
  if (P.mAniso > 0.01) {
    const anisoB = P.mAniso * 1.8;
    if (squeezeX >= squeezeY) squeezeX *= (1.0 + anisoB);
    else squeezeY *= (1.0 + anisoB);
  }
  // Internal aniso from params
  if (P.anisotropy > 0.05) {
    const anisoB = P.anisotropy * 1.2;
    if (squeezeX >= squeezeY) squeezeX *= (1.0 + anisoB);
    else squeezeY *= (1.0 + anisoB);
  }

  const wfm = P.warpFreqMul || 1.0;
  const cm  = P.contrastMul  || 1.0;
  const sm  = P.saturationMul || 1.0;
  // Contrast/saturation: EBC primary driver + avanceret override
  const contrast     = (P._ebcContrast || lrp(0.75, 2.5, te)) * cm;
  const saturation   = (P._ebcSaturation || lrp(0.65, 2.8, te)) * sm;
  const junctionBoost = lrp(0.08, 2.5, P.fermentChaos*0.4 + P.colonyMutation*0.6);
  const voidScale = lrp(0.0010, 0.0065, P.voidDensity) / scaleRef;
  const threadScale = lrp(0.0015, 0.0080, P.threadDensity) / scaleRef;

  return {
    blobCount: Math.min(Math.max(blobCount, 4), 150),
    radiusMin, radiusMax,
    rimWidth, fillRadius, softPow,
    squeezeX, squeezeY, cellWarpAmp,
    warpBigFreq:   lrp(0.20, 1.8, ta) / Math.pow(scaleRef, 0.4) * wfm,
    warpBigAmp:    warpAmp * Math.pow(scaleRef, 0.5),
    warpMicroFreq: lrp(1.5, 8.0, P.fermentChaos) / Math.pow(scaleRef, 0.4) * wfm,
    warpMicroAmp:  microWarp * Math.pow(scaleRef, 0.5),
    contrast, saturation,
    grainAmt:      P.microscopeNoise,
    junctionBoost,
    glowStr:       P.fluorescence,
    innerGlowStr:  P.stainIntensity,
    chromAb:       P.lensAberration,
    bloomStr:      P.bloom,
    bgStyle:       P.bgStyle,
    bgBlur:        P.bgBlur,
    negative:      P.negative ? 1.0 : 0.0,
    negativeMode:  P.negativeMode,
    voidScale,
    voidMinR:      P.voidMinRadius,
    voidMaxR:      P.voidMaxRadius,
    voidSoft:      lrp(0.005, 0.08, P.voidSoftness),
    voidBiasVal:   P.voidBias,
    threadScale,
    threadW:       lrp(0.05, 0.60, P.threadThickness),
    threadWave:    lrp(0.05, 0.65, P.threadWaviness),
    threadStr:     P.threadContrast,
    threadBias:    P.threadAttach,
    fillMode:        P.fillMode,
    membraneStyle:   P.membraneStyle,
    threadStyle:     P.threadStyle,
    voidMode:        P.voidMode,
    voidLayers:      P.voidLayers,
    cellTexture:     P.cellTexture,
    directionalBias: P.directionalBias,
    zoneMode:        P.zoneMode,
    zoneSplit:       P.zoneSplit,
    zoneContrast:    P.zoneContrast,
    microCellScale:    P.microCellScale || 0,
    microCellWall:     P.microCellWall || 0.1,
    microCellFill:     P.microCellFill || 0,
    fiberDominance:    P.fiberDominance || 0,
    voidConnect:       P.voidConnect || 0,
    regime:            P.regime,
    clusterIntensity:  P.clusterIntensity || 0,
    genType:     P.genType,
    formMode:    P.formMode,
    metaSmooth:  P.metaSmooth,
    bandFreq:    P.bandFreq,
    bandContrast:P.bandContrast,
    bandAmt:     P.bandAmt,
    bubbleRim:   P.bubbleRim,
    bubbleGlow:  P.bubbleGlow,
    bubbleInner: P.bubbleInner,
    scaleVariance: P.scaleVariance,
    liquidWarp:  P.liquidWarp || 0,
    smearStr:    P.smearStr || 0,
    massField:        (P.mMass - 0.5) * 2.0,
    connectField:     P.mConnectivity,
    perforationField: P.mPerforation,
    membraneBreak:    P.mMembraneBreak,
    fieldBlend:       P.mFieldBlend,
  };
}

/* ═══════════════════════════════════════════════════════════
   GLSL NOISE
   ═══════════════════════════════════════════════════════════ */
const GLSL_NOISE = `
  float hash21(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 19.31);
    return fract(p.x * p.y);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f*f*f*(f*(f*6.0-15.0)+10.0);
    return mix(
      mix(hash21(i),           hash21(i+vec2(1,0)), f.x),
      mix(hash21(i+vec2(0,1)), hash21(i+vec2(1,1)), f.x),
      f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    mat2 rot = mat2(0.80, 0.60, -0.60, 0.80);
    for (int i = 0; i < 5; i++) {
      v += a * vnoise(p);
      p  = rot * p * 2.03 + vec2(1.7, 9.2);
      a *= 0.48;
    }
    return v;
  }
  vec2 domainWarp(vec2 uv, float bF, float bA, float mF, float mA, float seed) {
    return vec2(
      bA*(fbm(uv*bF + seed) - 0.5) + mA*(vnoise(uv*mF + seed*2.0) - 0.5),
      bA*(fbm(uv*bF + seed + 50.0) - 0.5) + mA*(vnoise(uv*mF + seed*2.0 + 80.0) - 0.5)
    );
  }
  vec2 cellWarp(vec2 delta, float cellSeed, float amp) {
    float ang = fbm(delta * 0.009 + cellSeed) * 6.2832;
    float mag = vnoise(delta * 0.006 + cellSeed + 100.0) * amp;
    return vec2(cos(ang), sin(ang)) * mag;
  }
  float grainFn(vec2 uv, float s) {
    return fract(sin(dot(uv, vec2(12.9898, 78.233)) + s) * 43758.5453);
  }
`;

/* ═══════════════════════════════════════════════════════════
   FRAGMENT SHADER — V3 with regime support
   ═══════════════════════════════════════════════════════════ */
const FRAG_SHADER = `
  precision highp float;
  #define NB ${MAX_BLOBS}

  uniform vec2  uRes;
  uniform float uSeed, uTime;
  uniform int   uCount;
  uniform float uFill, uRimW, uSoftPow;
  uniform float uSqX, uSqY, uCWarp;
  uniform float uCX[NB], uCY[NB], uR[NB];
  uniform float uWBF, uWBA, uWMF, uWMA;
  uniform float uGrain, uContrast, uSat, uJBoost;
  uniform float uGlow, uIGlow, uChrom, uBloom;
  uniform float uBgStyle, uBgBlur;
  uniform float uNeg, uNegMode;
  uniform vec3  uC1, uC2, uC3, uC4;

  // Voids
  uniform float uVoidScale, uVoidMinR, uVoidMaxR, uVoidSoft, uVoidBias;
  // Threads
  uniform float uThreadScale, uThreadW, uThreadWave, uThreadStr, uThreadBias;
  // Modes (set by regime)
  uniform float uFillMode, uMembraneStyle, uThreadStyle;
  uniform float uVoidMode, uVoidLayers, uCellTexture, uDirBias;
  uniform float uZoneMode, uZoneSplit, uZoneContrast;
  // Regime
  uniform float uMicroCellScale, uMicroCellWall, uMicroCellFill;
  uniform float uFiberDominance, uVoidConnect, uRegime, uClusterIntensity;

  // ─── MULTI-GENERATOR PIPELINE ───
  uniform float uGenType;      // 0=voronoi 1=metaball 2=bands 3=slime 4=diffusion
  uniform float uFormMode;     // backward compat (same as uGenType)
  uniform float uMetaSmooth;   // metaball merge radius (px²)
  uniform float uBandFreq;     // band spatial frequency
  uniform float uBandContrast; // band sharpness
  uniform float uBandAmt;      // band blend opacity
  uniform float uBubbleRim;    // bubble wall fraction of radius
  uniform float uBubbleGlow;   // bubble outer glow
  uniform float uBubbleInner;  // bubble inner specular

  // ─── DRAMATISK: liquid warp + smear ───
  uniform float uLiquidWarp;   // extra large-scale liquid displacement (0–0.65)
  uniform float uSmearStr;     // directional smear/blur strength (0–0.55)

  // ─── MORPHOLOGY FIELDS (topology-first) ───
  uniform float uMassField;        // -1=sparse/skeletal  0=neutral  +1=dense/solid
  uniform float uConnectField;     // 0=isolated cells → 1=merged tissue
  uniform float uPerforationField; // 0=solid → 1=sponge-like holes
  uniform float uMembraneBreak;    // 0=intact walls → 1=dissolved membranes
  uniform float uFieldBlend;       // 0=geometric voronoi → 1=organic noise field

  // ─── KULSYRE BUBBLES ───
  uniform float uBubbleCount;
  uniform float uBubblePosX[64];
  uniform float uBubblePosY[64];
  uniform float uBubbleRad[64];

  ${GLSL_NOISE}

  vec3 rgb2hsv(vec3 c) {
    vec4 K = vec4(0.0,-1.0/3.0,2.0/3.0,-1.0);
    vec4 p = mix(vec4(c.bg,K.wz), vec4(c.gb,K.xy), step(c.b,c.g));
    vec4 q = mix(vec4(p.xyw,c.r), vec4(c.r,p.yzx), step(p.x,c.r));
    float d = q.x - min(q.w,q.y);
    return vec3(abs(q.z+(q.w-q.y)/(6.0*d+1e-10)), d/(q.x+1e-10), q.x);
  }
  vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0,2.0/3.0,1.0/3.0,3.0);
    vec3 p = abs(fract(c.xxx+K.xyz)*6.0-K.www);
    return c.z*mix(K.xxx, clamp(p-K.xxx,0.0,1.0), c.y);
  }

  /* ─── VOID WORLEY with connectivity ─── */
  float voidWorleyEx(vec2 px, float scale, float minR, float maxR, float soft, float connect) {
    vec2 gp = px * scale;
    vec2 id = floor(gp);
    float f1 = 100.0, f2 = 100.0;
    for (int iy = -1; iy <= 1; iy++) {
      for (int ix = -1; ix <= 1; ix++) {
        vec2 nb = id + vec2(float(ix), float(iy));
        float r1 = hash21(nb * 1.23 + uSeed * 0.17 + 33.0);
        float r2 = hash21(nb * 2.71 + uSeed * 0.31 + 77.0);
        vec2 pt = nb + vec2(r1, r2);
        float d = length(gp - pt);
        if (d < f1) { f2 = f1; f1 = d; }
        else if (d < f2) { f2 = d; }
      }
    }
    float vr = mix(minR, maxR, hash21(floor(gp) + uSeed * 0.5));
    float isolated = smoothstep(vr - soft, vr + soft, f1);
    float edges = f2 - f1;
    float connected = smoothstep(0.08, 0.30, edges);
    return mix(isolated, connected, connect);
  }

  /* ─── VOID MASK ─── */
  float voidMask(vec2 px, float cellDist, float insideMask) {
    if (uVoidScale < 0.001 || uVoidMode > 2.5) return 1.0;
    float v1 = voidWorleyEx(px, uVoidScale, uVoidMinR, uVoidMaxR, uVoidSoft, uVoidConnect);
    float v2 = 1.0;
    if (uVoidLayers > 1.5) {
      v2 = voidWorleyEx(px, uVoidScale*3.5, uVoidMinR*0.3, uVoidMaxR*0.4, uVoidSoft*0.5, uVoidConnect);
      v2 = mix(1.0, v2, 0.6);
    }
    float combined = v1 * v2;
    if (uVoidMode < 0.5) {
      return combined;
    } else if (uVoidMode < 1.5) {
      return mix(1.0, combined, insideMask);
    } else {
      return combined;
    }
  }

  /* ─── THREAD FILAMENTS ─── */
  float threadMask(vec2 px, float membraneDist) {
    if (uThreadScale < 0.001) return 0.0;
    vec2 p = px * uThreadScale;
    float v = 0.0;

    if (uThreadStyle < 0.5) {
      // Style 0: WEB / RANDOM
      p += vec2(
        fbm(p * 0.35 + uSeed * 0.4) - 0.5,
        fbm(p * 0.35 + uSeed * 0.4 + 60.0) - 0.5
      ) * uThreadWave * 8.0;
      float a = 1.0, f = 1.0;
      mat2 rot = mat2(0.80, 0.60, -0.60, 0.80);
      for (int i = 0; i < 3; i++) {
        float n = 1.0 - abs(vnoise(p*f + float(i)*20.0 + uSeed)*2.0 - 1.0);
        v += n*n*a; f *= 2.3; a *= 0.42; p = rot * p;
      }
      v /= 1.63;
    } else if (uThreadStyle < 1.5) {
      // Style 1: PARALLEL VERTICAL (wood grain)
      vec2 sp = p;
      sp.y *= 0.08;
      sp.x += fbm(vec2(p.y * 0.3, uSeed)) * uThreadWave * 3.0;
      v = 1.0 - abs(vnoise(sp + uSeed)*2.0 - 1.0);
      v = v*v;
      vec2 hp = p;
      hp.x *= 0.06;
      hp.y += fbm(vec2(p.x * 0.2, uSeed + 50.0)) * uThreadWave * 2.0;
      float hRay = 1.0 - abs(vnoise(hp + uSeed + 100.0)*2.0 - 1.0);
      hRay = hRay*hRay*0.5;
      v = max(v, hRay);
    } else if (uThreadStyle < 2.5) {
      // Style 2: PARALLEL HORIZONTAL
      vec2 sp = p;
      sp.x *= 0.08;
      sp.y += fbm(vec2(p.x * 0.3, uSeed)) * uThreadWave * 3.0;
      v = 1.0 - abs(vnoise(sp + uSeed)*2.0 - 1.0);
      v = v*v;
    } else if (uThreadStyle < 3.5) {
      // Style 3: BOUNDARY-FOLLOWING (connective tissue)
      float nearMem = smoothstep(40.0, 5.0, membraneDist);
      p += vec2(fbm(p*0.25 + uSeed*0.3) - 0.5) * uThreadWave * 6.0;
      float n = 1.0 - abs(vnoise(p + uSeed)*2.0 - 1.0);
      v = n*n*nearMem;
    } else if (uThreadStyle < 4.5) {
      // Style 4: STIPPLE / DOTS
      float dots = vnoise(p*3.0 + uSeed);
      v = smoothstep(0.72, 0.78, dots);
      v += smoothstep(0.82, 0.85, vnoise(p*8.0 + uSeed + 50.0)) * 0.5;
    } else if (uThreadStyle < 5.5) {
      // Style 5: GEL BANDS — electrophoresis-style stacked oval bands
      // Warp X to simulate lane wobble
      vec2 gp = p;
      gp.x += (fbm(vec2(p.y * 0.18, uSeed * 0.5)) - 0.5) * uThreadWave * 4.0;
      // Dense horizontal band lines (high frequency in Y)
      float ty = gp.y * 22.0 + uSeed * 9.0;
      float band = pow(max(0.0, sin(ty) * 0.5 + 0.5), 3.5);
      // Lane intensity modulation (varies along X)
      float lane = vnoise(vec2(gp.x * 0.12 + uSeed, gp.y * 0.02));
      v = band * (0.25 + lane * 0.75);
      v = smoothstep(0.28, 0.72, v);
    } else {
      // Style 6: THIN HAIR — ultra-fine stochastic filaments
      vec2 hp = p;
      hp += vec2(fbm(hp * 0.4 + uSeed)         - 0.5,
                 fbm(hp * 0.4 + uSeed + 30.0)  - 0.5) * uThreadWave * 4.5;
      // Several differently-angled ridge lines
      for (int hi = 0; hi < 4; hi++) {
        float ang = float(hi) * 0.7854 + fbm(vec2(hp.x*0.08 + float(hi)*7.3, uSeed)) * 1.2;
        vec2 dir = vec2(cos(ang), sin(ang));
        // project onto direction and create very narrow ridge
        float proj = dot(hp * 0.35, dir);
        float hair = 1.0 - abs(fract(proj) * 2.0 - 1.0);
        hair = pow(hair, 11.0);      // very sharp / thin
        v = max(v, hair * (0.5 + 0.5 * vnoise(hp * 0.05 + float(hi))));
      }
    }

    float thr = 1.0 - uThreadW*0.35;
    float threadVal = smoothstep(thr - 0.05, thr + 0.01, v);
    float onMembrane = smoothstep(30.0, 5.0, membraneDist);
    threadVal *= mix(1.0, onMembrane, uThreadBias);
    return threadVal * uThreadStr;
  }

  /* ─── KULSYRE BUBBLE HOLES ─── */
  float kulsyreMask(vec2 px) {
    float mask = 1.0;
    for (int i = 0; i < 64; i++) {
      if (i >= int(uBubbleCount)) break;
      float d = length(px - vec2(uBubblePosX[i], uBubblePosY[i]));
      float r = uBubbleRad[i];
      float bubble = smoothstep(r * 0.85, r * 1.05, d);
      mask = min(mask, bubble);
    }
    return mask;
  }

  /* ─── VORONOI (3 nearest) ─── */
  void voronoi3(vec2 px, vec2 uvNorm, out float d1, out float d2, out float d3,
                out float k1f, out float R1, out vec2 delta1) {
    d1 = 1.0e10; d2 = 1.0e10; d3 = 1.0e10;
    k1f = 0.0; R1 = 50.0; delta1 = vec2(0.0);
    for (int i = 0; i < NB; i++) {
      if (i >= uCount) break;
      vec2  site = vec2(uCX[i], uCY[i]);
      float ri = uR[i];
      float fi = float(i);
      vec2 delta = (px - site) * vec2(uSqX, uSqY);
      if (uCWarp > 0.001) {
        delta += cellWarp(delta, fi*13.37 + uSeed, uCWarp*ri*0.45);
      }
      float dist = length(delta);
      if      (dist < d1) { d3=d2; d2=d1; d1=dist; k1f=fi; R1=ri; delta1=delta; }
      else if (dist < d2) { d3=d2; d2=dist; }
      else if (dist < d3) { d3=dist; }
    }
  }

  /* ─── COMPUTE CELL ─── */
  vec3 computeCell(vec2 px, vec2 uvNorm, out float cellDist, out float membraneDist, out float insideMask) {
    float d1, d2, d3, k1f, R;
    vec2 delta1;
    voronoi3(px, uvNorm, d1, d2, d3, k1f, R, delta1);
    cellDist = d1;

    // ─── MORPHOLOGY: Field blend (voronoi → organic noise) ───
    if (uFieldBlend > 0.01) {
      float blend = uFieldBlend * uFieldBlend;
      float nf = fbm(px * 0.003 + uSeed * 0.77) * 2.0 - 0.5;
      float nf2 = vnoise(px * 0.008 + uSeed * 1.2) * 2.0 - 0.5;
      float noiseField = nf * 0.7 + nf2 * 0.3;
      float noiseD = noiseField * R * 3.0;
      d1 = mix(d1, noiseD, blend * 0.85);
      d2 = mix(d2, d1 + R * 0.2 + abs(noiseField) * R * 0.5, blend * 0.75);
      cellDist = d1;
    }

    // Hash-based per-cell random values (used by membrane/fill modes)
    float ch  = hash21(vec2(k1f * 0.372 + 0.1,   uSeed * 0.031));
    float ch2 = hash21(vec2(k1f * 0.619 + uSeed * 0.07, k1f * 0.888));
    float ch3 = hash21(vec2(k1f * 1.131, uSeed * 0.053 + k1f * 0.333));
    float cn  = fbm(px * 0.0045 + uSeed * 0.3) - 0.5;
    float cn2 = vnoise(px * 0.0085 + uSeed * 0.7) - 0.5;

    float rimW  = uRimW * R;
    float fillR = uFill * R;
    float cellFill = smoothstep(fillR * 1.08, fillR * 0.82, d1);
    membraneDist = d2 - d1;

    /* MEMBRANE STYLE */
    float membrane;
    if (uMembraneStyle < 0.5) {
      // Style 0: STANDARD GRADIENT
      float softM = max(rimW * 0.05, 1.2);
      membrane = 1.0 - smoothstep(0.0, rimW + softM, d2 - d1);
    } else if (uMembraneStyle < 1.5) {
      // Style 1: SHARP WIREFRAME
      float lineW = rimW * 0.3;
      membrane = smoothstep(lineW + 1.5, lineW - 0.5, d2 - d1)
               * (1.0 - smoothstep(0.0, 2.0, d2 - d1 - lineW));
    } else if (uMembraneStyle < 2.5) {
      // Style 2: DOUBLE LINE
      float lineW = rimW * 0.2;
      float gap = rimW * 0.15;
      float line1 = smoothstep(lineW + 1.0, lineW - 0.5, d2 - d1);
      float line2 = smoothstep(lineW + gap + 1.0, lineW + gap - 0.5, d2 - d1)
                   * (1.0 - smoothstep(0.0, 1.5, d2 - d1 - lineW - gap));
      membrane = max(line1, line2 * 0.7);
    } else if (uMembraneStyle < 3.5) {
      // Style 3: ORGANIC VARYING THICKNESS
      float softM = max(rimW * 0.1, 2.0);
      float waveThick = rimW * (1.0 + 0.3 * vnoise(px * 0.02 + k1f * 5.0));
      membrane = 1.0 - smoothstep(0.0, waveThick + softM, d2 - d1);
    } else if (uMembraneStyle < 4.5) {
      // Style 4: BUBBLE WALL — ultra thin, iridescent shimmer
      float bRim = uBubbleRim * R * 0.6;
      float memD = d2 - d1;
      float thinWall = smoothstep(bRim * 2.2, bRim * 0.3, memD)
                     * (1.0 - smoothstep(0.0, bRim * 0.5, memD - bRim * 0.8));
      // Iridescent oscillation along membrane
      float irid = 0.5 + 0.5 * sin(d1 * 0.04 + ch * 6.28318);
      membrane = thinWall * (0.6 + irid * 0.4);
    } else {
      // Style 5: NEON BORDER — flat bright line, fills with background
      float memD = d2 - d1;
      float neonW = rimW * 0.55;
      float neonLine = smoothstep(neonW + 2.5, neonW - 0.5, memD)
                      * (1.0 - smoothstep(0.0, neonW * 0.6, memD - neonW * 0.3));
      membrane = pow(neonLine, 1.3);
    }

    // ─── MORPHOLOGY: Connectivity (merge cells dramatically) ───
    if (uConnectField > 0.01) {
      float edgeDist = d2 - d1;
      float mergeW = uConnectField * uConnectField * 200.0;
      float merged = smoothstep(mergeW + 5.0, 0.0, edgeDist);
      membrane *= (1.0 - merged);
      cellFill = max(cellFill, merged);
    }

    // ─── MORPHOLOGY: Membrane break (binary dissolution) ───
    if (uMembraneBreak > 0.01) {
      float brkN = fbm(px * 0.005 + uSeed * 0.41);
      float brkT = uMembraneBreak * 0.85;
      membrane *= step(brkT, brkN);
    }

    float juncW    = rimW * 1.5;
    float junction = (1.0 - smoothstep(0.0, juncW, d3 - d1)) * membrane;
    float innerD   = clamp(d1 / max(fillR, 1.0), 0.0, 1.0);
    float innerGrad = pow(1.0 - innerD, uSoftPow);
    float edgeBleed = 1.0 - smoothstep(0.0, rimW * 3.8, d2 - d1);
    float outerGlow = smoothstep(rimW * 4.5, 0.0, d2 - d1) * (1.0 - cellFill);

    vec2 uvA = px / uRes;
    vec3 bg = uC4;
    bg += (fbm(uvA * 5.0 + uSeed * 0.2) - 0.5) * 0.03 * (1.0 + uBgBlur * 5.0);

    vec3 cellBase = uC1 * (0.84 + ch * 0.32);
    cellBase = mix(cellBase, mix(uC1, uC2, 0.22), ch2 * 0.22);

    /* FILL MODE */
    vec3 cellCol;
    if (uFillMode < 0.5) {
      // Mode 0: STANDARD FILL
      cellCol = cellBase * (0.70 + innerGrad * 0.46);
      cellCol += uC1 * 0.22 * pow(innerGrad, 3.0) * uIGlow;
      cellCol *= 1.0 - (1.0 - innerGrad) * 0.38 * uIGlow;
      cellCol += uC1 * cn * 0.06;
      cellCol += vec3(0.5) * cn2 * 0.02;
      cellCol = mix(cellCol, uC2 * 0.50 + cellCol * 0.62, edgeBleed * uIGlow * 0.60);
    } else if (uFillMode < 1.5) {
      // Mode 1: EMPTY / WIREFRAME
      cellCol = bg;
      cellFill = 0.0;
    } else if (uFillMode < 2.5) {
      // Mode 2: RADIAL GRADIENT
      float gradT = pow(innerGrad, 2.5);
      cellCol = mix(uC2 * 0.6, uC1, gradT);
      cellCol += uC1 * 0.15 * gradT * uIGlow;
    } else if (uFillMode < 3.5) {
      // Mode 3: TEXTURED / STIPPLED
      cellCol = cellBase * (0.70 + innerGrad * 0.30);
      float stipple = vnoise(px * 0.08 + k1f * 7.0 + uSeed);
      float spots = smoothstep(0.55, 0.60, stipple);
      float fine = vnoise(px * 0.25 + uSeed * 3.0);
      cellCol *= 1.0 - spots * 0.45 * uCellTexture;
      cellCol += (fine - 0.5) * 0.12 * uCellTexture;
    } else if (uFillMode < 4.5) {
      // Mode 4: BUBBLE — hollow sphere, thin glowing rim + inner specular
      float bubRimPx = uBubbleRim * R;
      float bubCore  = fillR * 0.88;
      // Thin shell at the bubble edge
      float distFromRim = abs(d1 - bubCore);
      float rimMask  = 1.0 - smoothstep(0.0, bubRimPx * 2.2, distFromRim);
      rimMask = pow(rimMask, 1.4);
      // Small bright specular highlight near top-left of bubble
      float spec = pow(clamp(1.0 - d1 / (fillR * 0.45), 0.0, 1.0), 4.0);
      // Outer atmospheric glow
      float atmosphereD = d1 - bubCore;
      float atmosphere  = smoothstep(bubRimPx * 5.0, 0.0, atmosphereD) * (1.0 - rimMask);
      vec3 rimColor  = mix(uC1 * 1.35, uC3 * 1.15, ch2 * 0.6);
      vec3 specColor = mix(uC3, vec3(1.0), 0.55);
      cellCol = bg;
      cellCol = mix(cellCol, uC1 * 0.5, atmosphere * uBubbleGlow * 0.4);
      cellCol = mix(cellCol, rimColor,   rimMask  * 0.95);
      cellCol = mix(cellCol, specColor,  spec     * uBubbleInner * 0.6);
      cellFill = rimMask * 0.93 + atmosphere * uBubbleGlow * 0.25;
    } else {
      // Mode 5: SMOOTH-GRADIENT BLOB — extra soft centre, no hard edge
      float softT = pow(innerGrad, 1.6);
      cellCol = mix(uC4 * 0.9, uC1, softT * 0.9);
      cellCol += uC1 * 0.25 * pow(innerGrad, 4.0);
      cellCol += uC3 * 0.12 * smoothstep(0.3, 0.0, innerD) * uIGlow;
      // Diffuse edge bleed
      cellCol = mix(cellCol, uC2 * 0.55 + cellCol * 0.55, edgeBleed * 0.55);
    }

    insideMask = cellFill;

    float pressureMul = 1.0 + junction * 0.55 * uJBoost;
    vec3 memCol = uC2 * pressureMul;
    memCol += uC2 * cn * 0.10;
    vec3 juncCol = uC3 * (1.25 + ch3 * 0.3);
    float juncPt = pow(junction, 1.6) * uJBoost;
    memCol = mix(memCol, juncCol, clamp(juncPt * 0.88, 0.0, 1.0));

    vec3 col = bg;
    col = mix(col, uC2 * 0.55 + bg * 0.35, outerGlow * uGlow * 0.80);
    col = mix(col, memCol, membrane * 0.93);
    col = mix(col, cellCol, cellFill * 0.97);
    float boundEdge = membrane * (1.0 - smoothstep(0.0, rimW * 0.35, d2 - d1));
    col = mix(col, memCol * 1.12, boundEdge * 0.45);

    return col;
  }

  /* ═══════════════════════════════════════════════════════
     GENERATOR: BLOB / METABALL FIELDS
     Implicit surface — blobs merge organically
     ═══════════════════════════════════════════════════════ */
  vec3 genMetaball(vec2 px, vec2 uvNorm, out float cellDist, out float membraneDist, out float insideMask) {
    float field = 0.0;
    float nearDist = 1.0e10;
    float nearIdx = 0.0;
    for (int i = 0; i < NB; i++) {
      if (i >= uCount) break;
      vec2 site = vec2(uCX[i], uCY[i]);
      float ri = max(uR[i], 1.0);
      vec2 delta = (px - site) * vec2(uSqX, uSqY);
      if (uCWarp > 0.001) {
        delta += cellWarp(delta, float(i) * 13.37 + uSeed, uCWarp * ri * 0.45);
      }
      float d = length(delta);
      float contrib = (ri * ri) / (d * d + ri * 0.5);
      field += contrib;
      if (d < nearDist) { nearDist = d; nearIdx = float(i); }
    }
    cellDist = nearDist;
    float threshold = mix(3.5, 0.6, clamp(uFill, 0.0, 1.0));
    float edgeSoft = mix(0.15, 0.45, uRimW);
    float inside = smoothstep(threshold - edgeSoft, threshold + edgeSoft * 0.5, field);
    insideMask = inside;
    membraneDist = abs(field - threshold) * 80.0;
    vec2 uvA = px / uRes;
    vec3 bg = uC4 + (fbm(uvA * 5.0 + uSeed * 0.2) - 0.5) * 0.03;
    float coreness = clamp((field - threshold) / (threshold * 3.0), 0.0, 1.0);
    float ch = hash21(vec2(nearIdx * 0.37, uSeed * 0.03));
    vec3 blobCol = mix(uC1 * 0.85, uC2 * 0.7, coreness * 0.5 + ch * 0.2);
    blobCol += uC3 * 0.18 * pow(coreness, 2.5);
    blobCol *= 0.75 + 0.4 * vnoise(px * 0.004 + uSeed * 0.5);
    float memRing = smoothstep(threshold - edgeSoft * 2.0, threshold, field)
                  * (1.0 - smoothstep(threshold, threshold + edgeSoft * 2.5, field));
    vec3 memCol = uC2 * 1.15;
    float glow = smoothstep(threshold * 0.35, threshold * 0.85, field) * (1.0 - inside);
    vec3 col = bg;
    col = mix(col, uC1 * 0.35 + bg * 0.45, glow * uGlow * 0.7);
    col = mix(col, memCol, memRing * uRimW * 1.5);
    col = mix(col, blobCol, inside * 0.95);
    return col;
  }

  /* ═══════════════════════════════════════════════════════
     GENERATOR: BAND STRUCTURES
     Domain-warped layered stripes — geological/chromatographic
     ═══════════════════════════════════════════════════════ */
  vec3 genBands(vec2 px, vec2 uvNorm, out float cellDist, out float membraneDist, out float insideMask) {
    vec2 uvA = px / uRes;
    vec3 bg = uC4 + (fbm(uvA * 5.0 + uSeed * 0.2) - 0.5) * 0.03;
    vec2 wp = px * 0.0015;
    float warpX = (fbm(wp + uSeed * 0.3) - 0.5) * uCWarp * 380.0;
    float warpY = (fbm(wp + uSeed * 0.3 + 50.0) - 0.5) * uCWarp * 380.0;
    vec2 bpx = px + vec2(warpX, warpY);
    float dirBlend = clamp(uSqX / (uSqX + uSqY + 0.001), 0.0, 1.0);
    float coord = mix(bpx.y, bpx.x, dirBlend);
    float freq = uBandFreq * 0.004;
    float band1 = sin(coord * freq * 3.14159) * 0.5 + 0.5;
    float band2 = sin(coord * freq * 2.0 * 3.14159 + uSeed * 0.7) * 0.5 + 0.5;
    float band3 = sin(coord * freq * 5.0 * 3.14159 + uSeed * 1.3) * 0.5 + 0.5;
    float band4 = sin(coord * freq * 11.0 * 3.14159 + uSeed * 2.1) * 0.5 + 0.5;
    float fillPow = mix(4.0, 0.5, clamp(uFill, 0.0, 1.0));
    float bandVal = pow(band1, fillPow) * 0.45
                  + pow(band2, fillPow * 1.5) * 0.28
                  + pow(band3, fillPow * 2.0) * 0.17
                  + pow(band4, fillPow * 3.0) * 0.10;
    float bandID = floor(coord * freq * 0.5 + 0.5);
    float bHash = hash21(vec2(bandID * 0.73 + uSeed, bandID * 1.31));
    float bHash2 = hash21(vec2(bandID * 2.17, uSeed * 0.41));
    bandVal = smoothstep(0.5 - uRimW * 0.45, 0.5 + uRimW * 0.08, bandVal);
    cellDist = abs(fract(coord * freq * 0.5) - 0.5) * 250.0;
    membraneDist = cellDist;
    insideMask = bandVal;
    vec3 bandColor = mix(uC1, uC2, bHash * 0.7);
    bandColor = mix(bandColor, uC3, bHash2 * 0.35 * bandVal);
    float bandInner = pow(bandVal, 2.0);
    bandColor *= 0.7 + bandInner * 0.4;
    float edgeDist = abs(fract(coord * freq * 0.5) - 0.5);
    float edgeMask = smoothstep(0.06, 0.0, edgeDist) * uRimW;
    vec3 edgeCol = uC2 * 1.25;
    vec3 col = bg;
    col = mix(col, bandColor, bandVal * 0.93);
    col = mix(col, edgeCol, edgeMask * 0.7);
    return col;
  }

  /* ═══════════════════════════════════════════════════════
     GENERATOR: SLIME-MOLD NETWORK
     Ridged noise creates vein/mycelium tube structures
     ═══════════════════════════════════════════════════════ */
  vec3 genSlimeMold(vec2 px, vec2 uvNorm, out float cellDist, out float membraneDist, out float insideMask) {
    vec2 uvA = px / uRes;
    vec3 bg = uC4 + (fbm(uvA * 5.0 + uSeed * 0.2) - 0.5) * 0.03;
    float baseScale = 0.0025 / max(uFill * 0.3 + 0.15, 0.05);
    vec2 p = px * baseScale;
    p += vec2(
      fbm(p * 0.4 + uSeed * 0.7) - 0.5,
      fbm(p * 0.4 + uSeed * 0.7 + 40.0) - 0.5
    ) * uCWarp * 3.5;
    float network = 0.0;
    float amp = 1.0;
    float nFreq = 1.0;
    mat2 rot = mat2(0.80, 0.60, -0.60, 0.80);
    vec2 q = p;
    for (int i = 0; i < 6; i++) {
      float n = vnoise(q * nFreq + float(i) * 17.0 + uSeed);
      float ridge = 1.0 - abs(n * 2.0 - 1.0);
      ridge = pow(ridge, mix(1.5, 4.0, clamp(uSoftPow / 6.0, 0.0, 1.0)));
      network += ridge * amp;
      nFreq *= 2.15;
      amp *= 0.48;
      q = rot * q;
    }
    network /= 2.0;
    network = clamp(network, 0.0, 1.0);
    float tubeThresh = mix(0.25, 0.75, clamp(uFill, 0.0, 1.0));
    float tube = smoothstep(tubeThresh - 0.06, tubeThresh + 0.02, network);
    float tubeEdge = smoothstep(tubeThresh - 0.14, tubeThresh - 0.01, network) * (1.0 - tube);
    float branch = smoothstep(0.78, 0.95, network);
    cellDist = (1.0 - network) * 250.0;
    membraneDist = abs(network - tubeThresh) * 350.0;
    insideMask = tube;
    float innerT = clamp((network - tubeThresh) / (1.0 - tubeThresh + 0.01), 0.0, 1.0);
    float ch = hash21(vec2(floor(p.x * 3.0), floor(p.y * 3.0)) + uSeed);
    vec3 tubeCol = mix(uC1 * 0.8, uC2 * 0.65, innerT * 0.55 + ch * 0.15);
    tubeCol += uC3 * 0.2 * pow(innerT, 2.5);
    tubeCol *= 0.7 + 0.35 * vnoise(px * 0.005 + uSeed * 0.3);
    vec3 edgeCol = uC2 * 1.1;
    vec3 branchCol = mix(uC1, uC3, 0.4) * 1.3;
    vec3 col = bg;
    col = mix(col, edgeCol, tubeEdge * uRimW * 2.5);
    col = mix(col, tubeCol, tube * 0.93);
    col = mix(col, branchCol, branch * 0.45);
    return col;
  }

  /* ═══════════════════════════════════════════════════════
     GENERATOR: DIFFUSION / HEATMAP FIELD
     Multi-octave smooth noise — thermal/topographic look
     ═══════════════════════════════════════════════════════ */
  vec3 genDiffusion(vec2 px, vec2 uvNorm, out float cellDist, out float membraneDist, out float insideMask) {
    vec2 uvA = px / uRes;
    vec3 bg = uC4 + (fbm(uvA * 5.0 + uSeed * 0.2) - 0.5) * 0.03;
    vec2 p = px * 0.002;
    float warpStr = uCWarp * 2.5;
    p += vec2(
      fbm(p * 0.35 + uSeed * 0.5) - 0.5,
      fbm(p * 0.35 + uSeed * 0.5 + 30.0) - 0.5
    ) * warpStr;
    float field = 0.0;
    field += fbm(p * 1.0 + uSeed * 0.1) * 0.40;
    field += fbm(p * 2.5 + uSeed * 0.3 + 20.0) * 0.25;
    field += vnoise(p * 5.0 + uSeed * 0.7) * 0.20;
    field += vnoise(p * 12.0 + uSeed * 1.1) * 0.10;
    field += vnoise(p * 25.0 + uSeed * 1.5 + 50.0) * 0.05;
    field = clamp(field, 0.0, 1.0);
    float intensity = mix(2.5, 0.3, clamp(uFill, 0.0, 1.0));
    field = pow(field, intensity);
    cellDist = (1.0 - field) * 200.0;
    membraneDist = 60.0;
    insideMask = field;
    vec3 col;
    if (field < 0.25) {
      col = mix(uC4 * 0.95, uC3 * 0.8, field / 0.25);
    } else if (field < 0.50) {
      col = mix(uC3 * 0.8, uC1, (field - 0.25) / 0.25);
    } else if (field < 0.75) {
      col = mix(uC1, uC2, (field - 0.50) / 0.25);
    } else {
      col = mix(uC2, uC2 * 1.3 + uC1 * 0.15, (field - 0.75) / 0.25);
    }
    if (uRimW > 0.01) {
      float contourFreq = mix(4.0, 16.0, uRimW);
      float contour = abs(fract(field * contourFreq) - 0.5) * 2.0;
      float contourLine = 1.0 - smoothstep(0.0, 0.04 + (1.0 - uRimW) * 0.08, 1.0 - contour);
      col = mix(col, uC2 * 0.5, contourLine * uRimW * 0.7);
    }
    float hotspot = pow(max(0.0, field), 5.0);
    col += uC1 * 0.25 * hotspot * uGlow;
    float coolspot = pow(max(0.0, 1.0 - field), 3.0);
    col = mix(col, uC4 * 0.85, coolspot * 0.3);
    return col;
  }

  /* ─── MULTI-GENERATOR DISPATCH ─── */
  vec3 generatePixel(vec2 px, vec2 uvNorm, out float cellDist, out float membraneDist, out float insideMask) {
    if (uGenType < 0.5) return computeCell(px, uvNorm, cellDist, membraneDist, insideMask);
    if (uGenType < 1.5) return genMetaball(px, uvNorm, cellDist, membraneDist, insideMask);
    if (uGenType < 2.5) return genBands(px, uvNorm, cellDist, membraneDist, insideMask);
    if (uGenType < 3.5) return genSlimeMold(px, uvNorm, cellDist, membraneDist, insideMask);
    return genDiffusion(px, uvNorm, cellDist, membraneDist, insideMask);
  }

  /* ─── MAIN ─── */
  void main() {
    vec2 fc  = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
    vec2 uv  = fc / uRes;
    vec2 uvA = uv * vec2(uRes.x / uRes.y, 1.0);

    vec2 warp = domainWarp(uvA * 3.0, uWBF, uWBA, uWMF, uWMA, uSeed);
    vec2 px   = fc + warp * uRes.y;

    // ══════ LIQUID WARP LAYERS (Processing-inspired) ══════
    // Large-scale flowing displacement — creates organic liquid forms
    if (uLiquidWarp > 0.005) {
      float lw = uLiquidWarp;
      // Layer 1: very large slow-moving displacement (MASSIVE)
      float ang1 = fbm(uvA * 0.8 + uSeed * 0.27) * 6.28318;
      float mag1 = fbm(uvA * 1.2 + uSeed * 0.63 + 44.0) * lw * uRes.y * 0.65;
      px += vec2(cos(ang1), sin(ang1)) * mag1;
      // Layer 2: medium swirl patches
      float ang2 = vnoise(fc * 0.0018 + uSeed * 0.41) * 12.566;
      float mag2 = vnoise(fc * 0.003 + uSeed * 0.83 + 77.0) * lw * uRes.y * 0.30;
      px += vec2(cos(ang2), sin(ang2)) * mag2;
      // Layer 3: fine turbulence
      float ang3 = vnoise(fc * 0.007 + uSeed * 1.1) * 6.28318;
      float mag3 = vnoise(fc * 0.010 + uSeed * 0.5 + 120.0) * lw * uRes.y * 0.12;
      px += vec2(cos(ang3), sin(ang3)) * mag3;
    }

    vec3 col;
    float cellDist, membraneDist, insideMask;
    if (uChrom > 0.005) {
      float ca   = uChrom * 9.0;
      vec2 shift = normalize(uv - 0.5 + 0.001) * ca;
      float cd1, md1, im1;
      vec3 colR = generatePixel(px + shift, uv, cd1, md1, im1);
      col = vec3(colR.r,
                 generatePixel(px, uv, cellDist, membraneDist, insideMask).g,
                 generatePixel(px - shift, uv, cd1, md1, im1).b);
    } else {
      col = generatePixel(px, uv, cellDist, membraneDist, insideMask);
    }

    // ══════ LIQUID SMEAR (directional blur using active generator) ══════
    if (uSmearStr > 0.008) {
      float smAng  = fbm(uvA * 2.2 + uSeed * 0.55) * 6.28318;
      vec2  smDir  = vec2(cos(smAng), sin(smAng));
      float smDist = uSmearStr * 75.0;
      float cd2, md2, im2;
      vec3 smearCol = generatePixel(px + smDir * smDist, uv, cd2, md2, im2);
      col = mix(col, smearCol, 0.42 * uSmearStr / 0.55);
      float smAng2  = fbm(uvA * 3.5 + uSeed * 0.88 + 30.0) * 6.28318;
      vec2  smDir2  = vec2(cos(smAng2), sin(smAng2));
      float smDist2 = uSmearStr * 35.0;
      vec3 smearCol2 = generatePixel(px + smDir2 * smDist2, uv, cd2, md2, im2);
      col = mix(col, smearCol2, 0.22 * uSmearStr / 0.55);
    }

    // ══════ MICRO-CELL OVERLAY ══════
    if (uMicroCellScale > 0.001) {
      vec2 mp = px * uMicroCellScale;
      vec2 mid = floor(mp);
      float mf1 = 100.0, mf2 = 100.0;
      for (int iy = -1; iy <= 1; iy++) {
        for (int ix = -1; ix <= 1; ix++) {
          vec2 nb = mid + vec2(float(ix), float(iy));
          vec2 pt = nb + vec2(hash21(nb*1.1+uSeed*0.31), hash21(nb*1.7+uSeed*0.53));
          float d = length(mp - pt);
          if (d < mf1) { mf2 = mf1; mf1 = d; }
          else if (d < mf2) { mf2 = d; }
        }
      }
      float microEdge = mf2 - mf1;
      float microWall = smoothstep(uMicroCellWall + 0.02, uMicroCellWall - 0.02, microEdge);
      float microInner = smoothstep(0.45, 0.1, mf1);
      float microZone = insideMask;
      if (uFillMode > 0.5 && uFillMode < 1.5) microZone = 1.0;
      col = mix(col, uC2*0.65 + uC1*0.1, microWall * microZone * 0.75);
      col = mix(col, mix(uC4, uC1, 0.15), microInner * microZone * uMicroCellFill * 0.3);
    }

    // VOIDS
    vec3 bgForVoid = uC4 + (fbm(uvA*5.0 + uSeed*0.2) - 0.5) * 0.03;
    float voidV = voidMask(px, cellDist, insideMask);
    col = mix(bgForVoid, col, voidV);

    // THREADS
    float threadV = threadMask(px, membraneDist);
    // Thread color: much more visible — uses primary color darkened, high opacity
    vec3 threadCol = uC2 * 0.65 + uC1 * 0.25;
    col = mix(col, threadCol, threadV * 0.95);

    // ══════ FIBER DOMINANCE ══════
    if (uFiberDominance > 0.01) {
      float cellFade = 1.0 - uFiberDominance * 0.85;
      vec3 fadedCol = mix(uC4, col, cellFade);
      float fiberBoost = clamp(threadV * (1.0 + uFiberDominance * 4.0), 0.0, 1.0);
      vec3 fiberCol = uC1 * 0.85 + uC2 * 0.15;
      fiberCol *= 0.7 + vnoise(px * 0.003 + uSeed) * 0.3;
      col = mix(fadedCol, fiberCol, fiberBoost * 0.92);
      float fiberDetail = smoothstep(0.45, 0.55, vnoise(px * vec2(0.002, 0.015) + uSeed * 0.7));
      col = mix(col, uC1 * 0.6, fiberDetail * uFiberDominance * 0.25);
    }

    // (Old overlays removed — now handled by full generators via generatePixel)

    // ══════ MORPHOLOGY: Mass field threshold (dramatic) ══════
    if (abs(uMassField) > 0.02) {
      vec3 bgM = uC4;
      if (uMassField < 0.0) {
        float sparse = -uMassField;
        float threshold = sparse * sparse * 0.95;
        float sparseMask = smoothstep(threshold, threshold + 0.03, insideMask);
        col = mix(bgM, col, sparseMask);
      } else {
        float dense = uMassField;
        float gapFill = (1.0 - insideMask) * dense * dense;
        vec3 fillC = mix(uC1 * 0.75, uC2 * 0.5, fbm(px * 0.002 + uSeed));
        col = mix(col, fillC, gapFill * 0.95);
      }
    }

    // ══════ MORPHOLOGY: Perforation (hard holes) ══════
    if (uPerforationField > 0.01) {
      vec3 bgP = uC4;
      float pf = uPerforationField;
      float p1 = vnoise(px * 0.003 + uSeed * 1.3);
      float p2 = vnoise(px * 0.009 + uSeed * 2.1 + 55.0);
      float perfVal = p1 * 0.6 + p2 * 0.4;
      float perfT = 1.0 - pf * 0.92;
      float perfKeep = step(perfT, perfVal);
      col = mix(bgP, col, perfKeep);
    }

    // ZONE SYSTEM
    if (uZoneMode > 0.5) {
      float zoneMask;
      if (uZoneMode < 1.5) {
        zoneMask = smoothstep(uZoneSplit - 0.1, uZoneSplit + 0.1, length(uv - 0.5) * 2.0);
      } else {
        zoneMask = smoothstep(uZoneSplit - 0.08, uZoneSplit + 0.08, uv.y);
      }
      vec3 zoneCol = mix(col, col * vec3(0.7, 0.4, 0.5) + uC3 * 0.3, zoneMask * uZoneContrast);
      col = mix(col, zoneCol, uZoneContrast);
    }

    // ══════ KULSYRE BUBBLE HOLES ══════
    if (uBubbleCount > 0.5) {
      float kMask = kulsyreMask(px);
      vec3 bgBubbles = uC4 + (fbm(uvA*5.0+uSeed*0.2)-0.5)*0.03;
      col = mix(bgBubbles, col, kMask);
    }

    // Bloom
    float luma = dot(col, vec3(0.299, 0.587, 0.114));
    col += col * smoothstep(0.50, 1.0, luma) * uBloom * 0.50;

    // Contrast & saturation
    col = clamp(col, 0.0, 1.0);
    col = (col - 0.5) * uContrast + 0.5;
    float lumF = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(lumF), col, uSat);

    // Grain
    float g = mix(grainFn(fc*0.45, uSeed+1.0), grainFn(fc*1.40, uSeed+7.0), 0.5);
    col += (g - 0.5) * uGrain;

    // Negative
    if (uNeg > 0.5) {
      if (uNegMode < 0.5) {
        col = 1.0 - col;
      } else if (uNegMode < 1.5) {
        vec3 h = rgb2hsv(col); h.x = fract(h.x + 0.5); col = hsv2rgb(h);
      } else {
        vec3 h = rgb2hsv(col);
        h.x = fract(h.x + 0.5); h.z = 1.0 - h.z * 0.65;
        col = hsv2rgb(h);
      }
    }

    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  }
`;

const VERT_SHADER = `
  attribute vec3 aPosition;
  void main() { gl_Position = vec4(aPosition, 1.0); }
`;

/* ═══════════════════════════════════════════════════════════
   P5 SKETCH
   ═══════════════════════════════════════════════════════════ */
let canvas;
let CW = 1800, CH = 800;

// Export resolution (label size × 4 for quality)
const EXPORT_MULTIPLIER = 4;
const EXPORT_W = Math.round(581.1 * EXPORT_MULTIPLIER);  // 2324
const EXPORT_H = Math.round(354.33 * EXPORT_MULTIPLIER); // 1417

new p5((p) => {
  let renderBuffer;  // High-res offscreen buffer (single source of truth)
  let bufferShader;  // Shader for render buffer
  let viewportShader; // Shader for viewport (optional, can share)
  let dirty = true;   // Flag to trigger re-render
  let patternCanvas2D = null;  // 2D copy of WebGL buffer (readable anytime)
  
  // State arrays in normalized coordinates (0-1)
  let STATE = {
    seed: 42,
    blobsX: new Float32Array(MAX_BLOBS),  // normalized 0-1
    blobsY: new Float32Array(MAX_BLOBS),  // normalized 0-1
    blobsR: new Float32Array(MAX_BLOBS),  // normalized to canvas diagonal
    // Kulsyre bubbles
    bubbleCount: 0,
    bubblePosX: new Float32Array(64),
    bubblePosY: new Float32Array(64),
    bubbleRadius: new Float32Array(64),
  };
  
  // Working arrays (scaled to current render target)
  let cx = new Float32Array(MAX_BLOBS);
  let cy = new Float32Array(MAX_BLOBS);
  let cr = new Float32Array(MAX_BLOBS);
  let M  = {};
  let prevStructural = { count: 0, rMin: 0, rMax: 0 };

  /* ─── buildState — Generate all random data (deterministic, normalized) ─── */
  function buildState(seed) {
    // Lock seed for determinism
    p.randomSeed(seed);
    p.noiseSeed(seed);
    const rng = mulberry32(seed);
    
    STATE.seed = seed;
    computeRegime();          // select regime from current slider values
    M = cellMapping();
    
    const n = M.blobCount;
    // Use normalized aspect ratio
    const aspect = EXPORT_W / EXPORT_H;
    
    STATE.blobsX.fill(0);
    STATE.blobsY.fill(0);
    STATE.blobsR.fill(0);

    const cols = Math.max(1, Math.ceil(Math.sqrt(n * aspect)));
    const rows = Math.max(1, Math.ceil(n / cols));
    const cellW = 1.0 / cols, cellH = 1.0 / rows;
    const jitter = lrp(0.08, 0.60, P.fermentChaos);
    const pos = [];

    // Density field for CLUSTER regime
    const densityPoints = [];
    if (P.clusterIntensity > 0.05) {
      const numPts = P.clusterCount || 1;
      for (let i = 0; i < numPts; i++) {
        densityPoints.push({
          x: 0.15 + rng() * 0.7,
          y: 0.15 + rng() * 0.7,
          radius: (0.08 + rng() * 0.18),
          strength: P.clusterIntensity * (0.5 + rng() * 0.5)
        });
      }
    }

    // Generate positions in normalized 0-1 space
    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        if (pos.length >= n) break;
        let x = (gx + 0.5 + (rng() - 0.5) * 2 * jitter) * cellW;
        let y = (gy + 0.5 + (rng() - 0.5) * 2 * jitter) * cellH;
        for (const dp of densityPoints) {
          const ddx = dp.x - x, ddy = dp.y - y;
          const dist = Math.sqrt(ddx*ddx + ddy*ddy) + 0.01;
          x += ddx * dp.strength * 0.2 / dist * 0.03;
          y += ddy * dp.strength * 0.2 / dist * 0.03;
        }
        pos.push([clampN(x, -cellW*0.4, 1+cellW*0.4), clampN(y, -cellH*0.4, 1+cellH*0.4)]);
      }
    }

    // Anisotropy squeeze
    if (P.anisotropy > 0.05) {
      const angle = P.anisotropyAngle || 0;
      const squeeze = lrp(1.0, 3.5, P.anisotropy);
      const ca = Math.cos(angle), sa = Math.sin(angle);
      for (let i = 0; i < pos.length; i++) {
        let dx = pos[i][0] - 0.5, dy = pos[i][1] - 0.5;
        let rx = dx*ca + dy*sa, ry = -dx*sa + dy*ca;
        ry /= squeeze;
        pos[i][0] = clampN(rx*ca - ry*sa + 0.5, -cellW, 1+cellW);
        pos[i][1] = clampN(rx*sa + ry*ca + 0.5, -cellH, 1+cellH);
      }
    }

    // Lloyd relaxation
    const relaxIters = Math.floor(lrp(1, 6, P.krop));
    const minDistBase = cellW * lrp(0.15, 0.45, P.krop);
    for (let iter = 0; iter < relaxIters; iter++) {
      for (let i = 0; i < pos.length; i++) {
        for (let j = i+1; j < pos.length; j++) {
          const ddx = pos[j][0]-pos[i][0], ddy = pos[j][1]-pos[i][1];
          const d = Math.sqrt(ddx*ddx + ddy*ddy) + 0.0001;
          if (d < minDistBase) {
            const push = (minDistBase - d) * 0.28 / d;
            pos[i][0] -= ddx*push; pos[i][1] -= ddy*push;
            pos[j][0] += ddx*push; pos[j][1] += ddy*push;
          }
        }
      }
    }

    // Shuffle
    for (let i = pos.length-1; i > 0; i--) {
      const j = Math.floor(rng() * (i+1));
      [pos[i], pos[j]] = [pos[j], pos[i]];
    }

    // Assign radii (normalized to diagonal)
    const diagonal = Math.sqrt(aspect*aspect + 1);
    const radiusMinNorm = M.radiusMin / (EXPORT_W > EXPORT_H ? EXPORT_W : EXPORT_H);
    const radiusMaxNorm = M.radiusMax / (EXPORT_W > EXPORT_H ? EXPORT_W : EXPORT_H);
    
    for (let i = 0; i < n && i < pos.length && i < MAX_BLOBS; i++) {
      STATE.blobsX[i] = pos[i][0];
      STATE.blobsY[i] = pos[i][1];
      
      let sizeT = rng();
      if (P.sizeBimodal > 0.1) {
        if (rng() < P.sizeBimodal * 0.35) sizeT = 0.75 + rng() * 0.25;
        else if (rng() < P.sizeBimodal * 0.5) sizeT = rng() * 0.15;
      }
      if (P.sizeSkew > 0.1) {
        sizeT = clamp01(sizeT * Math.exp((rng()-0.5) * 2.5 * P.sizeSkew) * 0.5);
      }
      if (P.clusterIntensity > 0.05) {
        let df = 0;
        for (const dp of densityPoints) {
          const ddx = pos[i][0]-dp.x, ddy = pos[i][1]-dp.y;
          df += dp.strength * Math.max(0, 1 - Math.sqrt(ddx*ddx+ddy*ddy) / dp.radius);
        }
        sizeT *= lrp(1.0, 0.2, clamp01(df));
      }
      const base = radiusMinNorm + sizeT * (radiusMaxNorm - radiusMinNorm);
      STATE.blobsR[i] = base * Math.max(0.2, 1.0 + (rng()-0.5) * 0.6 * P.colonyMutation);
    }

    // Edge padding
    let count = Math.min(n, Math.min(pos.length, MAX_BLOBS));
    const pad = radiusMaxNorm * 0.35;
    const edges = [
      [-pad,0.25],[-pad,0.5],[-pad,0.75],
      [1+pad,0.25],[1+pad,0.5],[1+pad,0.75],
      [0.25,-pad],[0.5,-pad],[0.75,-pad],
      [0.25,1+pad],[0.5,1+pad],[0.75,1+pad],
    ];
    for (let i = 0; i < edges.length && count < MAX_BLOBS; i++) {
      STATE.blobsX[count] = edges[i][0];
      STATE.blobsY[count] = edges[i][1];
      STATE.blobsR[count] = radiusMinNorm + rng() * (radiusMaxNorm-radiusMinNorm) * 0.8;
      count++;
    }
    M.blobCount = Math.min(count, MAX_BLOBS);

    // ── KULSYRE BUBBLES ──
    STATE.bubblePosX.fill(0);
    STATE.bubblePosY.fill(0);
    STATE.bubbleRadius.fill(0);
    const bubbleCount = Math.min(64, Math.floor(P.kulsyre * 60));
    STATE.bubbleCount = bubbleCount;
    for (let i = 0; i < bubbleCount; i++) {
      STATE.bubblePosX[i] = rng();
      STATE.bubblePosY[i] = rng();
      const sizeT = rng();
      const radius = sizeT < 0.3
        ? rng() * 0.015 + 0.005   // small
        : rng() * 0.06 + 0.02;    // large
      STATE.bubbleRadius[i] = radius * (0.5 + P.kulsyre);
    }
    
    dirty = true;
  }

  /* ─── scaleStateToTarget — Scale normalized state to pixel coordinates ─── */
  function scaleStateToTarget(targetWidth, targetHeight) {
    const maxDim = Math.max(targetWidth, targetHeight);
    const sv = P.scaleVariance || 0;
    for (let i = 0; i < MAX_BLOBS; i++) {
      cx[i] = STATE.blobsX[i] * targetWidth;
      cy[i] = STATE.blobsY[i] * targetHeight;
      let r = STATE.blobsR[i] * maxDim;
      // Apply scale variance: dramatically vary individual blob sizes in real-time
      if (sv > 0.01) {
        const h = (((i * 2654435761 + (STATE.seed | 0) * 7919) >>> 0) / 4294967296);
        const factor = Math.pow(2.0, (h - 0.5) * 2.0 * sv * 2.5);
        r *= Math.max(0.05, factor);
      }
      cr[i] = r;
    }
  }

  /* ─── genBlobs — DEPRECATED, replaced by buildState ─── */
  function genBlobs() {
    buildState(P.seed);
  }

  function hex2rgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    return [
      parseInt(h.slice(0,2),16)/255,
      parseInt(h.slice(2,4),16)/255,
      parseInt(h.slice(4,6),16)/255,
    ];
  }

  function setUniforms(shader, targetWidth, targetHeight) {
    shader.setUniform('uRes',     [targetWidth, targetHeight]);
    shader.setUniform('uSeed',    STATE.seed);
    shader.setUniform('uTime',    0);
    shader.setUniform('uCount',   M.blobCount | 0);
    shader.setUniform('uFill',    M.fillRadius);
    shader.setUniform('uRimW',    M.rimWidth);
    shader.setUniform('uSoftPow', M.softPow);
    shader.setUniform('uSqX',     M.squeezeX);
    shader.setUniform('uSqY',     M.squeezeY);
    shader.setUniform('uCWarp',   M.cellWarpAmp);
    shader.setUniform('uCX', cx); shader.setUniform('uCY', cy); shader.setUniform('uR', cr);
    shader.setUniform('uWBF', M.warpBigFreq);  shader.setUniform('uWBA', M.warpBigAmp);
    shader.setUniform('uWMF', M.warpMicroFreq); shader.setUniform('uWMA', M.warpMicroAmp);
    shader.setUniform('uGrain',    M.grainAmt);
    shader.setUniform('uContrast', M.contrast);
    shader.setUniform('uSat',      M.saturation);
    shader.setUniform('uJBoost',   M.junctionBoost);
    shader.setUniform('uGlow',     M.glowStr);
    shader.setUniform('uIGlow',    M.innerGlowStr);
    shader.setUniform('uChrom',    M.chromAb);
    shader.setUniform('uBloom',    M.bloomStr);
    shader.setUniform('uBgStyle',  M.bgStyle);
    shader.setUniform('uBgBlur',   M.bgBlur);
    shader.setUniform('uNeg',      M.negative);
    shader.setUniform('uNegMode',  M.negativeMode);
    // Voids
    shader.setUniform('uVoidScale', M.voidScale);
    shader.setUniform('uVoidMinR',  M.voidMinR);
    shader.setUniform('uVoidMaxR',  M.voidMaxR);
    shader.setUniform('uVoidSoft',  M.voidSoft);
    shader.setUniform('uVoidBias',  M.voidBiasVal);
    // Threads
    shader.setUniform('uThreadScale', M.threadScale);
    shader.setUniform('uThreadW',     M.threadW);
    shader.setUniform('uThreadWave',  M.threadWave);
    shader.setUniform('uThreadStr',   M.threadStr);
    shader.setUniform('uThreadBias',  M.threadBias);
    // Modes (from regime)
    shader.setUniform('uFillMode',       M.fillMode);
    shader.setUniform('uMembraneStyle',  M.membraneStyle);
    shader.setUniform('uThreadStyle',    M.threadStyle);
    shader.setUniform('uVoidMode',       M.voidMode);
    shader.setUniform('uVoidLayers',     M.voidLayers);
    shader.setUniform('uCellTexture',    M.cellTexture);
    shader.setUniform('uDirBias',        M.directionalBias);
    shader.setUniform('uZoneMode',       M.zoneMode);
    shader.setUniform('uZoneSplit',      M.zoneSplit);
    shader.setUniform('uZoneContrast',   M.zoneContrast);
    // Regime
    shader.setUniform('uMicroCellScale',   M.microCellScale || 0);
    shader.setUniform('uMicroCellWall',    M.microCellWall || 0.1);
    shader.setUniform('uMicroCellFill',    M.microCellFill || 0);
    shader.setUniform('uFiberDominance',   M.fiberDominance || 0);
    shader.setUniform('uVoidConnect',      M.voidConnect || 0);
    shader.setUniform('uRegime',           M.regime || 0);
    shader.setUniform('uClusterIntensity', M.clusterIntensity || 0);
    // MULTI-GENERATOR PIPELINE
    shader.setUniform('uGenType',      M.genType      || 0);
    shader.setUniform('uFormMode',     M.formMode     || 0);
    shader.setUniform('uMetaSmooth',   M.metaSmooth   || 0);
    shader.setUniform('uBandFreq',     M.bandFreq     || 1.0);
    shader.setUniform('uBandContrast', M.bandContrast || 0.8);
    shader.setUniform('uBandAmt',      M.bandAmt      || 0);
    shader.setUniform('uBubbleRim',    M.bubbleRim    || 0.05);
    shader.setUniform('uBubbleGlow',   M.bubbleGlow   || 0.4);
    shader.setUniform('uBubbleInner',  M.bubbleInner  || 0);
    // Dramatisk — liquid warp + smear
    shader.setUniform('uLiquidWarp',   M.liquidWarp   || 0);
    shader.setUniform('uSmearStr',     M.smearStr     || 0);
    // Morphology fields (topology-first)
    shader.setUniform('uMassField',        M.massField        || 0);
    shader.setUniform('uConnectField',     M.connectField     || 0);
    shader.setUniform('uPerforationField', M.perforationField || 0);
    shader.setUniform('uMembraneBreak',    M.membraneBreak    || 0);
    shader.setUniform('uFieldBlend',       M.fieldBlend       || 0);
    // Kulsyre bubbles — regenerated deterministically from kulsyre slider value
    const bubbleCount = P._kulsyreBubbleCount || STATE.bubbleCount || 0;
    shader.setUniform('uBubbleCount', bubbleCount);
    const bpx = new Float32Array(64), bpy = new Float32Array(64), bpr = new Float32Array(64);
    const maxDim = Math.max(targetWidth, targetHeight);
    // Use a deterministic hash to generate bubble positions (same seed = same positions)
    const bSeed = STATE.seed || 42;
    function bHash(i, off) { return (((i * 2654435761 + bSeed * 7919 + off * 1301081) >>> 0) / 4294967296); }
    for (let i = 0; i < 64; i++) {
      if (i < bubbleCount) {
        bpx[i] = bHash(i, 0) * targetWidth;
        bpy[i] = bHash(i, 1) * targetHeight;
        const sizeT = bHash(i, 2);
        const radius = sizeT < 0.3
          ? bHash(i, 3) * 0.015 + 0.005
          : bHash(i, 3) * 0.06 + 0.02;
        bpr[i] = radius * (0.5 + P.kulsyre) * maxDim;
      } else {
        bpx[i] = 0; bpy[i] = 0; bpr[i] = 0;
      }
    }
    shader.setUniform('uBubblePosX', bpx);
    shader.setUniform('uBubblePosY', bpy);
    shader.setUniform('uBubbleRad',  bpr);
    // Colours
    shader.setUniform('uC1', hex2rgb(P.color1));
    shader.setUniform('uC2', hex2rgb(P.color2));
    shader.setUniform('uC3', hex2rgb(P.color3));
    shader.setUniform('uC4', hex2rgb(P.color4));
  }

  /* ─── renderToBuffer — Render to offscreen buffer (single source of truth) ─── */
  function renderToBuffer() {
    if (!bufferShader || !renderBuffer) return;
    
    // Scale state to buffer dimensions
    scaleStateToTarget(EXPORT_W, EXPORT_H);
    
    // M contains resolution-independent scales from cellMapping(), but they're tuned
    // for the viewport size. Scale them down for the larger export resolution.
    const viewportDiag = Math.sqrt(CW * CW + CH * CH);
    const bufferDiag = Math.sqrt(EXPORT_W * EXPORT_W + EXPORT_H * EXPORT_H);
    const scaleFactor = bufferDiag / viewportDiag;
    
    // Store original values
    const origVoidScale = M.voidScale;
    const origThreadScale = M.threadScale;
    
    // Scale down for larger resolution (more pixels = need smaller scale values)
    M.voidScale = origVoidScale / scaleFactor;
    M.threadScale = origThreadScale / scaleFactor;
    
    // Render to buffer
    renderBuffer.push();
    renderBuffer.shader(bufferShader);
    setUniforms(bufferShader, EXPORT_W, EXPORT_H);
    renderBuffer.noStroke();
    renderBuffer.quad(-1, -1, 1, -1, 1, 1, -1, 1);
    renderBuffer.pop();
    
    // Restore original values
    M.voidScale = origVoidScale;
    M.threadScale = origThreadScale;
    
    // CRITICAL: Copy WebGL buffer to 2D canvas immediately (synchronously)
    // WebGL clears after the frame — composition reads this later via setTimeout
    if (!patternCanvas2D) {
      patternCanvas2D = document.createElement('canvas');
      patternCanvas2D.width = EXPORT_W;
      patternCanvas2D.height = EXPORT_H;
    }
    
    // Force WebGL to finish rendering before we copy
    const gl = renderBuffer.drawingContext;
    if (gl && gl.flush) gl.flush();
    if (gl && gl.finish) gl.finish();
    
    // Copy to 2D canvas (use .canvas instead of .elt for p5.Graphics)
    const ctx2d = patternCanvas2D.getContext('2d');
    const sourceCanvas = renderBuffer.canvas || renderBuffer.elt;
    ctx2d.drawImage(sourceCanvas, 0, 0);
    
    // DEBUG: verify copy worked
    const checkData = ctx2d.getImageData(EXPORT_W/2, EXPORT_H/2, 1, 1).data;
    console.log('[SOUR] Pattern copied, center pixel:', checkData[0], checkData[1], checkData[2], checkData[3]);
    
    dirty = false;
    
    // Trigger composition update immediately 
    if (typeof window !== 'undefined' && window.SOUR_COMPOSE) {
      setTimeout(() => window.SOUR_COMPOSE(), 10);
    }
  }

  function render() {
    // Just display the render buffer scaled to viewport
    if (!renderBuffer) return;
    p.push();
    p.image(renderBuffer, -p.width/2, -p.height/2, p.width, p.height);
    p.pop();
  }
  
  function fullGen()    { console.log('[SOUR] fullGen called, beer:', P.beer, 'seed:', P.seed); buildState(P.seed); prevStructural = { count: M.blobCount, rMin: M.radiusMin, rMax: M.radiusMax }; console.log('[SOUR] buildState done, blobs:', M.blobCount); renderToBuffer(); console.log('[SOUR] renderToBuffer done'); p.redraw(); }
  function previewGen() { buildState(P.seed); prevStructural = { count: M.blobCount, rMin: M.radiusMin, rMax: M.radiusMax }; renderToBuffer(); p.redraw(); }
  function renderOnly() {
    M = cellMapping();
    // Cap blob count to what was actually generated — prevents layout jumps
    if (prevStructural.count > 0) {
      M.blobCount = Math.min(M.blobCount, prevStructural.count);
    }
    renderToBuffer();
    p.redraw();
  }

  // smartUpdate now just re-renders — blob positions are ONLY regenerated
  // by fullGen (seed change, randomize, beer preset change)
  function smartUpdate() {
    renderOnly();
  }

  function resizeC(w, h) {
    CW = w; CH = h;
    p.resizeCanvas(w, h);
    const vw = (window.innerWidth - 370) * 0.95, vh = window.innerHeight * 0.92;
    const s  = Math.min(vw / CW, vh / CH, 1);
    canvas.style('width',  Math.round(CW * s) + 'px');
    canvas.style('height', Math.round(CH * s) + 'px');
    fullGen();
  }

  /* ─── HIGH-RES EXPORT — Export render buffer directly ─── */
  function exportHighRes(format, multiplier) {
    // We ignore multiplier - buffer is already at export resolution
    
    // Use the persistent 2D copy (same as composition uses)
    const bufferCanvas = patternCanvas2D || renderBuffer.elt;
    
    // Create label canvas with exact SVG dimensions (already at 4×)
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = EXPORT_W;
    labelCanvas.height = EXPORT_H;
    const lctx = labelCanvas.getContext('2d');
    
    // Draw pattern from buffer (no re-rendering!)
    const COMP = window.SOUR_COMPOSITION;

    // For Label4, draw pattern in mask area first, then SVG on top (so logo is visible)
    if (COMP?.template === 'Label4' && COMP?.svgImg) {
      const svgW = 581.1, svgH = 354.33;
      const maskH = EXPORT_H * (61.4 / svgH);

      // 1. Draw pattern clipped to MaskingRect region
      lctx.save();
      lctx.beginPath();
      lctx.rect(0, 0, EXPORT_W, maskH);
      lctx.clip();
      lctx.drawImage(bufferCanvas, 0, 0);
      lctx.restore();

      // 2. Draw SVG on top (logo stays visible)
      lctx.drawImage(COMP.svgImg, 0, 0, EXPORT_W, EXPORT_H);
    } else {
      // Default: pattern behind, SVG on top
      lctx.drawImage(bufferCanvas, 0, 0);
      if (COMP?.svgImg) {
        lctx.drawImage(COMP.svgImg, 0, 0, EXPORT_W, EXPORT_H);
      }
    }

    // Apply texture overlay to match screen appearance
    if (COMP?.textureImg) {
      lctx.globalCompositeOperation = 'overlay';
      lctx.globalAlpha = 1.5;
      lctx.drawImage(COMP.textureImg, 0, 0, EXPORT_W, EXPORT_H);
      lctx.globalCompositeOperation = 'source-over';
      lctx.globalAlpha = 1;
    }

    // Export the label canvas
    if (format === 'pdf') {
      const dataUrl = labelCanvas.toDataURL('image/jpeg', 0.95);
      const orientation = EXPORT_W > EXPORT_H ? 'landscape' : 'portrait';
      const pdf = new jsPDF({
        orientation, unit: 'px',
        format: [EXPORT_W, EXPORT_H],
        hotfixes: ['px_scaling'],
      });
      pdf.addImage(dataUrl, 'JPEG', 0, 0, EXPORT_W, EXPORT_H);
      pdf.save(`${P.beer.toLowerCase().replace(/ /g, '-')}_label_${STATE.seed}.pdf`);
    } else if (format === 'png') {
      labelCanvas.toBlob(b => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(b);
        a.download = `${P.beer.toLowerCase().replace(/ /g, '-')}_label_${STATE.seed}.png`;
        a.click();
      });
    } else if (format === 'jpg') {
      labelCanvas.toBlob(b => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(b);
        a.download = `${P.beer.toLowerCase().replace(/ /g, '-')}_label_${STATE.seed}.jpg`;
        a.click();
      }, 'image/jpeg', 0.95);
    }
  }

  /* ─── PATTERN-ONLY PNG EXPORT ─── */
  function exportPatternOnly() {
    const bufferCanvas = patternCanvas2D || renderBuffer.elt;
    if (!bufferCanvas) {
      console.warn('No pattern canvas available for export');
      return;
    }
    
    bufferCanvas.toBlob(b => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = `${P.beer.toLowerCase().replace(/ /g, '-')}_pattern_${STATE.seed}.png`;
      a.click();
    }, 'image/png');
  }

  window.SOUR_PREVIEW  = previewGen;
  window.SOUR_GENERATE = fullGen;
  window.SOUR_RENDER   = renderOnly;
  window.SOUR_SMART_UPDATE = smartUpdate;
  window.SOUR_EXPORT   = exportHighRes;
  window.SOUR_EXPORT_PATTERN = exportPatternOnly;
  window.SOUR_SAVE     = () => exportHighRes('pdf', 4);
  window.SOUR_RESIZE   = resizeC;

  p.setup = function () {
    const cont = document.getElementById('canvas-container');
    canvas = p.createCanvas(CW, CH, p.WEBGL);
    canvas.parent(cont);
    p.pixelDensity(Math.min(window.devicePixelRatio || 2));
    const vw = (window.innerWidth - 370) * 0.95, vh = window.innerHeight * 0.92;
    const s  = Math.min(vw / CW, vh / CH, 1);
    canvas.style('width',  Math.round(CW * s) + 'px');
    canvas.style('height', Math.round(CH * s) + 'px');
    
    // Create render buffer at export resolution (single source of truth)
    renderBuffer = p.createGraphics(EXPORT_W, EXPORT_H, p.WEBGL);
    renderBuffer.pixelDensity(1);
    
    // Create shader for buffer
    bufferShader = renderBuffer.createShader(VERT_SHADER, FRAG_SHADER);
    
    // Build state and render
    buildState(P.seed);
    prevStructural = { count: M.blobCount, rMin: M.radiusMin, rMax: M.radiusMax };
    renderToBuffer();
    
    p.noLoop();
  };

  p.draw          = function () { render(); };
  p.windowResized = function () {
    const vw = (window.innerWidth - 370) * 0.95, vh = window.innerHeight * 0.92;
    const s  = Math.min(vw / CW, vh / CH, 1);
    canvas.style('width',  Math.round(CW * s) + 'px');
    canvas.style('height', Math.round(CH * s) + 'px');
  };
  p.keyPressed = function () {
    if (p.key === 's' || p.key === 'S') exportHighRes('pdf', 4);
    if (p.key === 'r' || p.key === 'R') { randomizeControlled(); window.SOUR_SYNC_UI?.(); fullGen(); }
  };

  window.SOUR_GET_PATTERN_CANVAS = () => patternCanvas2D || (renderBuffer ? renderBuffer.elt : null);
});

/* ═══════════════════════════════════════════════════════════
   COMPOSITION SYSTEM — Beer Can + Label + Texture
   ═══════════════════════════════════════════════════════════ */
const COMPOSITION = {
  enabled: true,
  canImg: null,
  svgImg: null,
  textureImg: null,
  svgDoc: null,
  svgText: null,               // original SVG text (before recolor)
  template: 'Label1',          // current template name

  labelColors: { shape: '#ff0000', letters: '#ff7ec4', text: '#ffffff', logo: '#ffffff', stroke: '#ff7ec4' },

  labelScale: 0.65,
  labelYOffset: 0,
  labelTextureStrength: 0.8,
  wrapHighlightStrength: 0.8,

  labelBounds: { x: 0, y: 0, w: 0, h: 0 },
};
window.SOUR_COMPOSITION = COMPOSITION;

/* ─── Label colour defaults per template ─── */
const LABEL_COLOR_DEFAULTS = {
  Label1: { shape: '#240000', letters: '#ff7ec4', text: '#694d6a', logo: '#694d6a', stroke: '#ff7ec4' },
  Label2: { shape: '#c25b88', letters: '#ff52f9', text: '#ff0000', logo: '#ff0000', stroke: '#ff0000' },
  Label3: { shape: '#a9b46e', letters: '#788418', text: '#788418', logo: '#788418', stroke: '#ffffff' },
  Label4: { shape: '#ff2020', letters: '#ed1e79', text: '#ed1e79', logo: '#ffffff', stroke: '#ff0000' },
};

/* ─── Per-template parameter presets (applied when switching templates) ─── */
const TEMPLATE_PRESETS = {
  Label2: {
    abv: 2.5, ebc: 13,
    struktur: 0.72, krop: 0.88, membran: 0.55, gaering: 0.28,
    kulsyre: 0.42, filamenter: 0.23, udtryk: 0.18,
    form: 0.11, kanal: -0.30, skalering: 0.50,
    dWarpAmt: 0.12, dWarpFreq: 0.56, dFill: 0.77, dSoftness: 0.50,
    dStretch: 0.50, dVoids: 0.13, dThreads: 0.50, dGlow: 0.50,
  },
  Label3: {
    abv: 1.9, ebc: 13,
    struktur: 0.18, krop: 0.27, membran: 0.55, gaering: 0.28,
    kulsyre: 0.42, filamenter: 0.23, udtryk: 0.18,
    form: 0.11, kanal: -0.30, skalering: 0.50,
    dWarpAmt: 0.12, dWarpFreq: 0.56, dFill: 0.77, dSoftness: 0.50,
    dStretch: 0.11, dVoids: 0.13, dThreads: 0.50, dGlow: 0.50,
  },
};
window.SOUR_LABEL_COLOR_DEFAULTS = LABEL_COLOR_DEFAULTS;

/* ─── Per-template colour store (persists user edits across switches) ─── */
const TEMPLATE_COLOR_STORE = {};

/* ─── Recolour SVG DOM in-place ─── */
function recolorSVGDoc(doc, colors, template) {
  if (!doc || !colors || !template) return;

  // ── Shape / Background ──
  if (template === 'Label1') {
    // Label1: Shape is a single <path id="Shape"> — set fill directly
    const el = doc.getElementById('Shape');
    if (el) el.setAttribute('fill', colors.shape);
  } else if (template === 'Label2') {
    // Label2: No Shape ID — background is first <rect> child of <svg>
    const rects = doc.querySelectorAll('svg > rect');
    if (rects.length > 0) rects[0].setAttribute('fill', colors.shape);
  } else {
    // Label3 / Label4 — coloured paths inside <g id="Shape">
    const shape = doc.getElementById('Shape');
    if (shape) {
      shape.querySelectorAll('path').forEach(p => {
        const f = (p.getAttribute('fill') || '').toLowerCase();
        if (f && f !== 'none' && f !== '#fff' && f !== '#ffffff' && f !== 'white') {
          p.setAttribute('fill', colors.shape);
        }
      });
    }
  }

  // ── A letterforms ──
  const as = doc.getElementById('A_x27_s');
  if (as) {
    as.setAttribute('fill', colors.letters);
    as.querySelectorAll('path').forEach(p => p.setAttribute('fill', colors.letters));
  }

  // ── Text / Content ──
  const textGroupIds = {
    Label1: ['Content1', 'Content2', 'BigText', 'BigText2', 'BigText3', '_\u00c5ben'],
    Label2: ['Content'],
    Label3: ['Content', 'BigText1', 'BigText2', 'BigText3'],
    Label4: ['Text'],
  };
  (textGroupIds[template] || []).forEach(id => {
    const el = doc.getElementById(id);
    if (el) {
      el.setAttribute('fill', colors.text);
      el.querySelectorAll('path').forEach(p => p.setAttribute('fill', colors.text));
    }
  });

  // ── Logo fill ── (all templates now use 'Logo')
  const logoGroup = doc.getElementById('Logo');
  if (logoGroup && colors.logo) {
    logoGroup.querySelectorAll('path').forEach(p => {
      const f = (p.getAttribute('fill') || '').toLowerCase();
      if (f && f !== 'none') {
        p.setAttribute('fill', colors.logo);
      }
    });
  }

  // ── Stroke colour (only in Logo paths) ──
  if (logoGroup && colors.stroke) {
    logoGroup.querySelectorAll('path').forEach(p => {
      if (p.hasAttribute('stroke')) {
        p.setAttribute('stroke', colors.stroke);
      }
    });
  }
}

/* ─── Apply current labelColors to stored SVG and regenerate image ─── */
async function applyLabelColors() {
  const svgText = COMPOSITION.svgText;
  if (!svgText) return;

  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, 'image/svg+xml');

  recolorSVGDoc(doc, COMPOSITION.labelColors, COMPOSITION.template);

  // Set explicit dimensions so the browser rasterises the SVG at high resolution
  const svgEl = doc.documentElement;
  svgEl.setAttribute('width',  String(EXPORT_W));
  svgEl.setAttribute('height', String(EXPORT_H));

  COMPOSITION.svgDoc = doc;

  const serializer = new XMLSerializer();
  const recoloredText = serializer.serializeToString(doc);
  const svgBlob = new Blob([recoloredText], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(svgBlob);
  COMPOSITION.svgImg = await _loadImage(url);
  URL.revokeObjectURL(url);
}
window.SOUR_APPLY_LABEL_COLORS_SILENT = async () => {
  await applyLabelColors();
  window.SOUR_COMPOSE?.();
  window.SOUR_SYNC_UI?.();
};

/* ─── loadImage helper (reusable) ─── */
const _loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.src = src;
});

/* ─── Template loader — swaps SVG overlay without touching pattern ─── */
async function loadTemplate(name) {
  const path = '/' + name + '.svg';
  try {
    const svgText = await fetch(path).then(r => r.text());
    COMPOSITION.svgText = svgText;
    COMPOSITION.template = name;

    // Use persisted colours if available, otherwise defaults
    const stored = TEMPLATE_COLOR_STORE[name];
    const defaults = LABEL_COLOR_DEFAULTS[name] || LABEL_COLOR_DEFAULTS.Label1;
    COMPOSITION.labelColors = stored ? { ...stored } : { ...defaults };

    // Apply recolouring and create SVG image
    await applyLabelColors();

    console.log('Template loaded:', name);
    return true;
  } catch (e) {
    console.warn('Could not load template:', name, e);
    return false;
  }
}

/* ─── Global: set template + re-compose (no pattern regen) ─── */
window.SOUR_SET_TEMPLATE = async (name) => {
  // Save current template's colours before switching
  if (COMPOSITION.template && COMPOSITION.labelColors) {
    TEMPLATE_COLOR_STORE[COMPOSITION.template] = { ...COMPOSITION.labelColors };
  }
  const ok = await loadTemplate(name);
  if (ok) {
    // Apply per-template parameter preset if one exists
    const preset = TEMPLATE_PRESETS[name];
    if (preset) {
      for (const k of Object.keys(preset)) P[k] = preset[k];
      window.SOUR_SYNC_UI?.();
      window.SOUR_GENERATE?.();
    }
    window.SOUR_COMPOSE?.();
    window.SOUR_TEMPLATE_CHANGED?.(name);
  }
  return ok;
};

/* ─── Global: set label colours + re-compose ─── */
window.SOUR_SET_LABEL_COLORS = async (colors) => {
  if (colors.shape   !== undefined) COMPOSITION.labelColors.shape   = colors.shape;
  if (colors.letters !== undefined) COMPOSITION.labelColors.letters = colors.letters;
  if (colors.text    !== undefined) COMPOSITION.labelColors.text    = colors.text;
  if (colors.logo    !== undefined) COMPOSITION.labelColors.logo    = colors.logo;
  if (colors.stroke  !== undefined) COMPOSITION.labelColors.stroke  = colors.stroke;
  // Persist to store so colours survive template switches
  TEMPLATE_COLOR_STORE[COMPOSITION.template] = { ...COMPOSITION.labelColors };
  await applyLabelColors();
  window.SOUR_COMPOSE?.();
};

async function loadCompositionAssets() {
  try {
    COMPOSITION.canImg     = await _loadImage('/BeerCan2.png');
    COMPOSITION.textureImg = await _loadImage('/papertexture2.jpg');
    COMPOSITION.shadowImg  = await _loadImage('/shadows.png');

    // Load default template (Label1)
    await loadTemplate(COMPOSITION.template);

    console.log('Composition assets loaded');
    window.SOUR_COMPOSE?.();
  } catch (e) {
    console.warn('Could not load composition assets:', e);
    COMPOSITION.enabled = false;
  }
}

function renderComposition(targetCanvas) {
  if (!COMPOSITION.enabled || !COMPOSITION.canImg || !COMPOSITION.svgImg) return;

  const ctx = targetCanvas.getContext('2d');
  const W = targetCanvas.width;
  const H = targetCanvas.height;

  // Light paper background
  ctx.fillStyle = '#f5f0eb';
  ctx.fillRect(0, 0, W, H);

  const canImg = COMPOSITION.canImg;
  const canAspect = canImg.width / canImg.height;
  let canW, canH;
  if (W / H > canAspect) {
    canH = H * 1.25;
    canW = canH * canAspect;
  } else {
    canW = W * 1.25;
    canH = canW / canAspect;
  }
  const canX = (W - canW) / 2;
  const canY = (H - canH) / 2;
  ctx.drawImage(canImg, canX, canY, canW, canH);

  const svgW = 581.1, svgH = 354.33;
  const labelW = canW * COMPOSITION.labelScale;
  const labelH = labelW * (svgH / svgW);
  const labelX = canX + (canW - labelW) / 2;
  const labelY = canY + (canH - labelH) / 2 + COMPOSITION.labelYOffset;
  COMPOSITION.labelBounds = { x: labelX, y: labelY, w: labelW, h: labelH };

  const patternCanvas = window.SOUR_GET_PATTERN_CANVAS?.();
  if (!patternCanvas) return;

  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = labelW;
  labelCanvas.height = labelH;
  const labelCtx = labelCanvas.getContext('2d');

  // For Label4, draw pattern in mask area first, then SVG on top (so logo is visible)
  if (COMPOSITION.template === 'Label4') {
    const maskH = labelH * (61.4 / svgH);   // MaskingRect height in canvas px

    // 1. Draw pattern clipped to MaskingRect region
    labelCtx.save();
    labelCtx.beginPath();
    labelCtx.rect(0, 0, labelW, maskH);
    labelCtx.clip();
    labelCtx.drawImage(patternCanvas, 0, 0, labelW, labelH);
    labelCtx.restore();

    // 2. Draw SVG on top (logo stays visible)
    labelCtx.drawImage(COMPOSITION.svgImg, 0, 0, labelW, labelH);
  } else {
    labelCtx.drawImage(patternCanvas, 0, 0, labelW, labelH);
    labelCtx.drawImage(COMPOSITION.svgImg, 0, 0, labelW, labelH);
  }

  if (COMPOSITION.textureImg && COMPOSITION.labelTextureStrength > 0) {
    labelCtx.globalCompositeOperation = 'multiply';
    labelCtx.globalAlpha = COMPOSITION.labelTextureStrength;
    labelCtx.drawImage(COMPOSITION.textureImg, 0, 0, labelW, labelH);
    labelCtx.globalCompositeOperation = 'source-over';
    labelCtx.globalAlpha = 1;
  }

  ctx.drawImage(labelCanvas, labelX, labelY);

  if (COMPOSITION.wrapHighlightStrength > 0) {
    const hlW = labelW * 0.08;
    const hlAlpha = COMPOSITION.wrapHighlightStrength * 0.5;
    const gradL = ctx.createLinearGradient(labelX, 0, labelX + hlW, 0);
    gradL.addColorStop(0, `rgba(255,255,255,${hlAlpha})`);
    gradL.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradL;
    ctx.fillRect(labelX, labelY, hlW, labelH);
    const gradR = ctx.createLinearGradient(labelX + labelW, 0, labelX + labelW - hlW, 0);
    gradR.addColorStop(0, `rgba(255,255,255,${hlAlpha})`);
    gradR.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradR;
    ctx.fillRect(labelX + labelW - hlW, labelY, hlW, labelH);
  }
}

function initComposition() {
  const compCanvas = document.createElement('canvas');
  compCanvas.id = 'composition-canvas';
  compCanvas.width = 800;
  compCanvas.height = 1000;
  compCanvas.style.cssText = 'display:none;';
  document.body.appendChild(compCanvas);

  loadCompositionAssets();

  window.SOUR_COMPOSE = () => {
    if (!COMPOSITION.enabled) return;
    const compCanvas = document.getElementById('composition-canvas');
    if (compCanvas) {
      renderComposition(compCanvas);
      window.SOUR_COMP_UPDATE?.();
    }
  };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initComposition);
} else {
  initComposition();
}

/* ═══════════════════════════════════════════════════════════
   HIDE MORFOLOGI PANEL (driven internally, no separate UI)
   ═══════════════════════════════════════════════════════════ */
(function hideMorfologi() {
  function doHide() {
    const secMorph = document.getElementById('sec-morph');
    if (secMorph) {
      secMorph.style.display = 'none';
      // Hide the section header too (previous sibling)
      const prev = secMorph.previousElementSibling;
      if (prev && prev.classList.contains('section-head')) {
        prev.style.display = 'none';
      }
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', doHide);
  } else {
    doHide();
  }
})();


