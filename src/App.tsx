import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Phaser from 'phaser';
import { RECIPES } from '@logs/shared';
import { WorldScene } from './game/WorldScene';
import { useWorld } from './state';
import { API, connect, gather, interact } from './network';
import { iconUrl } from './game/sprites';
import { sound } from './game/audio';
import {
  Chat,
  Hotbar,
  Icon,
  Minimap,
  Missions,
  Notices,
  PlayerCard,
  Resources,
  Selection,
  Sidebar,
  TargetFrame,
  useSlot,
} from './ui/Hud';
import { Construction, Help, Inventory, MapPanel, Merchant, Settings, Smith } from './ui/Panels';

function GameCanvas() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = ref.current!;
    let game: Phaser.Game | undefined;
    // WebGL cannot allocate a 0 × 0 framebuffer, so the game starts only once the container has
    // a real size (a page opened in a hidden tab has none) and ignores later collapses.
    // Phaser also caches the canvas position for pointer math; refresh it whenever layout settles.
    const observer = new ResizeObserver(() => {
      if (!container.clientWidth || !container.clientHeight) return;
      if (game) return game.scale.refresh();
      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: container,
        backgroundColor: '#163e5c',
        pixelArt: true,
        scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
        scene: WorldScene,
        audio: { noAudio: true },
      });
      // Dev-only handle for debugging the scene from the browser console.
      if (import.meta.env.DEV) Object.assign(window, { __game: game, __sound: sound });
    });
    const settle = () => game?.scale.updateBounds();
    observer.observe(container);
    container.addEventListener('pointerenter', settle);
    return () => {
      observer.disconnect();
      container.removeEventListener('pointerenter', settle);
      game?.destroy(true);
    };
  }, []);
  return (
    <div
      className="world-canvas"
      ref={ref}
      aria-label="Mundo isométrico. Clique no chão para andar, em recursos para coletar e em goblins para atacar."
    />
  );
}
function Entry() {
  const [name, setName] = useState('');
  const [saved] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('logs:last-character') || 'null') as {
        name: string;
        token: string;
      } | null;
    } catch {
      return null;
    }
  });
  const [resumeError, setResumeError] = useState('');
  const resume = async () => {
    if (!saved) return;
    try {
      const response = await fetch(`${API}/api/me`, {
        headers: { Authorization: `Bearer ${saved.token}` },
        signal: AbortSignal.timeout(6000),
      });
      if (!response.ok) throw new Error('A sessão anterior expirou. Crie um novo personagem.');
      sessionStorage.setItem('logs:token', saved.token);
      connect(saved.token);
    } catch (error) {
      setResumeError(error instanceof Error ? error.message : 'Não foi possível retornar.');
    }
  };
  const health = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const r = await fetch(`${API}/api/health`, { signal: AbortSignal.timeout(4000) });
      if (!r.ok) throw new Error('offline');
      return r.json() as Promise<{ status: string }>;
    },
    retry: false,
    refetchInterval: 10000,
  });
  const entry = useMutation({
    mutationFn: async () => {
      const response = await fetch(`${API}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) {
        const data = (await response.json()) as { message: string };
        throw new Error(data.message || 'Não foi possível entrar.');
      }
      return response.json() as Promise<{ token: string }>;
    },
    onSuccess: ({ token }) => {
      sessionStorage.setItem('logs:token', token);
      localStorage.setItem('logs:last-character', JSON.stringify({ name, token }));
      connect(token);
    },
  });
  const error = entry.error instanceof Error ? entry.error.message : '';
  return (
    <div className="entry-wrap">
      <section className="entry-card panel">
        <div className="logo">
          <img src={iconUrl('axe')} alt="" className="px-icon" />
          <h1>
            Lord of the <em>Logs</em>
          </h1>
          <span className="eyebrow">Um mundo multiplayer persistente</span>
        </div>
        <p className="entry-description">
          Corte, minere, plante e forje. Derrote goblins, cumpra missões e erga um reino ao lado de
          outros viajantes — tudo fica salvo no vale.
        </p>
        <ul className="entry-features">
          <li>
            <Icon name="axe" size={22} /> Colete e construa
          </li>
          <li>
            <Icon name="sword" size={22} /> Combata goblins
          </li>
          <li>
            <Icon name="scroll" size={22} /> Complete missões
          </li>
          <li>
            <Icon name="chat" size={22} /> Jogue com amigos
          </li>
        </ul>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            entry.mutate();
          }}
        >
          <label htmlFor="nickname">Como devemos chamar você?</label>
          <input
            id="nickname"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Seu nome no vale"
            minLength={2}
            maxLength={20}
            required
            autoComplete="nickname"
          />
          <button className="primary" disabled={entry.isPending || !health.isSuccess} type="submit">
            {entry.isPending ? 'Preparando sua chegada…' : 'Começar aventura'}
          </button>
        </form>
        {saved && (
          <button
            className="text-button"
            onClick={() => void resume()}
            disabled={!health.isSuccess}
          >
            Continuar como {saved.name} →
          </button>
        )}
        {(error || resumeError) && (
          <p className="error small" role="alert">
            {error || resumeError}
          </p>
        )}
        <div className="server-status">
          <i className={health.isSuccess ? 'live-dot' : 'offline-dot'} />
          {health.isSuccess
            ? 'Vale online · sem cadastro'
            : health.isPending
              ? 'Consultando o vale…'
              : 'Servidor indisponível. Inicie o backend para entrar.'}
        </div>
      </section>
    </div>
  );
}
const PANEL_KEYS: Record<string, 'inventory' | 'build' | 'map' | 'help' | 'settings'> = {
  i: 'inventory',
  b: 'build',
  m: 'map',
  h: 'help',
  o: 'settings',
};
export default function App() {
  const state = useWorld();
  const booted = useRef(false);
  const useSlotAction = useSlot();
  useEffect(() => {
    if (!booted.current) {
      booted.current = true;
      const token = sessionStorage.getItem('logs:token');
      if (token) connect(token);
    }
    const handler = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).matches('input, textarea') || !useWorld.getState().entered)
        return;
      const s = useWorld.getState();
      const k = event.key.toLowerCase();
      if (PANEL_KEYS[k])
        s.set({
          panel: s.panel === PANEL_KEYS[k] ? null : PANEL_KEYS[k],
          buildKind: null,
          dialog: null,
        });
      if (k === 'j') s.configure({ quests: !s.settings.quests });
      if (k === 'n') s.configure({ muted: !s.settings.muted });
      if (k === 'f') s.set({ focus: s.focus + 1 });
      if (/^[1-8]$/.test(k)) useSlotAction(Number(k) - 1);
      if (event.key === 'Escape')
        s.set({ panel: null, buildKind: null, selected: null, dialog: null, intent: null });
      if (k === 'e' && s.selected && s.connected) {
        if (s.snapshot?.nodes.some((n) => n.id === s.selected)) {
          s.set({ intent: { type: 'gather', id: s.selected } });
          gather(s.selected);
        } else if (s.snapshot?.buildings?.some((b) => b.id === s.selected)) interact(s.selected);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [useSlotAction]);
  useEffect(() => {
    // Browsers only allow audio after a gesture; any click or key press unlocks it.
    const unlock = () => sound.unlock();
    const click = (event: MouseEvent) => {
      if ((event.target as HTMLElement).closest('button:not(:disabled)')) sound.play('click');
    };
    sound.setMix(useWorld.getState().settings);
    const unsubscribe = useWorld.subscribe((s, previous) => {
      if (s.settings !== previous.settings) sound.setMix(s.settings);
    });
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    window.addEventListener('click', click);
    return () => {
      unsubscribe();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('click', click);
    };
  }, []);
  return (
    <main>
      <GameCanvas />
      {!state.entered ? (
        <Entry />
      ) : (
        <div className="hud">
          <PlayerCard />
          <Sidebar />
          <div className="top-right">
            <Resources />
            <Minimap />
            {state.settings.quests && <Missions />}
          </div>
          <TargetFrame />
          <Notices />
          {state.panel === 'inventory' && <Inventory />}
          {state.panel === 'build' && <Construction />}
          {state.panel === 'map' && <MapPanel />}
          {state.panel === 'settings' && <Settings />}
          {state.panel === 'help' && <Help />}
          {state.dialog === 'smith' && <Smith />}
          {state.dialog === 'merchant' && <Merchant />}
          <Selection />
          <Hotbar />
          <Chat />
          {!state.connected && (
            <div className="connection-alert">
              Conexão perdida. As ações voltam após a sincronização.
            </div>
          )}
          {state.buildKind && (
            <div className="placement-hint panel">
              <Icon name="hammer" size={20} />
              <strong>{RECIPES[state.buildKind].name}</strong>
              <span>Clique no terreno para construir</span>
              <kbd>Esc</kbd>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
