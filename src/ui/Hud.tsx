import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  MOBS,
  NPCS,
  LANDMARKS,
  QUESTS,
  REGIONS,
  RECIPES,
  WORLD_SIZE,
  activeQuests,
  buildingState,
  distance,
  nearBuilding,
  questProgress,
  region,
  terrain,
  type BuildingKind,
  type Item,
} from '@logs/shared';
import { useWorld, selfOf, type Panel } from '../state';
import { claim, eat, gather, interact, say } from '../network';
import { iconUrl, lookFor, portraitUrl } from '../game/sprites';
import { hash } from '../game/pixel';

export function Icon({
  name,
  size = 28,
  className = '',
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  return (
    <img
      src={iconUrl(name)}
      width={size}
      height={size}
      alt=""
      className={`px-icon ${className}`}
      draggable={false}
    />
  );
}
export const fmt = (n: number) => n.toLocaleString('pt-BR');
function Bar({
  value,
  max,
  kind,
  label,
}: {
  value: number;
  max: number;
  kind: string;
  label?: boolean;
}) {
  return (
    <div
      className={`bar ${kind}`}
      role="meter"
      aria-valuenow={value}
      aria-valuemax={max}
      aria-label={kind}
    >
      <i style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` }} />
      {label !== false && (
        <span>
          {fmt(Math.round(value))} / {fmt(max)}
        </span>
      )}
    </div>
  );
}
export function PlayerCard() {
  const snapshot = useWorld((s) => s.snapshot);
  const self = selfOf(snapshot);
  if (!snapshot || !self) return null;
  const me = snapshot.me;
  return (
    <section className="player-card panel" aria-label="Personagem">
      <div className="portrait">
        <img src={portraitUrl(lookFor(hash(self.id)))} alt="" />
      </div>
      <div className="player-info">
        <div className="player-name">
          <strong>{self.name}</strong>
          <span>Nível {me.level}</span>
        </div>
        <Bar value={me.hp} max={me.maxHp} kind="hp" />
        <Bar value={me.energy} max={me.maxEnergy} kind="energy" />
      </div>
    </section>
  );
}
const MENU: { panel: Exclude<Panel, null>; label: string; icon: string; key: string }[] = [
  { panel: 'inventory', label: 'Inventário', icon: 'bag', key: 'I' },
  { panel: 'build', label: 'Construção', icon: 'hammer', key: 'B' },
  { panel: 'map', label: 'Mapa', icon: 'map', key: 'M' },
  { panel: 'quests', label: 'Missões', icon: 'scroll', key: 'J' },
  { panel: 'help', label: 'Guia', icon: 'banner', key: 'H' },
  { panel: 'settings', label: 'Ajustes', icon: 'gear', key: 'O' },
];
export function Sidebar() {
  const { panel, set, settings, configure } = useWorld();
  return (
    <nav className="sidebar panel" aria-label="Menu">
      {MENU.map((item) => {
        const active = item.panel === 'quests' ? settings.quests : panel === item.panel;
        return (
          <button
            key={item.panel}
            className={active ? 'active' : ''}
            onClick={() =>
              item.panel === 'quests'
                ? configure({ quests: !settings.quests })
                : set({
                    panel: panel === item.panel ? null : item.panel,
                    buildKind: null,
                    dialog: null,
                  })
            }
            aria-pressed={active}
            title={`${item.label} (${item.key})`}
          >
            <Icon name={item.icon} size={30} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
const CURRENCY: { item: Item; icon: string; label: string }[] = [
  { item: 'gold', icon: 'coin', label: 'Ouro' },
  { item: 'wood', icon: 'wood', label: 'Madeira' },
  { item: 'stone', icon: 'stone', label: 'Pedra' },
  { item: 'iron', icon: 'iron', label: 'Ferro' },
  { item: 'food', icon: 'food', label: 'Comida' },
];
export function Resources() {
  const snapshot = useWorld((s) => s.snapshot);
  const connected = useWorld((s) => s.connected);
  const muted = useWorld((s) => s.settings.muted);
  const configure = useWorld((s) => s.configure);
  return (
    <div className="resources panel" aria-label="Recursos">
      {CURRENCY.map((c) => (
        <span key={c.item} title={c.label} className="chip">
          <Icon name={c.icon} size={22} />
          <b>{fmt(snapshot?.inventory[c.item] ?? 0)}</b>
        </span>
      ))}
      <button
        className="sound-toggle"
        onClick={() => configure({ muted: !muted })}
        aria-pressed={muted}
        aria-label={muted ? 'Ativar som (N)' : 'Silenciar (N)'}
        title={muted ? 'Ativar som (N)' : 'Silenciar (N)'}
      >
        <Icon name={muted ? 'mute' : 'sound'} size={22} />
      </button>
      <span className="chip online" title={connected ? 'Viajantes no vale' : 'Reconectando'}>
        <i className={connected ? 'live-dot' : 'offline-dot'} />
        <b>{snapshot?.players.length ?? 0}</b>
      </span>
    </div>
  );
}
const MINI = {
  grass: '#4f7d34',
  forest: '#2f5a2a',
  dirt: '#9a7448',
  cobble: '#8a867c',
  stone: '#7c8074',
  water: '#1c4a6c',
  bridge: '#8e6438',
};
let terrainImage: HTMLCanvasElement | undefined;
/** Top-down world image rotated to match the isometric screen orientation. */
export function worldImage(scale: number) {
  if (terrainImage?.width === WORLD_SIZE * scale) return terrainImage;
  const c = document.createElement('canvas');
  c.width = c.height = WORLD_SIZE * scale;
  const ctx = c.getContext('2d')!;
  for (let y = 0; y < WORLD_SIZE; y++)
    for (let x = 0; x < WORLD_SIZE; x++) {
      const t = terrain(x, y);
      ctx.fillStyle = t === 'forest' && region(x, y) === 'sombria' ? '#1f3a24' : MINI[t];
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  terrainImage = c;
  return c;
}
function drawWorld(
  ctx: CanvasRenderingContext2D,
  size: number,
  scale: number,
  focus: { x: number; y: number },
) {
  const snapshot = useWorld.getState().snapshot;
  ctx.save();
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = MINI.water;
  ctx.fillRect(0, 0, size, size);
  ctx.translate(size / 2, size / 2);
  ctx.rotate(Math.PI / 4);
  ctx.translate(-(focus.x + 0.5) * scale, -(focus.y + 0.5) * scale);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(worldImage(4), 0, 0, WORLD_SIZE * scale, WORLD_SIZE * scale);
  const dot = (x: number, y: number, color: string, r = 1) => {
    ctx.fillStyle = '#120e0a';
    ctx.fillRect(
      x * scale - r * scale * 0.15,
      y * scale - r * scale * 0.15,
      scale * (1 + r * 0.3),
      scale * (1 + r * 0.3),
    );
    ctx.fillStyle = color;
    ctx.fillRect(x * scale, y * scale, scale, scale);
  };
  for (const l of LANDMARKS)
    for (let i = 0; i < l.w; i++)
      for (let j = 0; j < l.h; j++)
        dot(
          l.x + i,
          l.y + j,
          l.kind === 'tent' || l.kind === 'campfire' ? '#a0503a' : '#d8c8a0',
          0,
        );
  for (const b of snapshot?.buildings ?? [])
    for (let i = 0; i < RECIPES[b.kind].size; i++)
      for (let j = 0; j < RECIPES[b.kind].size; j++)
        dot(b.x + i, b.y + j, b.ownerId === snapshot?.selfId ? '#ffcf5a' : '#e0a060', 0);
  for (const m of snapshot?.mobs ?? []) if (!m.dead) dot(m.x, m.y, '#ff4a3a');
  for (const n of NPCS) dot(n.x, n.y, '#ffe08a');
  for (const p of snapshot?.players ?? []) if (p.id !== snapshot?.selfId) dot(p.x, p.y, '#6ae8f0');
  const self = selfOf(snapshot ?? null);
  if (self) dot(self.x, self.y, '#ffffff', 2);
  ctx.restore();
}
export function Minimap() {
  const ref = useRef<HTMLCanvasElement>(null);
  const snapshot = useWorld((s) => s.snapshot);
  const self = selfOf(snapshot);
  const where = self ? region(self.x, self.y) : 'vila';
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (ctx) drawWorld(ctx, 150, 5, self ?? { x: 22, y: 24 });
  }, [snapshot, self]);
  return (
    <aside className="minimap" aria-label="Minimapa">
      <div className="compass">
        <canvas ref={ref} width={150} height={150} />
        <span className="n">N</span>
        <span className="e">L</span>
        <span className="s">S</span>
        <span className="w">O</span>
      </div>
      <div className="place panel">
        <strong>{REGIONS[where].name}</strong>
        <span>
          ({self?.x ?? 22}, {self?.y ?? 24})
        </span>
      </div>
    </aside>
  );
}
export function WorldMap({ size }: { size: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const snapshot = useWorld((s) => s.snapshot);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (ctx)
      drawWorld(ctx, size, size / (WORLD_SIZE * 1.42), {
        x: WORLD_SIZE / 2 - 0.5,
        y: WORLD_SIZE / 2 - 0.5,
      });
  }, [snapshot, size]);
  const labels = useMemo(() => {
    const sums = new Map<string, { x: number; y: number; n: number }>();
    for (let y = 2; y < WORLD_SIZE - 2; y++)
      for (let x = 2; x < WORLD_SIZE - 2; x++) {
        if (terrain(x, y) === 'water' && region(x, y) !== 'lago') continue;
        const r = region(x, y);
        const s = sums.get(r) ?? { x: 0, y: 0, n: 0 };
        sums.set(r, { x: s.x + x, y: s.y + y, n: s.n + 1 });
      }
    const scale = size / (WORLD_SIZE * 1.42);
    return [...sums].map(([r, s]) => {
      // Same rotation as the canvas: screen = rotate45(world - center).
      const wx = (s.x / s.n - WORLD_SIZE / 2) * scale,
        wy = (s.y / s.n - WORLD_SIZE / 2) * scale;
      return {
        r,
        left: size / 2 + (wx - wy) * Math.SQRT1_2,
        top: size / 2 + (wx + wy) * Math.SQRT1_2,
      };
    });
  }, [size]);
  return (
    <div className="world-map" style={{ width: size, height: size }}>
      <canvas ref={ref} width={size} height={size} />
      {labels.map((l) => (
        <span key={l.r} className="map-label" style={{ left: l.left, top: l.top }}>
          {REGIONS[l.r as keyof typeof REGIONS].name}
        </span>
      ))}
    </div>
  );
}
export function Missions() {
  const { snapshot, set } = useWorld();
  const configure = useWorld((s) => s.configure);
  if (!snapshot) return null;
  const owned: Partial<Record<BuildingKind, number>> = {};
  for (const b of snapshot.buildings ?? [])
    if (b.ownerId === snapshot.selfId) owned[b.kind] = (owned[b.kind] ?? 0) + 1;
  const ctx = { stats: snapshot.me.stats, level: snapshot.me.level, owned };
  const quests = activeQuests(snapshot.me.claimed);
  const total = quests.reduce((sum, q) => sum + q.reward.xp, 0);
  return (
    <section className="missions panel" aria-label="Missões">
      <header>
        <h2>Missões</h2>
        <span className="muted">
          {snapshot.me.claimed.length}/{QUESTS.length}
        </span>
        <button
          className="icon-button"
          aria-label="Fechar missões"
          onClick={() => configure({ quests: false })}
        >
          ×
        </button>
      </header>
      {quests.length === 0 && (
        <p className="muted">Você completou todas as histórias do vale. Por enquanto.</p>
      )}
      <ul>
        {quests.map((q) => {
          const progress = questProgress(q, ctx);
          const done = progress >= q.target;
          return (
            <li key={q.id} className={done ? 'done' : ''}>
              <i className="quest-dot" />
              <div>
                <strong>{q.goal}</strong>
                <small>{q.title}</small>
              </div>
              {done ? (
                <button className="claim" onClick={() => claim(q.id)}>
                  Resgatar
                </button>
              ) : (
                <b>
                  {progress}/{q.target}
                </b>
              )}
            </li>
          );
        })}
      </ul>
      <footer>
        <span>Recompensa:</span>
        <b>{fmt(total)} XP</b>
        <button className="text-button" onClick={() => set({ panel: 'help' })}>
          Guia
        </button>
      </footer>
    </section>
  );
}
export const SLOTS: { icon: string | null; label: string; tool?: 'sword' | 'axe' | 'pickaxe' }[] = [
  { icon: 'sword', label: 'Espada', tool: 'sword' },
  { icon: 'axe', label: 'Machado', tool: 'axe' },
  { icon: 'pickaxe', label: 'Picareta', tool: 'pickaxe' },
  { icon: 'hammer', label: 'Martelo · construir' },
  { icon: 'sickle', label: 'Foice · colher plantações' },
  { icon: 'food', label: 'Comer (recupera vida e energia)' },
  { icon: null, label: 'Vazio' },
  { icon: null, label: 'Vazio' },
];
const TIER_CLASS = ['', 'bronze', 'iron', 'steel', 'gold'];
export function useSlot() {
  return (index: number) => {
    const s = useWorld.getState();
    if (index === 3)
      return s.set({ slot: index, panel: s.panel === 'build' ? null : 'build', buildKind: null });
    if (index === 5) return void eat();
    if (index === 4) {
      const farm = s.snapshot?.buildings?.find((b) => b.id === s.selected && b.kind === 'farm');
      if (farm) interact(farm.id);
      else s.notify('Selecione sua plantação para plantar ou colher.');
    }
    s.set({ slot: index });
  };
}
export function Hotbar() {
  const { snapshot, slot } = useWorld();
  const use = useSlot();
  if (!snapshot) return null;
  const me = snapshot.me;
  return (
    <div className="hotbar-wrap">
      <nav className="hotbar panel" aria-label="Barra de ferramentas">
        {SLOTS.map((s, i) => {
          const tier = s.tool ? me.tools[s.tool] : 0;
          return (
            <button
              key={i}
              className={`slot ${slot === i ? 'active' : ''} ${TIER_CLASS[tier] ?? ''}`}
              onClick={() => use(i)}
              title={s.label}
              aria-label={s.label}
            >
              {s.icon && <Icon name={s.icon} size={34} />}
              {i === 5 && <em>{snapshot.inventory.food}</em>}
              {tier > 0 && <i className="tier">{'◆'.repeat(tier)}</i>}
              <kbd>{i + 1}</kbd>
            </button>
          );
        })}
      </nav>
      <div className="xp">
        <Bar value={me.xp} max={me.xpNext} kind="xp" label={false} />
        <span>
          {fmt(me.xp)} / {fmt(me.xpNext)} XP
        </span>
      </div>
    </div>
  );
}
export function Chat() {
  const { chat, set } = useWorld();
  const [text, setText] = useState('');
  const [open, setOpen] = useState(true);
  const log = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
    set({ unread: 0 });
  }, [chat, set, open]);
  useEffect(() => {
    const focus = (e: KeyboardEvent) => {
      if (
        e.key === 'Enter' &&
        document.activeElement !== input.current &&
        !(e.target as HTMLElement).matches('input, textarea')
      ) {
        setOpen(true);
        setTimeout(() => input.current?.focus());
      }
    };
    window.addEventListener('keydown', focus);
    return () => window.removeEventListener('keydown', focus);
  }, []);
  return (
    <section className={`chat panel ${open ? '' : 'collapsed'}`} aria-label="Conversa">
      <button className="chat-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        <Icon name="chat" size={18} /> Conversa
      </button>
      {open && (
        <>
          <div className="chat-log" ref={log} aria-live="polite">
            {chat.slice(-40).map((m) => (
              <p key={m.id} className={m.channel}>
                <b>[{m.channel === 'global' ? 'Global' : 'Vale'}]</b>{' '}
                {m.channel === 'global' && <em>{m.name}:</em>} {m.text}
              </p>
            ))}
            {!chat.length && <p className="system">Diga olá ao vale. Enter para conversar.</p>}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (text.trim()) say(text.trim());
              setText('');
              input.current?.blur();
            }}
          >
            <input
              ref={input}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && input.current?.blur()}
              maxLength={140}
              placeholder="Digite uma mensagem…"
              aria-label="Mensagem"
            />
            <button type="submit" aria-label="Enviar">
              ➤
            </button>
          </form>
        </>
      )}
    </section>
  );
}
export function TargetFrame() {
  const { snapshot, selected } = useWorld();
  const mob = snapshot?.mobs.find((m) => m.id === selected && !m.dead);
  if (!mob) return null;
  return (
    <div className="target panel" aria-label="Alvo">
      <img src={iconUrl('sword')} alt="" className="px-icon" width={20} height={20} />
      <div>
        <strong>
          {MOBS[mob.kind].name} <small>nível {MOBS[mob.kind].level}</small>
        </strong>
        <Bar value={mob.hp} max={mob.maxHp} kind="hp" />
      </div>
    </div>
  );
}
function Card({
  eyebrow,
  title,
  onClose,
  children,
}: {
  eyebrow: string;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <section className="selection panel">
      <header>
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
        </div>
        <button className="icon-button" aria-label="Fechar" onClick={onClose}>
          ×
        </button>
      </header>
      {children}
    </section>
  );
}
const NODE_NAMES = {
  wood: 'Árvore',
  stone: 'Rocha',
  iron: 'Veio de ferro',
  food: 'Arbusto de frutas',
};
export function Selection() {
  const { snapshot, selected, set, connected, skew } = useWorld();
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(t);
  }, []);
  const self = selfOf(snapshot);
  if (!snapshot || !self || !selected) return null;
  const close = () => set({ selected: null, intent: null });
  const node = snapshot.nodes.find((n) => n.id === selected);
  if (node) {
    const near = distance(self, node) <= 1;
    return (
      <Card eyebrow="Recurso" title={NODE_NAMES[node.kind]} onClose={close}>
        <div className="amount">
          <Icon name={node.kind} size={22} />
          <span>Disponível</span>
          <b>
            {node.quantity}/{node.capacity}
          </b>
        </div>
        <Bar value={node.quantity} max={node.capacity} kind="resource" label={false} />
        <button
          className="primary"
          disabled={!connected || node.quantity <= 0 || !!self.gathering}
          onClick={() => {
            set({ intent: { type: 'gather', id: node.id } });
            if (near) gather(node.id);
          }}
        >
          {self.gathering
            ? 'Coletando…'
            : node.quantity <= 0
              ? 'Regenerando…'
              : near
                ? 'Coletar'
                : 'Ir e coletar'}
          <kbd>E</kbd>
        </button>
        <small className="muted">
          Cada coleta gasta 5 de energia. A coleta se repete até o recurso acabar.
        </small>
      </Card>
    );
  }
  const b = snapshot.buildings?.find((x) => x.id === selected);
  if (!b) return null;
  const recipe = RECIPES[b.kind];
  const mine = b.ownerId === self.id;
  const state = buildingState(b, Date.now() - skew);
  const near = nearBuilding(self, b);
  const action =
    state.action === 'collect'
      ? { label: `Recolher ${state.amount}`, ok: state.amount > 0 }
      : state.action === 'plant'
        ? { label: 'Plantar trigo', ok: true }
        : state.action === 'harvest'
          ? { label: 'Colher', ok: true }
          : state.action === 'growing'
            ? { label: `Crescendo… ${Math.round(state.progress * 100)}%`, ok: false }
            : state.action === 'rest'
              ? {
                  label: state.ready
                    ? 'Descansar'
                    : `Descanso em ${Math.round((1 - state.progress) * 120)} s`,
                  ok: state.ready,
                }
              : null;
  const owner = snapshot.players.find((p) => p.id === b.ownerId)?.name;
  return (
    <Card
      eyebrow={mine ? 'Sua construção' : `Construção de ${owner ?? 'outro viajante'}`}
      title={recipe.name}
      onClose={close}
    >
      <p className="muted small">{recipe.description}</p>
      {state.action === 'collect' && (
        <div className="amount">
          <Icon name={state.item} size={22} />
          <span>Estoque</span>
          <b>{state.amount}</b>
        </div>
      )}
      {(state.action === 'growing' || state.action === 'rest') && (
        <Bar value={state.progress * 100} max={100} kind="resource" label={false} />
      )}
      {mine && action && (
        <button
          className="primary"
          disabled={!connected || !action.ok}
          onClick={() => (near ? interact(b.id) : set({ intent: { type: 'building', id: b.id } }))}
        >
          {near || !action.ok ? action.label : `Ir · ${action.label}`}
          <kbd>E</kbd>
        </button>
      )}
    </Card>
  );
}
export function Notices() {
  const notices = useWorld((s) => s.notices);
  return (
    <div className="notices" aria-live="polite">
      {notices.slice(-3).map((n) => (
        <div key={n.id} className={n.error ? 'notice error' : 'notice'}>
          {n.text}
        </div>
      ))}
    </div>
  );
}
export const npcByRole = (role: string) => NPCS.find((n) => n.role === role)!;
