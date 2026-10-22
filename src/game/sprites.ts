import { Pix, shade } from './pixel';

export const OUTLINE = 0x1b1512;
/** Front view, 14 × 23. Legs (rows 19–22) are swapped per walk frame. */
const HERO_FRONT = [
  '....hhhhhh....',
  '...hhhhhhhh...',
  '..hhhhhhhhhh..',
  '..hhhhhhhhhh..',
  '..hssssssssh..',
  '..hsessssesh..',
  '..hssssssssh..',
  '...ssssssss...',
  '....ssmmss....',
  '.....ssss.....',
  '...cccccccc...',
  '..cccccccccc..',
  '.cccccccccccc.',
  '.cCccccccccCc.',
  '.cCccccccccCc.',
  '.sCccccccccCs.',
  '.s.wwwwgwww.s.',
  '...pppppppp...',
  '...pppPPppp...',
  '...ppp..ppp...',
  '...ppp..ppp...',
  '...bbb..bbb...',
  '..bbbb..bbbb..',
];
const BACK_HEAD = [
  '..hhhhhhhhhh..',
  '..hhhhhhhhhh..',
  '..hhhhhhhhhh..',
  '...hhhhhhhh...',
  '....hhhhhh....',
  '.....ssss.....',
];
const LEGS = [
  ['...ppp..ppp...', '...ppp..ppp...', '...bbb..bbb...', '..bbbb..bbbb..'],
  ['...ppp...pp...', '..ppp....pp...', '..bbb....bb...', '.bbbb....bbb..'],
  ['...pp...ppp...', '...pp....ppp..', '...bb....bbb..', '..bbb....bbbb.'],
];
export type Look = {
  hair: number;
  skin: number;
  shirt: number;
  pants: number;
  beard?: boolean;
  apron?: boolean;
  dress?: boolean;
  longHair?: boolean;
};
const HAIR = [0x5a3a24, 0x2a221e, 0xd9b45a, 0xa4512a, 0xe6e0d0, 0x6b4a2e];
const SKIN = [0xe8b48a, 0xc98e62, 0x8d5a3b, 0xf0c8a0];
const SHIRT = [0x2f7d86, 0xa83a32, 0x3a5fa8, 0x4f8a3a, 0x7a4a9a, 0xc0742a, 0x8a2d4a];
const PANTS = [0x5b4030, 0x2d3a5a, 0x4a4a52, 0x3d4a2e];
export function lookFor(seed: number): Look {
  return {
    hair: HAIR[seed % HAIR.length],
    skin: SKIN[(seed >>> 3) % SKIN.length],
    shirt: SHIRT[(seed >>> 6) % SHIRT.length],
    pants: PANTS[(seed >>> 9) % PANTS.length],
    longHair: (seed >>> 12) % 3 === 0,
  };
}
export const NPC_LOOKS: Record<string, Look> = {
  ferreiro: {
    hair: 0x2a221e,
    skin: 0xc98e62,
    shirt: 0x6a6f78,
    pants: 0x3a2e28,
    beard: true,
    apron: true,
  },
  mercadora: {
    hair: 0x8a3a22,
    skin: 0xe8b48a,
    shirt: 0x3f7a4a,
    pants: 0x3f7a4a,
    dress: true,
    longHair: true,
  },
};
/** view: 0 front, 1 back. frame: 0 idle, 1–2 walking. */
export function hero(look: Look, view: number, frame: number): HTMLCanvasElement {
  const rows = HERO_FRONT.map((r) => r.split(''));
  if (view === 1) BACK_HEAD.forEach((r, i) => (rows[4 + i] = r.split('')));
  if (view === 1) rows[16] = '.s.wwwwwwww.s.'.split('');
  LEGS[frame].forEach((r, i) => (rows[19 + i] = r.split('')));
  if (frame) {
    // Arms swing opposite to the leading leg.
    const up = frame === 1 ? 1 : 12;
    rows[16][up] = '.';
    rows[14][up] = 's';
  }
  if (look.beard && view === 0) {
    rows[7] = '...dssssssd...'.split('');
    rows[8] = '...dddmmddd...'.split('');
    rows[9] = '....dddddd....'.split('');
  }
  if (look.longHair)
    for (let y = 4; y <= 12; y++) {
      rows[y][2] = 'h';
      rows[y][11] = 'h';
      if (y > 6) rows[y][1] = rows[y][12] = 'h';
    }
  if (look.apron)
    for (let y = 11; y <= 18; y++)
      for (let x = 4; x <= 9; x++) if ('cCwgpP'.includes(rows[y][x])) rows[y][x] = 'a';
  if (look.dress) {
    const dress = ['...cccccccc...', '..cccccccccc..', '..cccccccccc..', '.cCcccccccCcc.'];
    dress.forEach((r, i) => (rows[17 + i] = r.split('')));
    rows[21] = (
      frame === 1 ? '..bb.....bb...' : frame === 2 ? '...bb.....bb..' : '...bb....bb...'
    ).split('');
    rows[22] = '..............'.split('');
  }
  const p = new Pix(16, 25);
  p.sprite(
    rows.map((r) => r.join('')),
    {
      h: look.hair,
      d: shade(look.hair, 0.85),
      s: look.skin,
      e: 0x22191a,
      m: shade(look.skin, 0.62),
      c: look.shirt,
      C: shade(look.shirt, 0.72),
      w: 0x4a3020,
      g: 0xe3b24a,
      p: look.pants,
      P: shade(look.pants, 0.75),
      b: 0x3b2a20,
      a: 0x8a5a32,
    },
    1,
    1,
  );
  // Soft form shading: lighten left contours, darken right ones.
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++)
      if (p.alpha(x, y)) {
        if (!p.alpha(x + 1, y)) p.set(x, y, shade(p.get(x, y), 0.8));
        else if (!p.alpha(x - 1, y)) p.set(x, y, shade(p.get(x, y), 1.12));
      }
  return p.outline(OUTLINE).canvas();
}

const GOBLIN = [
  '.....gggg.....',
  '....gggggg....',
  'EE.gggggggg.EE',
  '.EEgyygggyygEE',
  '...gggGGggg...',
  '...gwmmmmwg...',
  '....gggggg....',
  '...tttttttt...',
  '..tttttttttt..',
  '.gttttttttttg.',
  '.gTtttttttTtg.',
  '.g.wwwwwwww.g.',
  '...tttttttt...',
  '...gg....gg...',
  '...gg....gg...',
  '..bbb....bbb..',
];
const GOBLIN_LEGS = [
  ['...gg....gg...', '...gg....gg...', '..bbb....bbb..'],
  ['...gg.....gg..', '..gg......gg..', '.bbb.....bbb..'],
  ['..gg.....gg...', '..gg......gg..', '..bbb.....bbb.'],
];
export function goblin(warrior: boolean, view: number, frame: number): HTMLCanvasElement {
  const rows = GOBLIN.map((r) => r.split(''));
  GOBLIN_LEGS[frame].forEach((r, i) => (rows[13 + i] = r.split('')));
  if (view === 1) {
    rows[3] = '.EEggggggggggE'.split('');
    rows[4] = '...gggggggg...'.split('');
    rows[5] = '...gggggggg...'.split('');
  }
  if (warrior) {
    rows[0] = '....MMMMMM....'.split('');
    rows[1] = '...MMMMMMMM...'.split('');
    rows[2] = 'EEMMMMMMMMMMEE'.split('');
    for (let y = 7; y <= 10; y++)
      for (let x = 4; x <= 9; x++) if ('tT'.includes(rows[y][x])) rows[y][x] = y === 7 ? 'M' : 'A';
  }
  const p = new Pix(16, 18);
  p.sprite(
    rows.map((r) => r.join('')),
    {
      g: warrior ? 0x6f9a3a : 0x7fb048,
      G: warrior ? 0x56782c : 0x5f8a34,
      E: warrior ? 0x5a8030 : 0x6a9a3a,
      y: 0xf2d24a,
      w: 0xf4ecd8,
      m: 0x3a1a14,
      t: warrior ? 0x9a2e2a : 0x7a5a34,
      T: warrior ? 0x6e1e1c : 0x5a4026,
      M: 0x9aa0a8,
      A: 0x6c727c,
      b: 0x3b2a20,
    },
    1,
    1,
  );
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++)
      if (p.alpha(x, y) && !p.alpha(x + 1, y)) p.set(x, y, shade(p.get(x, y), 0.78));
  return p.outline(OUTLINE).canvas();
}

const TIER = [0, 0x9a7a52, 0xa8b0b8, 0xd8e4ec, 0xf2c14a];
/** Held tools are drawn pointing up-right with the grip at the bottom-left. */
export function heldTool(kind: string, tier = 1): HTMLCanvasElement {
  const p = new Pix(14, 14);
  const metal = TIER[tier] || TIER[2];
  const wood = 0x7a4f2a;
  if (kind === 'sword') {
    p.line(3, 10, 11, 2, metal);
    p.line(4, 10, 11, 3, shade(metal, 0.75));
    p.line(2, 8, 5, 11, 0xd9a43a);
    p.line(1, 12, 3, 10, 0x5a3a22);
  } else if (kind === 'axe' || kind === 'pickaxe' || kind === 'hammer' || kind === 'club') {
    p.line(2, 12, 9, 3, kind === 'club' ? 0x6a4626 : wood);
    if (kind === 'axe') p.poly([7, 1, 12, 2, 12, 7, 9, 6], metal);
    if (kind === 'pickaxe') {
      p.line(5, 2, 12, 6, metal);
      p.line(6, 2, 12, 5, shade(metal, 0.8));
    }
    if (kind === 'hammer') p.rect(7, 1, 5, 4, 0x8a8f96);
    if (kind === 'club') p.ball(9, 4, 3, [0x4a2e18, 0x6a4626, 0x8a6036]);
  }
  return p.outline(OUTLINE).canvas();
}

/** HUD icons, 14 × 14 before the outline. */
const ICONS: Record<string, { rows: string[]; palette: Record<string, number> }> = {
  sword: {
    rows: [
      '...........WW.',
      '..........WLW.',
      '.........WLW..',
      '........WLW...',
      '.......WLW....',
      '......WLW.....',
      '..GG.WLW......',
      '...GGLW.......',
      '....GG........',
      '...HGGG.......',
      '..HH..GG......',
      '.HH...........',
      'HH............',
      '..............',
    ],
    palette: { W: 0xe4ecf0, L: 0x9aa8b4, G: 0xe0a83a, H: 0x6a4428 },
  },
  axe: {
    rows: [
      '.......MMM....',
      '......MMMMM...',
      '.....MMMMMML..',
      '.....MMHMMLL..',
      '......HMMLL...',
      '.....HH.LL....',
      '....HH........',
      '...HH.........',
      '..HH..........',
      '.HH...........',
      'HH............',
      'H.............',
      '..............',
      '..............',
    ],
    palette: { M: 0xc4ccd4, L: 0x86929c, H: 0x8a5a30 },
  },
  pickaxe: {
    rows: [
      '...MMMMMM.....',
      '..MM....MMM...',
      '.MM.....HLMM..',
      '.M.....HH..MM.',
      '......HH....M.',
      '.....HH.......',
      '....HH........',
      '...HH.........',
      '..HH..........',
      '.HH...........',
      'HH............',
      '..............',
      '..............',
      '..............',
    ],
    palette: { M: 0xb4bec8, L: 0x86929c, H: 0x8a5a30 },
  },
  hammer: {
    rows: [
      '....MMMMMM....',
      '....MMMMMML...',
      '....MMMMMML...',
      '.......HL.....',
      '.......HL.....',
      '.......HL.....',
      '.......HL.....',
      '.......HL.....',
      '.......HL.....',
      '.......HL.....',
      '.......HL.....',
      '......HHLL....',
      '..............',
      '..............',
    ],
    palette: { M: 0x9aa4ae, L: 0x6a4428, H: 0x9a6a3a },
  },
  sickle: {
    rows: [
      '.....MMMM.....',
      '...MM....M....',
      '..M.......M...',
      '.M........M...',
      '.M.......M....',
      '.M......M.....',
      '..M...HH......',
      '...MMHH.......',
      '....HH........',
      '...HH.........',
      '..HH..........',
      '.HH...........',
      '..............',
      '..............',
    ],
    palette: { M: 0xd0d8e0, H: 0x8a5a30 },
  },
  food: {
    rows: [
      '......G.......',
      '.....GS.......',
      '....RRSRR.....',
      '...RRRRRRR....',
      '..RRWRRRRRR...',
      '..RWRRRRRRD...',
      '..RRRRRRRRD...',
      '..RRRRRRRDD...',
      '...RRRRRDD....',
      '....RRRDD.....',
      '..............',
      '..............',
      '..............',
      '..............',
    ],
    palette: { R: 0xd8423a, D: 0x9a2a26, W: 0xf8c8b8, G: 0x5a9a3a, S: 0x6a4428 },
  },
  bag: {
    rows: [
      '.....BBBB.....',
      '....B....B....',
      '....BBBBBB....',
      '...LLLLLLLL...',
      '..LLLLLLLLLL..',
      '.LLLLGGLLLLLD.',
      '.LLLLGGLLLLLD.',
      '.LLLLLLLLLLLD.',
      '.LLLLLLLLLLLD.',
      '.LLLLLLLLLLDD.',
      '..LLLLLLLLDD..',
      '...DDDDDDDD...',
      '..............',
      '..............',
    ],
    palette: { B: 0x6a4428, L: 0xc08a4a, D: 0x8a5a30, G: 0xe0b84a },
  },
  scroll: {
    rows: [
      '..RRRRRRRRRR..',
      '.RPPPPPPPPPPR.',
      '..PPPPPPPPPP..',
      '..PIIIIIIIPP..',
      '..PPPPPPPPPP..',
      '..PIIIIIPPPP..',
      '..PPPPPPPPPP..',
      '..PIIIIIIIPP..',
      '..PPPPPPPPPP..',
      '..PIIIIPPPPP..',
      '..PPPPPPPPPP..',
      '.RPPPPPPPPPPR.',
      '..RRRRRRRRRR..',
      '..............',
    ],
    palette: { R: 0xa86a3a, P: 0xf0dcae, I: 0x8a6a4a },
  },
  map: {
    rows: [
      '..............',
      '.PPPPGGGPPPPP.',
      '.PGGGGGPPPBBP.',
      '.PGGGPPPPBBBP.',
      '.PPPPPPPBBBPP.',
      '.PPPRRPPBBPPP.',
      '.PPPPRPPPPGGP.',
      '.PGPPPRRPGGGP.',
      '.PGGPPPPRXPGP.',
      '.PGGGPPPPPPPP.',
      '.PPPPPPPPPPPP.',
      '..............',
      '..............',
      '..............',
    ],
    palette: { P: 0xe8d4a4, G: 0x6a9a4a, B: 0x4a8ac0, R: 0xa83a2a, X: 0xd02a2a },
  },
  banner: {
    rows: [
      '.HHHHHHHHHHHH.',
      '..RRRRRRRRRR..',
      '..RRRRRRRRRR..',
      '..RRRGGGGRRR..',
      '..RRGGGGGGRR..',
      '..RRRGGGGRRR..',
      '..RRRRGGRRRR..',
      '..RRRRRRRRRR..',
      '..RRRRRRRRRR..',
      '..RRRR..RRRR..',
      '..RRR....RRR..',
      '..RR......RR..',
      '..............',
      '..............',
    ],
    palette: { H: 0x8a5a30, R: 0xb03a32, G: 0xf0c04a },
  },
  gear: {
    rows: [
      '.....MMMM.....',
      '..M..MMMM..M..',
      '.MMMMMMMMMMMM.',
      '..MMMMMMMMMM..',
      '..MMMM..MMMM..',
      'MMMMM....MMMMM',
      'MMMM......MMMM',
      'MMMM......MMMM',
      'MMMMM....MMMMM',
      '..MMMM..MMMM..',
      '..MMMMMMMMMM..',
      '.MMMMMMMMMMMM.',
      '..M..MMMM..M..',
      '.....MMMM.....',
    ],
    palette: { M: 0xb4bcc4 },
  },
  coin: {
    rows: [
      '....GGGGG.....',
      '..GGYYYYYGG...',
      '.GYYGGGGGYYG..',
      '.GYGYYYYYGYD..',
      'GYGYYYYYYYGYD.',
      'GYGYYYYYYYGYD.',
      'GYGYYYYYYYGYD.',
      'GYGYYYYYYYGYD.',
      '.GYGYYYYYGYD..',
      '.GYYGGGGGYYD..',
      '..DDYYYYYDD...',
      '....DDDDD.....',
      '..............',
      '..............',
    ],
    palette: { G: 0xc8901e, Y: 0xf6cf4a, D: 0x9a6a14 },
  },
  wood: {
    rows: [
      '..............',
      '...BBBBBBBB...',
      '..BBBBBBBBBRR.',
      '.BBBBBBBBBRLLR',
      '.BBBBBBBBBRLRR',
      '.DDDDDDDDDRRR.',
      '..DDBBBBBBBBR.',
      '..BBBBBBBBBRLR',
      '.BBBBBBBBBRLLR',
      '.DDDDDDDDDRRR.',
      '..............',
      '..............',
      '..............',
      '..............',
    ],
    palette: { B: 0x9a6236, D: 0x6a4024, R: 0xc89a5a, L: 0xe8c48a },
  },
  stone: {
    rows: [
      '..............',
      '.....LLLL.....',
      '...LLLLLLMM...',
      '..LLWLLLMMMM..',
      '..LLLLLMMMMMD.',
      '.LLLLLMMMMMMD.',
      '.MMMMMMMMMMDD.',
      '.MMMMMMMMMDDD.',
      '..DDDDDDDDDD..',
      '..............',
      '..............',
      '..............',
      '..............',
      '..............',
    ],
    palette: { L: 0xc0c4c4, M: 0x8c9294, D: 0x5c6264, W: 0xeef0ee },
  },
  iron: {
    rows: [
      '..............',
      '..............',
      '....LLLLLLL...',
      '...LWWLLLLMD..',
      '..LLLLLLLMMD..',
      '.MMMMMMMMMDD..',
      '.MMMMMMMMMD...',
      '..DDDDDDDDD...',
      '..............',
      '..............',
      '..............',
      '..............',
      '..............',
      '..............',
    ],
    palette: { L: 0xb8c4d0, M: 0x7a8a9a, D: 0x4a5664, W: 0xf0f4f8 },
  },
  heart: {
    rows: [
      '..............',
      '..RRR...RRR...',
      '.RWWRR.RRRRR..',
      '.RWRRRRRRRRD..',
      '.RRRRRRRRRRD..',
      '..RRRRRRRRD...',
      '...RRRRRRD....',
      '....RRRRD.....',
      '.....RRD......',
      '......D.......',
      '..............',
      '..............',
      '..............',
      '..............',
    ],
    palette: { R: 0xe0443a, D: 0xa02a26, W: 0xffb0a0 },
  },
  bolt: {
    rows: [
      '.......YYY....',
      '......YYY.....',
      '.....YYY......',
      '....YYYYYYY...',
      '.......YYY....',
      '......YYY.....',
      '.....YY.......',
      '....Y.........',
      '..............',
      '..............',
      '..............',
      '..............',
      '..............',
      '..............',
    ],
    palette: { Y: 0x5ab8f0 },
  },
  anvil: {
    rows: [
      '..............',
      '..............',
      'MMMMMMMMMMMM..',
      '.MMMMMMMMMMMMM',
      '..DDDDDDDDDD..',
      '.....MMMM.....',
      '.....MMMM.....',
      '....MMMMMM....',
      '..DDDDDDDDDD..',
      '..............',
      '..............',
      '..............',
      '..............',
      '..............',
    ],
    palette: { M: 0x8a929c, D: 0x4a5058 },
  },
  house: {
    rows: [
      '......RR......',
      '.....RRRR.....',
      '....RRRRRR....',
      '...RRRRRRRR...',
      '..RRRRRRRRRR..',
      '.RRRRRRRRRRRR.',
      '..WWWWWWWWWW..',
      '..WYYWWWWDDW..',
      '..WYYWWWWDDW..',
      '..WWWWWWWDDW..',
      '..WWWWWWWDDW..',
      '..............',
      '..............',
      '..............',
    ],
    palette: { R: 0xb0502e, W: 0x9a6a3a, Y: 0xffd06a, D: 0x4a3020 },
  },
  quest: {
    rows: [
      '.....YYYY.....',
      '....YYYYYY....',
      '....YYYYYY....',
      '....YYYYYY....',
      '.....YYYY.....',
      '.....YYYY.....',
      '......YY......',
      '......YY......',
      '..............',
      '.....YYYY.....',
      '.....YYYY.....',
      '..............',
      '..............',
      '..............',
    ],
    palette: { Y: 0xf6cf4a },
  },
  chat: {
    rows: [
      '..............',
      '.WWWWWWWWWWWW.',
      '.WWWWWWWWWWWW.',
      '.WWDWWDWWDWWW.',
      '.WWWWWWWWWWWW.',
      '.WWWWWWWWWWWW.',
      '...WW.........',
      '..WW..........',
      '..............',
      '..............',
      '..............',
      '..............',
      '..............',
      '..............',
    ],
    palette: { W: 0xe8eef2, D: 0x6a7480 },
  },
};
export type IconName = keyof typeof ICONS;
export function icon(name: string, scale = 1): HTMLCanvasElement {
  const def = ICONS[name] ?? ICONS.quest;
  const p = new Pix(16, 16);
  p.sprite(def.rows, def.palette, 1, 1);
  return p.outline(OUTLINE).canvas(scale);
}
const iconCache = new Map<string, string>();
/** Data URL for React: crisp when rendered with `image-rendering: pixelated`. */
export function iconUrl(name: string): string {
  if (!iconCache.has(name)) iconCache.set(name, icon(name).toDataURL());
  return iconCache.get(name)!;
}
const portraitCache = new Map<string, string>();
export function portraitUrl(look: Look): string {
  const id = JSON.stringify(look);
  if (!portraitCache.has(id)) {
    const source = hero(look, 0, 0);
    const c = document.createElement('canvas');
    c.width = 16;
    c.height = 14;
    c.getContext('2d')!.drawImage(source, 0, 0, 16, 14, 0, 0, 16, 14);
    portraitCache.set(id, c.toDataURL());
  }
  return portraitCache.get(id)!;
}
