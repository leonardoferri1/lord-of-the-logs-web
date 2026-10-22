import Phaser from 'phaser';
import {
  BUILD_RANGE,
  LANDMARKS,
  MOBS,
  NPCS,
  NPC_RANGE,
  RECIPES,
  WORLD_SIZE,
  GATHER_ENERGY,
  blockers,
  buildingState,
  distance,
  footprint,
  fromIso,
  initialNodes,
  key,
  nearBuilding,
  noise,
  pathToAdjacent,
  placementError,
  region,
  riverX,
  terrain,
  toIso,
  type Building,
  type Effect,
  type Point,
} from '@logs/shared';
import { useWorld, selfOf, type WorldSnapshot } from '../state';
import { attack, build, gather, move } from '../network';
import { hash } from './pixel';
import { NPC_LOOKS, goblin, hero, heldTool, icon, lookFor, type Look } from './sprites';
import * as props from './props';
import { ART, LEAVES } from './props';
import { GROUND_ORIGIN, paintGround } from './ground';

type Ref = { type: 'node' | 'building' | 'landmark' | 'mob' | 'npc'; id: string };
type Actor = {
  body: Phaser.GameObjects.Image;
  tool: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  bar: Phaser.GameObjects.Graphics;
  marker?: Phaser.GameObjects.Image;
  skin: string;
  moved: number;
  lastTile: string;
};
const LABEL = {
  fontFamily: '"Pixelify Sans", "Trebuchet MS", sans-serif',
  fontSize: '13px',
  color: '#f4ead2',
  stroke: '#14100c',
  strokeThickness: 4,
  resolution: 2,
};
const CYCLE_MS = 12 * 60 * 1000;
/** 0 by day, 1 at deepest night; shared by every client through the wall clock. */
export function darkness(now = Date.now()) {
  const t = (now % CYCLE_MS) / CYCLE_MS;
  if (t < 0.5) return 0;
  if (t < 0.6) return (t - 0.5) / 0.1;
  if (t < 0.88) return 1;
  return 1 - (t - 0.88) / 0.12;
}
const lerpColor = (a: number, b: number, t: number) =>
  Phaser.Display.Color.GetColor(
    ((a >> 16) & 255) + (((b >> 16) & 255) - ((a >> 16) & 255)) * t,
    ((a >> 8) & 255) + (((b >> 8) & 255) - ((a >> 8) & 255)) * t,
    (a & 255) + ((b & 255) - (a & 255)) * t,
  );
const center = (p: Point, w: number, h = w) =>
  toIso({ x: p.x + (w - 1) / 2, y: p.y + (h - 1) / 2 });

export class WorldScene extends Phaser.Scene {
  private origins = new Map<string, number>();
  private highlight!: Phaser.GameObjects.Graphics;
  private ghost!: Phaser.GameObjects.Image;
  private night!: Phaser.GameObjects.Rectangle;
  private glows: { glow: Phaser.GameObjects.Image; base: number; seed: number }[] = [];
  private nodes = new Map<string, Phaser.GameObjects.Image>();
  private structures = new Map<
    string,
    { image: Phaser.GameObjects.Image; texture: string; badge: Phaser.GameObjects.Image }
  >();
  private people = new Map<string, Actor>();
  private enemies = new Map<string, Actor>();
  private villagers = new Map<string, Actor>();
  private seen = new Set<number>();
  private lastSnapshot: WorldSnapshot | null = null;
  private focusRevision = -1;
  private follow = true;
  private intentAt = 0;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private panOrigin?: { x: number; y: number; scrollX: number; scrollY: number };
  constructor() {
    super('valley');
  }
  private art(name: string, art: props.Art | HTMLCanvasElement) {
    if (this.textures.exists(name)) return;
    if (art instanceof HTMLCanvasElement) this.textures.addCanvas(name, art);
    else {
      this.textures.addCanvas(name, art.canvas);
      this.origins.set(name, art.originY);
    }
  }
  private image(x: number, y: number, name: string) {
    return this.add
      .image(x, y, name)
      .setOrigin(0.5, this.origins.get(name) ?? 0.5)
      .setScale(ART);
  }
  private textures_() {
    for (let i = 0; i < 4; i++) {
      this.art(`oak${i}`, props.oak(i + 1));
      this.art(`pine${i}`, props.pine(i + 11));
      this.art(`dark${i}`, props.pine(i + 21, LEAVES.dark));
    }
    this.art('autumn0', props.oak(41, LEAVES.autumn));
    this.art('autumn1', props.oak(42, LEAVES.autumn));
    this.art('stump', props.stump());
    for (let i = 0; i < 3; i++) this.art(`rock${i}`, props.rock(i + 5));
    this.art('iron0', props.rock(61, 0xd88a4a));
    this.art('iron1', props.rock(62, 0x8ab8e8));
    this.art('bush', props.bush(7, true));
    this.art('bush-bare', props.bush(7, false));
    for (const kind of [
      'house',
      'lumber',
      'storage',
      'tower',
      'inn',
      'forge',
      'market',
      'well',
      'garden',
      'tent',
      'campfire',
    ])
      this.art(kind, props.buildingArt(kind));
    for (let s = 0; s < 4; s++) this.art(`farm${s}`, props.buildingArt('farm', s));
    this.art('torch', props.torch());
    this.art('lamp', props.lamp());
    this.art('barrel', props.barrel());
    this.art('crate', props.crate());
    this.art('fence0', props.fence(0));
    this.art('fence1', props.fence(1));
    this.art('boat', props.boat());
    this.art('dock', props.dock(2));
    for (let i = 0; i < 3; i++) {
      this.art(`lily${i}`, props.lily(i));
      this.art(`flame${i}`, props.flame(i));
    }
    this.art('sparkle', props.sparkle());
    this.art('glow', props.glowTexture());
    this.art('arrow', props.arrow());
    this.art('quest-marker', props.marker(0xf6cf4a));
    for (const name of ['wood', 'stone', 'iron', 'food', 'heart', 'coin', 'bolt'])
      this.art(`icon-${name}`, icon(name));
    for (const tool of ['sword', 'axe', 'pickaxe', 'hammer', 'club'])
      for (let tier = 1; tier <= 4; tier++) this.art(`tool-${tool}-${tier}`, heldTool(tool, tier));
    for (let w = 0; w < 2; w++)
      for (let v = 0; v < 2; v++)
        for (let f = 0; f < 3; f++) this.art(`goblin${w}-${v}-${f}`, goblin(!!w, v, f));
  }
  private heroSkin(look: Look) {
    const skin = `hero-${hash(JSON.stringify(look))}`;
    for (let v = 0; v < 2; v++)
      for (let f = 0; f < 3; f++) this.art(`${skin}-${v}-${f}`, hero(look, v, f));
    return skin;
  }
  create() {
    this.textures_();
    const camera = this.cameras.main;
    camera.setBackgroundColor('#163e5c');
    this.art('ground', paintGround());
    this.add
      .image(GROUND_ORIGIN.x, GROUND_ORIGIN.y, 'ground')
      .setOrigin(0)
      .setScale(ART)
      .setDepth(-1e6);
    this.highlight = this.add.graphics().setDepth(-5e5);
    this.ghost = this.add
      .image(0, 0, 'house')
      .setScale(ART)
      .setAlpha(0.6)
      .setVisible(false)
      .setDepth(9e5);
    this.decorate();
    // The deterministic forest is the backdrop until the first authoritative snapshot arrives.
    this.syncWorld({
      nodes: initialNodes(),
      buildings: [],
      time: Date.now(),
    } as unknown as WorldSnapshot);
    for (const landmark of LANDMARKS) {
      const p = center(landmark, landmark.w, landmark.h);
      const image = this.image(p.x, p.y, landmark.kind)
        .setDepth(toIso({ x: landmark.x + landmark.w - 1, y: landmark.y + landmark.h - 1 }).y + 10)
        .setData('ref', { type: 'landmark', id: landmark.id } satisfies Ref)
        .setInteractive({ pixelPerfect: true, alphaTolerance: 100, cursor: 'help' });
      if (landmark.kind === 'campfire') this.fire(p.x, p.y - 6, image.depth + 1, 1.2);
      if (landmark.kind === 'forge') this.glow(p.x + 14, p.y - 4, 1.1);
      if (landmark.kind === 'inn' || landmark.kind === 'forge') this.smoke(p.x + 24, p.y - 82);
      if (landmark.kind === 'inn') {
        this.glow(p.x - 30, p.y - 20, 0.7);
        this.glow(p.x - 10, p.y - 12, 0.7);
      }
    }
    for (const npc of NPCS) {
      const skin = this.heroSkin(NPC_LOOKS[npc.id]);
      const actor = this.actor(skin, npc.name, '#ffe39a');
      const iso = toIso(npc);
      actor.body
        .setPosition(iso.x, iso.y)
        .setData('ref', { type: 'npc', id: npc.id } satisfies Ref);
      actor.body.setInteractive({ cursor: 'pointer' });
      actor.marker = this.add
        .image(iso.x, iso.y - 74, npc.role === 'smith' ? 'quest-marker' : 'icon-coin')
        .setScale(ART);
      this.tweens.add({
        targets: actor.marker,
        y: iso.y - 82,
        yoyo: true,
        repeat: -1,
        duration: 700,
        ease: 'Sine.easeInOut',
      });
      this.villagers.set(npc.id, actor);
    }
    this.night = this.add
      .rectangle(0, 0, 10, 10, 0xffffff)
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setDepth(9.2e5)
      .setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.center({ x: 22, y: 24 });
    camera.setZoom(this.scale.width < 700 ? 1 : 1.35);
    this.cursors = this.input.keyboard?.createCursorKeys();
    this.input.mouse?.disableContextMenu();
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _o: unknown, _x: number, dy: number) =>
      camera.setZoom(Phaser.Math.Clamp(camera.zoom * (dy > 0 ? 0.9 : 1.1), 0.55, 2.6)),
    );
    this.input.on(
      'pointerdown',
      (p: Phaser.Input.Pointer, objects: Phaser.GameObjects.GameObject[]) => this.click(p, objects),
    );
    this.input.on('pointerup', () => {
      this.panOrigin = undefined;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.panOrigin) {
        this.follow = false;
        camera.scrollX = this.panOrigin.scrollX - (p.x - this.panOrigin.x) / camera.zoom;
        camera.scrollY = this.panOrigin.scrollY - (p.y - this.panOrigin.y) / camera.zoom;
      }
      const tile = fromIso(camera.getWorldPoint(p.x, p.y));
      const hover = useWorld.getState().hover;
      if (!hover || hover.x !== tile.x || hover.y !== tile.y)
        useWorld.getState().set({ hover: tile });
    });
  }
  /** Deterministic scenery: torches, docks, a boat, lily pads, fences, barrels and fireflies. */
  private decorate() {
    const place = (name: string, p: Point, dx = 0, dy = 0, depth = 0) => {
      const iso = toIso(p);
      return this.image(iso.x + dx, iso.y + dy, name).setDepth(iso.y + dy + depth);
    };
    for (const p of [
      { x: 18, y: 20 },
      { x: 26, y: 20 },
      { x: 18, y: 28 },
      { x: 26, y: 28 },
      { x: 22, y: 19 },
      { x: 27, y: 24 },
    ]) {
      const t = place(p.x === 22 || p.x === 27 ? 'lamp' : 'torch', p, 18, -2);
      if (t.texture.key === 'torch') this.fire(t.x, t.y - 50, t.depth + 1, 0.8);
      else this.glow(t.x, t.y - 52, 0.8);
    }
    place('barrel', { x: 24, y: 22 }, -26, -4);
    place('barrel', { x: 25, y: 22 }, 10, -8);
    place('crate', { x: 21, y: 26 }, -24, 4);
    place('crate', { x: 18, y: 26 }, 14, 4);
    place('barrel', { x: 21, y: 21 }, -20, 6);
    // Fences frame the communal garden.
    for (let x = 14; x <= 16; x++) place('fence1', { x, y: 25 }, 0, 12, -2);
    // A short dock and boat on the village bank of the river, south of the bridge.
    for (let y = 27; y <= 33; y++) {
      const x = Math.floor(riverX(y) - 1.6);
      if (terrain(x, y) === 'water' && terrain(x - 1, y) !== 'water') {
        place('dock', { x, y }, -4, 10, -30);
        place('boat', { x: x + 1, y: y + 1 }, 0, 4, -20);
        break;
      }
    }
    let lilies = 0;
    for (let y = 0; y < WORLD_SIZE && lilies < 40; y++)
      for (let x = 0; x < WORLD_SIZE; x++)
        if (
          terrain(x, y) === 'water' &&
          noise(x, y, 301) > 0.9 &&
          x > 2 &&
          y > 2 &&
          x < 45 &&
          y < 45
        ) {
          place(
            `lily${lilies % 3}`,
            { x, y },
            (noise(x, y, 3) - 0.5) * 30,
            (noise(x, y, 4) - 0.5) * 12,
            -1e5,
          );
          lilies++;
        }
    for (let i = 0; i < 90; i++) {
      const x = Math.floor(noise(i, 1, 404) * WORLD_SIZE),
        y = Math.floor(noise(i, 2, 404) * WORLD_SIZE);
      if (terrain(x, y) !== 'water') continue;
      const iso = toIso({ x, y });
      const s = this.add
        .image(iso.x + noise(i, 3) * 40 - 20, iso.y, 'sparkle')
        .setScale(ART)
        .setDepth(-9e5)
        .setAlpha(0);
      this.tweens.add({
        targets: s,
        alpha: 0.9,
        x: s.x + 8,
        duration: 900 + i * 13,
        yoyo: true,
        repeat: -1,
        delay: i * 97,
        repeatDelay: 1500 + (i % 7) * 400,
      });
    }
    for (let i = 0; i < 40; i++) {
      const x = 4 + noise(i, 7, 505) * 40,
        y = 4 + noise(i, 8, 505) * 40;
      if (terrain(Math.round(x), Math.round(y)) !== 'forest') continue;
      const iso = toIso({ x, y });
      const fly = this.add
        .circle(iso.x, iso.y - 30, 1.6, 0xeaff9a, 0)
        .setDepth(9.5e5)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.glows.push({ glow: fly as unknown as Phaser.GameObjects.Image, base: -1, seed: i });
      this.tweens.add({
        targets: fly,
        x: iso.x + 40,
        y: iso.y - 70,
        duration: 4000 + i * 90,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }
  private glow(x: number, y: number, size: number) {
    const glow = this.add
      .image(x, y, 'glow')
      .setScale(size * 2.4)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(9.5e5);
    this.glows.push({ glow, base: size, seed: x * 0.13 + y });
  }
  private fire(x: number, y: number, depth: number, size: number) {
    const flame = this.add
      .image(x, y, 'flame0')
      .setScale(ART * size)
      .setOrigin(0.5, 1)
      .setDepth(depth);
    let frame = 0;
    this.time.addEvent({
      delay: 140,
      loop: true,
      callback: () => flame.setTexture(`flame${++frame % 3}`),
    });
    this.glow(x, y - 6, size * 1.2);
  }
  private smoke(x: number, y: number) {
    this.time.addEvent({
      delay: 900,
      loop: true,
      callback: () => {
        const puff = this.add.circle(x, y, 4, 0xc8c8c0, 0.45).setDepth(9e5);
        this.tweens.add({
          targets: puff,
          y: y - 50,
          x: x + 16,
          alpha: 0,
          scale: 2.4,
          duration: 2600,
          onComplete: () => puff.destroy(),
        });
      },
    });
  }
  private actor(skin: string, name: string, color: string): Actor {
    return {
      body: this.add.image(0, 0, `${skin}-0-0`).setOrigin(0.5, 0.94).setScale(ART),
      tool: this.add
        .image(0, 0, 'tool-sword-1')
        .setOrigin(0.15, 0.85)
        .setScale(ART)
        .setVisible(false),
      label: this.add.text(0, 0, name, { ...LABEL, color }).setOrigin(0.5, 1),
      bar: this.add.graphics(),
      skin,
      moved: 0,
      lastTile: '',
    };
  }
  private center(p: Point) {
    const iso = toIso(p);
    this.cameras.main.centerOn(iso.x, iso.y - 30);
  }
  private click(p: Phaser.Input.Pointer, objects: Phaser.GameObjects.GameObject[]) {
    if (p.rightButtonDown() || p.middleButtonDown()) {
      const camera = this.cameras.main;
      this.panOrigin = { x: p.x, y: p.y, scrollX: camera.scrollX, scrollY: camera.scrollY };
      return;
    }
    const state = useWorld.getState(),
      snapshot = state.snapshot,
      self = selfOf(snapshot);
    if (!state.connected || !snapshot || !self) return;
    const tile = fromIso(this.cameras.main.getWorldPoint(p.x, p.y));
    if (state.buildKind) {
      if (tile.x >= 0 && tile.y >= 0 && tile.x < WORLD_SIZE && tile.y < WORLD_SIZE)
        build(tile, state.buildKind);
      return;
    }
    this.follow = true;
    const refs = objects
      .map((o) => o.getData('ref') as Ref | undefined)
      .filter((r): r is Ref => !!r);
    const order: Ref['type'][] = ['mob', 'npc', 'node', 'building', 'landmark'];
    // Small moving targets are forgiving: a click on a goblin's tile counts as clicking it.
    const onTile = snapshot.mobs.find((m) => !m.dead && m.x === tile.x && m.y === tile.y);
    if (onTile) refs.push({ type: 'mob', id: onTile.id });
    const ref = refs.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type))[0];
    const occupied = blockers(snapshot.nodes, snapshot.buildings ?? []);
    const approach = (target: Point) => {
      const path = pathToAdjacent(self, target, occupied);
      if (path === null) state.notify('Não há caminho até lá.', true);
      else if (path.length) move(path[path.length - 1]);
    };
    if (ref?.type === 'mob') {
      attack(ref.id);
      state.set({ selected: ref.id, intent: null });
      return;
    }
    if (ref?.type === 'npc') {
      const npc = NPCS.find((n) => n.id === ref.id)!;
      state.set({ selected: null, intent: { type: 'npc', id: npc.id } });
      if (distance(self, npc) > NPC_RANGE) approach(npc);
      return;
    }
    if (ref?.type === 'node') {
      const node = snapshot.nodes.find((n) => n.id === ref.id);
      if (!node) return;
      state.set({
        selected: node.id,
        intent: { type: 'gather', id: node.id },
        slot: node.kind === 'wood' ? 1 : node.kind === 'food' ? state.slot : 2,
      });
      this.intentAt = 0;
      if (distance(self, node) > 1) approach(node);
      return;
    }
    if (ref?.type === 'building') {
      const b = snapshot.buildings?.find((x) => x.id === ref.id);
      if (!b) return;
      state.set({
        selected: b.id,
        intent: b.ownerId === self.id ? { type: 'building', id: b.id } : null,
      });
      if (b.ownerId === self.id && !nearBuilding(self, b))
        approach(footprint(b, b.kind).sort((a, c) => distance(self, a) - distance(self, c))[0]);
      return;
    }
    if (ref?.type === 'landmark') {
      const landmark = LANDMARKS.find((l) => l.id === ref.id)!;
      state.notify(landmark.name);
    }
    state.set({ selected: null, intent: null });
    if (
      tile.x >= 0 &&
      tile.y >= 0 &&
      tile.x < WORLD_SIZE &&
      tile.y < WORLD_SIZE &&
      !(tile.x === self.x && tile.y === self.y)
    )
      move(tile);
  }
  private nodeTexture(kind: string, x: number, y: number, alive: boolean) {
    const n = noise(x, y, 808);
    if (kind === 'wood') {
      if (!alive) return 'stump';
      const r = region(x, y);
      if (r === 'sombria') return `dark${Math.floor(n * 4)}`;
      if (r === 'montanhas' || (r === 'bosque' && n > 0.5)) return `pine${Math.floor(n * 4)}`;
      if (r === 'campos' && n > 0.7) return `autumn${Math.floor(n * 10) % 2}`;
      return n > 0.72 ? `pine${Math.floor(n * 13) % 4}` : `oak${Math.floor(n * 4)}`;
    }
    if (kind === 'food') return alive ? 'bush' : 'bush-bare';
    if (kind === 'iron') return `iron${Math.floor(n * 2)}`;
    return `rock${Math.floor(n * 3)}`;
  }
  private syncWorld(snapshot: WorldSnapshot) {
    if (snapshot.nodes !== this.lastSnapshot?.nodes)
      for (const node of snapshot.nodes) {
        const alive = node.quantity > 0;
        const texture = this.nodeTexture(node.kind, node.x, node.y, alive);
        const existing = this.nodes.get(node.id);
        const dim = !alive && node.kind !== 'wood' && node.kind !== 'food' ? 0.35 : 1;
        if (existing) {
          if (existing.texture.key !== texture)
            existing.setTexture(texture).setOrigin(0.5, this.origins.get(texture) ?? 0.5);
          existing.setAlpha(dim);
          continue;
        }
        const p = toIso(node);
        const jitter = (noise(node.x, node.y, 9) - 0.5) * 10;
        this.nodes.set(
          node.id,
          this.image(p.x + jitter, p.y + 4, texture)
            .setDepth(p.y + 4)
            .setAlpha(dim)
            .setData('ref', { type: 'node', id: node.id } satisfies Ref)
            .setInteractive({ pixelPerfect: true, alphaTolerance: 100, cursor: 'pointer' }),
        );
      }
    const current = new Set((snapshot.buildings ?? []).map((b) => b.id));
    for (const [id, s] of this.structures)
      if (!current.has(id)) {
        s.image.destroy();
        s.badge.destroy();
        this.structures.delete(id);
      }
    for (const b of snapshot.buildings ?? []) {
      const texture = b.kind === 'farm' ? this.farmTexture(b, snapshot) : b.kind;
      const existing = this.structures.get(b.id);
      if (existing) {
        if (existing.texture !== texture) {
          existing.image.setTexture(texture);
          existing.texture = texture;
        }
        continue;
      }
      const size = RECIPES[b.kind].size,
        p = center(b, size);
      const image = this.image(p.x, p.y, texture)
        .setDepth(toIso({ x: b.x + size - 1, y: b.y + size - 1 }).y + 10)
        .setData('ref', { type: 'building', id: b.id } satisfies Ref)
        .setInteractive({ pixelPerfect: true, alphaTolerance: 100, cursor: 'pointer' });
      const badge = this.add
        .image(p.x, p.y - 90, 'icon-wood')
        .setScale(ART)
        .setDepth(9.1e5)
        .setVisible(false);
      this.tweens.add({
        targets: badge,
        y: p.y - 98,
        yoyo: true,
        repeat: -1,
        duration: 600,
        ease: 'Sine.easeInOut',
      });
      if (b.kind === 'house') {
        this.glow(p.x - 22, p.y - 22, 0.6);
        this.smoke(p.x + 24, p.y - 66);
      }
      if (b.kind === 'tower') this.glow(p.x - 4, p.y - 66, 0.6);
      this.structures.set(b.id, { image, texture, badge });
      // A short rise for structures that appear while we watch.
      if (this.lastSnapshot)
        this.tweens.add({
          targets: image,
          scaleY: { from: ART * 0.2, to: ART },
          duration: 450,
          ease: 'Back.easeOut',
        });
    }
  }
  private farmTexture(b: Building, snapshot: WorldSnapshot) {
    const state = buildingState(b, snapshot.time);
    if (state.action === 'harvest') return 'farm3';
    if (state.action === 'growing') return state.progress < 0.4 ? 'farm1' : 'farm2';
    return 'farm0';
  }
  private animateActor(
    actor: Actor,
    target: Point,
    facing: number,
    busy: boolean,
    time: number,
    delta: number,
  ) {
    const iso = toIso(target);
    const dx = iso.x - actor.body.x,
      dy = iso.y - actor.body.y;
    const moving = Math.hypot(dx, dy) > 0.8;
    const factor = 1 - Math.exp(-delta / 90);
    actor.body.x += dx * factor;
    actor.body.y += dy * factor;
    // Facing: 0 +x (down-right), 1 +y (down-left), 2 -x (up-left), 3 -y (up-right).
    const view = facing === 2 || facing === 3 ? 1 : 0;
    const flip = facing === 1 || facing === 2;
    const frame = moving ? 1 + (Math.floor(time / 150) % 2) : 0;
    actor.body
      .setTexture(`${actor.skin}-${view}-${frame}`)
      .setFlipX(flip)
      .setDepth(actor.body.y + 6);
    return moving;
  }
  private drawBar(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    value: number,
    max: number,
    color: number,
  ) {
    g.clear();
    if (value >= max) return;
    g.fillStyle(0x14100c, 0.9).fillRect(x - 17, y, 34, 6);
    g.fillStyle(0x3a1a18, 1).fillRect(x - 16, y + 1, 32, 4);
    g.fillStyle(color, 1).fillRect(x - 16, y + 1, Math.max(0, (32 * value) / max), 4);
  }
  private holdTool(actor: Actor, tool: string | null, tier: number, swing: boolean, time: number) {
    if (!tool) return actor.tool.setVisible(false);
    const flip = actor.body.flipX;
    actor.tool
      .setTexture(`tool-${tool}-${tier}`)
      .setVisible(true)
      .setFlipX(flip)
      .setOrigin(flip ? 0.85 : 0.15, 0.85)
      .setPosition(actor.body.x + (flip ? -9 : 9), actor.body.y - 16)
      .setDepth(actor.body.depth + 1)
      .setRotation(swing ? Math.sin(time / 70) * 0.9 * (flip ? -1 : 1) - 0.3 * (flip ? -1 : 1) : 0);
  }
  update(time: number, delta: number) {
    const state = useWorld.getState(),
      snapshot = state.snapshot,
      camera = this.cameras.main;
    const self = selfOf(snapshot);
    if (this.focusRevision !== state.focus) {
      this.focusRevision = state.focus;
      this.follow = true;
      if (self) this.center(self);
    }
    const speed = (delta * 0.6) / camera.zoom;
    if (this.cursors?.left.isDown) camera.scrollX -= speed;
    if (this.cursors?.right.isDown) camera.scrollX += speed;
    if (this.cursors?.up.isDown) camera.scrollY -= speed;
    if (this.cursors?.down.isDown) camera.scrollY += speed;
    if (this.cursors && Object.values(this.cursors).some((k) => k.isDown)) this.follow = false;
    if (snapshot && snapshot !== this.lastSnapshot) {
      this.syncWorld(snapshot);
      for (const [id, actor] of this.people)
        if (!snapshot.players.some((p) => p.id === id)) {
          for (const o of [actor.body, actor.tool, actor.label, actor.bar]) o.destroy();
          this.people.delete(id);
        }
      for (const effect of snapshot.effects)
        if (!this.seen.has(effect.id)) this.spawnEffect(effect, snapshot);
      if (this.seen.size > 600) this.seen = new Set([...this.seen].slice(-300));
      this.lastSnapshot = snapshot;
    }
    if (!snapshot) return this.lighting(time, state.settings.cycle);
    const now = Date.now() - state.skew;
    for (const p of snapshot.players) {
      let actor = this.people.get(p.id);
      if (!actor) {
        const look = lookFor(hash(p.id));
        actor = this.actor(
          this.heroSkin(look),
          p.name,
          p.id === snapshot.selfId ? '#ffe08a' : '#e8f0e8',
        );
        const iso = toIso(p);
        actor.body.setPosition(iso.x, iso.y);
        this.people.set(p.id, actor);
      }
      const gatheringNode = p.gathering
        ? snapshot.nodes.find((n) => n.id === p.gathering!.nodeId)
        : undefined;
      const facing = gatheringNode ? this.faceToward(p, gatheringNode) : p.facing;
      const moving = this.animateActor(actor, p, facing, !!p.gathering, time, delta);
      const tool = p.attacking
        ? 'sword'
        : gatheringNode
          ? gatheringNode.kind === 'wood'
            ? 'axe'
            : gatheringNode.kind === 'food'
              ? null
              : 'pickaxe'
          : p.id === snapshot.selfId && !moving
            ? (['sword', 'axe', 'pickaxe', 'hammer'][state.slot] ?? null)
            : null;
      const tier =
        p.id === snapshot.selfId && tool && tool !== 'hammer'
          ? snapshot.me.tools[tool as 'sword']
          : 1;
      const mob = p.attacking ? snapshot.mobs.find((m) => m.id === p.attacking) : undefined;
      this.holdTool(actor, tool, tier, !!p.gathering || (!!mob && distance(p, mob) <= 1), time);
      actor.label
        .setText(`${p.name}  ${p.level}`)
        .setPosition(actor.body.x, actor.body.y - 54)
        .setDepth(9.3e5)
        .setVisible(state.settings.names || p.id === snapshot.selfId);
      this.drawBar(actor.bar, actor.body.x, actor.body.y - 50, p.hp, p.maxHp, 0xe0443a);
      actor.bar.setDepth(9.3e5);
      if (p.gathering) {
        const progress = 1 - Math.max(0, p.gathering.endsAt - now) / 1500;
        actor.bar.fillStyle(0x14100c, 0.9).fillRect(actor.body.x - 17, actor.body.y - 44, 34, 5);
        actor.bar
          .fillStyle(0xf6cf4a)
          .fillRect(actor.body.x - 16, actor.body.y - 43, 32 * Math.min(1, progress), 3);
      }
    }
    const living = new Set<string>();
    for (const m of snapshot.mobs) {
      let actor = this.enemies.get(m.id);
      if (!actor) {
        const warrior = m.kind === 'warrior' ? 1 : 0;
        actor = this.actor(
          `goblin${warrior}`,
          `${MOBS[m.kind].name}  ${MOBS[m.kind].level}`,
          '#ff9a8a',
        );
        actor.body
          .setScale(ART * (warrior ? 1.25 : 1))
          .setData('ref', { type: 'mob', id: m.id } satisfies Ref);
        actor.body.setInteractive({ cursor: 'crosshair' });
        const iso = toIso(m);
        actor.body.setPosition(iso.x, iso.y);
        this.enemies.set(m.id, actor);
      }
      living.add(m.id);
      const visible = !m.dead;
      if (actor.body.visible && !visible) {
        this.tweens.add({
          targets: actor.body,
          alpha: 0,
          angle: 90,
          duration: 400,
          onComplete: () => actor!.body.setVisible(false).setAlpha(1).setAngle(0),
        });
      } else if (visible && !actor.body.visible) {
        const iso = toIso(m);
        actor.body.setVisible(true).setPosition(iso.x, iso.y).setAlpha(0);
        this.tweens.add({ targets: actor.body, alpha: 1, duration: 600 });
      }
      if (!visible) {
        actor.label.setVisible(false);
        actor.bar.clear();
        actor.tool.setVisible(false);
        continue;
      }
      const fighting =
        !!m.targetId && snapshot.players.some((p) => p.id === m.targetId && distance(p, m) <= 1);
      this.animateActor(actor, m, m.facing, false, time, delta);
      actor.body.setScale(ART * (m.kind === 'warrior' ? 1.25 : 1));
      this.holdTool(actor, 'club', 1, fighting, time + 200);
      actor.label
        .setPosition(actor.body.x, actor.body.y - (m.kind === 'warrior' ? 50 : 42))
        .setDepth(9.3e5)
        .setVisible(state.settings.names || state.selected === m.id);
      this.drawBar(
        actor.bar,
        actor.body.x,
        actor.body.y - (m.kind === 'warrior' ? 48 : 40),
        m.hp,
        m.maxHp,
        0xd8423a,
      );
      actor.bar.setDepth(9.3e5);
    }
    for (const npc of NPCS) {
      const actor = this.villagers.get(npc.id)!;
      const face = self ? this.faceToward(npc, self) : 1;
      this.animateActor(actor, npc, distance(npc, self ?? npc) < 6 ? face : 1, false, time, delta);
      actor.label.setPosition(actor.body.x, actor.body.y - 54).setDepth(9.3e5);
      if (npc.role === 'smith')
        this.holdTool(actor, 'hammer', 1, Math.floor(time / 2400) % 3 === 0, time);
    }
    for (const [id, s] of this.structures) {
      const b = snapshot.buildings?.find((x) => x.id === id);
      if (!b || b.ownerId !== snapshot.selfId) {
        s.badge.setVisible(false);
        continue;
      }
      if (b.kind === 'farm') {
        const texture = this.farmTexture(b, { ...snapshot, time: now });
        if (texture !== s.texture) {
          s.image.setTexture(texture);
          s.texture = texture;
        }
      }
      const st = buildingState(b, now);
      const badge =
        st.action === 'collect' && st.amount >= 3
          ? `icon-${st.item}`
          : st.action === 'harvest'
            ? 'icon-food'
            : st.action === 'rest' && st.ready && self && self.hp < self.maxHp
              ? 'icon-heart'
              : null;
      s.badge.setVisible(!!badge);
      if (badge && s.badge.texture.key !== badge) s.badge.setTexture(badge);
    }
    if (self && this.follow) {
      const actor = this.people.get(self.id);
      if (actor) {
        const tx = actor.body.x - camera.width / 2,
          ty = actor.body.y - 30 - camera.height / 2;
        camera.scrollX += (tx - camera.scrollX) * Math.min(1, delta / 260);
        camera.scrollY += (ty - camera.scrollY) * Math.min(1, delta / 260);
      }
    }
    if (self) this.pursue(snapshot, self, time);
    this.drawHighlight(snapshot);
    this.lighting(time, state.settings.cycle);
  }
  private faceToward(from: Point, to: Point) {
    const dx = to.x - from.x,
      dy = to.y - from.y;
    if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 0 : 2;
    return dy >= 0 ? 1 : 3;
  }
  /** Fulfils the click intent once the authoritative position arrives beside the target. */
  private pursue(snapshot: WorldSnapshot, self: WorldSnapshot['players'][number], time: number) {
    const state = useWorld.getState(),
      intent = state.intent;
    const actor = this.people.get(self.id);
    if (!intent || !actor) return;
    const tileKey = key(self);
    if (actor.lastTile !== tileKey) {
      actor.lastTile = tileKey;
      actor.moved = time;
    }
    const settled = time - actor.moved > 380;
    if (intent.type === 'gather') {
      const node = snapshot.nodes.find((n) => n.id === intent.id);
      if (!node || node.quantity <= 0) {
        if (node) state.notify('Recurso esgotado. Ele volta em alguns segundos.');
        return state.set({ intent: null });
      }
      if (self.gathering || distance(self, node) !== 1 || !settled || time - this.intentAt < 450)
        return;
      if (snapshot.me.energy < GATHER_ENERGY) {
        state.notify('Sem energia. Coma algo (6) ou descanse em casa.', true);
        return state.set({ intent: null });
      }
      this.intentAt = time;
      gather(node.id);
    } else if (intent.type === 'npc') {
      const npc = NPCS.find((n) => n.id === intent.id)!;
      if (distance(self, npc) <= NPC_RANGE)
        state.set({ intent: null, dialog: npc.role, panel: null });
    } else {
      const b = snapshot.buildings?.find((x) => x.id === intent.id);
      if (!b) return state.set({ intent: null });
      if (nearBuilding(self, b)) state.set({ intent: null, selected: b.id });
    }
  }
  private drawHighlight(snapshot: WorldSnapshot) {
    const state = useWorld.getState(),
      g = this.highlight;
    g.clear();
    const diamond = (p: Point, color: number, alpha: number, line = 0) => {
      const iso = toIso(p);
      const pts = [
        { x: iso.x, y: iso.y - 16 },
        { x: iso.x + 32, y: iso.y },
        { x: iso.x, y: iso.y + 16 },
        { x: iso.x - 32, y: iso.y },
      ];
      g.fillStyle(color, alpha).fillPoints(pts, true);
      if (line) g.lineStyle(line, color, 0.9).strokePoints(pts, true);
    };
    const self = selfOf(snapshot);
    if (state.buildKind && self && state.hover) {
      // Construction grid around the builder, like a surveyor's chalk lines.
      for (let y = self.y - BUILD_RANGE; y <= self.y + BUILD_RANGE; y++)
        for (let x = self.x - BUILD_RANGE; x <= self.x + BUILD_RANGE; x++) {
          if (distance(self, { x, y }) > BUILD_RANGE || terrain(x, y) === 'water') continue;
          const iso = toIso({ x, y });
          g.lineStyle(1, 0xf4ead2, 0.34).strokePoints(
            [
              { x: iso.x, y: iso.y - 16 },
              { x: iso.x + 32, y: iso.y },
              { x: iso.x, y: iso.y + 16 },
              { x: iso.x - 32, y: iso.y },
            ],
            true,
          );
        }
      const invalid =
        placementError(
          state.hover,
          state.buildKind,
          blockers(snapshot.nodes, snapshot.buildings ?? []),
          snapshot.players,
        ) || distance(self, state.hover) > BUILD_RANGE;
      for (const tile of footprint(state.hover, state.buildKind))
        diamond(tile, invalid ? 0xf05a46 : 0x5ae06a, 0.35, 2);
      const size = RECIPES[state.buildKind].size,
        p = center(state.hover, size);
      const texture = state.buildKind === 'farm' ? 'farm0' : state.buildKind;
      this.ghost
        .setTexture(texture)
        .setOrigin(0.5, this.origins.get(texture) ?? 0.5)
        .setPosition(p.x, p.y)
        .setVisible(true)
        .setTint(invalid ? 0xff8a7a : 0xb8ffb8);
      return;
    }
    this.ghost.setVisible(false);
    if (
      state.hover &&
      state.hover.x >= 0 &&
      state.hover.y >= 0 &&
      state.hover.x < WORLD_SIZE &&
      state.hover.y < WORLD_SIZE
    )
      diamond(state.hover, 0xf7e2a8, 0.12, 1);
    const node = snapshot.nodes.find((n) => n.id === state.selected);
    if (node) diamond(node, 0xf6cf4a, 0.25, 2);
    const mob = snapshot.mobs.find((m) => m.id === state.selected && !m.dead);
    if (mob) diamond(mob, 0xf05a46, 0.3, 2);
    const b = snapshot.buildings?.find((x) => x.id === state.selected);
    if (b) for (const tile of footprint(b, b.kind)) diamond(tile, 0xf6cf4a, 0.18, 1);
  }
  private spawnEffect(e: Effect, snapshot: WorldSnapshot) {
    this.seen.add(e.id);
    if (Date.now() - useWorld.getState().skew - e.at > 1200) return;
    const iso = toIso(e);
    const float = (text: string, color: string, size = 16, rise = 46) => {
      const label = this.add
        .text(iso.x + (Math.random() - 0.5) * 16, iso.y - 46, text, {
          ...LABEL,
          fontSize: `${size}px`,
          color,
          strokeThickness: 5,
        })
        .setOrigin(0.5)
        .setDepth(9.6e5);
      this.tweens.add({
        targets: label,
        y: label.y - rise,
        alpha: { from: 1, to: 0 },
        duration: 1100,
        ease: 'Cubic.easeOut',
        onComplete: () => label.destroy(),
      });
    };
    const self =
      e.kind === 'hurt' &&
      snapshot.players.some((p) => p.id === snapshot.selfId && p.x === e.x && p.y === e.y);
    if (e.kind === 'damage') float(`-${e.amount}`, '#ffffff', 18);
    if (e.kind === 'hurt') {
      float(`-${e.amount}`, '#ff6a5a', 17);
      if (self) this.cameras.main.shake(120, 0.004);
    }
    if (e.kind === 'heal') float(`+${e.amount}`, '#7cf08a');
    if (e.kind === 'xp') float(`+${e.amount} XP`, '#b8a8ff', 15, 60);
    if (e.kind === 'loot' && e.text) float(e.text, '#ffe08a', 14, 40);
    if (e.kind === 'level') {
      float(`NÍVEL ${e.amount}!`, '#ffd24a', 24, 70);
      const ring = this.add
        .circle(iso.x, iso.y - 20, 10, 0xffd24a, 0)
        .setStrokeStyle(3, 0xffd24a)
        .setDepth(9.6e5);
      this.tweens.add({
        targets: ring,
        scale: 6,
        alpha: 0,
        duration: 900,
        onComplete: () => ring.destroy(),
      });
    }
    if (e.kind === 'death') float('Derrotado', '#c8c8c8', 16);
    if (e.kind === 'arrow' && e.from) {
      const from = toIso(e.from);
      const arrow = this.add
        .image(from.x, from.y - 90, 'arrow')
        .setScale(ART)
        .setDepth(9.6e5);
      arrow.setRotation(Math.atan2(iso.y - 30 - arrow.y, iso.x - arrow.x));
      this.tweens.add({
        targets: arrow,
        x: iso.x,
        y: iso.y - 30,
        duration: 260,
        onComplete: () => {
          arrow.destroy();
          float(`-${e.amount}`, '#ffffff', 16);
        },
      });
    }
  }
  private lighting(time: number, cycle: boolean) {
    const d = cycle ? darkness() : 0;
    const camera = this.cameras.main;
    const dusk = d > 0 && d < 1 ? Math.sin(d * Math.PI) : 0;
    const tint = lerpColor(lerpColor(0xffffff, 0x8a90c8, d), 0xffb88a, dusk * 0.35);
    this.night
      .setFillStyle(tint, 1)
      .setSize(camera.width / camera.zoom + 400, camera.height / camera.zoom + 400)
      .setPosition(camera.width / 2, camera.height / 2)
      .setVisible(d > 0.01);
    for (const light of this.glows) {
      const flicker =
        0.85 +
        Math.sin(time / 120 + light.seed) * 0.08 +
        Math.sin(time / 47 + light.seed * 3) * 0.05;
      light.glow.setAlpha(light.base < 0 ? d * 0.9 : (0.12 + d * 0.7) * flicker);
    }
  }
}
