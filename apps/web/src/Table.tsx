import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { CardBack, CardView } from './CardView';
import { PlayerPortrait } from './PlayerPortrait';
import { CARD_TYPES, cardName, t } from './i18n';
import { inspectPlay } from '@kittens/shared/play-policy';
import { phaseDurationMs } from '@kittens/shared';
import { selectHandCard, secondsRemaining, suggestPlay } from './playAssist';
import { AutoControls, PhaseCoach, QuickGuide, coach } from './PlayCoach';
import { useAutoPlay } from './useAutoPlay';
import { PUBLIC_INSERT_MS, publicInsertionOf, type PublicInsertion } from './effectDescriptors';
import type { ArtStyle, Card, CardType, GameAction, GameEvent, Language, PrivateGame, PublicGame, Room } from './types';

type TableProps = {
  lang: Language; room: Room; game: { public: PublicGame; private: PrivateGame | null };
  online: boolean; clockOffsetMs: number; selfId?: string; liveEvents: GameEvent[]; busy: boolean;
  action: (action: GameAction) => Promise<boolean>; reduced: boolean;
};
const EMPTY_HAND: Card[] = [];

function AvatarTimer({ seconds, progress, lang }: { seconds: number; progress: number; lang: Language }) {
  return <span className={`avatar-timer ${seconds <= 5 ? 'urgent' : seconds <= 10 ? 'warning' : ''}`} role="timer" aria-live="off" aria-label={lang === 'vi' ? `Còn ${seconds} giây` : `${seconds} seconds left`} data-remaining={seconds}>
    <svg viewBox="0 0 48 48" aria-hidden="true"><circle className="timer-track" cx="24" cy="24" r="21"/><circle className="timer-arc" cx="24" cy="24" r="21" pathLength="100" strokeDasharray="100" strokeDashoffset={100 * (1 - progress)}/></svg><span className="countdown avatar-countdown" aria-hidden="true">{seconds}s</span>
  </span>;
}

function Avatar({ playerId, lang, name, count, active, alive, connected, self, style, index, seconds, progress }: { playerId: string; lang: Language; name: string; count: number; active: boolean; alive: boolean; connected: boolean; self: boolean; style: ArtStyle; index: number; seconds: number; progress: number }) {
  const label = lang === 'vi' ? `${name}, ${count} lá, ${alive ? 'đang sống' : 'đã bị loại'}, ${connected ? 'đã kết nối' : 'mất kết nối'}` : `${name}, ${count} cards, ${alive ? 'alive' : 'eliminated'}, ${connected ? 'connected' : 'disconnected'}`;
  return <div data-player-id={playerId} className={`seat seat-${index} ${active ? 'active' : ''} ${!alive ? 'dead' : ''} ${!connected ? 'disconnected' : ''}`} aria-label={label}>
    <div className={`seat-face style-${style}`}><PlayerPortrait id={playerId} alive={alive}/>{active && <AvatarTimer seconds={seconds} progress={progress} lang={lang}/>}</div>
    <span className="seat-name">{name}{self ? ' · ●' : ''}</span><span className="seat-count">{count} <span aria-hidden="true">▰</span></span>
  </div>;
}

function InsertScene({ lang, name, own, slotCount, action, busy, zone, reduced }: {
  lang: Language; name: string; own: boolean; slotCount?: number; action: (action: GameAction) => Promise<boolean>; busy: boolean;
  zone?: 'TOP' | 'BOTTOM' | 'MIDDLE_HIDDEN'; reduced: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [dragging, setDragging] = useState(false);
  const slots = Math.max(1, slotCount ?? 1);
  const max = slots - 1;
  useEffect(() => { setIndex(0); }, [slotCount]);
  const updateFromPoint = (clientY: number, element: HTMLElement) => {
    const box = element.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientY - box.top) / Math.max(1, box.height)));
    setIndex(Math.round(ratio * max));
  };
  const position = index === 0 ? t(lang, 'insertTop') : index === max ? t(lang, 'insertBottom') : t(lang, 'insertMiddle');
  return <div className={`insert-overlay ${reduced ? 'no-motion' : ''}`} role="dialog" aria-modal="false" aria-labelledby="insert-title">
    <div className="insert-header"><span className="eyebrow">{lang === 'vi' ? 'BỘ BÀI ĐANG CÓ VẤN ĐỀ' : 'THE DECK HAS A PROBLEM'}</span><h2 id="insert-title">{zone ? zone === 'TOP' ? t(lang, 'insertTopPublic') : zone === 'BOTTOM' ? t(lang, 'insertBottomPublic') : t(lang, 'insertMiddlePublic') : t(lang, 'insertTitle')}</h2><p>{zone ? '' : t(lang, 'insertSubtitle', { name })}</p></div>
    <div className={`insert-stage ${own ? 'is-own' : ''} ${zone ? `zone-${zone.toLowerCase()}` : ''}`}>
      <div className="insert-kitten" aria-hidden="true"><span>!</span><small>{cardName(lang, 'EXPLODING_KITTEN')}</small></div>
      <div className="insert-deck-wrap">
        <div className="insert-deck" aria-label={t(lang, 'deck')} onPointerDown={event => { if (!own || zone) return; event.currentTarget.setPointerCapture(event.pointerId); setDragging(true); updateFromPoint(event.clientY, event.currentTarget); }} onPointerMove={event => { if (dragging && own) updateFromPoint(event.clientY, event.currentTarget); }} onPointerUp={() => setDragging(false)} onPointerCancel={() => setDragging(false)}>
          <span className="insert-deck-top">0</span><span className="insert-deck-pattern" aria-hidden="true">◡</span><span className="insert-deck-bottom">{own ? max : '·'}</span>
          {own && !zone && <span className="insert-marker" style={{ top: `${max === 0 ? 0 : index / max * 100}%` }} aria-hidden="true"/>}
          {zone && <span className="public-insert-card" aria-hidden="true"/>}
        </div>
      </div>
      {own && !zone && <div className="insert-control"><p>{t(lang, 'insertActor')}</p><div className="insert-stepper"><button type="button" className="button button-outline" disabled={index === 0} onClick={() => setIndex(Math.max(0, index - 1))} aria-label={t(lang, 'insertUp')}>↑</button><strong>{position} <small>{t(lang, 'insertSlot', { index, count: max })}</small></strong><button type="button" className="button button-outline" disabled={index === max} onClick={() => setIndex(Math.min(max, index + 1))} aria-label={t(lang, 'insertDown')}>↓</button></div>
        <div className="insert-slots" role="group" aria-label={lang === 'vi' ? 'Tất cả khe chèn' : 'All insert slots'} onKeyDown={event => { if (event.key === 'ArrowUp') { event.preventDefault(); setIndex(Math.max(0, index - 1)); } if (event.key === 'ArrowDown') { event.preventDefault(); setIndex(Math.min(max, index + 1)); } }}>
          {Array.from({ length: slots }, (_, slot) => <button key={slot} type="button" className={slot === index ? 'active' : ''} aria-pressed={slot === index} onClick={() => setIndex(slot)}>{slot === 0 ? t(lang, 'insertTop') : slot === max ? t(lang, 'insertBottom') : String(slot)}</button>)}
        </div><button type="button" className="button button-primary insert-submit" disabled={busy} onClick={() => void action({ type: 'DEFUSE_POSITION', index })}>{t(lang, 'insertConfirm')} · {position}</button></div>}
      {!own && !zone && <p className="insert-observer-note">{t(lang, 'insertObserver')}</p>}
    </div>
  </div>;
}

function PrivateInsight({ lang, future, peek, players }: { lang: Language; future?: Card[]; peek?: { targetId: string; cards: Card[] }; players: PublicGame['players'] }) {
  const signature = `${future?.map(card => card.instanceId).join(',') ?? ''}|${peek?.cards.map(card => card.instanceId).join(',') ?? ''}`;
  const [dismissed, setDismissed] = useState('');
  if (!signature || signature === '|' || dismissed === signature) return null;
  const cards = peek?.cards ?? future ?? [];
  const title = peek ? `${t(lang, 'peek')} · ${players.find(player => player.id === peek.targetId)?.name ?? ''}` : t(lang, 'future');
  return <aside className="private-insight" aria-label={title}><div className="insight-header"><div><span className="eyebrow">{t(lang, 'privateView')}</span><h3>{title}</h3></div><button className="icon-button" type="button" onClick={() => setDismissed(signature)} aria-label={t(lang, 'close')}>×</button></div><div className="insight-cards">{cards.length ? cards.map(card => <CardView key={card.instanceId} card={card} lang={lang} compact/>) : <span>∅</span>}</div><button className="text-button" type="button" onClick={() => setDismissed(signature)}>{t(lang, 'revealDone')}</button></aside>;
}

export function Table({ lang, room, game, selfId, liveEvents, busy, action, reduced, online, clockOffsetMs }: TableProps) {
  const pub = game.public;
  const mine = game.private;
  const hand = mine?.hand ?? EMPTY_HAND;
  const selfPlayer = pub.players.find(player => player.id === selfId);
  const selfIndex = pub.players.findIndex(player => player.id === selfId);
  const opponents = selfIndex < 0 ? pub.players : [...pub.players.slice(selfIndex + 1), ...pub.players.slice(0, selfIndex)];
  const pending = pub.pending;
  const ownTurn = !!selfId && pub.currentPlayerId === selfId && !!selfPlayer?.alive;
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 250); return () => window.clearInterval(timer); }, []);
  const seconds = secondsRemaining(pub.deadlineAt, now, clockOffsetMs);
  const duration = phaseDurationMs(pub.phase);
  const timerProgress = duration ? Math.max(0, Math.min(1, ((pub.deadlineAt ?? now) - now - clockOffsetMs) / duration)) : 0;
  const activeControls = online && !busy && seconds > 0;
  const canPlay = ownTurn && pub.phase === 'TURN' && activeControls;
  const auto = useAutoPlay(pub, mine, selfId, seconds, online, busy, action);
  const [selected, setSelected] = useState<string[]>([]);
  const [sorted, setSorted] = useState(false);
  const [targetId, setTargetId] = useState('');
  const [requestedType, setRequestedType] = useState<CardType>('DEFUSE');
  const [localMessage, setLocalMessage] = useState('');
  const [passedNope, setPassedNope] = useState<number | null>(null);
  const [insertion, setInsertion] = useState<PublicInsertion | null>(null);
  const lastInsertSeq = useRef(0);
  const selectedCards = hand.filter(card => selected.includes(card.instanceId));
  const nopecard = hand.find(card => card.type === 'NOPE');
  const discardTop = pub.discardPile.at(-1);
  const isSpectator = !mine || !selfPlayer || !selfPlayer.alive;
  const currentName = pub.players.find(player => player.id === pub.currentPlayerId)?.name ?? '—';

  useEffect(() => { setSelected(previous => previous.filter(id => hand.some(card => card.instanceId === id))); }, [hand]);
  useEffect(() => { setPassedNope(null); }, [pub.phase, pending?.nopeCount]);
  useEffect(() => { setSelected([]); setTargetId(''); setLocalMessage(''); }, [pub.gameId, pub.turnId, pub.phase]);
  useEffect(() => {
    if (!liveEvents.length) { setInsertion(null); lastInsertSeq.current = 0; return; }
    const event = [...liveEvents].reverse().find(item => item.key === 'defuse.inserted' && item.seq > lastInsertSeq.current && item.gameId === pub.gameId);
    if (!event) return;
    lastInsertSeq.current = event.seq;
    setInsertion(publicInsertionOf(event));
  }, [liveEvents, pub.gameId]);
  useEffect(() => {
    if (!insertion) return;
    const id = window.setTimeout(() => setInsertion(null), reduced ? 180 : PUBLIC_INSERT_MS);
    return () => window.clearTimeout(id);
  }, [insertion, reduced]);

  const inspection = inspectPlay(selectedCards);
  const mode = inspection.valid ? inspection.kind : 'SINGLE';
  const playShape = inspection.valid ? inspection.kind : 'INVALID';
  const needsTarget = inspection.valid && inspection.target !== 'NONE';
  const targetChoices = pub.players.filter(player => inspection.valid && (inspection.target === 'ELIMINATED' ? !player.alive : player.alive && player.id !== selfId));
  const targetValid = !needsTarget || targetChoices.some(player => player.id === targetId);
  const playValid = inspection.valid && targetValid;
  const suggestion = mine && ownTurn && pub.phase === 'TURN' ? suggestPlay(pub, mine, selfId!) : null;
  const composeHint = !selectedCards.length ? (lang === 'vi' ? 'Chạm lá để chọn · chọn 2–3 lá cùng tên để ghép.' : 'Tap cards · select 2–3 matching cards for a combo.')
    : !inspection.valid ? (lang === 'vi' ? 'Chọn thêm lá cùng tên để ghép cặp / bộ ba; Cứu nổ tự dùng, Nope dùng khi chặn.' : 'Select matching cards for a pair / triple; Defuse is automatic, Nope is a response.')
    : needsTarget && !targetChoices.length ? coach(lang, 'noTarget') : !targetValid ? `${coach(lang, 'missingTarget')} · ${lang === 'vi' ? 'Chạm người chơi phía trên.' : 'Tap a player above.'}` : coach(lang, 'confirm');
  const choicePhase = ['FAVOR_CHOICE', 'HIP_BAT_DISCARD', 'BATTLE_HAMSTER_DISCARD'].includes(pub.phase);
  const mustChooseCard = choicePhase && pending?.targetPlayerId === selfId;
  const archaeology = pub.phase === 'ARCHAEOLOGY_CHOICE' && pending?.sourcePlayerId === selfId;
  const hipCat = pub.phase === 'HIP_CAT_CHOICE' && (pending?.sourcePlayerId === selfId || pending?.targetPlayerId === selfId);
  const noChoice = pub.phase === 'NOPE_WINDOW' && !!selfPlayer?.alive;

  function toggleCard(card: Card) {
    if (auto.mode !== 'OFF') auto.setMode('OFF');
    setLocalMessage('');
    if (noChoice) {
      if (card.type === 'NOPE' && activeControls) void action({ type: 'NOPE', cardId: card.instanceId });
      return;
    }
    setSelected(previous => selectHandCard(previous, card, hand, mustChooseCard));
    setTargetId('');
  }
  async function playSelected() {
    if (!playValid || !canPlay) { setLocalMessage(composeHint); return; }
    const result = await action({ type: 'PLAY_CARD', cardIds: selected, ...(needsTarget ? { targetId } : {}), ...(playShape === 'TRIPLE' ? { requestedType } : {}) });
    if (result) { setSelected([]); setTargetId(''); setLocalMessage(''); }
  }
  const publicInsertion = pub.phase === 'DEFUSE_INSERT' ? null : insertion;
  const insertionEvent = [...(pub.log ?? [])].reverse().find(event => event.key === 'defuse.inserted');
  const receipt = insertionEvent && !(pub.log ?? []).some(event => event.seq > insertionEvent.seq && ['card.drawn','card.played'].includes(event.key))
    ? publicInsertionOf(insertionEvent) : null;
  const scene = pub.phase === 'DEFUSE_INSERT' || publicInsertion;
  const sceneActor = pub.phase === 'DEFUSE_INSERT' && pending?.sourcePlayerId === selfId;
  const sceneName = pub.players.find(player => player.id === (publicInsertion?.playerId ?? pending?.sourcePlayerId))?.name ?? '—';

  const displayHand = sorted ? [...hand].sort((a, b) => CARD_TYPES.indexOf(a.type) - CARD_TYPES.indexOf(b.type)) : hand;
  const responseId = choicePhase ? pending?.targetPlayerId : pub.phase === 'TURN' ? pub.currentPlayerId : pending?.sourcePlayerId;
  const responseName = pub.players.find(player => player.id === responseId)?.name ?? currentName;
  const myResponse = pub.phase === 'NOPE_WINDOW' ? !!selfPlayer?.alive : responseId === selfId || hipCat;
  const isTiming = (id: string) => pub.phase !== 'FINISHED' && !!pub.players.find(player => player.id === id)?.alive && (pub.phase === 'NOPE_WINDOW' ? !pending?.passedPlayerIds?.includes(id) : pub.phase === 'HIP_CAT_CHOICE' ? (id === pending?.sourcePlayerId || id === pending?.targetPlayerId) && (id !== selfId || !mine?.privateData.hipCatChoice) : id === responseId);

  return <main className={`table-layout ${myResponse ? 'my-turn' : ''} ${pub.players.some(player => player.id === selfId && !player.alive) ? 'is-eliminated' : ''}`}><section className="game-area">
    <div className="table-status"><div><span className="eyebrow">{t(lang, 'room')} #{room.code}</span><h1 role="status">{pub.phase === 'TURN' ? ownTurn ? t(lang, 'yourTurn') : t(lang, 'playerTurn', { name: currentName }) : pub.phase === 'NOPE_WINDOW' ? t(lang, 'nopeWindow') : myResponse ? coach(lang, 'yourChoice') : coach(lang, 'waitingFor', { name: responseName })}</h1>{pub.turnsRemaining > 1 && <span className="debt-label">{t(lang, 'turnDebt', { count: pub.turnsRemaining })}</span>}</div></div>
    {receipt && <div className="insertion-receipt" role="status" data-public-insertion={receipt.zone}>{t(lang,receipt.zone==='TOP'?'insertTopPublic':receipt.zone==='BOTTOM'?'insertBottomPublic':'insertMiddlePublic')}</div>}
    <PhaseCoach lang={lang} game={pub} selfId={isSpectator ? undefined : selfId} seconds={seconds}/><div className="table-arena" data-seats={opponents.length}><div className="opponents-row">{opponents.map((player, index) => <button type="button" key={player.id} className={`seat-target ${needsTarget && targetChoices.some(p => p.id === player.id) ? 'can-target' : ''}`} aria-label={lang === 'vi' ? `Chọn ${player.name}` : `Choose ${player.name}`} aria-pressed={targetId === player.id} disabled={!canPlay || !needsTarget || !targetChoices.some(p => p.id === player.id)} onClick={() => setTargetId(player.id)}><Avatar playerId={player.id} lang={lang} name={player.name} count={player.handCount ?? 0} alive={!!player.alive} active={isTiming(player.id)} connected={room.players.find(item => item.id === player.id)?.connected ?? false} self={false} style={(['pen', 'stamp', 'pixel', 'geometry'] as ArtStyle[])[index % 4]!} index={index} seconds={seconds} progress={timerProgress}/>{responseId === player.id && <span className="seat-turn-label">{lang === 'vi' ? 'ĐANG CHƠI' : 'PLAYING'}</span>}</button>)}</div>
    <div className="table-felt"><div className="table-deck-zone"><div data-deck className="deck-holder"><CardBack count={pub.drawCount} label={t(lang, 'deck')}/><span>{t(lang, 'deck')}</span></div><div data-discard className="discard-holder">{discardTop ? <CardView card={discardTop} lang={lang} compact/> : <div className="empty-discard">∅</div>}<span>{t(lang, 'discard')}</span></div></div>
      {!scene && pub.phase === 'NOPE_WINDOW' && <div className="nope-callout" role="status"><strong>{lang === 'vi' ? 'Ai Nope không?' : 'Anyone want to Nope?'}</strong><span>{lang === 'vi' ? `Còn ${seconds} giây để chặn` : `${seconds}s to block`}</span></div>}
      {!scene && pub.phase !== 'NOPE_WINDOW' && <div className="table-message" aria-live="polite">{pub.phase === 'TURN' ? t(lang, 'drawHint') : pub.phase === 'FINISHED' ? t(lang, 'results') : t(lang, 'waiting')}</div>}
    </div></div>
    <details className="table-assist-menu"><summary aria-label={lang === 'vi' ? 'Trợ giúp & tự chơi' : 'Help & autoplay'} title={lang === 'vi' ? 'Trợ giúp & tự chơi' : 'Help & autoplay'}><span aria-hidden="true">?</span><span className="assist-menu-label">{lang === 'vi' ? 'Trợ giúp & tự chơi' : 'Help & autoplay'}</span></summary><div className="table-assist-panel"><QuickGuide lang={lang}/>{!isSpectator && <AutoControls lang={lang} mode={auto.mode} onChange={auto.setMode} queued={auto.queued}/>} {suggestion && <div className="suggestion-bar"><p><strong>{coach(lang, 'hint')}:</strong> {coach(lang, suggestion.reason)}</p>{suggestion.cardIds.length > 0 && <button type="button" className="button button-outline" disabled={!activeControls} onClick={() => { auto.setMode('OFF'); setSelected(suggestion.cardIds); setTargetId(''); }}>{coach(lang, 'applyHint')}</button>}</div>}</div></details>
    <div data-hand className="hand-area"><div className="hand-heading"><div className="hand-identity">{selfPlayer && <div className="self-avatar"><Avatar playerId={selfPlayer.id} lang={lang} name={selfPlayer.name} count={hand.length} active={isTiming(selfPlayer.id)} alive={!!selfPlayer.alive} connected={online} self style="pen" index={0} seconds={seconds} progress={timerProgress}/></div>}<h2>{isSpectator ? t(lang, 'spectator') : `${selfPlayer?.name ?? ''} · ${t(lang, 'yourHand')}`} <span>{hand.length}</span>{ownTurn && <small className="self-turn-label">{t(lang, 'yourTurn')}</small>}</h2></div><div className="hand-heading-actions">{selected.length > 0 && <button className="text-button" type="button" onClick={() => { setSelected([]); setTargetId(''); }}>{t(lang, 'clearSelection')}</button>}<button className="text-button" type="button" aria-pressed={sorted} onClick={() => setSorted(value => !value)}>{lang === 'vi' ? 'Xếp bài' : 'Sort cards'}</button></div></div><div className="hand-scroll" style={{'--hand-count': hand.length} as CSSProperties} aria-label={t(lang, 'yourHand')}>{isSpectator ? <p className="spectator-note">{t(lang, 'spectatorHint')}</p> : hand.length ? displayHand.map(card => <CardView key={card.instanceId} card={card} lang={lang} selected={selected.includes(card.instanceId)} onClick={() => toggleCard(card)} disabled={!activeControls || !(canPlay || mustChooseCard || noChoice && card.type === 'NOPE')} selectable={canPlay && card.type !== 'EXPLODING_KITTEN' || mustChooseCard || noChoice && card.type === 'NOPE'} className="hand-card"/>) : <p className="empty-hand">{lang === 'vi' ? 'Không còn lá nào. Đáng ngờ.' : 'No cards. Suspicious.'}</p>}</div></div>
    <div className="action-area" aria-live="polite">
      {ownTurn && pub.phase === 'TURN' && selectedCards.length > 0 && <div className="play-preview"><strong>{coach(lang, mode)} · {selectedCards.map(card => cardName(lang, card.type)).join(' + ')}</strong><p>{playShape === 'PAIR' ? t(lang, 'comboPair') : playShape === 'TRIPLE' ? `${t(lang, 'comboTriple')} · ${cardName(lang, requestedType)}` : playShape === 'PLUS_PLUS' ? coach(lang, 'plus') : ''}{targetValid && needsTarget ? ` → ${targetChoices.find(player => player.id === targetId)?.name ?? ''}` : ''}</p></div>}
      {pub.phase === 'TURN' && <div className="turn-composer"><p className="compose-hint" role="status">{ownTurn ? composeHint : coach(lang, 'waitingFor', { name: currentName })}</p>
      {ownTurn && playShape === 'TRIPLE' && <label className="requested-picker"><span>{coach(lang, 'requested')}</span><select aria-label={coach(lang, 'requested')} title={coach(lang, 'requested')} value={requestedType} disabled={!activeControls} onChange={event => setRequestedType(event.currentTarget.value as CardType)}>{CARD_TYPES.filter(type => type !== 'EXPLODING_KITTEN' && (room.options.mode === 'EXTENDED' || !['AMATEUR_ARCHAEOLOGY','BATTLE_HAMSTER','CREEPY_PEEKY','HIP_BAT','HIP_CAT','PLUS_PLUS','ROBIN_HOOD','THE_TWINS'].includes(type)) && (room.options.resurrection || type !== 'RESURRECTION')).map(type => <option key={type} value={type}>{cardName(lang, type)}</option>)}</select></label>}
      <div className="turn-actions"><button type="button" className="button button-dark play-submit" disabled={!canPlay || !playValid} onClick={() => void playSelected()}>{t(lang, 'playSelected')} {selected.length ? `(${selected.length})` : ''}</button><button type="button" className="button button-primary draw-button" disabled={!canPlay} onClick={() => void action({ type: 'DRAW_CARD' })}>{t(lang, 'draw')} <span aria-hidden="true">↗</span></button></div></div>}
      {pub.phase === 'NOPE_WINDOW' && <div className="choice-bar"><div><strong>{t(lang, 'nopeWindow')}</strong><p>{t(lang, 'nopeHint')}</p></div>{noChoice && <div className="choice-buttons">{nopecard && <button type="button" className="button button-danger" disabled={!activeControls} onClick={() => nopecard && void action({ type: 'NOPE', cardId: nopecard.instanceId })}>{t(lang, 'nope')}</button>}<button type="button" className="button button-outline" disabled={!activeControls || pending?.passedPlayerIds?.includes(selfId!) || passedNope === pending?.nopeCount} onClick={async () => { if (await action({ type: 'PASS_NOPE' })) setPassedNope(pending?.nopeCount ?? 0); }}>{t(lang, 'pass')}</button>{pending?.passedPlayerIds?.includes(selfId!) && <small>{coach(lang, 'passed')}</small>}</div>}</div>}
      {mustChooseCard && <div className="choice-bar"><div><strong>{coach(lang, pub.phase)}</strong><p>{pub.phase === 'BATTLE_HAMSTER_DISCARD' ? coach(lang, 'hamster', { n: Math.max(0, hand.length - 1) }) : coach(lang, 'chooseOne')}</p></div><div className="choice-buttons"><span className="choice-selected">{selectedCards[0] ? `${coach(lang, 'selected')}: ${cardName(lang, selectedCards[0].type)}` : coach(lang, 'choose')}</span><button type="button" className="button button-primary" disabled={!selected[0] || !activeControls} onClick={async () => { if (await action({ type: 'CHOOSE_CARD', cardId: selected[0]! })) setSelected([]); }}>{t(lang, 'confirm')}</button></div></div>}
      {archaeology && <div className="choice-bar archaeology-choice"><div><strong>{cardName(lang, 'AMATEUR_ARCHAEOLOGY')}</strong><p>{t(lang, 'rule.AMATEUR_ARCHAEOLOGY')}</p></div><div className="discard-choices">{mine?.privateData.discardChoices?.map(card => <button type="button" key={card.instanceId} disabled={!activeControls} onClick={() => void action({ type: 'CHOOSE_CARD', cardId: card.instanceId })}>{cardName(lang, card.type)}</button>)}</div></div>}
      {hipCat && <div className="choice-bar"><div><strong>{t(lang, 'hipCatChoice')}</strong><p>{t(lang, 'hipCatHint')}</p></div>{mine?.privateData.hipCatChoice ? <span className="quiet-note">{t(lang, mine.privateData.hipCatChoice.toLowerCase())} ✓</span> : <div className="choice-buttons">{(['ROCK', 'PAPER', 'SCISSORS'] as const).map(choice => <button key={choice} type="button" className="button button-outline" disabled={!activeControls} onClick={() => void action({ type: 'HIP_CAT_CHOICE', choice })}>{t(lang, choice.toLowerCase())}</button>)}</div>}</div>}
      {localMessage && <p className="inline-error" role="alert">{localMessage}</p>}
    </div>
    <PrivateInsight lang={lang} future={mine?.privateData.futureCards} peek={mine?.privateData.peekHand} players={pub.players}/>
    {scene && <InsertScene key={publicInsertion?.seq ?? pub.turnId} lang={lang} name={sceneName} own={!!sceneActor} slotCount={sceneActor ? mine?.privateData.insertSlotCount : undefined} action={action} busy={!activeControls} zone={publicInsertion?.zone} reduced={reduced}/>}
    {pub.players.some(player => player.id === selfId && !player.alive) && <div className="dead-player-note"><strong>{t(lang, 'fx.eliminated')}</strong><span>{t(lang, 'fx.deadHint')}</span></div>}
  </section></main>;
}
