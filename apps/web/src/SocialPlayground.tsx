import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { PropIcon, type ThrowProp } from './FunProps';
import { eventText } from './eventText';
import { t } from './i18n';
import type { Ack, GameEvent, Language, Player } from './types';

const props: ThrowProp[] = ['EGG', 'BOMB', 'ROCK'];
export function SocialToolbar({ players, selfId, lang, online, send }: { players: Player[]; selfId?: string; lang: Language; online: boolean; send: (targetId: string, prop: ThrowProp) => Promise<Ack<Record<string, unknown>>> }) {
  const [targetId, setTarget] = useState('');
  const [pending, setPending] = useState(false);
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState('');
  const target = players.some(player => player.id === targetId) ? targetId : players.find(player => player.id !== selfId)?.id ?? players[0]?.id;
  useEffect(() => { if (until <= Date.now()) return; const timer = window.setInterval(() => setNow(Date.now()), 100); return () => window.clearInterval(timer); }, [until]);
  const throwing = async (prop: ThrowProp) => {
    if (!target || pending || !online || Date.now() < until) return;
    setPending(true); setError('');
    try {
      const result = await send(target, prop);
      if (result.ok) { setUntil(Date.now() + 1500); setNow(Date.now()); }
      else setError(t(lang, `error.${result.error.code}`));
    } catch { setError(t(lang, 'errorConnection')); }
    finally { setPending(false); }
  };
  return <section className="social-toolbar" aria-label={t(lang, 'social.title')}><div className="social-heading"><strong>{t(lang, 'social.title')}</strong><small>{t(lang, 'social.hint')}</small></div><label className="social-target">{t(lang, 'social.target')}<select value={target ?? ''} onChange={event => setTarget(event.target.value)} disabled={!online || !players.length}>{players.map(player => <option key={player.id} value={player.id}>{player.name}</option>)}</select></label><div className="social-buttons">{props.map(prop => <button key={prop} data-throw-prop={prop} disabled={!online || !target || pending || until > now} onClick={() => void throwing(prop)}><PropIcon prop={prop}/><span>{t(lang, `social.${prop}`)}</span></button>)}</div><span className="social-status" role="status">{error || (pending ? t(lang, 'social.sending') : until > now ? t(lang, 'social.cooldown', { n: ((until - now) / 1000).toFixed(1) }) : '')}</span></section>;
}

export function SocialEffects({ events, lang, players, reduced }: { events: GameEvent[]; lang: Language; players: Player[]; reduced: boolean }) {
  const [queue, setQueue] = useState<GameEvent[]>([]);
  const [positions, setPositions] = useState<CSSProperties>();
  const lastSeq = useRef(0);
  const active = queue[0];
  useEffect(() => {
    if (!events.length || document.hidden) { setQueue([]); return; }
    const fresh = events.filter(event => event.seq > lastSeq.current && event.key === 'social.thrown' && event.visibility === 'PUBLIC' && props.includes(event.params?.prop as ThrowProp));
    lastSeq.current = Math.max(lastSeq.current, ...events.map(event => event.seq));
    if (fresh.length) setQueue(previous => [...previous, ...fresh].slice(-4));
  }, [events]);
  useEffect(() => {
    if (!active) return;
    const seat = (id: unknown, fallback: number) => {
      const element = [...document.querySelectorAll('[data-player-id]')].find(node => node.getAttribute('data-player-id') === id);
      const box = element?.getBoundingClientRect();
      return { x: Math.max(35, Math.min(window.innerWidth - 35, box ? box.left + box.width / 2 : window.innerWidth * fallback)), y: Math.max(70, Math.min(window.innerHeight - 80, box ? box.top + box.height / 2 : Math.min(window.innerHeight * .38, 260))) };
    };
    const from = seat(active.params?.sourceId, .2), to = seat(active.params?.targetId, .7);
    setPositions({ '--throw-from-x': `${from.x}px`, '--throw-from-y': `${from.y}px`, '--throw-to-x': `${to.x}px`, '--throw-to-y': `${to.y}px`, '--throw-mid-x': `${(from.x + to.x) / 2}px`, '--throw-mid-y': `${Math.max(25, Math.min(from.y, to.y) - 110)}px` } as CSSProperties);
    const timer = window.setTimeout(() => setQueue(previous => previous[0]?.seq === active.seq ? previous.slice(1) : previous), reduced ? 180 : 650);
    return () => window.clearTimeout(timer);
  }, [active, reduced]);
  const prop = active?.params?.prop as ThrowProp;
  return <div className={`social-effects ${reduced ? 'social-reduced' : ''}`} aria-hidden="true">{active && positions && <div key={active.seq} className={`social-effect throw-${prop.toLowerCase()}`} style={positions} data-social-effect={prop} data-effect-seq={active.seq}><div className="throw-flight"><PropIcon prop={prop}/></div><div className="throw-impact"><span className="impact-splat"/><span className="impact-face">{prop === 'EGG' ? '• ◡ •' : prop === 'BOMB' ? '⊙ ω ⊙' : '− _ −'}</span><strong>{t(lang, `social.caption.${prop}`)}</strong></div><div className="throw-caption">{eventText(lang, active, players)}</div></div>}</div>;
}
