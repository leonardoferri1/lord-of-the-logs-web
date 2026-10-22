import { create } from 'zustand';
import type { BuildingKind, ChatMessage, Point, ResourceNode, Snapshot } from '@logs/shared';

export type WorldSnapshot = Snapshot & { nodes: ResourceNode[] };
/** What the character is walking towards; the scene fulfils it on arrival. */
export type Intent =
  { type: 'gather'; id: string } | { type: 'npc'; id: string } | { type: 'building'; id: string };
export type Panel = 'inventory' | 'build' | 'map' | 'quests' | 'settings' | 'help' | null;
export type Settings = { names: boolean; cycle: boolean; quests: boolean };
type UiState = {
  snapshot: WorldSnapshot | null;
  /** Client clock minus server clock, for timers sent in server time. */
  skew: number;
  connected: boolean;
  entered: boolean;
  selected: string | null;
  intent: Intent | null;
  buildKind: BuildingKind | null;
  panel: Panel;
  dialog: 'smith' | 'merchant' | null;
  slot: number;
  chat: ChatMessage[];
  unread: number;
  settings: Settings;
  notices: { id: number; text: string; error: boolean }[];
  hover: Point | null;
  focus: number;
  set: (patch: Partial<UiState>) => void;
  notify: (text: string, error?: boolean) => void;
  configure: (patch: Partial<Settings>) => void;
};
let sequence = 0;
function loadSettings(): Settings {
  const defaults = { names: true, cycle: true, quests: true };
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem('logs:settings') || '{}') };
  } catch {
    return defaults;
  }
}
export const useWorld = create<UiState>((set, get) => ({
  snapshot: null,
  skew: 0,
  connected: false,
  entered: false,
  selected: null,
  intent: null,
  buildKind: null,
  panel: null,
  dialog: null,
  slot: 0,
  chat: [],
  unread: 0,
  settings: loadSettings(),
  notices: [],
  hover: null,
  focus: 0,
  set: (patch) => set(patch),
  notify: (text, error = false) => {
    const id = ++sequence;
    set((state) => ({
      notices: [...state.notices.filter((n) => n.text !== text).slice(-3), { id, text, error }],
    }));
    setTimeout(() => set((state) => ({ notices: state.notices.filter((n) => n.id !== id) })), 6000);
  },
  configure: (patch) => {
    const settings = { ...get().settings, ...patch };
    try {
      localStorage.setItem('logs:settings', JSON.stringify(settings));
    } catch {
      // Preferences are a convenience; the game works without storage.
    }
    set({ settings });
  },
}));
export const selfOf = (s: WorldSnapshot | null) => s?.players.find((p) => p.id === s.selfId);
