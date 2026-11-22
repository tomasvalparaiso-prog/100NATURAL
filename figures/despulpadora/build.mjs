// Despulpadora de fruta: figura isométrica interactiva.
// node figures/despulpadora/build.mjs [--light]
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../.claude/skills/anatomy/kit/iso-kit.mjs";
import * as G from "../../.claude/skills/anatomy/kit/lathe.mjs";
import { kitScript } from "../../.claude/skills/anatomy/scripts/inline-kit.mjs";
import { MODEL } from "./model.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

// 1 unidad = 4 mm.
const WIDTH = 640;
const HEIGHT = 440;
const AZ = 52;

const LEG = { x: 100, y: 40, w: 7, top: 140, foot: 6 };
const RAIL_Z = [140, 148];
const SHELF_Z = [43, 45];
const BRACE_Z = [36, 43];

const ZC = 200; // eje del rotor
const R = 34; // radio del tamiz
const SIEVE = [-96, 96];
const COVER = [-96, -56];
const PAN = { x: -92, y: -38, w: 166, d: 76, z: 148, h: 20 };
const BLADE = { r0: 23, r1: MODEL.tipR, half: 1.1, x: [-88, 88] };
const ARMS = [-66, -4, 58];
const PULLEY = { x: [112, 122], r: MODEL.rotorPulleyR };
const MOTOR = { z: 66, r: 15, body: [58, 94], pulleyR: MODEL.motorPulleyR, pulley: [113, 121] };
const CHUTE = { x: [77, 91], from: [0, 160], to: [64, 112], h: 9 };
const BUCKET = { x: -22, y: 62, r: 18, h: 50 };
const BIN = { x: 70, y: 58, w: 30, d: 28, h: 30 };
const VFD = { x: -66, y: 43.5, w: 28, d: 9, z: 104, h: 32 };
const SPOUT = { x: -22, y: [38, 54], z: 152 };

const P = k.fitProjection(
  [
    ...k.boxCorners({ x: -104, y: -44, w: 208, d: 88, r: 0 }, 0, 150),
    [-100, -26, 286], [-52, 26, 286], [124, 0, ZC + 27], [124, 0, ZC - 27],
    [BUCKET.x, BUCKET.y + BUCKET.r, 0], [BIN.x + BIN.w, BIN.y + BIN.d, 0],
  ],
  WIDTH,
  HEIGHT,
  { pad: 16, azimuth: AZ, elevation: 38 },
);

const V = G.viewOf(P);
const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const path = (pts, close = false) => (pts.length ? "M" + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L") + (close ? "Z" : "") : "");
const box = (x0, x1, y0, y1, z0, z1, r = 0.8, bevel = 0.4) => k.slabOf({ x: x0, y: y0, w: x1 - x0, d: y1 - y0, r }, z0, z1 - z0, P, 3, bevel);
const XF = (y = 0, z = ZC) => G.frameOf([0, y, z], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
const YF = (x, z) => G.frameOf([x, 0, z], [0, 1, 0], [0, 0, 1], [1, 0, 0]);

// Una cara plana en 3D, sombreada como las del kit.
function face(poly, { tone = "hi", lit = false, inside = false } = {}) {
  const a = G.sub3(poly[1], poly[0]);
  const b = G.sub3(poly[2], poly[0]);
  let n = G.unit3(G.cross3(a, b));
  if (G.dot3(n, V) < 0) n = G.mul3(n, -1);
  const shade = G.toneOf(n, P);
  const d = path(poly.map(at), true);
  const fill = inside ? `<path class="iso-shade" data-shade="${Math.min(shade, 3) === 3 ? 1 : 0}" d="${d}"/>` : shade === 4 ? `<path class="iso-top" d="${d}"/>` : `<path class="iso-shade" data-shade="${shade}" d="${d}"/>`;
  return `<g class="iso-solid"${lit ? " data-lit" : ""}><path class="iso-fill" d="${d}"/>${fill}<path class="iso-line iso-edge" data-tone="${tone}" d="${d}"/></g>`;
}

// Media cáscara cilíndrica a lo largo de x (tamiz y tapa). Devuelve la cara interior (atrás) y la exterior (adelante).
function shell(x0, x1, r, phi0, phi1, { n = 72, holes = null, rimNear = true } = {}) {
  const pt = (x, f) => [x, r * Math.cos(f), ZC + r * Math.sin(f)];
  const strips = [];
  for (let i = 0; i < n; i++) {
    const fa = phi0 + ((phi1 - phi0) * i) / n;
    const fb = phi0 + ((phi1 - phi0) * (i + 1)) / n;
    const fm = (fa + fb) / 2;
    const N = [0, Math.cos(fm), Math.sin(fm)];
    const s = G.dot3(N, V);
    const front = s > 0;
    const tone = front ? G.toneOf(N, P) : G.toneOf(G.mul3(N, -1), P);
    strips.push({ fa, fb, front, tone });
  }
  const runs = [];
  for (const st of strips) {
    const last = runs[runs.length - 1];
    if (last && last.front === st.front && last.tone === st.tone) last.fb = st.fb;
    else runs.push({ ...st });
  }
  const band = (fa, fb) => {
    const steps = Math.max(2, Math.ceil(((fb - fa) / (phi1 - phi0)) * n));
    const a = [];
    for (let i = 0; i <= steps; i++) a.push(pt(x0, fa + ((fb - fa) * i) / steps));
    const b = [];
    for (let i = steps; i >= 0; i--) b.push(pt(x1, fa + ((fb - fa) * i) / steps));
    return path([...a, ...b].map(at), true);
  };
  const paint = (list) =>
    list
      .map((run) => {
        const d = band(run.fa, run.fb);
        const cls = run.tone === 4 ? `class="iso-top"` : `class="iso-shade" data-shade="${run.front ? run.tone : Math.max(0, run.tone - 1)}"`;
        return `<path class="iso-fill" d="${d}"/><path ${cls} d="${d}"/>`;
      })
      .join("");
  const backRuns = runs.filter((r0) => !r0.front);
  const frontRuns = runs.filter((r0) => r0.front);
  // Generatrices: bordes (rim) y limbo donde la cara cambia de lado.
  const gen = (f) => path([at(pt(x0, f)), at(pt(x1, f))]);
  const arc = (x, fa, fb, m = 40) => path(Array.from({ length: m + 1 }, (_, i) => at(pt(x, fa + ((fb - fa) * i) / m))));
  const limbs = [];
  for (let i = 1; i < strips.length; i++) if (strips[i].front !== strips[i - 1].front) limbs.push(strips[i].fa);
  // Perforaciones: puntos que se desvanecen hacia el limbo.
  let backDots = [];
  let frontDots = [];
  if (holes) {
    const { pitch, from = x0 + 3, to = x1 - 3 } = holes;
    const dphi = pitch / r;
    let row = 0;
    for (let f = phi0 + dphi / 2; f < phi1 - dphi / 3; f += dphi, row++) {
      const N = [0, Math.cos(f), Math.sin(f)];
      const s = G.dot3(N, V);
      const alpha = G.fadeOf(Math.abs(s), [0.03, 0.35]);
      if (alpha < 0.05) continue;
      for (let x = from + (row % 2 ? pitch / 2 : 0); x < to; x += pitch) {
        if (holes.skip && holes.skip(x, f)) continue;
        const [sx, sy] = at(pt(x, f));
        (s > 0 ? frontDots : backDots).push([sx, sy, +alpha.toFixed(2)]);
      }
    }
  }
  return { pt, backRuns, frontRuns, paint, gen, arc, limbs, backDots, frontDots };
}

// ---------- Bastidor ----------
const legAt = [
  [-LEG.x, -LEG.y],
  [LEG.x, -LEG.y],
  [-LEG.x, LEG.y],
  [LEG.x, LEG.y],
];
function foot([x, y]) {
  const out = [];
  out.push(S(k.cylinder(x, y, 6, 0, 2, P, 28), { tone: "lo" }));
  out.push(S(k.cylinder(x, y, 1.6, 2, LEG.foot - 2, P, 16), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(x, y, 3.2, 3.2, 1.8, P, 6), { tone: "mid" }));
  return out.join("");
}
function leg([x, y]) {
  const h = LEG.w / 2;
  const out = [foot([x, y])];
  out.push(S(box(x - h, x + h, y - h, y + h, LEG.foot, LEG.top, 1, 0), { tone: "mid" }));
  out.push(S(box(x - h - 1, x + h + 1, y - h - 1, y + h + 1, LEG.foot, LEG.foot + 1.4, 0.6, 0), { tone: "mid" }));
  return out.join("");
}
const railX = (y) => S(box(-LEG.x - 3.5, LEG.x + 3.5, y - 3.5, y + 3.5, RAIL_Z[0], RAIL_Z[1], 1, 0.4), { tone: "mid" });
const railY = (x) => S(box(x - 3.5, x + 3.5, -LEG.y + 3.5, LEG.y - 3.5, RAIL_Z[0], RAIL_Z[1], 1, 0.4), { tone: "mid" });
const braceX = (y) => S(box(-LEG.x + 3.5, LEG.x - 3.5, y - 3.5, y + 3.5, BRACE_Z[0], BRACE_Z[1], 0.8, 0.3), { tone: "mid" });
const braceY = (x) => S(box(x - 3.5, x + 3.5, -LEG.y + 3.5, LEG.y - 3.5, BRACE_Z[0], BRACE_Z[1], 0.8, 0.3), { tone: "mid" });
const railBolts = (y) => D([-LEG.x, LEG.x].map((x) => at([x, y, RAIL_Z[1]])), { size: 0.5 });

function shelf() {
  const plan = { x: -LEG.x + 3.5, y: -LEG.y + 3.5, w: 2 * LEG.x - 7, d: 2 * LEG.y - 7, r: 0.6 };
  const out = [S(k.slabOf(plan, SHELF_Z[0], SHELF_Z[1] - SHELF_Z[0], P, 2, 0.4), { tone: "mid" })];
  const ribs = [-60, -20, 20];
  out.push(L(ribs.map((x) => k.lineOnTop([x, plan.y], [x, plan.y + plan.d], SHELF_Z[1], P)).join(""), { tone: "faint" }));
  out.push(D(k.corners(plan, 3).map((p) => at([p[0], p[1], SHELF_Z[1]])), { size: 0.45 }));
  return out.join("");
}

// ---------- Motor ----------
function motor() {
  const F = XF(0, MOTOR.z);
  const out = [];
  const base = { x0: 62, x1: 92, y: 15 };
  out.push(`<path class="iso-halo" d="${k.haloOf({ x: 56, y: -18, w: 40, d: 36, r: 6 }, SHELF_Z[1], 0.1, P)}" style="filter:blur(5px)"/>`);
  // Rieles tensores
  for (const y of [-12, 12]) {
    out.push(S(box(60, 96, y - 3, y + 3, SHELF_Z[1], SHELF_Z[1] + 2, 0.6, 0.3), { tone: "mid" }));
    out.push(L(k.planOutline({ x: 64, y: y - 1, w: 28, d: 2, r: 1 }, SHELF_Z[1] + 2, P, 4), { tone: "lo" }));
  }
  out.push(S(box(base.x0, base.x1, -base.y, base.y, SHELF_Z[1] + 2, 50, 0.8, 0.4), { tone: "mid" }));
  out.push(D([[66, -11], [88, -11], [66, 11], [88, 11]].map(([x, y]) => at([x, y, 50])), { size: 0.55 }));
  // Tapa del ventilador
  out.push(S(G.disc(50, 58, MOTOR.r - 1.5, F, P), { tone: "mid", inner: L(G.arcOf(F, 54, MOTOR.r - 1.5, P), { tone: "faint" }) }));
  const vents = [];
  for (let r0 = 3; r0 <= 10; r0 += 3.5) vents.push(G.circleOf(F, 50, r0, P));
  out.push(L(vents.join(""), { tone: "lo" }));
  // Carcasa con aletas
  const fins = G.ribsOf(F, MOTOR.body[0] + 1, MOTOR.body[1] - 1, MOTOR.r, 28, P, { fade: [0.05, 0.4] });
  out.push(S(G.disc(MOTOR.body[0], MOTOR.body[1], MOTOR.r, F, P), { tone: "mid", inner: k.fadedSvg(fins, { tone: "lo" }) + L(G.arcOf(F, MOTOR.body[0] + 1, MOTOR.r, P) + G.arcOf(F, MOTOR.body[1] - 1, MOTOR.r, P), { tone: "faint" }) }));
  // Caja de bornes
  out.push(S(box(70, 84, -7, 7, MOTOR.z + MOTOR.r - 2, MOTOR.z + MOTOR.r + 8, 1, 0.5), { tone: "mid" }));
  out.push(L(k.planOutline({ x: 71.5, y: -5.5, w: 11, d: 11, r: 0.8 }, MOTOR.z + MOTOR.r + 8, P, 3), { tone: "faint" }));
  out.push(D([[72.5, -4.5], [81.5, -4.5], [72.5, 4.5], [81.5, 4.5]].map(([x, y]) => at([x, y, MOTOR.z + MOTOR.r + 8])), { size: 0.45 }));
  // Placa de características sobre el costado
  const plate = k.sideMatrix([72, 15.2, MOTOR.z + 2], MOTOR.z + 2, P, "left");
  // Escudo delantero, eje y polea motriz
  out.push(S(G.disc(MOTOR.body[1], MOTOR.body[1] + 4, MOTOR.r - 2, F, P), { tone: "mid" }));
  out.push(D(G.dotsOf(F, MOTOR.body[1] + 4, MOTOR.r - 4.5, 4, P, { phase: Math.PI / 4, all: true }), { size: 0.5 }));
  out.push(S(G.disc(MOTOR.body[1] + 4, MOTOR.pulley[1] + 3, 2, F, P), { tone: "mid", crease: "none" }));
  void plate;
  return out.join("");
}

function motorPulley() {
  const F = XF(0, MOTOR.z);
  return S(G.disc(MOTOR.pulley[0], MOTOR.pulley[1], MOTOR.pulleyR, F, P), { tone: "mid", inner: L(G.arcOf(F, MOTOR.pulley[0] + 2.7, MOTOR.pulleyR, P) + G.arcOf(F, MOTOR.pulley[1] - 2.7, MOTOR.pulleyR, P), { tone: "lo" }) }) + L(G.circleOf(F, MOTOR.pulley[1], 3.2, P), { tone: "lo" });
}

// ---------- Bandeja colectora ----------
const PX = [PAN.x, PAN.x + PAN.w];
const PY = [PAN.y, PAN.y + PAN.d];
const PZ = [PAN.z, PAN.z + PAN.h];
const T = 2;
function panBack() {
  const out = [];
  out.push(S(box(PX[0], PX[1], PY[0], PY[1], PZ[0], PZ[0] + T, 1.2, 0), { tone: "mid" }));
  // pulpa en el fondo
  out.push(S(k.slabOf({ x: PX[0] + T, y: PY[0] + T, w: PAN.w - 2 * T, d: PAN.d - 2 * T, r: 1 }, PZ[0] + T, 3, P, 3), { tone: "lo", crease: "none", className: "dp-pulp" }));
  out.push(S(box(PX[0], PX[1], PY[0], PY[0] + T, PZ[0], PZ[1], 0.6, 0.4), { tone: "mid" }));
  out.push(S(box(PX[0], PX[0] + T, PY[0], PY[1], PZ[0], PZ[1], 0.6, 0.4), { tone: "mid" }));
  return out.join("");
}
function panFront() {
  const out = [];
  out.push(S(box(PX[1] - T, PX[1], PY[0], PY[1], PZ[0], PZ[1], 0.6, 0.4), { tone: "mid" }));
  const near = { x: PX[0], y: PY[1] - T, w: PAN.w, d: T, r: 0.6 };
  out.push(S(k.slabOf(near, PZ[0], PAN.h, P, 3, 0.4), { tone: "mid", inner: L(k.sideSeam(near, PZ[0] + 4, P, 3), { tone: "faint" }) }));
  // Pico de salida de pulpa
  const F = YF(SPOUT.x, SPOUT.z);
  out.push(S(G.disc(PY[1] - 1, PY[1] + 2, 5.5, F, P), { tone: "mid" }));
  out.push(S(G.disc(PY[1] + 2, SPOUT.y[1], 3.6, F, P), { tone: "mid", inner: L(G.arcOf(F, SPOUT.y[1] - 4, 3.6, P), { tone: "faint" }) }));
  out.push(L(G.circleOf(F, SPOUT.y[1], 2.6, P), { tone: "lo" }));
  out.push(D(G.dotsOf(F, PY[1] + 2, 4.6, 4, P, { phase: Math.PI / 4, all: true }), { size: 0.45 }));
  // Etiqueta grabada
  out.push(k.faceTextSvg(k.sideMatrix([PX[0] + 40, PY[1], PZ[0] + 9], PZ[0] + 9, P, "left"), "PULPA", { size: 3.4, tone: "lo", anchor: "middle" }));
  return out.join("");
}

// ---------- Tamiz, tapa fija, tolva ----------
const sieve = shell(SIEVE[0], SIEVE[1], R, Math.PI, 2 * Math.PI, {
  n: 96,
  holes: { pitch: 3.4, skip: (x, f) => x > CHUTE.x[0] - 1 && x < CHUTE.x[1] + 1 && Math.abs(f - 1.5 * Math.PI) < 0.35 },
});
const cover = shell(COVER[0], COVER[1], R + 0.6, 0, Math.PI, { n: 72 });

function flange(side) {
  const y0 = side > 0 ? R : -R - 7;
  const plan = { x: SIEVE[0], y: y0, w: SIEVE[1] - SIEVE[0], d: 7, r: 0.6 };
  const out = [S(k.slabOf(plan, ZC - 2, 2, P, 2, 0.3), { tone: "mid" })];
  const bolts = [];
  for (let x = SIEVE[0] + 8; x < SIEVE[1] - 4; x += 16) bolts.push(at([x, y0 + 3.5, ZC]));
  out.push(D(bolts, { size: 0.5 }));
  return out.join("");
}
function hinges() {
  const out = [];
  for (const x0 of [-40, 10, 60]) {
    const F = XF(-R - 6.5, ZC + 2);
    out.push(S(G.disc(x0, x0 + 12, 2.4, F, P), { tone: "mid", inner: L(G.arcOf(F, x0 + 4, 2.4, P) + G.arcOf(F, x0 + 8, 2.4, P), { tone: "lo" }) }));
  }
  return out.join("");
}
function latches() {
  const out = [];
  for (const x0 of [-36, 14, 64]) {
    out.push(S(box(x0, x0 + 10, R + 7, R + 10, ZC - 9, ZC, 0.6, 0.3), { tone: "mid" }));
    out.push(S(box(x0 + 3, x0 + 7, R + 10, R + 13, ZC - 7, ZC - 2, 0.8, 0), { tone: "mid" }));
    out.push(D([at([x0 + 2, R + 10, ZC - 7]), at([x0 + 8, R + 10, ZC - 7])], { size: 0.45 }));
  }
  return out.join("");
}

function endPlateBack() {
  const F = XF();
  const out = [];
  out.push(S(box(-100, -96.5, -10, 10, RAIL_Z[1], ZC - R - 4, 0.6, 0.3), { tone: "mid" }));
  out.push(S(G.disc(-100, -96, R + 4, F, P), { tone: "mid" }));
  return out.join("");
}
function sieveBack() {
  const out = [sieve.paint(sieve.backRuns)];
  out.push(D(sieve.backDots, { size: 0.42, tone: "mid" }));
  out.push(L(sieve.gen(Math.PI), { tone: "mid" }));
  return out.join("");
}
function coverBack() {
  return cover.paint(cover.backRuns);
}
function sieveFront() {
  const out = [sieve.paint(sieve.frontRuns)];
  out.push(D(sieve.frontDots, { size: 0.42, tone: "lo" }));
  out.push(L(sieve.limbs.map((f) => sieve.gen(f)).join("") + sieve.arc(SIEVE[1], Math.PI, 2 * Math.PI, 60), { tone: "hi" }));
  // aros de refuerzo del tamiz
  const ringsAt = [-40, 0, 40];
  out.push(L(ringsAt.map((x) => sieve.arc(x, Math.PI, 2 * Math.PI, 60)).join(""), { tone: "faint" }));
  out.push(L(sieve.gen(2 * Math.PI), { tone: "hi" }));
  return out.join("");
}
function coverFront() {
  const out = [cover.paint(cover.frontRuns)];
  out.push(L(cover.limbs.map((f) => cover.gen(f)).join("") + cover.arc(COVER[1], 0, Math.PI, 60) + cover.gen(0), { tone: "hi" }));
  out.push(L(cover.arc(COVER[0] + 3, 0, Math.PI * 0.55, 30), { tone: "faint" }));
  return out.join("");
}

// Tolva: tronco de pirámide hueco.
const HOP = { lo: { x: [-86, -66], y: [-11, 11], z: 240 }, hi: { x: [-102, -50], y: [-27, 27], z: 286 } };
function hopperFaces() {
  const { lo, hi } = HOP;
  const c = (o, x, y) => [o.x[x], o.y[y], o.z];
  const faces = [
    { poly: [c(lo, 0, 0), c(lo, 1, 0), c(hi, 1, 0), c(hi, 0, 0)], out: [0, -1, 0] },
    { poly: [c(lo, 0, 1), c(lo, 1, 1), c(hi, 1, 1), c(hi, 0, 1)], out: [0, 1, 0] },
    { poly: [c(lo, 0, 0), c(lo, 0, 1), c(hi, 0, 1), c(hi, 0, 0)], out: [-1, 0, 0] },
    { poly: [c(lo, 1, 0), c(lo, 1, 1), c(hi, 1, 1), c(hi, 1, 0)], out: [1, 0, 0] },
  ];
  // una cara es "trasera" si su normal exterior (con la inclinación) se aleja del observador
  return faces.map((f) => {
    const a = G.sub3(f.poly[1], f.poly[0]);
    const b = G.sub3(f.poly[3], f.poly[0]);
    let n = G.unit3(G.cross3(a, b));
    if (G.dot3(n, f.out) < 0) n = G.mul3(n, -1);
    return { ...f, n, back: G.dot3(n, V) < 0 };
  });
}
function hopperBack() {
  return hopperFaces()
    .filter((f) => f.back)
    .map((f) => face(f.poly, { tone: "mid", inside: true }))
    .join("");
}
function throat() {
  const { lo } = HOP;
  return S(box(lo.x[0], lo.x[1], lo.y[0], lo.y[1], ZC + R - 2, lo.z, 0.6, 0.3), { tone: "mid" });
}
function hopperFront() {
  const { hi } = HOP;
  const out = hopperFaces()
    .filter((f) => !f.back)
    .sort((a, b) => G.dot3(a.poly[2], V) - G.dot3(b.poly[2], V))
    .map((f) => face(f.poly, { tone: "hi" }));
  // labio enrollado del borde superior
  const rim = [
    [hi.x[0], hi.y[0]], [hi.x[1], hi.y[0]], [hi.x[1], hi.y[1]], [hi.x[0], hi.y[1]],
  ].map(([x, y]) => [x, y, hi.z]);
  out.push(L(path([...rim, rim[0]].map(at)), { tone: "hi" }));
  return out.join("");
}
// Fruta en la tolva
const FRUIT = (() => {
  const list = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const spots = [
    [-92, -16], [-80, -18], [-68, -16], [-58, -14], [-94, -2], [-82, -4], [-70, -2], [-59, 0],
    [-90, 12], [-78, 10], [-66, 13], [-56, 14], [-86, 22], [-74, 22], [-62, 22],
  ];
  for (const [x, y] of spots) list.push({ c: [x + rnd() * 2, y + rnd() * 2, 280 + rnd() * 5], r: 5.2 + rnd() * 1.4 });
  return list.sort((a, b) => G.dot3(a.c, V) - G.dot3(b.c, V));
})();
function fruit() {
  return FRUIT.map((f) => S(G.sphereOf(f.c, f.r, P), { tone: "mid", className: "dp-fruit" })).join("");
}

// ---------- Rotor (cuadros precalculados) ----------
const FX = XF();
function bladeSolid(theta) {
  const c = [Math.cos(theta), Math.sin(theta)];
  const n = [-Math.sin(theta), Math.cos(theta)];
  const poly = [
    [c[0] * BLADE.r0 - n[0] * BLADE.half, c[1] * BLADE.r0 - n[1] * BLADE.half],
    [c[0] * BLADE.r1 - n[0] * BLADE.half, c[1] * BLADE.r1 - n[1] * BLADE.half],
    [c[0] * BLADE.r1 + n[0] * BLADE.half, c[1] * BLADE.r1 + n[1] * BLADE.half],
    [c[0] * BLADE.r0 + n[0] * BLADE.half, c[1] * BLADE.r0 + n[1] * BLADE.half],
  ];
  const out = [];
  out.push(S(G.prismOf(FX, poly, BLADE.x[0], BLADE.x[1], P), { tone: "hi", lit: true }));
  return out.join("");
}
function armSolid(theta, x) {
  const c = [Math.cos(theta), Math.sin(theta)];
  const n = [-Math.sin(theta), Math.cos(theta)];
  const w = 2.2;
  const poly = [
    [c[0] * 3.4 - n[0] * w, c[1] * 3 - n[1] * w],
    [c[0] * (BLADE.r0 + 1) - n[0] * w, c[1] * (BLADE.r0 + 1) - n[1] * w],
    [c[0] * (BLADE.r0 + 1) + n[0] * w, c[1] * (BLADE.r0 + 1) + n[1] * w],
    [c[0] * 3.4 + n[0] * w, c[1] * 3 + n[1] * w],
  ];
  return S(G.prismOf(FX, poly, x - 2, x + 2, P), { tone: "mid" });
}
const BLADES = 4;
const FRAMES = 30;
function rotorFrame(phase) {
  const items = [];
  for (let i = 0; i < BLADES; i++) {
    const theta = phase + (i * 2 * Math.PI) / BLADES;
    const mid = G.pointOf(FX, 0, (BLADE.r0 + BLADE.r1) / 2, theta);
    const depth = G.dot3(G.sub3(mid, [0, 0, ZC]), V);
    const arms = ARMS.map((x) => armSolid(theta, x)).join("");
    items.push({ depth, svg: arms + bladeSolid(theta) });
  }
  items.sort((a, b) => a.depth - b.depth);
  const back = items.filter((it) => it.depth < 0).map((it) => it.svg).join("");
  const front = items.filter((it) => it.depth >= 0).map((it) => it.svg).join("");
  return [back, front];
}
const SHAFT = S(G.disc(-96, 96, 3.4, FX, P), { tone: "mid", inner: L(ARMS.map((x) => G.arcOf(FX, x - 3, 3.4, P) + G.arcOf(FX, x + 3, 3.4, P)).join(""), { tone: "lo" }) }) + ARMS.map((x) => S(G.disc(x - 3, x + 3, 4.4, FX, P), { tone: "mid" })).join("");
function pulleyBody() {
  const F = XF();
  const r = PULLEY.r;
  return S(G.disc(PULLEY.x[0], PULLEY.x[1], r, F, P), { tone: "mid", inner: L(G.arcOf(F, PULLEY.x[0] + 3.3, r, P) + G.arcOf(F, PULLEY.x[1] - 3.3, r, P), { tone: "lo" }) }) + L(G.circleOf(F, PULLEY.x[1], r - 3.5, P), { tone: "lo" });
}
function pulleyHub() {
  const F = XF();
  return S(G.disc(PULLEY.x[1], PULLEY.x[1] + 2.5, 7, F, P), { tone: "mid" }) + L(G.circleOf(F, PULLEY.x[1] + 2.5, 2.2, P), { tone: "mid" });
}
function pulleyFrame(phase) {
  const F = XF();
  const out = [];
  const r = PULLEY.r;
  // cuatro brazos con ventanas
  const spokes = [];
  for (let i = 0; i < 4; i++) {
    const t0 = phase + (i * Math.PI) / 2 + 0.32;
    const t1 = phase + ((i + 1) * Math.PI) / 2 - 0.32;
    const pts = [];
    for (let j = 0; j <= 10; j++) pts.push(at(G.pointOf(F, PULLEY.x[1], r - 6, t0 + ((t1 - t0) * j) / 10)));
    for (let j = 10; j >= 0; j--) pts.push(at(G.pointOf(F, PULLEY.x[1], 10.5, t0 + ((t1 - t0) * j) / 10)));
    spokes.push(path(pts, true));
  }
  out.push(`<path class="dp-window" d="${spokes.join("")}"/>`);
  out.push(L(spokes.join(""), { tone: "lo" }));
  return out.join("");
}
const ROTOR_FRAMES = Array.from({ length: FRAMES }, (_, i) => rotorFrame(Math.PI / 4 + ((i / FRAMES) * 2 * Math.PI) / BLADES));
const PULLEY_FRAMES = Array.from({ length: FRAMES }, (_, i) => pulleyFrame(((i / FRAMES) * 2 * Math.PI) / 4));

// ---------- Extremo motriz ----------
function endPlateFront() {
  const F = XF();
  const out = [];
  out.push(S(box(96, 99.5, -10, 10, RAIL_Z[1], ZC - R - 4, 0.6, 0.3), { tone: "mid" }));
  const poly = [];
  for (let i = 0; i <= 40; i++) {
    const a = Math.PI + (Math.PI * i) / 40;
    poly.push([(R + 4) * Math.cos(a), (R + 4) * Math.sin(a)]);
  }
  poly.push([14, 13], [-14, 13]);
  out.push(S(G.prismOf(F, poly, 96, 100, P), { tone: "mid" }));
  out.push(D([[-30, -10], [30, -10], [0, -34], [-22, -27], [22, -27]].map(([u, v]) => at(G.pointOf(F, 100, Math.hypot(u, v), Math.atan2(v, u)))), { size: 0.5 }));
  // Rodamiento de brida
  const sq = [[-10, -10], [10, -10], [10, 10], [-10, 10]].map(([u, v]) => [u, v]);
  out.push(S(G.prismOf(F, sq, 100, 103, P), { tone: "mid" }));
  out.push(D([[-7, -7], [7, -7], [7, 7], [-7, 7]].map(([u, v]) => at(G.pointOf(F, 103, Math.hypot(u, v), Math.atan2(v, u)))), { size: 0.55 }));
  out.push(S(G.disc(103, 109, 7.5, F, P), { tone: "mid", inner: L(G.arcOf(F, 106, 7.5, P), { tone: "faint" }) }));
  out.push(S(G.disc(109, 112, 4.6, F, P), { tone: "mid" }));
  out.push(D([at(G.pointOf(F, 105, 7.5, 0.6))], { size: 0.6, tone: "hi" }));
  out.push(S(G.disc(108, PULLEY.x[0] + 1, 3.4, F, P), { tone: "mid", crease: "none" }));
  return out.join("");
}

// Correa: dos tramos tangentes a las poleas, en el plano x = 117.
const BELT_X = [114, 120];
function beltRuns() {
  const c1 = [0, MOTOR.z];
  const c2 = [0, ZC];
  const r1 = MOTOR.pulleyR - 1.2;
  const r2 = PULLEY.r - 1.2;
  const d = c2[1] - c1[1];
  const beta = Math.asin((r2 - r1) / d);
  const runs = [];
  for (const side of [1, -1]) {
    // ángulo de la normal (en el plano y-z) hacia el lado de la correa
    const a = side > 0 ? -beta : Math.PI + beta;
    const n = [Math.cos(a), Math.sin(a)];
    const p1 = [c1[0] + n[0] * r1, c1[1] + n[1] * r1];
    const p2 = [c2[0] + n[0] * r2, c2[1] + n[1] * r2];
    runs.push({ p1, p2, n, side });
  }
  return runs;
}
const BELT = beltRuns();
function belt() {
  const out = [];
  for (const run of BELT) {
    const q = (x, p, off = 0) => [x, p[0] + run.n[0] * off, p[1] + run.n[1] * off];
    const poly = [q(BELT_X[0], run.p1), q(BELT_X[1], run.p1), q(BELT_X[1], run.p2), q(BELT_X[0], run.p2)];
    out.push(face(poly, { tone: "mid" }));
    out.push(L(path([at(q(117, run.p1)), at(q(117, run.p2))]), { tone: "lo", className: "dp-belt" }));
  }
  return out.join("");
}

// ---------- Ducto de descarte (semillas y cáscara) ----------
const CH = (() => {
  const a = G.unit3([0, CHUTE.to[0] - CHUTE.from[0], CHUTE.to[1] - CHUTE.from[1]]);
  const v = G.unit3(G.cross3(a, [1, 0, 0]));
  const len = Math.hypot(CHUTE.to[0] - CHUTE.from[0], CHUTE.to[1] - CHUTE.from[1]);
  const o = [(CHUTE.x[0] + CHUTE.x[1]) / 2, CHUTE.from[0], CHUTE.from[1]];
  return { F: G.frameOf(o, a, [1, 0, 0], v.map((c) => (v[2] < 0 ? -c : c))), len, o };
})();
function chute() {
  const out = [];
  const hw = (CHUTE.x[1] - CHUTE.x[0]) / 2;
  out.push(S(box(CHUTE.x[0] - 1, CHUTE.x[1] + 1, -9, 9, CHUTE.from[1] - 2, ZC - R + 1, 0.6, 0.3), { tone: "mid" }));
  const poly = [[-hw, -CHUTE.h / 2], [hw, -CHUTE.h / 2], [hw, CHUTE.h / 2], [-hw, CHUTE.h / 2]];
  out.push(S(G.prismOf(CH.F, poly, 0, CH.len, P), { tone: "mid" }));
  const mouth = poly.map(([u, w]) => at(G.add3(G.add3(G.add3(CH.o, G.mul3(CH.F.a, CH.len)), G.mul3(CH.F.u, u)), G.mul3(CH.F.v, w))));
  out.push(`<path class="dp-mouth" d="${path(poly.map(([u, w]) => at(G.add3(G.add3(G.add3(CH.o, G.mul3(CH.F.a, CH.len)), G.mul3(CH.F.u, u * 0.82)), G.mul3(CH.F.v, w * 0.7)))), true)}"/>`);
  out.push(L(path(poly.map(([u, w]) => at(G.add3(G.add3(G.add3(CH.o, G.mul3(CH.F.a, CH.len)), G.mul3(CH.F.u, u * 0.82)), G.mul3(CH.F.v, w * 0.7)))), true), { tone: "lo" }));
  void mouth;
  // costura a lo largo del ducto
  return out.join("");
}

// ---------- Variador de frecuencia ----------
function vfd() {
  const out = [];
  const { x, y, w, d, z, h } = VFD;
  // ganchos al larguero
  for (const hx of [x + 5, x + w - 5]) out.push(S(box(hx - 1.5, hx + 1.5, y - 1, y + 2, z + h, RAIL_Z[0] + 4, 0.4, 0), { tone: "mid" }));
  const plan = { x, y, w, d, r: 1.2 };
  out.push(S(k.slabOf(plan, z, h, P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(plan, z + h - 4, P, 3), { tone: "faint" }) }));
  const fy = y + d;
  const side = (px, pz) => at([px, fy, pz]);
  // ventana del display
  const win = [[x + 4, z + h - 7], [x + w - 4, z + h - 7], [x + w - 4, z + h - 15], [x + 4, z + h - 15]];
  out.push(`<path class="dp-screen" d="${path(win.map(([a, b]) => side(a, b)), true)}"/>`);
  out.push(L(path(win.map(([a, b]) => side(a, b)), true), { tone: "lo" }));
  out.push(`<text class="iso-face-text dp-hz" data-tone="hi" transform="${k.sideMatrix([x + w - 5.5, fy, z + h - 13.2], z + h - 13.2, P, "left")}" font-size="5.4" text-anchor="end">50.0</text>`);
  out.push(k.faceTextSvg(k.sideMatrix([x + 5, fy, z + h - 2.6], z + h - 2.6, P, "left"), "Hz", { size: 2.4, tone: "lo" }));
  // perilla
  const F = YF(x + 9, z + 8);
  out.push(S(G.disc(fy, fy + 1.2, 5.2, F, P), { tone: "mid" }));
  const knurl = G.ribsOf(F, fy + 1.2, fy + 4.6, 4.2, 24, P, { fade: [0.05, 0.4] });
  out.push(S(G.disc(fy + 1.2, fy + 4.6, 4.2, F, P), { tone: "mid", inner: k.fadedSvg(knurl, { tone: "lo" }) }));
  out.push(`<path class="iso-line" data-tone="lit" data-part="knob" d="" style="stroke-width:1"/>`);
  // botones marcha / paro
  const F2 = YF(x + 19, z + 11);
  const F3 = YF(x + 19, z + 4.6);
  out.push(S(G.disc(fy, fy + 1.2, 1.8, F2, P), { tone: "hi" }));
  out.push(S(G.disc(fy, fy + 1.2, 1.8, F3, P), { tone: "mid" }));
  out.push(k.faceTextSvg(k.sideMatrix([x + 23, fy, z + 9], z + 9, P, "left"), "I", { size: 2.6, tone: "lo" }));
  out.push(k.faceTextSvg(k.sideMatrix([x + 23, fy, z + 3.4], z + 3.4, P, "left"), "O", { size: 2.6, tone: "lo" }));
  out.push(D([side(x + 2, z + 2), side(x + w - 2, z + 2), side(x + 2, z + h - 2), side(x + w - 2, z + h - 2)], { size: 0.45 }));
  return out.join("");
}
const KNOB = { c: [VFD.x + 9, VFD.y + VFD.d + 4.6, VFD.z + 8], r: 3.4 };

// ---------- Recipientes ----------
function bucket() {
  const { x, y, r, h } = BUCKET;
  const out = [`<path class="iso-halo" d="${k.haloOf({ x: x - r, y: y - r, w: 2 * r, d: 2 * r, r }, 0, 0.1, P)}" style="filter:blur(5px)"/>`];
  out.push(S(k.cylinder(x, y, r, 0, h, P, 64, 0.8), { tone: "mid", inner: L(k.sideArc(x, y, r, 4, P, 48) + k.sideArc(x, y, r, h - 6, P, 48), { tone: "faint" }) }));
  out.push(`<path class="dp-pulp-surface" d="${path(Array.from({ length: 48 }, (_, i) => at([x + (r - 1.6) * Math.cos((i / 48) * 2 * Math.PI), y + (r - 1.6) * Math.sin((i / 48) * 2 * Math.PI), h])), true)}"/>`);
  out.push(L(k.ring(x, y, r - 1.6, h, P, 48), { tone: "lo" }));
  // asa
  const lug = (s) => [x + s * r * Math.cos((AZ * Math.PI) / 180 + Math.PI / 2), y + s * r * Math.sin((AZ * Math.PI) / 180 + Math.PI / 2), h - 6];
  const a = lug(1);
  const b = lug(-1);
  const pts = Array.from({ length: 25 }, (_, i) => {
    const t = i / 24;
    const p = G.lerp3(a, b, t);
    const back = Math.sin(Math.PI * t) * 15;
    const tv = k.towardViewer(P);
    return at([p[0] - tv[0] * back, p[1] - tv[1] * back, p[2] + Math.sin(Math.PI * t) * 7]);
  });
  out.push(L(path(pts), { tone: "mid" }));
  out.push(D([at(a), at(b)], { size: 0.8, tone: "hi" }));
  return out.join("");
}
function bin() {
  const { x, y, w, d, h } = BIN;
  const plan = { x, y, w, d, r: 2 };
  const out = [`<path class="iso-halo" d="${k.haloOf(plan, 0, 0.1, P)}" style="filter:blur(5px)"/>`];
  out.push(S(k.slabOf(plan, 0, h, P, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(plan, h - 4, P, 4), { tone: "faint" }) }));
  out.push(`<path class="dp-mouth" d="${path(k.ringOf(k.insetPlan(plan, 1.6), 4).map(([a, b]) => at([a, b, h])), true)}"/>`);
  out.push(L(k.planOutline(k.insetPlan(plan, 1.6), h, P, 4), { tone: "lo" }));
  // semillas acumuladas
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pile = [];
  for (let i = 0; i < 70; i++) {
    const px = x + 4 + rnd() * (w - 8);
    const py = y + 4 + rnd() * (d - 8);
    pile.push(at([px, py, h - 0.2]));
  }
  out.push(D(pile, { size: 0.7, tone: "mid" }));
  out.push(k.faceTextSvg(k.sideMatrix([x + w / 2, y + d, h - 13], h - 13, P, "left"), "DESCARTE", { size: 3, tone: "lo", anchor: "middle" }));
  return out.join("");
}

// ---------- Corriente de pulpa y caída de semillas (trayectos fijos) ----------
const STREAM = (() => {
  const tip = [SPOUT.x, SPOUT.y[1] + 1, SPOUT.z - 1];
  const pts = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    pts.push(at([tip[0], tip[1] + 6 * Math.sqrt(t), tip[2] - (tip[2] - BUCKET.h) * t]));
  }
  return path(pts);
})();
const DROP = (() => {
  const mouth = G.add3(CH.o, G.mul3(CH.F.a, CH.len));
  const pts = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    pts.push(at([mouth[0], mouth[1] + 4 * Math.sqrt(t) + 2, mouth[2] - (mouth[2] - BIN.h) * t]));
  }
  return path(pts);
})();

// ---------- Ensamble ----------
const byDepth = (list) => [...list].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const backLegs = byDepth(legAt.filter(([, y]) => y < 0));
const nearLeftLeg = [-LEG.x, LEG.y];
const nearRightLeg = [LEG.x, LEG.y];

const body = [
  `<path class="iso-halo" d="${k.haloOf({ x: -106, y: -46, w: 212, d: 92, r: 10 }, 0, 0.1, P)}"/>`,
  backLegs.map(leg).join(""),
  braceX(-LEG.y),
  braceY(-LEG.x),
  railX(-LEG.y),
  railBolts(-LEG.y),
  railY(-LEG.x),
  shelf(),
  leg(nearLeftLeg),
  motor(),
  braceY(LEG.x),
  railY(LEG.x),
  panBack(),
  endPlateBack(),
  flange(-1),
  hinges(),
  coverBack(),
  sieveBack(),
  `<g data-part="chunks"></g>`,
  `<g data-part="rotor-back">${ROTOR_FRAMES[0][0]}</g>`,
  SHAFT,
  `<g data-part="rotor-front">${ROTOR_FRAMES[0][1]}</g>`,
  sieveFront(),
  flange(1),
  latches(),
  coverFront(),
  throat(),
  hopperBack(),
  fruit(),
  hopperFront(),
  railX(LEG.y),
  railBolts(LEG.y),
  panFront(),
  chute(),
  endPlateFront(),
  belt(),
  motorPulley(),
  pulleyBody(),
  `<g data-part="pulley">${PULLEY_FRAMES[0]}</g>`,
  pulleyHub(),
  braceX(LEG.y),
  leg(nearRightLeg),
  vfd(),
  `<path class="iso-line dp-stream" data-tone="lit" data-part="stream" d="${STREAM}"/>`,
  bucket(),
  `<path class="iso-line dp-seeds" data-tone="mid" data-part="drop" d="${DROP}"/>`,
  bin(),
];

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "Despulpadora de fruta de acero inoxidable, con la tapa superior retirada. La fruta entra por la tolva; un rotor de cuatro paletas, movido por un motor y una correa, la aprieta contra un tamiz perforado. La pulpa atraviesa los agujeros, cae a la bandeja y sale por un pico a un balde; semillas y cáscara avanzan hasta el extremo y caen por un ducto a un cajón de descarte. Un variador de frecuencia fija la velocidad.",
  body,
});

const CSS = `
.dp-pulp>.iso-top,.dp-pulp>.iso-shade{fill:var(--anatomy-lit-shade)}
.dp-pulp-surface{fill:var(--anatomy-lit-shade);stroke:none}
.dp-mouth{fill:var(--anatomy-shade-0);stroke:none}
.dp-window{fill:var(--anatomy-shade-0);stroke:none}
.dp-screen{fill:var(--anatomy-shade-0);stroke:none}
.dp-stream{stroke-width:1.8;stroke-dasharray:5 3}
.dp-seeds{stroke-width:1.4;stroke-dasharray:.01 4.5}
.dp-belt{stroke-dasharray:3 4}
.dp-chunk{fill:var(--anatomy-lit-shade);stroke:var(--anatomy-mid);stroke-width:.6px}
.dp-chunk[data-seed]{fill:var(--anatomy-mid);stroke:none}
`;

const live = `
const P = ${JSON.stringify(P)};
const MODEL = ${JSON.stringify(MODEL)};
const ROTOR = ${JSON.stringify(ROTOR_FRAMES)};
const PULLEYS = ${JSON.stringify(PULLEY_FRAMES)};
const ZC = ${ZC}, R = ${R}, SIEVE = ${JSON.stringify(SIEVE)}, COVER = ${JSON.stringify(COVER)};
const KNOB = ${JSON.stringify(KNOB)};
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const rotorBack = svg.querySelector('[data-part="rotor-back"]');
const rotorFront = svg.querySelector('[data-part="rotor-front"]');
const pulley = svg.querySelector('[data-part="pulley"]');
const chunksLayer = svg.querySelector('[data-part="chunks"]');
const stream = svg.querySelector('[data-part="stream"]');
const drop = svg.querySelector('[data-part="drop"]');
const belts = svg.querySelectorAll(".dp-belt");
const knob = svg.querySelector('[data-part="knob"]');
const hz = svg.querySelector(".dp-hz");
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const at = (p) => iso(p, P);
const rpmOf = (f) => MODEL.motorRpm50 * f / 50 / MODEL.ratio;
const tipOf = (f) => rpmOf(f) * 2 * Math.PI / 60 * MODEL.tipM;
const gOf = (f) => Math.pow(rpmOf(f) * 2 * Math.PI / 60, 2) * MODEL.tipM / 9.81;
const fmt = (v, d = 0) => v.toLocaleString("es-CL", { minimumFractionDigits: d, maximumFractionDigits: d });
const FRAMES = ROTOR.length;
let f = 50, target = 50, angle = 0, travel = 0, frame = -1, raf = 0, last = 0, clock = 0, touring = true, visible = false, idle = 0;
// Trozos de fruta que avanzan por el tamiz: se achican al perder pulpa y al final queda la semilla.
const N = 16;
const chunks = Array.from({ length: N }, (_, i) => ({ u: i / N, side: (i * 0.618) % 1 }));
const nodes = chunks.map(() => { const c = document.createElementNS("http://www.w3.org/2000/svg", "circle"); chunksLayer.appendChild(c); return c; });
function knobLine(turn) {
  const a = -Math.PI * 0.75 + turn * Math.PI * 1.5;
  const c = KNOB.c;
  const p0 = at([c[0] + Math.cos(a) * 1.2, c[1], c[2] + Math.sin(a) * 1.2]);
  const p1 = at([c[0] + Math.cos(a) * KNOB.r, c[1], c[2] + Math.sin(a) * KNOB.r]);
  return "M" + p0[0].toFixed(1) + " " + p0[1].toFixed(1) + "L" + p1[0].toFixed(1) + " " + p1[1].toFixed(1);
}
function draw() {
  const k = ((Math.round((angle / (Math.PI / 2)) * FRAMES) % FRAMES) + FRAMES) % FRAMES;
  if (k !== frame) { frame = k; rotorBack.innerHTML = ROTOR[k][0]; rotorFront.innerHTML = ROTOR[k][1]; pulley.innerHTML = PULLEYS[k]; }
  const on = clamp(f / 12, 0, 1);
  stream.style.opacity = on.toFixed(2);
  stream.style.strokeDashoffset = (-travel * 1.4).toFixed(1);
  drop.style.opacity = on.toFixed(2);
  drop.style.strokeDashoffset = (-travel * 1.1).toFixed(1);
  belts.forEach((b, i) => b.style.strokeDashoffset = ((i ? 1 : -1) * travel * 0.9).toFixed(1));
  chunks.forEach((c, i) => {
    const x = COVER[1] + 2 + c.u * (SIEVE[1] - COVER[1] - 12);
    const r0 = 4.4 * (1 - c.u) + 1.3 * c.u;
    const swing = Math.PI * 1.5 + (c.side - 0.5) * 0.9 + Math.sin(angle * 4 + i) * 0.12 * on;
    const rr = R - r0 - 0.6;
    const p = at([x, rr * Math.cos(swing), ZC + rr * Math.sin(swing)]);
    const s = at([x, rr * Math.cos(swing) + r0, ZC + rr * Math.sin(swing)]);
    const rad = Math.hypot(s[0] - p[0], s[1] - p[1]);
    const n = nodes[i];
    n.setAttribute("cx", p[0].toFixed(1)); n.setAttribute("cy", p[1].toFixed(1)); n.setAttribute("r", rad.toFixed(2));
    n.setAttribute("class", "dp-chunk");
    if (c.u > 0.82) n.setAttribute("data-seed", ""); else n.removeAttribute("data-seed");
    n.style.opacity = (Math.min(1, c.u * 8, (1 - c.u) * 10)).toFixed(2);
  });
  knob.setAttribute("d", knobLine(f / 60));
  const shown = f.toFixed(1);
  if (hz.textContent !== shown) hz.textContent = shown;
  const text = f < 0.5 ? "detenida · 0 rpm" : fmt(f) + " Hz · rotor " + fmt(rpmOf(f)) + " rpm · punta " + fmt(tipOf(f), 1) + " m/s · " + fmt(gOf(f)) + " g";
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuenow", String(Math.round(f)));
  stage.setAttribute("aria-valuetext", text);
}
const tourAt = (t) => [50, 50, 30, 30, 0, 0, 40, 40][Math.floor(t / 2.6) % 8];
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const calm = still.matches;
  if (touring) { clock += dt; target = tourAt(clock); }
  f = calm ? target : f + (target - f) * (1 - Math.exp(-dt / 0.6));
  if (Math.abs(target - f) < 0.02) f = target;
  if (!calm) {
    const revs = rpmOf(f) / 60 / MODEL.slow;
    angle += revs * 2 * Math.PI * dt;
    travel += f * dt * 0.9;
    const flow = (f / 50) * dt * 0.09;
    chunks.forEach((c) => { c.u += flow; if (c.u >= 1) { c.u -= 1; c.side = Math.random(); } });
  }
  draw();
  const settled = calm || (!touring && f === target && f === 0);
  raf = visible && !settled ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!raf && visible) { last = 0; raf = requestAnimationFrame(tick); } };
const steer = (next) => { touring = false; target = clamp(Math.round(next), 0, 60); clearTimeout(idle); idle = setTimeout(() => { touring = !still.matches; clock = 0; run(); }, 4000); run(); if (still.matches) { f = target; draw(); } };
new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
if (still.matches) { touring = false; f = 40; }
stage.addEventListener("pointermove", (event) => {
  const b = svg.getBoundingClientRect();
  steer(clamp(((event.clientX - b.left) / b.width - 0.15) / 0.7, 0, 1) * 60);
});
stage.addEventListener("keydown", (event) => {
  let to = null;
  if (event.key === "ArrowRight" || event.key === "ArrowUp") to = target + 5;
  if (event.key === "ArrowLeft" || event.key === "ArrowDown") to = target - 5;
  if (event.key === "Home") to = 0;
  if (event.key === "End") to = 60;
  if (to === null) return;
  event.preventDefault();
  steer(to);
});
draw();
`;

const plate = k.plateHtml({
  fig: "Fig 1",
  title: "Despulpadora",
  hint: "Mueve el puntero para girar el variador",
  readout: "50 Hz · rotor " + Math.round(MODEL.motorRpm50 / MODEL.ratio).toLocaleString("es-CL") + " rpm",
  keys: [
    { mark: "lit", label: "Paletas del rotor y chorro de pulpa: lo que hace el trabajo" },
    { mark: "raised", label: "Tamiz perforado de 1 mm: deja pasar la pulpa, retiene semillas y cáscara" },
    { mark: "dotted", label: "Descarte: semillas y cáscara que salen por el extremo" },
  ],
  caption: `Tapa superior retirada para ver el rotor. Un motor de 2 polos (${MODEL.motorRpm50.toLocaleString("es-CL")} rpm a 50 Hz) mueve el rotor con una correa en V; las poleas de ${MODEL.motorPulleyMm} y ${MODEL.rotorPulleyMm} mm reducen la velocidad ${MODEL.ratio.toLocaleString("es-CL", { maximumFractionDigits: 2 })} veces. Las paletas, a ${MODEL.tipM * 1000} mm del eje, aprietan la fruta contra el tamiz: la pulpa pasa por los agujeros y cae a la bandeja; lo que no pasa avanza hacia el extremo y sale por el ducto de descarte. El variador cambia la frecuencia del motor y con ella la velocidad del rotor. Las paletas se dibujan ${MODEL.slow} veces más lentas que en la realidad.`,
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Despulpadora: flechas para cambiar la frecuencia del variador" aria-valuemin="0" aria-valuemax="60" aria-valuenow="50">${svg}</div>`,
});

const name = theme === "light" ? "despulpadora-light.html" : "despulpadora.html";
const html = k.pageHtml({ title: "Despulpadora", theme, body: `<style>${CSS}</style>` + plate, script: kitScript() + live, width: 700 });
writeFileSync(join(HERE, name), html);
console.log("wrote", name, (html.length / 1024).toFixed(0) + " KB");
