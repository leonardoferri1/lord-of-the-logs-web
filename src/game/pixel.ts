/** Minimal pixel-art raster: everything in the game is painted here, then scaled with nearest
 * filtering. Colors are 0xRRGGBB; `null` from a shader leaves the pixel untouched. */
export type Shader = number | ((x: number, y: number) => number | null);
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** Ordered-dither threshold in [0, 1) for a pixel. */
export const bayer = (x: number, y: number) => BAYER[(y & 3) * 4 + (x & 3)] / 16;
export function shade(color: number, factor: number): number {
  const r = Math.min(255, Math.round(((color >> 16) & 255) * factor));
  const g = Math.min(255, Math.round(((color >> 8) & 255) * factor));
  const b = Math.min(255, Math.round((color & 255) * factor));
  return (r << 16) | (g << 8) | b;
}
export function mix(a: number, b: number, t: number): number {
  const c = (shift: number) =>
    Math.round(((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t) << shift;
  return c(16) | c(8) | c(0);
}
/** Picks a palette entry from a 0..1 light value with ordered dithering between steps. */
export function ramp(palette: number[], light: number, x: number, y: number): number {
  const v = Math.max(0, Math.min(0.999, light)) * (palette.length - 1);
  const i = Math.floor(v);
  return palette[Math.min(palette.length - 1, i + (v - i > bayer(x, y) ? 1 : 0))];
}
export function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}
export function rand(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

export class Pix {
  readonly data: Uint32Array;
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.data = new Uint32Array(w * h);
  }
  set(x: number, y: number, color: number, alpha = 255) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const r = (color >> 16) & 255,
      g = (color >> 8) & 255,
      b = color & 255;
    this.data[y * this.w + x] = ((alpha << 24) | (b << 16) | (g << 8) | r) >>> 0;
  }
  get(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    const v = this.data[y * this.w + x];
    return ((v & 255) << 16) | (v & 0xff00) | ((v >> 16) & 255);
  }
  alpha(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.data[y * this.w + x] >>> 24;
  }
  private paint(x: number, y: number, shader: Shader) {
    const c = typeof shader === 'number' ? shader : shader(x, y);
    if (c !== null) this.set(x, y, c);
  }
  rect(x: number, y: number, w: number, h: number, shader: Shader) {
    for (let j = Math.max(0, y); j < Math.min(this.h, y + h); j++)
      for (let i = Math.max(0, x); i < Math.min(this.w, x + w); i++) this.paint(i, j, shader);
  }
  /** Even-odd scanline fill sampled at pixel centers. */
  poly(points: number[], shader: Shader) {
    const n = points.length / 2;
    let minY = Infinity,
      maxY = -Infinity;
    for (let i = 0; i < n; i++) {
      minY = Math.min(minY, points[i * 2 + 1]);
      maxY = Math.max(maxY, points[i * 2 + 1]);
    }
    for (let y = Math.max(0, Math.floor(minY)); y <= Math.min(this.h - 1, Math.ceil(maxY)); y++) {
      const cy = y + 0.5,
        xs: number[] = [];
      for (let i = 0; i < n; i++) {
        const x1 = points[i * 2],
          y1 = points[i * 2 + 1],
          x2 = points[((i + 1) % n) * 2],
          y2 = points[((i + 1) % n) * 2 + 1];
        if (y1 <= cy !== y2 <= cy) xs.push(x1 + ((cy - y1) / (y2 - y1)) * (x2 - x1));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2)
        for (
          let x = Math.max(0, Math.round(xs[k]));
          x < Math.min(this.w, Math.round(xs[k + 1]));
          x++
        )
          this.paint(x, y, shader);
    }
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, shader: Shader) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++)
        if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) this.paint(x, y, shader);
  }
  line(x0: number, y0: number, x1: number, y1: number, shader: Shader) {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0),
      dy = -Math.abs(y1 - y0),
      sx = x0 < x1 ? 1 : -1,
      sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.paint(x0, y0, shader);
      if (x0 === x1 && y0 === y1) return;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }
  /** Shaded sphere lit from the upper left: the workhorse for foliage, rocks and bushes. */
  ball(cx: number, cy: number, r: number, palette: number[], bias = 0, ry = r) {
    this.ellipse(cx, cy, r, ry, (x, y) => {
      const nx = (x + 0.5 - cx) / r,
        ny = (y + 0.5 - cy) / ry;
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      return ramp(palette, 0.5 - nx * 0.42 - ny * 0.5 + nz * 0.25 + bias, x, y);
    });
  }
  /** Draws a palette-indexed sprite; '.' and ' ' are transparent. */
  sprite(rows: string[], palette: Record<string, number>, ox = 0, oy = 0, flip = false) {
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const c = palette[row[x]];
        if (c !== undefined) this.set(ox + (flip ? row.length - 1 - x : x), oy + y, c);
      }
    });
  }
  /** Adds a 1px outline around opaque pixels; `inner` darkens edge pixels instead of growing. */
  outline(color: number) {
    const marks: number[] = [];
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++)
        if (
          !this.alpha(x, y) &&
          (this.alpha(x + 1, y) ||
            this.alpha(x - 1, y) ||
            this.alpha(x, y + 1) ||
            this.alpha(x, y - 1))
        )
          marks.push(x, y);
    for (let i = 0; i < marks.length; i += 2) this.set(marks[i], marks[i + 1], color);
    return this;
  }
  canvas(scale = 1): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = this.w * scale;
    canvas.height = this.h * scale;
    const ctx = canvas.getContext('2d')!;
    const image = new ImageData(new Uint8ClampedArray(this.data.buffer.slice(0)), this.w, this.h);
    if (scale === 1) ctx.putImageData(image, 0, 0);
    else {
      const source = document.createElement('canvas');
      source.width = this.w;
      source.height = this.h;
      source.getContext('2d')!.putImageData(image, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    }
    return canvas;
  }
}
