import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { CardBack, CardView } from './CardView';
import { describeEffects, type GameEffect } from './effectDescriptors';
import { eventText } from './eventText';
import type { GameEvent, Language, Player } from './types';
import './gameEffects.css';

type Point = { x: number; y: number };
type Flight = { from: Point; to: Point };

function point(element: Element | null, bounds: DOMRect, fallback: Point): Point {
  if (!element) return fallback;
  const box = element.getBoundingClientRect();
  return { x: box.left + box.width / 2 - bounds.left, y: box.top + box.height / 2 - bounds.top };
}

export function GameEffects({ events, gameId, selfId, lang, players, reduced }: {
  events: GameEvent[]; gameId: string; selfId?: string; lang: Language; players: Player[]; reduced: boolean;
}) {
  const [queue, setQueue] = useState<GameEffect[]>([]);
  const [flight, setFlight] = useState<Flight | null>(null);
  const seen = useRef(new Set<string>());
  const layer = useRef<HTMLDivElement>(null);
  const active = queue[0];

  useEffect(() => {
    if (!events.length || document.hidden) { seen.current.clear(); setQueue([]); return; }
    const effects = describeEffects(events.filter(event => event.gameId === gameId), selfId);
    const fresh = effects.filter(effect => !seen.current.has(effect.id));
    for (const effect of fresh) seen.current.add(effect.id);
    if (fresh.length) setQueue(previous => [...previous, ...fresh].slice(-8));
    if (seen.current.size > 200) seen.current = new Set(effects.map(effect => effect.id));
  }, [events, gameId, selfId]);

  useEffect(() => {
    if (!active) { setFlight(null); return; }
    const area = layer.current?.parentElement;
    if (!area) return;
    const bounds = area.getBoundingClientRect();
    const center = { x: bounds.width / 2, y: bounds.height * 0.42 };
    const seat = (id?: string) => id === selfId ? area.querySelector('[data-hand]')
      : [...area.querySelectorAll('[data-player-id]')].find(element => element.getAttribute('data-player-id') === id) ?? null;
    const deck = area.querySelector('[data-deck]');
    const discard = area.querySelector('[data-discard]');
    let from = center;
    let to = center;
    if (active.kind === 'draw') {
      from = point(deck, bounds, center);
      to = point(seat(active.playerId), bounds, center);
    } else if (active.kind === 'play') {
      from = point(seat(active.playerId), bounds, center);
      to = point(discard, bounds, center);
    } else if (active.kind === 'steal') {
      from = point(seat(active.sourceId), bounds, center);
      to = point(seat(active.targetId), bounds, center);
    } else if (active.kind === 'attack') to = point(discard, bounds, center);
    setFlight({ from, to });
    const animations: Animation[] = [];
    if (!reduced && active.kind === 'attack') {
      const target = seat(active.targetId);
      if (target) animations.push(target.animate([
        { transform: 'perspective(500px) rotateY(0deg) rotateZ(0deg)' },
        { transform: 'perspective(500px) rotateY(12deg) rotateZ(5deg)' },
        { transform: 'perspective(500px) rotateY(0deg) rotateZ(0deg)' },
      ], { duration: active.duration, easing: 'ease-out' }));
    }
    if (!reduced && active.kind === 'revive') {
      const target = seat(active.playerId);
      if (target) animations.push(target.animate([
        { transform: 'translateY(12px) scale(.9)' }, { transform: 'translateY(-5px) scale(1.03)' },
        { transform: 'translateY(0) scale(1)' },
      ], { duration: active.duration, easing: 'ease-out' }));
    }
    if (!reduced && active.kind === 'shuffle' && deck) animations.push(deck.animate([
      { transform: 'rotate(0)' }, { transform: 'translateY(-7px) rotate(7deg)' },
      { transform: 'translateY(-4px) rotate(-6deg)' }, { transform: 'rotate(0)' },
    ], { duration: active.duration, easing: 'ease-out' }));
    const timer = window.setTimeout(() => setQueue(previous => previous[0]?.id === active.id ? previous.slice(1) : previous), reduced ? 180 : active.duration);
    return () => { window.clearTimeout(timer); animations.forEach(animation => animation.cancel()); };
  }, [active, selfId, reduced]);

  const flying = active && ['draw', 'play', 'steal', 'attack'].includes(active.kind);
  const custom = flight && active ? {
    '--from-x': `${flight.from.x}px`, '--from-y': `${flight.from.y}px`,
    '--to-x': `${flight.to.x}px`, '--to-y': `${flight.to.y}px`, '--effect-ms': `${active.duration}ms`,
  } as CSSProperties : undefined;
  return <div ref={layer} className={`game-effects ${reduced ? 'effects-reduced' : ''}`} aria-hidden="true">
    {active && <div key={active.id} className={`game-effect effect-${active.kind}`} style={custom} data-effect-kind={active.kind} data-effect-seq={active.event.seq}>
      {flying && flight && <div className="effect-flight"><div className={`effect-flip ${active.card ? 'has-face' : ''} ${active.kind === 'play' || active.kind === 'attack' ? 'face-up' : ''}`}>
        <div className="effect-card-back"><CardBack/></div>{active.card && <div className="effect-card-front"><CardView card={active.card} lang={lang} compact/></div>}
      </div></div>}
      {active.kind === 'nope' && <div className="effect-nope">{lang === 'vi' ? 'KHÔNG' : 'NOPE'}</div>}
      {(active.kind === 'explosion' || active.kind === 'defuse') && <div className="effect-cat-scene"><div className="effect-cat">⌃ ◡ ⌃</div><span className="effect-puff">{active.kind === 'explosion' ? (lang === 'vi' ? 'bụp.' : 'pop.') : (lang === 'vi' ? 'xì.' : 'pfft.')}</span></div>}
      {active.kind === 'peek' && <div className="effect-peek">⌕</div>}
      {active.kind === 'revive' && <div className="effect-revive">⌃ ◡ ⌃</div>}
      <div className="effect-caption">{eventText(lang, active.event, players)}</div>
    </div>}
  </div>;
}
