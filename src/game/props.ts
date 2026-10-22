import { Pix, bayer, mix, ramp, rand, shade } from './pixel';
import { OUTLINE } from './sprites';

/** Art pixels are drawn at half resolution and shown at 2× world scale. */
export const ART = 2;
const SHADOW = 0x0c1a14;
function shadow(p: Pix, cx: number, cy: number, rx: number, ry: number, alpha = 95) {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++)
      if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1 && !p.alpha(x, y))
        p.set(x, y, SHADOW, alpha);
}
export type Art = { canvas: HTMLCanvasElement; originY: number };
const done = (p: Pix, baseY: number, outline = true): Art => {
  if (outline) p.outline(OUTLINE);
  return { canvas: p.canvas(), originY: baseY / p.h };
};

const LEAVES = {
  oak: [0x1d3d22, 0x2a5a2c, 0x3a7434, 0x55923e, 0x7cb24e],
  autumn: [0x5a2a14, 0x8a3e1a, 0xb8602a, 0xd88a34, 0xf0b44a],
  pine: [0x15301e, 0x1f4428, 0x2c5a32, 0x3c723a, 0x5a8e44],
  dark: [0x0f1f1c, 0x162c26, 0x203c30, 0x2c4e38, 0x3e6444],
};
export function oak(seed: number, palette: number[] = LEAVES.oak): Art {
  const p = new Pix(40, 48),
    r = rand(seed);
  p.poly([18, 46, 17, 30, 20, 26, 23, 30, 22, 46], (x, y) =>
    ramp([0x3a2414, 0x5a3820, 0x7a5030], x < 20 ? 0.7 : 0.25, x, y),
  );
  p.line(20, 32, 13, 26, 0x4a2e1a);
  p.line(21, 31, 27, 25, 0x4a2e1a);
  const blobs = [
    [20, 16, 12],
    [11, 23, 8],
    [29, 23, 8],
    [14, 13, 8],
    [27, 12, 8],
    [20, 25, 9],
  ];
  for (const [x, y, s] of blobs)
    p.ball(x + (r() - 0.5) * 2, y + (r() - 0.5) * 2, s, palette, (16 - y) / 60 - 0.05);
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(6 + r() * 28),
      y = Math.floor(4 + r() * 26);
    if (p.alpha(x, y) && p.alpha(x + 1, y + 1)) p.set(x, y, palette[4]);
  }
  p.outline(OUTLINE);
  shadow(p, 20, 45, 13, 3.5);
  return { canvas: p.canvas(), originY: 45 / 48 };
}
export function pine(seed: number, palette: number[] = LEAVES.pine): Art {
  const p = new Pix(32, 56),
    r = rand(seed);
  p.rect(14, 44, 4, 10, (x, y) => ramp([0x3a2414, 0x5a3820], x < 16 ? 0.8 : 0.2, x, y));
  const tiers = 4 + Math.floor(r() * 2);
  for (let t = 0; t < tiers; t++) {
    const top = 2 + t * 9,
      bottom = top + 16,
      half = 6 + t * 2.6;
    p.poly([16, top, 16 + half, bottom, 16 - half, bottom], (x, y) => {
      const edge = (x - 16) / half,
        down = (y - top) / (bottom - top);
      return ramp(palette, 0.82 - edge * 0.45 - down * 0.35 + (t === 0 ? 0.1 : 0), x, y);
    });
    for (let x = Math.ceil(16 - half); x < 16 + half; x += 3)
      if (bayer(x, t) > 0.3) p.set(x, bottom - 1, palette[0]);
  }
  p.outline(OUTLINE);
  shadow(p, 16, 53, 10, 3);
  return { canvas: p.canvas(), originY: 53 / 56 };
}
export function stump(): Art {
  const p = new Pix(16, 12);
  p.rect(4, 4, 8, 5, (x, y) => ramp([0x4a2e1a, 0x6a4426, 0x8a5c34], x < 8 ? 0.8 : 0.3, x, y));
  p.ellipse(8, 4, 4, 2, 0xc8a064);
  p.set(8, 4, 0x8a6a40);
  p.outline(OUTLINE);
  shadow(p, 8, 10, 6, 2);
  return { canvas: p.canvas(), originY: 10 / 12 };
}
export function rock(seed: number, ore?: number): Art {
  const p = new Pix(28, 22),
    r = rand(seed);
  const grey = [0x3e4446, 0x5c6466, 0x7c8484, 0x9ea4a0, 0xc4c8c0];
  p.ball(11, 13, 8, grey, 0, 6.5);
  p.ball(17, 12, 7, grey, 0.05, 6);
  p.ball(14, 9, 6, grey, 0.15, 5);
  // Facets: hard crease lines give the chiselled pixel-art look.
  p.line(9, 9, 13, 15, grey[1]);
  p.line(16, 7, 19, 13, grey[1]);
  if (ore)
    for (let i = 0; i < 9; i++) {
      const x = Math.floor(6 + r() * 16),
        y = Math.floor(6 + r() * 11);
      if (p.alpha(x, y) && p.alpha(x + 1, y)) {
        p.set(x, y, ore);
        p.set(x + 1, y, shade(ore, 0.7));
      }
    }
  p.outline(OUTLINE);
  shadow(p, 14, 19, 11, 2.5);
  return { canvas: p.canvas(), originY: 18 / 22 };
}
export function bush(seed: number, berries: boolean): Art {
  const p = new Pix(22, 18),
    r = rand(seed);
  const leaves = [0x1e3e20, 0x2e5a2a, 0x447a34, 0x62983e];
  p.ball(8, 11, 6, leaves);
  p.ball(14, 11, 6, leaves);
  p.ball(11, 7, 6, leaves, 0.1);
  if (berries)
    for (let i = 0; i < 8; i++) {
      const x = Math.floor(4 + r() * 14),
        y = Math.floor(4 + r() * 10);
      if (p.alpha(x, y)) {
        p.set(x, y, 0xd8323a);
        p.set(x, y - 1, 0xff8a8a);
      }
    }
  p.outline(OUTLINE);
  shadow(p, 11, 16, 9, 2);
  return { canvas: p.canvas(), originY: 16 / 18 };
}

/** Isometric box with optional gable roof: the shared base of every building. */
type BoxOptions = {
  size: number;
  wall: number;
  roof?: number;
  roofH?: number;
  wallColors: number[];
  roofColors: number[];
  stone?: boolean;
  inset?: number;
};
/** Center of the footprint diamond's ground plane inside a building canvas. */
function iso(p: Pix, size: number) {
  return { cx: p.w / 2, gy: p.h - size * 8 - 2 };
}
function wallShader(
  colors: number[],
  slope: number,
  ox: number,
  oy: number,
  stone: boolean,
  light: number,
) {
  return (x: number, y: number) => {
    const v = y - oy - (x - ox) * slope;
    if (stone) {
      const row = Math.floor(v / 3),
        col = Math.floor((x + (row % 2) * 3) / 6);
      if (Math.floor(v) % 3 === 0 || (x + (row % 2) * 3) % 6 === 0) return colors[0];
      return ramp(colors, light + ((col * 7 + row * 3) % 5) * 0.04, x, y);
    }
    const plank = Math.floor(v / 3);
    if (Math.floor(v) % 3 === 2) return colors[0];
    return ramp(colors, light + (plank % 2) * 0.12, x, y);
  };
}
function house(p: Pix, o: BoxOptions) {
  const { cx, gy } = iso(p, o.size);
  const inset = o.inset ?? 3;
  const hw = o.size * 16 - inset * 2,
    hh = o.size * 8 - inset;
  const L = [cx - hw, gy],
    B = [cx, gy + hh],
    R = [cx + hw, gy],
    T = [cx, gy - hh];
  const up = (q: number[], h: number) => [q[0], q[1] - h];
  const W = o.wall;
  p.poly(
    [...L, ...B, ...up(B, W), ...up(L, W)],
    wallShader(o.wallColors, 0.5, L[0], L[1] - W, !!o.stone, 0.75),
  );
  p.poly(
    [...B, ...R, ...up(R, W), ...up(B, W)],
    wallShader(o.wallColors, -0.5, B[0], B[1] - W, !!o.stone, 0.35),
  );
  const roofH = o.roofH ?? 0;
  if (!roofH) {
    p.poly([...up(L, W), ...up(B, W), ...up(R, W), ...up(T, W)], o.roofColors[2]);
    return { cx, gy, L, B, R, T, W };
  }
  const mid = (a: number[], b: number[]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const ov = 3;
  const Lr = [L[0] - ov, L[1] - W + 1],
    Br = [B[0], B[1] - W + ov],
    Rr = [R[0] + ov, R[1] - W + 1],
    Tr = [T[0], T[1] - W - ov];
  const ridgeA = up(mid(L, T), W + roofH),
    ridgeB = up(mid(B, R), W + roofH);
  ridgeA[0] -= ov;
  ridgeB[0] += ov;
  // Back slope, gable wall, then the visible front slope with shingle rows.
  p.poly([...Tr, ...Rr, ...ridgeB, ...ridgeA], (x, y) => ramp(o.roofColors, 0.2, x, y));
  p.poly(
    [...up(B, W), ...up(R, W), ...up(mid(B, R), W + roofH - 2)],
    wallShader(o.wallColors, -0.5, B[0], B[1] - W, !!o.stone, 0.3),
  );
  p.poly([...Lr, ...Br, ...ridgeB, ...ridgeA], (x, y) => {
    const along = (x - Lr[0]) * 0.5 - (y - Lr[1]);
    const row = Math.floor(along / 3);
    if (Math.floor(along) % 3 === 0) return o.roofColors[0];
    return ramp(
      o.roofColors,
      0.45 + (along / (roofH + 10)) * 0.4 + ((x + row * 2) % 5 === 0 ? -0.15 : 0),
      x,
      y,
    );
  });
  p.line(ridgeA[0], ridgeA[1], ridgeB[0], ridgeB[1], o.roofColors[o.roofColors.length - 1]);
  return { cx, gy, L, B, R, T, W };
}
/** Window on the left (south-west) wall; `t` runs 0..1 along the wall. */
function windowLeft(p: Pix, g: ReturnType<typeof house>, t: number, h: number, glow: number) {
  const x = g.L[0] + (g.B[0] - g.L[0]) * t,
    y = g.L[1] + (g.B[1] - g.L[1]) * t - h;
  p.poly([x, y, x + 5, y + 2.5, x + 5, y + 8.5, x, y + 6], OUTLINE);
  p.poly([x + 1, y + 1.5, x + 4, y + 3, x + 4, y + 7, x + 1, y + 5.5], (px, py) =>
    ramp([shade(glow, 0.75), glow, 0xfff2c0], 1 - (py - y) / 8, px, py),
  );
  p.line(x + 2.5, y + 2, x + 2.5, y + 7, 0x4a3020);
}
function doorRight(p: Pix, g: ReturnType<typeof house>, t: number) {
  const x = g.B[0] + (g.R[0] - g.B[0]) * t,
    y = g.B[1] + (g.R[1] - g.B[1]) * t;
  p.poly([x, y - 11, x + 6, y - 14, x + 6, y - 3, x, y], OUTLINE);
  p.poly([x + 1, y - 10, x + 5, y - 12, x + 5, y - 3.5, x + 1, y - 1.5], (px, py) =>
    ramp([0x3a2416, 0x5a3820, 0x6a4628], (px - x) / 6, px, py),
  );
  p.set(x + 4, y - 7, 0xe3b24a);
}
function chimney(p: Pix, x: number, y: number, h: number) {
  p.rect(x, y - h, 5, h, (px, py) =>
    ramp([0x4a4a4a, 0x6e6e6a, 0x8e8c84], px < x + 2 ? 0.9 : 0.3, px, py),
  );
  p.rect(x - 1, y - h - 2, 7, 2, 0x5a5a56);
}
const WOOD = [0x3a2416, 0x6a4426, 0x8a5c34, 0xa8743e, 0xc08a4a];
const ROOF_RED = [0x3a1a14, 0x6e2a1c, 0x96402a, 0xb85a34, 0xd47a44];
const ROOF_TEAL = [0x1c2a2c, 0x2a4446, 0x3a5e5c, 0x4e7a72, 0x6a9a8a];
const ROOF_SLATE = [0x22262e, 0x343a46, 0x4a525e, 0x626c78, 0x7c8894];
const STONE = [0x3a3e40, 0x5e6466, 0x7c8282, 0x989c98, 0xb4b6ae];
export const GLOW = 0xffc45a;
export function buildingArt(kind: string, stage = 0): Art {
  if (kind === 'house' || kind === 'inn') {
    const inn = kind === 'inn';
    const p = new Pix(72, inn ? 92 : 78);
    const g = house(p, {
      size: 2,
      wall: inn ? 26 : 18,
      roofH: inn ? 22 : 18,
      wallColors: WOOD,
      roofColors: inn ? ROOF_TEAL : ROOF_RED,
    });
    windowLeft(p, g, 0.28, inn ? 18 : 13, GLOW);
    windowLeft(p, g, 0.68, inn ? 18 : 13, GLOW);
    if (inn) {
      windowLeft(p, g, 0.28, 8, GLOW);
      windowLeft(p, g, 0.68, 8, GLOW);
    }
    doorRight(p, g, 0.35);
    if (!inn) {
      const x = g.B[0] + (g.R[0] - g.B[0]) * 0.72,
        y = g.B[1] + (g.R[1] - g.B[1]) * 0.72;
      p.poly([x, y - 12, x + 4, y - 14, x + 4, y - 9, x, y - 7], GLOW);
    }
    chimney(p, g.cx + 12, g.gy - g.W - 10, inn ? 18 : 14);
    if (inn) {
      p.line(g.L[0] - 4, g.L[1] - 22, g.L[0] + 4, g.L[1] - 18, 0x5a3820);
      p.rect(g.L[0] - 8, g.L[1] - 18, 9, 7, (x, y) => ramp([0x6a4426, 0xa8743e], 0.6, x, y));
      p.rect(g.L[0] - 6, g.L[1] - 16, 5, 1, 0xf0d080);
    }
    p.outline(OUTLINE);
    shadow(p, g.cx + 4, g.gy + 2, 32, 15, 80);
    return { canvas: p.canvas(), originY: g.gy / p.h };
  }
  if (kind === 'storage') {
    const p = new Pix(72, 74);
    const g = house(p, {
      size: 2,
      wall: 16,
      roofH: 14,
      wallColors: STONE,
      roofColors: ROOF_SLATE,
      stone: true,
    });
    doorRight(p, g, 0.4);
    windowLeft(p, g, 0.5, 11, 0xd8a050);
    for (let i = 0; i < 4; i++) p.ball(g.L[0] + 8 + i * 5, g.L[1] + 1 + i * 2.5, 3.5, STONE, 0.1);
    p.outline(OUTLINE);
    shadow(p, g.cx + 4, g.gy + 2, 32, 15, 80);
    return { canvas: p.canvas(), originY: g.gy / p.h };
  }
  if (kind === 'lumber') {
    const p = new Pix(72, 74);
    const { cx, gy } = iso(p, 2);
    // Log pile and saw bench under an open shed.
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 3 - (i > 1 ? 1 : 0); j++) {
        const x = cx - 24 + j * 7 + i * 3,
          y = gy + 2 - i * 4 + j * 3;
        p.poly([x, y, x + 12, y + 6, x + 12, y + 11, x, y + 5], (px, py) =>
          ramp(WOOD, 0.3 + (py - y) * 0.04, px, py),
        );
        p.ellipse(x + 12, y + 8.5, 2.5, 3, 0xd8b070);
        p.set(x + 12, y + 8, 0x9a7040);
      }
    const posts = [
      [cx + 2, gy - 10],
      [cx + 26, gy + 2],
      [cx + 2, gy + 10],
      [cx - 6, gy + 6],
    ];
    for (const [x, y] of posts)
      p.rect(x, y - 22, 3, 22, (px, py) => ramp(WOOD, px === x ? 0.8 : 0.3, px, py));
    p.poly([cx - 10, gy - 22, cx + 6, gy - 34, cx + 32, gy - 21, cx + 14, gy - 9], (x, y) =>
      ramp(ROOF_TEAL, 0.5 + bayer(x, y) * 0.1, x, y),
    );
    p.poly([cx - 10, gy - 22, cx + 14, gy - 9, cx + 14, gy - 6, cx - 10, gy - 19], ROOF_TEAL[1]);
    p.rect(cx + 6, gy - 6, 16, 4, (x, y) => ramp(WOOD, 0.6, x, y));
    p.ellipse(cx + 14, gy - 9, 5, 5, (x, y) =>
      ramp([0x7a8088, 0xb8c0c8, 0xe0e6ea], 1 - Math.hypot(x - cx - 14, y - gy + 9) / 6, x, y),
    );
    p.set(cx + 14, gy - 9, 0x3a3e44);
    p.outline(OUTLINE);
    shadow(p, cx + 4, gy + 3, 32, 14, 70);
    return { canvas: p.canvas(), originY: gy / p.h };
  }
  if (kind === 'tower') {
    const p = new Pix(40, 96);
    const g = house(p, {
      size: 1,
      wall: 44,
      wallColors: STONE,
      roofColors: STONE,
      stone: true,
      inset: 2,
    });
    const top = g.gy - g.W;
    p.poly([g.cx - 16, top, g.cx, top - 8, g.cx + 16, top, g.cx, top + 8], (x, y) =>
      ramp(WOOD, 0.6, x, y),
    );
    for (let i = -14; i <= 14; i += 4) {
      p.rect(g.cx + i, top - 7 + Math.abs(i) * 0.5, 2, 6, WOOD[2]);
    }
    p.poly([g.cx - 14, top - 8, g.cx, top - 26, g.cx + 14, top - 8, g.cx, top - 2], (x, y) =>
      ramp(ROOF_RED, x < g.cx ? 0.6 : 0.3, x, y),
    );
    p.line(g.cx, top - 26, g.cx, top - 36, 0x5a3820);
    p.poly([g.cx, top - 36, g.cx + 9, top - 33, g.cx, top - 30], 0xd84a3a);
    windowLeft(p, g, 0.5, 30, GLOW);
    p.outline(OUTLINE);
    shadow(p, g.cx + 3, g.gy + 1, 15, 8, 80);
    return { canvas: p.canvas(), originY: g.gy / p.h };
  }
  if (kind === 'farm' || kind === 'garden') {
    const w = kind === 'garden' ? 3 : 2,
      h = 2;
    const p = new Pix((w + h) * 16 + 4, (w + h) * 8 + 26);
    const ox = h * 16 + 2,
      oy = 20;
    const at = (i: number, j: number) => [ox + (i - j) * 16, oy + (i + j) * 8];
    const a = at(0, 0),
      b = at(w, 0),
      c = at(w, h),
      d = at(0, h);
    p.poly([...a, ...b, ...c, ...d], (x, y) => {
      const furrow = Math.floor(y - oy - (x - ox) * 0.5) % 4 < 2;
      return ramp([0x3a2414, 0x5a3a20, 0x6e4a2a], furrow ? 0.3 : 0.7, x, y);
    });
    const ripe = kind === 'garden' || stage === 3;
    if (kind === 'garden' || stage > 0) {
      const height = kind === 'garden' ? 9 : [0, 3, 6, 8][stage];
      const crop = ripe ? [0x8a6a1a, 0xc8a030, 0xe8c84a, 0xf8e080] : [0x2a5a20, 0x3e7a2c, 0x5a9a3a];
      for (let i = 0.3; i < w; i += 0.42)
        for (let j = 0.3; j < h; j += 0.5) {
          const [x, y] = at(i, j);
          p.line(x, y, x, y - height, crop[1]);
          p.line(x + 1, y, x + 1, y - height + 1, crop[0]);
          p.ellipse(x + 0.5, y - height, 1.5, 2, crop[ripe ? 3 : 2]);
        }
    }
    // Picket fence on the two visible edges.
    const fence = (s: number[], e: number[]) => {
      const n = Math.round(Math.hypot(e[0] - s[0], e[1] - s[1]) / 5);
      for (let k = 0; k <= n; k++) {
        const x = s[0] + ((e[0] - s[0]) * k) / n,
          y = s[1] + ((e[1] - s[1]) * k) / n;
        p.rect(x, y - 6, 2, 7, (px, py) => ramp(WOOD, px === Math.round(x) ? 0.9 : 0.4, px, py));
      }
      p.line(s[0], s[1] - 4, e[0], e[1] - 4, WOOD[2]);
    };
    fence(d, c);
    fence(c, b);
    fence(a, d);
    return done(p, oy + (w + h) * 4);
  }
  if (kind === 'forge') {
    const p = new Pix(72, 80);
    const g = house(p, {
      size: 2,
      wall: 18,
      roofH: 14,
      wallColors: STONE,
      roofColors: ROOF_SLATE,
      stone: true,
    });
    // Open front with the glowing furnace mouth.
    const x = g.B[0] + 6,
      y = g.B[1] - 2;
    p.poly([x, y - 12, x + 14, y - 19, x + 14, y - 8, x, y - 1], OUTLINE);
    p.poly([x + 1, y - 11, x + 13, y - 17, x + 13, y - 9, x + 1, y - 3], (px, py) =>
      ramp([0x8a2a10, 0xd8601a, 0xf8a030, 0xffe08a], 1 - (py - (y - 17)) / 14, px, py),
    );
    chimney(p, g.cx - 8, g.gy - g.W - 12, 18);
    const ax = g.L[0] + 8,
      ay = g.L[1] + 4;
    p.rect(ax, ay - 6, 10, 3, 0x5a6066);
    p.rect(ax + 3, ay - 3, 4, 4, 0x3e4448);
    p.outline(OUTLINE);
    shadow(p, g.cx + 4, g.gy + 2, 32, 15, 80);
    return { canvas: p.canvas(), originY: g.gy / p.h };
  }
  if (kind === 'market') {
    const p = new Pix(72, 70);
    const { cx, gy } = iso(p, 2);
    p.poly([cx - 26, gy, cx, gy + 12, cx + 26, gy, cx, gy - 12], (x, y) => ramp(WOOD, 0.4, x, y));
    for (const [x, y] of [
      [cx - 24, gy],
      [cx, gy + 11],
      [cx + 24, gy],
    ])
      p.rect(x, y - 24, 2, 24, WOOD[2]);
    p.poly([cx - 30, gy - 24, cx, gy - 38, cx + 30, gy - 24, cx, gy - 10], (x, y) =>
      Math.floor((x - cx) / 6 + (y - gy) / 3 + 40) % 2 ? 0xd84a3a : 0xf2e8d0,
    );
    p.poly([cx - 30, gy - 24, cx, gy - 10, cx, gy - 7, cx - 30, gy - 21], 0xa83228);
    p.poly([cx, gy - 10, cx + 30, gy - 24, cx + 30, gy - 21, cx, gy - 7], 0xc0b4a0);
    const goods = [0xd8423a, 0xf0b84a, 0x6aa84a, 0x9a6236];
    goods.forEach((c, i) => {
      p.rect(cx - 18 + i * 9, gy - 4 + (i % 2) * 2, 7, 5, (x, y) => ramp(WOOD, 0.5, x, y));
      p.ball(cx - 15 + i * 9, gy - 6 + (i % 2) * 2, 3, [shade(c, 0.6), c, shade(c, 1.3)]);
    });
    return done(p, gy);
  }
  if (kind === 'well') {
    const p = new Pix(36, 46);
    const cx = 18,
      gy = 38;
    p.ellipse(cx, gy - 4, 12, 7, (x, y) => ramp(STONE, 0.4 + ((x * 3 + y * 5) % 4) * 0.08, x, y));
    p.ellipse(cx, gy - 7, 10, 5, (x, y) => ramp(STONE, 0.75, x, y));
    p.ellipse(cx, gy - 7, 7, 3.5, 0x14303c);
    p.rect(cx - 11, gy - 26, 2, 19, WOOD[2]);
    p.rect(cx + 9, gy - 26, 2, 19, WOOD[2]);
    p.poly([cx - 15, gy - 24, cx, gy - 34, cx + 15, gy - 24, cx, gy - 18], (x, y) =>
      ramp(ROOF_RED, 0.5, x, y),
    );
    p.line(cx, gy - 22, cx, gy - 12, 0xb0a080);
    p.rect(cx - 2, gy - 13, 4, 3, WOOD[1]);
    return done(p, gy);
  }
  if (kind === 'tent') {
    const p = new Pix(36, 34);
    const cx = 18,
      gy = 28;
    p.poly([cx - 15, gy, cx, gy - 22, cx + 2, gy + 6], (x, y) =>
      ramp([0x4a3020, 0x6a4a2c, 0x8a6a40], 0.7, x, y),
    );
    p.poly([cx + 2, gy + 6, cx, gy - 22, cx + 15, gy], (x, y) =>
      ramp([0x4a3020, 0x6a4a2c, 0x8a6a40], 0.25, x, y),
    );
    p.poly([cx - 3, gy + 3, cx, gy - 8, cx + 2, gy + 5], 0x1a1210);
    p.line(cx, gy - 22, cx - 3, gy - 27, 0x5a3820);
    p.line(cx, gy - 22, cx + 3, gy - 27, 0x5a3820);
    p.set(cx - 8, gy - 9, 0xe8e0d0);
    p.set(cx - 7, gy - 10, 0xe8e0d0);
    return done(p, gy);
  }
  if (kind === 'campfire') {
    const p = new Pix(24, 18);
    p.line(4, 14, 18, 10, WOOD[1]);
    p.line(5, 10, 19, 15, WOOD[2]);
    for (let i = 0; i < 7; i++) p.ball(3 + i * 3, 15 + (i % 2), 2, STONE);
    return done(p, 14);
  }
  return buildingArt('house');
}

export function flame(frame: number): HTMLCanvasElement {
  const p = new Pix(10, 14);
  const sway = [0, 1, -1][frame % 3];
  p.ellipse(5 + sway * 0.5, 9, 4, 5, 0xe8541a);
  p.ellipse(5 + sway, 8, 3, 4, 0xf8a030);
  p.ellipse(5 + sway, 8.5, 1.5, 2.5, 0xfff0a0);
  p.set(5 + sway, 2, 0xf8a030);
  return p.canvas();
}
export function torch(): Art {
  const p = new Pix(10, 30);
  p.rect(4, 8, 2, 20, (x, y) => ramp(WOOD, x === 4 ? 0.8 : 0.3, x, y));
  p.rect(3, 7, 4, 3, 0x4a4a4a);
  p.outline(OUTLINE);
  shadow(p, 5, 28, 4, 1.5);
  return { canvas: p.canvas(), originY: 28 / 30 };
}
export function lamp(): Art {
  const p = new Pix(12, 34);
  p.rect(5, 10, 2, 22, 0x2e3236);
  p.rect(3, 4, 6, 7, OUTLINE);
  p.rect(4, 5, 4, 5, GLOW);
  p.rect(2, 3, 8, 2, 0x2e3236);
  p.outline(OUTLINE);
  shadow(p, 6, 32, 4, 1.5);
  return { canvas: p.canvas(), originY: 32 / 34 };
}
export function barrel(): Art {
  const p = new Pix(14, 16);
  p.rect(2, 3, 10, 11, (x, y) => ramp(WOOD, 0.9 - (x - 2) / 12, x, y));
  p.ellipse(7, 3, 5, 2, WOOD[3]);
  p.rect(2, 5, 10, 1, 0x4a4a4a);
  p.rect(2, 11, 10, 1, 0x4a4a4a);
  return done(p, 14);
}
export function crate(): Art {
  const p = new Pix(16, 16);
  p.poly([1, 6, 8, 9, 8, 15, 1, 12], (x, y) => ramp(WOOD, 0.75, x, y));
  p.poly([8, 9, 15, 6, 15, 12, 8, 15], (x, y) => ramp(WOOD, 0.35, x, y));
  p.poly([1, 6, 8, 3, 15, 6, 8, 9], WOOD[3]);
  p.line(1, 6, 8, 15, WOOD[0]);
  p.line(8, 9, 15, 12, WOOD[0]);
  return done(p, 14);
}
export function fence(axis: 0 | 1): Art {
  const p = new Pix(36, 22);
  const s = axis ? [2, 6] : [2, 14],
    e = axis ? [34, 22] : [34, -2];
  for (let k = 0; k <= 4; k++) {
    const x = s[0] + ((e[0] - s[0]) * k) / 4,
      y = s[1] + ((e[1] - s[1]) * k) / 4 + 2;
    p.rect(x, y - 9, 2, 9, (px, py) => ramp(WOOD, px === Math.round(x) ? 0.9 : 0.4, px, py));
  }
  p.line(s[0], s[1] - 3, e[0], e[1] - 3, WOOD[3]);
  p.line(s[0], s[1] - 1, e[0], e[1] - 1, WOOD[2]);
  return done(p, 13);
}
export function boat(): Art {
  const p = new Pix(40, 22);
  p.poly([2, 8, 30, 4, 38, 9, 32, 16, 8, 18], (x, y) => ramp(WOOD, 0.8 - (y - 4) / 16, x, y));
  p.poly([6, 9, 29, 6, 34, 10, 29, 13, 9, 14], (x, y) => ramp([0x3a2416, 0x5a3820], 0.4, x, y));
  p.line(12, 10, 26, 8, WOOD[3]);
  p.line(14, 6, 6, 1, WOOD[2]);
  return done(p, 14);
}
export function dock(length: number): Art {
  const p = new Pix(24 + length * 16, 20 + length * 8);
  for (let i = 0; i < length * 4; i++) {
    const x = 4 + i * 4,
      y = 6 + i * 2;
    p.poly([x, y, x + 12, y - 6, x + 16, y - 4, x + 4, y + 2], (px, py) =>
      ramp(WOOD, i % 2 ? 0.55 : 0.75, px, py),
    );
    if (i % 4 === 0) p.rect(x + 2, y + 2, 2, 8, WOOD[1]);
  }
  return done(p, 8);
}
export function lily(seed: number): HTMLCanvasElement {
  const p = new Pix(10, 6),
    r = rand(seed);
  p.ellipse(5, 3, 4.5, 2.5, (x, y) =>
    ramp([0x2a5a2a, 0x3e7a34, 0x5a9a44], 0.6 - (y - 1) * 0.12, x, y),
  );
  p.line(5, 3, 8, 2, 0x1e3e20);
  if (r() > 0.5) {
    p.set(3, 2, 0xf0a0c0);
    p.set(4, 2, 0xffd0e0);
  }
  return p.canvas();
}
export function sparkle(): HTMLCanvasElement {
  const p = new Pix(5, 3);
  p.rect(1, 1, 3, 1, 0xbfe8f8);
  p.set(2, 0, 0xffffff);
  return p.canvas();
}
export function glowTexture(size = 64): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,214,140,0.9)');
  g.addColorStop(0.35, 'rgba(255,170,80,0.35)');
  g.addColorStop(1, 'rgba(255,140,60,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}
export function arrow(): HTMLCanvasElement {
  const p = new Pix(12, 3);
  p.line(0, 1, 9, 1, 0x8a5a30);
  p.set(10, 1, 0xd0d8e0);
  p.set(11, 1, 0xd0d8e0);
  p.set(0, 0, 0xe8e0d0);
  p.set(0, 2, 0xe8e0d0);
  return p.canvas();
}
export function marker(color: number): HTMLCanvasElement {
  const p = new Pix(8, 14);
  p.rect(2, 0, 4, 8, color);
  p.rect(2, 10, 4, 3, color);
  p.rect(3, 1, 1, 6, mix(color, 0xffffff, 0.5));
  return p.outline(OUTLINE).canvas();
}
export { LEAVES };
