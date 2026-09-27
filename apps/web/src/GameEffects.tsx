import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { CardBack, CardView } from './CardView';
import { describeEffects, type GameEffect } from './effectDescriptors';
import { eventText } from './eventText';
import type { GameEvent, Language, Player } from './types';
import './gameEffects.css';
import { ActionSticker } from './FunProps';
import { t } from './i18n';

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
    const effects = describeEffects(events.filter(event => event.gameId === gameId), selfId).filter(effect => effect.kind !== 'toss');
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
    const center = point(area.querySelector('[data-deck]'), bounds, { x: bounds.width / 2, y: bounds.height * 0.42 });
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
      {active.kind === 'nope' && <div className="nope-stopper">{lang === 'vi' ? 'KHÔNG' : 'NOPE'}</div>}
      {active.kind === 'play' && active.card && <ActionSticker type={active.card.type} lang={lang}/>}
      {(active.kind === 'explosion' || active.kind === 'defuse') && <div className="effect-cat-scene"><span className="comic-burst"/><div className="effect-cat">{active.card && <CardView card={active.card} lang={lang} compact/>}</div><span className="comic-letter">{active.kind === 'explosion' ? 'BOOM!' : 'PFFT…'}</span><span className="effect-puff">{t(lang, active.kind === 'explosion' ? 'fx.boom' : 'fx.defuse')}</span></div>}
      {active.kind === 'eliminate' && <div className={`elimination-scene ${active.playerId === selfId ? 'is-self' : ''}`} data-eliminated-effect={active.playerId}><span className="ko-cat">× ω ×</span><strong>K.O.</strong><p>{t(lang, 'fx.eliminated')}</p></div>}
      {active.kind === 'start' && <div className="deal-scene">{Array.from({length:7},(_,i)=><div key={i} className="deal-fan-card" style={{'--fan-index':i} as CSSProperties}><CardBack/></div>)}<strong>{t(lang, 'fx.start')}</strong></div>}
      {active.kind === 'win' && <div className="winner-sticker"><span>♛</span><strong>{t(lang, 'fx.win')}</strong></div>}
      {active.kind === 'peek' && <div className="effect-peek">⌕</div>}
      {active.kind === 'revive' && <div className="effect-revive">⌃ ◡ ⌃</div>}
      <div className="effect-caption">{eventText(lang, active.event, players)}</div>
    </div>}
  </div>;
}
