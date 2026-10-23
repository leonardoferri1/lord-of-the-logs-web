import { io, type Socket } from 'socket.io-client';
import type { ClientEvents, ServerEvents, Point, BuildingKind, Item, Tool } from '@logs/shared';
import { useWorld, selfOf } from './state';
import { sound, type Sfx } from './game/audio';
export const API = import.meta.env.VITE_API_URL || '';
let socket: Socket<ServerEvents, ClientEvents> | undefined;
const live = () => (socket?.connected ? socket : undefined);
const actionId = () => crypto.randomUUID();
export function connect(token: string) {
  socket?.disconnect();
  socket = io(API || undefined, { auth: { token }, reconnection: true, reconnectionDelay: 1000 });
  socket.on('snapshot', (snapshot) => {
    const previous = useWorld.getState().snapshot;
    const nodes = snapshot.nodes ?? previous?.nodes;
    // Without a node list yet (a reconnect mid-revision), ask for a full snapshot.
    if (!nodes) return void socket?.emit('resync');
    useWorld.getState().set({
      snapshot: { ...snapshot, nodes },
      skew: Date.now() - snapshot.time,
      connected: true,
      entered: true,
    });
  });
  socket.on('disconnect', () => useWorld.getState().set({ connected: false }));
  socket.on('connect_error', () => {
    useWorld.getState().set({ connected: false });
    useWorld.getState().notify('Conexão interrompida. Tentando reconectar ao vale…', true);
  });
  socket.on('result', (result) => {
    const cue = resultSound(result.ok, result.message);
    if (cue) sound.play(cue);
    // Routine gathering already floats over the resource; only notable results become toasts.
    if (result.ok && result.message.startsWith('+') && !result.message.includes('Nível')) return;
    useWorld.getState().notify(result.message, !result.ok);
  });
  socket.on('chatHistory', (chat) => useWorld.getState().set({ chat }));
  socket.on('chat', (message) => {
    const state = useWorld.getState();
    state.set({ chat: [...state.chat.slice(-59), message], unread: state.unread + 1 });
    if (message.channel === 'global' && message.name !== selfOf(state.snapshot)?.name)
      sound.play('chat');
  });
}
/** Results whose world effect has no sound of its own get a cue here; scene effects cover the rest. */
function resultSound(ok: boolean, message: string): Sfx | null {
  if (!ok) return message.startsWith('Você perdeu') ? null : 'error';
  if (message.startsWith('Missão')) return 'quest';
  if (message.includes('forjada')) return 'anvil';
  if (/^(Vendeu|Comprou|Recolheu)/.test(message)) return 'coin';
  if (/^(Você comeu|Você descansou)/.test(message)) return 'heal';
  if (/^(Colheita|Trigo plantado)/.test(message)) return 'rustle';
  return null;
}
export const move = (p: Point) => live()?.emit('move', p);
export const gather = (nodeId: string) => live()?.emit('gather', { nodeId, actionId: actionId() });
export const build = (p: Point, kind: BuildingKind) =>
  live()?.emit('build', { ...p, kind, actionId: actionId() });
export const attack = (mobId: string) => live()?.emit('attack', { mobId });
export const interact = (buildingId: string) =>
  live()?.emit('interact', { buildingId, actionId: actionId() });
export const upgrade = (tool: Tool) => live()?.emit('upgrade', { tool, actionId: actionId() });
export const trade = (item: Exclude<Item, 'gold'>, mode: 'sell' | 'buy', amount: number) =>
  live()?.emit('trade', { item, mode, amount, actionId: actionId() });
export const eat = () => live()?.emit('eat', { actionId: actionId() });
export const claim = (questId: string) => live()?.emit('claim', { questId, actionId: actionId() });
export const say = (text: string) => live()?.emit('chat', { text });
export const stop = () => live()?.emit('stop');
export function logout() {
  socket?.disconnect();
  sessionStorage.removeItem('logs:token');
  useWorld.getState().set({ entered: false, snapshot: null, connected: false, chat: [] });
}
