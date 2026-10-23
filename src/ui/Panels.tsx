import { useMemo, useState, type ReactNode } from 'react';
import {
  BUILDING_KINDS,
  ITEMS,
  MAX_TOOL_TIER,
  PRICES,
  RECIPES,
  TIER_NAMES,
  TOOLS,
  canAfford,
  gatherYield,
  swordDamage,
  upgradeCost,
  type Inventory,
  type Item,
  type Resource,
  type Tool,
} from '@logs/shared';
import { useWorld } from '../state';
import { trade, upgrade, logout } from '../network';
import { buildingArt } from '../game/props';
import { Icon, WorldMap, fmt } from './Hud';

function Window({
  title,
  eyebrow,
  onClose,
  children,
  className = '',
}: {
  title: string;
  eyebrow?: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`window panel ${className}`} role="dialog" aria-label={title}>
      <header>
        <div>
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
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
const close = () => useWorld.getState().set({ panel: null, dialog: null, buildKind: null });
function Cost({ cost, have }: { cost: Partial<Inventory>; have?: Inventory }) {
  return (
    <span className="cost">
      {(Object.entries(cost) as [Item, number][]).map(([item, n]) => (
        <span key={item} className={have && have[item] < n ? 'missing' : ''}>
          <Icon name={item === 'gold' ? 'coin' : item} size={16} />
          {n}
        </span>
      ))}
    </span>
  );
}
export function Inventory() {
  const snapshot = useWorld((s) => s.snapshot);
  if (!snapshot) return null;
  const { inventory, me } = snapshot;
  const stats = [
    ['Madeiras coletadas', me.stats.wood],
    ['Pedras coletadas', me.stats.stone],
    ['Ferro extraído', me.stats.iron],
    ['Comida colhida', me.stats.food],
    ['Goblins derrotados', me.stats.goblins],
    ['Guerreiros derrotados', me.stats.warriors],
    ['Colheitas', me.stats.harvests],
    ['Ferramentas aprimoradas', me.stats.upgrades],
  ];
  return (
    <Window title="Inventário" eyebrow="Sua bolsa" onClose={close}>
      <div className="inventory-grid">
        {(Object.keys(ITEMS) as Item[]).map((item) => (
          <div key={item} className="item-slot" title={ITEMS[item].name}>
            <Icon name={item === 'gold' ? 'coin' : item} size={32} />
            <b>{fmt(inventory[item])}</b>
            <small>{ITEMS[item].name}</small>
          </div>
        ))}
      </div>
      <h3>Ferramentas</h3>
      <div className="tools">
        {(Object.keys(TOOLS) as Tool[]).map((tool) => (
          <div key={tool} className="tool-row">
            <Icon name={tool} size={28} />
            <div>
              <strong>
                {TOOLS[tool].name} {TIER_NAMES[me.tools[tool]]}
              </strong>
              <small>
                {tool === 'sword'
                  ? `Dano ${swordDamage(me.tools.sword, me.level, 0)}–${swordDamage(me.tools.sword, me.level, 1)}`
                  : tool === 'axe'
                    ? `${gatherYield('wood', me.tools)} madeiras por coleta`
                    : `${gatherYield('stone', me.tools)} pedras · ${gatherYield('iron', me.tools)} ferro por coleta`}
              </small>
            </div>
            <i className="tier">{'◆'.repeat(me.tools[tool])}</i>
          </div>
        ))}
      </div>
      <h3>Jornada</h3>
      <dl className="stats">
        {stats.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{fmt(Number(value))}</dd>
          </div>
        ))}
      </dl>
    </Window>
  );
}
const previews = new Map<string, string>();
const preview = (kind: string) => {
  if (!previews.has(kind))
    previews.set(
      kind,
      buildingArt(kind === 'farm' ? 'farm' : kind, kind === 'farm' ? 3 : 0).canvas.toDataURL(),
    );
  return previews.get(kind)!;
};
export function Construction() {
  const { snapshot, buildKind, set } = useWorld();
  if (!snapshot) return null;
  return (
    <Window title="Construção" eyebrow="Erga seu reino" onClose={close} className="build-window">
      <p className="muted small">
        Escolha uma estrutura e clique num terreno livre a até 6 passos. Estradas, a praça e
        acampamentos goblins não aceitam obras.
      </p>
      <div className="building-list">
        {BUILDING_KINDS.map((kind) => {
          const recipe = RECIPES[kind];
          const locked = snapshot.me.level < recipe.level;
          const affordable = canAfford(snapshot.inventory, recipe.cost);
          return (
            <button
              key={kind}
              className={`building-card ${buildKind === kind ? 'selected' : ''}`}
              disabled={locked}
              onClick={() => set({ buildKind: buildKind === kind ? null : kind, selected: null })}
            >
              <img src={preview(kind)} alt="" className="px-icon preview" />
              <span className="building-copy">
                <strong>{recipe.name}</strong>
                <small>
                  {locked ? `Desbloqueia no nível ${recipe.level}` : recipe.description}
                </small>
                <Cost cost={recipe.cost} have={snapshot.inventory} />
              </span>
              {!locked && !affordable && <em className="tag">Faltam recursos</em>}
            </button>
          );
        })}
      </div>
    </Window>
  );
}
export function MapPanel() {
  const size = Math.min(520, window.innerWidth - 48, window.innerHeight - 270);
  return (
    <Window title="Mapa do mundo" eyebrow="Vale do Carvalho" onClose={close} className="map-window">
      <WorldMap size={size} />
      <div className="legend">
        <span>
          <i style={{ background: '#fff' }} /> Você
        </span>
        <span>
          <i style={{ background: '#6ae8f0' }} /> Viajantes
        </span>
        <span>
          <i style={{ background: '#ffe08a' }} /> Moradores
        </span>
        <span>
          <i style={{ background: '#ff4a3a' }} /> Goblins
        </span>
        <span>
          <i style={{ background: '#ffcf5a' }} /> Suas obras
        </span>
      </div>
    </Window>
  );
}
type Toggle = 'names' | 'cycle' | 'quests' | 'muted';
type Level = 'volume' | 'music' | 'effects' | 'ambience';
export function Settings() {
  const { settings, configure } = useWorld();
  const toggle = (key: Toggle, label: string, hint: string) => (
    <label className="toggle">
      <input
        type="checkbox"
        checked={settings[key]}
        onChange={(e) => configure({ [key]: e.target.checked })}
      />
      <span>
        <strong>{label}</strong>
        <small>{hint}</small>
      </span>
    </label>
  );
  const slider = (key: Level, label: string) => (
    <label className="slider">
      <span>{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={settings[key]}
        disabled={settings.muted}
        onChange={(e) => configure({ [key]: Number(e.target.value) })}
        aria-valuetext={`${settings[key]}%`}
      />
      <b>{settings[key]}%</b>
    </label>
  );
  return (
    <Window title="Ajustes" onClose={close}>
      <h3>Som</h3>
      {toggle('muted', 'Silenciar tudo', 'Atalho: N. O som começa após o primeiro clique no jogo.')}
      <div className="sliders">
        {slider('volume', 'Volume geral')}
        {slider('effects', 'Efeitos')}
        {slider('music', 'Música')}
        {slider('ambience', 'Ambiente')}
      </div>
      <h3>Jogo</h3>
      {toggle(
        'names',
        'Nomes sobre os personagens',
        'Mostra viajantes e goblins com seus nomes e níveis.',
      )}
      {toggle(
        'cycle',
        'Ciclo de dia e noite',
        'O vale escurece a cada 12 minutos; tochas e janelas iluminam.',
      )}
      {toggle('quests', 'Painel de missões', 'Mantém as missões ativas à direita da tela.')}
      <button className="secondary" onClick={logout}>
        Sair do vale
      </button>
    </Window>
  );
}
export function Help() {
  return (
    <Window
      title="Guia do viajante"
      eyebrow="Primeiros passos"
      onClose={close}
      className="help-window"
    >
      <ol className="guide">
        <li>
          <strong>Colete.</strong> Clique numa árvore, rocha, veio de ferro ou arbusto. Você caminha
          até ele e coleta sozinho até esgotar. Cada coleta gasta energia.
        </li>
        <li>
          <strong>Construa.</strong> Abra <kbd>B</kbd>, escolha uma estrutura e clique num terreno
          livre. Novas estruturas são desbloqueadas ao subir de nível.
        </li>
        <li>
          <strong>Lute.</strong> Clique num goblin para atacar. A Floresta Sombria tem goblins
          comuns; o Bosque Rubro guarda guerreiros. Torres atiram sozinhas.
        </li>
        <li>
          <strong>Forje e negocie.</strong> Na Vila do Rio, o ferreiro aprimora ferramentas e a
          mercadora compra recursos e vende comida.
        </li>
        <li>
          <strong>Recupere-se.</strong> Coma com <kbd>6</kbd>, descanse na sua casa ou fique perto
          dela para regenerar mais rápido. Cair em combate custa 10% do seu ouro.
        </li>
      </ol>
      <div className="keys">
        <span>
          <kbd>I</kbd> Inventário
        </span>
        <span>
          <kbd>M</kbd> Mapa
        </span>
        <span>
          <kbd>J</kbd> Missões
        </span>
        <span>
          <kbd>1–8</kbd> Ferramentas
        </span>
        <span>
          <kbd>E</kbd> Coletar / usar
        </span>
        <span>
          <kbd>F</kbd> Centralizar
        </span>
        <span>
          <kbd>Enter</kbd> Conversar
        </span>
        <span>
          <kbd>Esc</kbd> Cancelar
        </span>
        <span>
          <kbd>N</kbd> Som liga/desliga
        </span>
      </div>
      <p className="muted small">
        Arraste com o botão direito ou use as setas para mover a câmera; a roda do mouse aproxima.
        Tudo o que você conquista é validado e salvo pelo servidor.
      </p>
    </Window>
  );
}
export function Smith() {
  const snapshot = useWorld((s) => s.snapshot);
  if (!snapshot) return null;
  return (
    <Window
      title="Forja do Ferreiro"
      eyebrow="Bruno, o ferreiro"
      onClose={close}
      className="dialog"
    >
      <p className="quote">
        “Ferro bom e madeira seca. Traga os dois e eu deixo suas ferramentas dignas de uma lenda.”
      </p>
      {(Object.keys(TOOLS) as Tool[]).map((tool) => {
        const tier = snapshot.me.tools[tool];
        const max = tier >= MAX_TOOL_TIER;
        const cost = upgradeCost(tier);
        return (
          <div key={tool} className="trade-row">
            <Icon name={tool} size={30} />
            <div>
              <strong>
                {TOOLS[tool].name} {TIER_NAMES[tier]}
              </strong>
              <small>
                {max ? 'Já é lendária.' : `Próximo: ${TIER_NAMES[tier + 1]} · ${TOOLS[tool].use}`}
              </small>
            </div>
            {!max && <Cost cost={cost} have={snapshot.inventory} />}
            <button
              className="primary small"
              disabled={max || !canAfford(snapshot.inventory, cost)}
              onClick={() => upgrade(tool)}
            >
              Forjar
            </button>
          </div>
        );
      })}
    </Window>
  );
}
export function Merchant() {
  const snapshot = useWorld((s) => s.snapshot);
  const [amount, setAmount] = useState(5);
  const goods = useMemo(
    () => Object.entries(PRICES) as [Resource, { sell?: number; buy?: number }][],
    [],
  );
  if (!snapshot) return null;
  return (
    <Window
      title="Barraca da Mercadora"
      eyebrow="Iara, a mercadora"
      onClose={close}
      className="dialog"
    >
      <p className="quote">“Tudo tem preço no vale. Até pedra. Principalmente pedra.”</p>
      <div className="amounts">
        Quantidade:
        {[1, 5, 10, 25].map((n) => (
          <button key={n} className={amount === n ? 'active' : ''} onClick={() => setAmount(n)}>
            {n}
          </button>
        ))}
      </div>
      {goods.map(([item, price]) => (
        <div key={item} className="trade-row">
          <Icon name={item} size={30} />
          <div>
            <strong>{ITEMS[item].name}</strong>
            <small>Você tem {fmt(snapshot.inventory[item])}</small>
          </div>
          {price.sell && (
            <button
              className="secondary small"
              disabled={snapshot.inventory[item] < amount}
              onClick={() => trade(item, 'sell', amount)}
            >
              Vender · {price.sell * amount} <Icon name="coin" size={14} />
            </button>
          )}
          {price.buy && (
            <button
              className="primary small"
              disabled={snapshot.inventory.gold < price.buy * amount}
              onClick={() => trade(item, 'buy', amount)}
            >
              Comprar · {price.buy * amount} <Icon name="coin" size={14} />
            </button>
          )}
        </div>
      ))}
    </Window>
  );
}
