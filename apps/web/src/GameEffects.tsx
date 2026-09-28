import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { CardBack, CardView } from './CardView';
import { describeEffects, type GameEffect } from './effectDescriptors';
import { eventText } from './eventText';
import type { GameEvent, Language, Player } from './types';
import './gameEffects.css';
import { cardDescription, cardName, t } from './i18n';

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
  const [notice, setNotice] = useState<GameEffect | null>(null);
  const seen = useRef(new Set<string>());
  const layer = useRef<HTMLDivElement>(null);
  const active = queue[0];

  useEffect(() => {
    if (!events.length || document.hidden) { seen.current.clear(); setQueue([]); setNotice(null); return; }
    const effects = describeEffects(events.filter(event => event.gameId === gameId), selfId).filter(effect => effect.kind !== 'toss');
    const fresh = effects.filter(effect => !seen.current.has(effect.id));
    const played = fresh.filter(effect => ['play','nope','defuse'].includes(effect.kind)).at(-1);
    if (played?.card) setNotice(played);
    for (const effect of fresh) seen.current.add(effect.id);
    if (fresh.length) setQueue(previous => [...previous, ...fresh].slice(-8));
    if (seen.current.size > 200) seen.current = new Set(effects.map(effect => effect.id));
  }, [events, gameId, selfId]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4800);
    return () => window.clearTimeout(timer);
  }, [notice]);
  useEffect(() => { setNotice(null); }, [gameId]);

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
    const timer = window.setTimeout(() => setQueue(previous => previous[0]?.id === active.id ? previous.slice(1) : previous), reduced ? 180 : active.duration);
    return () => { window.clearTimeout(timer); animations.forEach(animation => animation.cancel()); };
  }, [active, selfId, reduced]);

  const flying = active && ['draw', 'play', 'steal', 'attack'].includes(active.kind);
  const custom = flight && active ? {
    '--from-x': `${flight.from.x}px`, '--from-y': `${flight.from.y}px`,
    '--to-x': `${flight.to.x}px`, '--to-y': `${flight.to.y}px`, '--effect-ms': `${active.duration}ms`,
  } as CSSProperties : undefined;
  const playKind = notice?.event.params?.playKind;
  const noticeBody = playKind === 'PAIR' ? t(lang, 'comboPair') : playKind === 'TRIPLE' ? t(lang, 'comboTriple') : notice?.card ? cardDescription(lang, notice.card.type) : '';
  return <><div ref={layer} className={`game-effects ${reduced ? 'effects-reduced' : ''}`} aria-hidden="true">
    {active && <div key={active.id} className={`game-effect effect-${active.kind}`} style={custom} data-effect-kind={active.kind} data-effect-seq={active.event.seq}>
      {flying && flight && <div className="effect-flight"><div className={`effect-flip ${active.card ? 'has-face' : ''} ${active.kind === 'play' || active.kind === 'attack' ? 'face-up' : ''}`}>
        <div className="effect-card-back"><CardBack/></div>{active.card && <div className="effect-card-front"><CardView card={active.card} lang={lang} compact/></div>}
      </div></div>}
      {active.kind === 'nope' && <div className="nope-stopper">{lang === 'vi' ? 'KHÔNG' : 'NOPE'}</div>}
      {active.kind === 'shuffle' && flight && <div className="shuffle-packets" data-shuffle-animation><div className="shuffle-packet packet-left"><CardBack/></div><div className="shuffle-packet packet-right"><CardBack/></div><span>↝</span></div>}
      {(active.kind === 'explosion' || active.kind === 'defuse') && <div className="effect-cat-scene"><span className="comic-burst"/><div className="effect-cat">{active.card && <CardView card={active.card} lang={lang} compact/>}</div><span className="comic-letter">{active.kind === 'explosion' ? 'BOOM!' : 'PFFT…'}</span><span className="effect-puff">{t(lang, active.kind === 'explosion' ? 'fx.boom' : 'fx.defuse')}</span></div>}
      {active.kind === 'eliminate' && <div className={`elimination-scene ${active.playerId === selfId ? 'is-self' : ''}`} data-eliminated-effect={active.playerId}><span className="ko-cat">× ω ×</span><strong>K.O.</strong><p>{t(lang, 'fx.eliminated')}</p></div>}
      {active.kind === 'start' && <div className="deal-scene">{Array.from({length:7},(_,i)=><div key={i} className="deal-fan-card" style={{'--fan-index':i} as CSSProperties}><CardBack/></div>)}<strong>{t(lang, 'fx.start')}</strong></div>}
      {active.kind === 'win' && <div className="winner-sticker"><span>♛</span><strong>{t(lang, 'fx.win')}</strong></div>}
      {active.kind === 'peek' && <div className="effect-peek">⌕</div>}
      {active.kind === 'revive' && <div className="effect-revive">⌃ ◡ ⌃</div>}
      <div className="effect-caption">{eventText(lang, active.event, players)}</div>
    </div>}
  </div>{notice?.card && <aside className="function-notice" role="status" key={notice.id} data-function-notice={notice.card.type}><span className="function-notice-symbol" aria-hidden="true">{playKind === 'PAIR' ? '2' : playKind === 'TRIPLE' ? '3' : '✦'}</span><div><small>{players.find(player => player.id === notice.playerId)?.name ?? ''} · {lang === 'vi' ? 'ĐÁNH BÀI' : 'PLAYED'}</small><strong>{cardName(lang, notice.card.type)}{playKind === 'PAIR' ? ' × 2' : playKind === 'TRIPLE' ? ' × 3' : ''}</strong><p>{noticeBody}{playKind === 'PLUS_PLUS' ? ' (+1)' : ''} {notice.kind !== 'defuse' && (lang === 'vi' ? 'Có thể bị chặn bởi Nope.' : 'Can be blocked by Nope.')}</p></div></aside>}</>;
}
