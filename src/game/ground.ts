import { WORLD_SIZE, noise, region, terrain, type Terrain } from '@logs/shared';
import { Pix, bayer, ramp } from './pixel';
import { ART } from './props';

const PALETTE: Record<string, number[]> = {
  grass: [0x35602a, 0x426f30, 0x517e36, 0x62903e, 0x78a44a],
  meadow: [0x4c7230, 0x5c8236, 0x6e943e, 0x84a848, 0x9cbc56],
  forest: [0x24461f, 0x2c5226, 0x365e2c, 0x426c32, 0x507a3a],
  dark: [0x172c1c, 0x1d3622, 0x244028, 0x2c4c2e, 0x365834],
  stone: [0x55594f, 0x676b5f, 0x7a7e70, 0x8e9282, 0xa4a694],
  dirt: [0x5e4228, 0x705032, 0x83603c, 0x977248, 0xaa8456],
  cobble: [0x4a4844, 0x66625a, 0x7c786e, 0x928d82, 0xa8a296],
  water: [0x163e5c, 0x1c4c6e, 0x235c80, 0x2d6e92, 0x3c82a6],
  bridge: [0x3e2818, 0x5a3a22, 0x74502e, 0x8e6438, 0xa87a44],
  cliff: [0x2a1c12, 0x3a2818, 0x4e3620, 0x64462a],
};
/** Smooth value noise built on the shared deterministic hash. */
function smooth(x: number, y: number, seed: number) {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    fx = x - ix,
    fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx),
    sy = fy * fy * (3 - 2 * fy);
  const a = noise(ix, iy, seed),
    b = noise(ix + 1, iy, seed),
    c = noise(ix, iy + 1, seed),
    d = noise(ix + 1, iy + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
const MARGIN = 6;
/** Canvas origin in world pixels; the image is placed here and scaled by ART. */
export const GROUND_ORIGIN = {
  x: -(WORLD_SIZE + MARGIN * 2) * 32,
  y: -16 - MARGIN * 32,
};
export function paintGround(): HTMLCanvasElement {
  const span = WORLD_SIZE + MARGIN * 2;
  const p = new Pix(span * 32, span * 16 + 8);
  const tile = (fx: number, fy: number): Terrain => terrain(Math.round(fx), Math.round(fy));
  // Distance to land in tiles, for water depth shading.
  const depth = new Float32Array(span * span).fill(9);
  for (let y = -MARGIN; y < WORLD_SIZE + MARGIN; y++)
    for (let x = -MARGIN; x < WORLD_SIZE + MARGIN; x++) {
      if (terrain(x, y) !== 'water') continue;
      let best = 9;
      for (let dy = -4; dy <= 4; dy++)
        for (let dx = -4; dx <= 4; dx++)
          if (terrain(x + dx, y + dy) !== 'water') best = Math.min(best, Math.hypot(dx, dy));
      depth[(y + MARGIN) * span + x + MARGIN] = best;
    }
  const depthAt = (x: number, y: number) =>
    depth[(Math.round(y) + MARGIN) * span + Math.round(x) + MARGIN] ?? 9;
  const sample = (cx: number, cy: number) => {
    const wx = GROUND_ORIGIN.x + cx * ART + 1,
      wy = GROUND_ORIGIN.y + cy * ART + 1;
    const fx = (wx / 32 + wy / 16) / 2,
      fy = (wy / 16 - wx / 32) / 2;
    const jx = (smooth(fx * 1.7, fy * 1.7, 11) - 0.5) * 0.55,
      jy = (smooth(fx * 1.7, fy * 1.7, 29) - 0.5) * 0.55;
    const plain = tile(fx, fy);
    const t =
      plain === 'cobble' || plain === 'bridge' || tile(fx + jx, fy + jy) === 'bridge'
        ? plain
        : tile(fx + jx, fy + jy);
    return { t, fx, fy };
  };
  const cache: Terrain[] = new Array(p.w * p.h);
  for (let cy = 0; cy < p.h; cy++)
    for (let cx = 0; cx < p.w; cx++) cache[cy * p.w + cx] = sample(cx, cy).t;
  const at = (cx: number, cy: number) =>
    cx < 0 || cy < 0 || cx >= p.w || cy >= p.h ? 'water' : cache[cy * p.w + cx];
  for (let cy = 0; cy < p.h; cy++)
    for (let cx = 0; cx < p.w; cx++) {
      const { fx, fy } = sample(cx, cy);
      const t = cache[cy * p.w + cx];
      const grain = noise(cx, cy, 5);
      const broad = smooth(fx * 0.9, fy * 0.9, 3);
      if (t === 'water') {
        // Cliff faces below land: the island and riverbanks read as raised ground.
        let cliff = 0;
        for (let k = 1; k <= 6; k++)
          if (at(cx, cy - k) !== 'water' && at(cx, cy - k) !== 'bridge') {
            cliff = k;
            break;
          }
        if (cliff) {
          p.set(
            cx,
            cy,
            cliff === 1
              ? PALETTE.dark[2]
              : ramp(PALETTE.cliff, 1 - cliff / 6 + grain * 0.15, cx, cy),
          );
          continue;
        }
        const d = depthAt(fx, fy);
        const shore =
          at(cx, cy - 7) !== 'water' ||
          at(cx - 2, cy) !== 'water' ||
          at(cx + 2, cy) !== 'water' ||
          at(cx, cy + 2) !== 'water';
        if (shore && grain > 0.45) {
          p.set(cx, cy, 0x8ec4d4);
          continue;
        }
        const wave = Math.sin(fx * 2.1 + fy * 2.1 + smooth(fx * 2, fy * 2, 7) * 6);
        let light = 0.75 - Math.min(d, 5) * 0.12 + (broad - 0.5) * 0.2;
        if (wave > 0.93 && grain > 0.35) light += 0.35;
        p.set(cx, cy, ramp(PALETTE.water, light, cx, cy));
        continue;
      }
      if (t === 'bridge') {
        const plank = Math.floor((fx - fy) * 6);
        const edge = Math.abs(((((fx + fy) % 1) + 1) % 1) - 0.5);
        let c = ramp(PALETTE.bridge, 0.45 + (plank % 2) * 0.2 + grain * 0.15, cx, cy);
        if (Math.floor((fx - fy) * 12) % 2 === 0 && grain > 0.8) c = PALETTE.bridge[0];
        if (edge > 0.47) c = PALETTE.bridge[1];
        p.set(cx, cy, c);
        continue;
      }
      const r = region(Math.round(fx), Math.round(fy));
      let pal = PALETTE[t] ?? PALETTE.grass;
      if (t === 'grass' && (r === 'campos' || r === 'lago')) pal = PALETTE.meadow;
      if (t === 'forest' && r === 'sombria') pal = PALETTE.dark;
      let light = 0.5 + (broad - 0.5) * 0.7 + (grain - 0.5) * 0.35;
      if (t === 'cobble') {
        const u = fx * 3.2 + (Math.floor(fy * 3.2) % 2) * 0.5,
          v = fy * 3.2;
        const cell = noise(Math.floor(u), Math.floor(v), 77);
        const fu = u - Math.floor(u),
          fv = v - Math.floor(v);
        if (fu < 0.12 || fv < 0.16) {
          p.set(cx, cy, pal[0]);
          continue;
        }
        light = 0.35 + cell * 0.45 + (fv < 0.35 ? 0.15 : 0) - (fu > 0.85 ? 0.15 : 0);
      }
      if (t === 'dirt' && grain > 0.965) {
        p.set(cx, cy, PALETTE.stone[3]);
        continue;
      }
      // Darken ground just above a cliff edge and beside paths for a soft border.
      if (at(cx, cy + 1) === 'water') light -= 0.25;
      let c = ramp(pal, light, cx, cy);
      if (t === 'grass' || t === 'forest') {
        const tuft = noise(cx >> 1, cy, 17);
        if (tuft > 0.93 && at(cx, cy - 1) === t) {
          c = pal[4];
          p.set(cx, cy - 1, pal[3]);
        }
        const flower = noise(cx, cy, 99);
        if (t === 'grass' && flower > (r === 'campos' ? 0.992 : 0.997))
          c = [0xf2d24a, 0xf0f0e8, 0xe87aa0, 0x9ab8f0][Math.floor(grain * 4)];
      }
      if (t === 'stone' && bayer(cx, cy) > 0.8 && grain > 0.9) c = pal[4];
      p.set(cx, cy, c);
    }
  return p.canvas();
}
