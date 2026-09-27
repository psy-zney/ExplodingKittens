import { useEffect, useRef, useState } from 'react';
import { calculateDeckScaling } from '@kittens/shared';
import { CardView } from './CardView';
import { DECK_PREVIEW_TYPES } from './cardPresentation';
import { cardName, EXPANSION_TYPES, t } from './i18n';
import type { Language, Room, RoomMode, ServerSnapshot } from './types';
import { useGameConnection } from './useGameConnection';
import { useAudio, type AudioSettings } from './useAudio';
import { Table } from './Table';
import { RoomSidebar } from './RoomSidebar';
import { eventText } from './eventText';
import { useModalFocus } from './useModalFocus';
import { LobbyLoading } from './LobbyLoading';
import { CardCodexModal } from './CardCodexModal';
import { TutorialModal } from './TutorialModal';
import { DefuseDraft } from './DefuseDraft';
import { SocialToolbar, SocialEffects } from './SocialPlayground';
import { GameEffects } from './GameEffects';
import { InteractionFeedback } from './InteractionFeedback';
import './playfulGame.css';

function storedChoice<T extends string>(key: string, fallback: T): T {
  return (localStorage.getItem(key) as T) || fallback;
}

function usePreference<T extends string>(key: string, fallback: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => storedChoice(key, fallback));
  useEffect(() => { localStorage.setItem(key, value); }, [key, value]);
  return [value, setValue];
}


function DeckPreview({ lang }: { lang: Language }) {
  return <div className="mixed-deck-preview"><div className="mixed-deck-cards" aria-hidden="true">{DECK_PREVIEW_TYPES.map(type => <CardView key={type} card={{ instanceId: `preview-${type}`, type }} lang={lang} compact/>)}</div><p><strong>{t(lang, 'mixedDeck')}</strong><span>{t(lang, 'mixedDeckNote')}</span></p></div>;
}

function RulePanel({ lang, room, onClose }: { lang: Language; room: Room | null; onClose: () => void }) {
  const modalRef = useModalFocus();
  const expanded = room?.options.mode === 'EXTENDED';
  const revival = !!room?.options.resurrection;
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={modalRef} className="modal rules-modal" role="dialog" aria-modal="true" aria-labelledby="rules-title">
      <header className="modal-header"><div><span className="eyebrow">{t(lang, 'room')}</span><h2 id="rules-title">{t(lang, 'rules')}</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label={t(lang, 'close')}>×</button></header>
      <div className="modal-scroll">
        <div className="rule-section"><span className="rule-tag">01 · {t(lang, 'original')}</span><p>{t(lang, 'rule.base')}</p><p>{t(lang, 'rule.combo')}</p></div>
        <div className="rule-section"><span className="rule-tag">02 · {t(lang, 'online')}</span><p>{t(lang, 'rule.online')}</p><p><strong>{t(lang, 'draft.house')}</strong><br/>{t(lang, 'draft.hint')}</p><p>{t(lang, 'rule.privacy')}</p></div>
        {expanded && <div className="rule-section"><span className="rule-tag">03 · {t(lang, 'house')}</span><p>{t(lang, 'rule.extro')}</p>
          <div className="expansion-rules">{EXPANSION_TYPES.map(type => <div key={type}><strong>{cardName(lang, type)}</strong><p>{t(lang, `rule.${type}`)}</p><details><summary>{t(lang, 'rule.contract')}</summary><p>{t(lang, `rule.detail.${type}`)}</p></details></div>)}</div>
        </div>}
        {revival && <div className="rule-section"><span className="rule-tag">04 · {t(lang, 'house')}</span><h3>{cardName(lang, 'RESURRECTION')}</h3><p>{t(lang, 'rule.RESURRECTION')}</p></div>}
      </div>
    </section>
  </div>;
}

function SettingsPanel({ lang, settings, setSettings, enabled, enable, reduced, setReduced, skip, setSkip, onClose }: {
  lang: Language; settings: AudioSettings;
  setSettings: (value: AudioSettings) => void; enabled: boolean; enable: () => Promise<void>;
  reduced: boolean; setReduced: (value: boolean) => void; skip: boolean; setSkip: (value: boolean) => void; onClose: () => void;
}) {
  const modalRef = useModalFocus();
  const slider = (key: 'master' | 'music' | 'sfx', label: string) => <label className="volume-row" key={key}><span>{label}</span><input type="range" min="0" max="1" step="0.01" value={settings[key]} onChange={event => setSettings({ ...settings, [key]: Number(event.currentTarget.value) })} aria-label={label}/><output>{Math.round(settings[key] * 100)}%</output></label>;
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={modalRef} className="modal settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <header className="modal-header"><div><span className="eyebrow">◡</span><h2 id="settings-title">{t(lang, 'settings')}</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label={t(lang, 'close')}>×</button></header>
      <div className="modal-scroll">
        <h3>{t(lang, 'audio')}</h3>
        {!enabled && <button type="button" className="button button-primary" onClick={() => void enable()}>{t(lang, 'enableAudio')}</button>}
        <label className="toggle-row"><span>{t(lang, settings.mute ? 'unmute' : 'mute')}</span><input type="checkbox" checked={settings.mute} onChange={event => setSettings({ ...settings, mute: event.currentTarget.checked })}/></label>
        {slider('master', t(lang, 'master'))}{slider('music', t(lang, 'music'))}{slider('sfx', t(lang, 'sfx'))}
        <h3>{lang === 'vi' ? 'Chuyển động' : 'Motion'}</h3>
        <label className="toggle-row"><span>{t(lang, 'reduceMotion')}</span><input type="checkbox" checked={reduced} onChange={event => setReduced(event.currentTarget.checked)}/></label>
        <label className="toggle-row"><span>{t(lang, 'skipAnimation')}</span><input type="checkbox" checked={skip} onChange={event => setSkip(event.currentTarget.checked)}/></label>
      </div>
    </section>
  </div>;
}

function Entry({ lang, connection, busy, createRoom, joinRoom, onOpenCodex }: {
  lang: Language; connection: string; busy: boolean;
  createRoom: (nickname: string, options: { mode: RoomMode; resurrection: boolean }) => Promise<boolean>;
  joinRoom: (nickname: string, code: string, watch?: boolean) => Promise<boolean>; onOpenCodex: () => void;
}) {
  const [name, setName] = useState(() => localStorage.getItem('kittens.nickname') || '');
  const [code, setCode] = useState(() => new URLSearchParams(window.location.search).get('room') || '');
  const [mode, setMode] = useState<RoomMode>('BASE');
  const [resurrection, setResurrection] = useState(false);
  const valid = name.trim().length >= 1 && connection === 'connected' && !busy;
  return <main className={`entry-layout lang-${lang}`}>
    <section className="entry-intro"><div className="entry-mark entry-mark-gif" aria-hidden="true"><img src={import.meta.env.BASE_URL+'cat-ok.gif'} alt="Cat Mascot" className="cat-mascot-gif" /></div><span className="eyebrow">01 / {lang === 'vi' ? 'BÀN BÀI' : 'THE TABLE'}</span><h1>{t(lang, 'brand')}<span className="title-dot">.</span></h1><p>{t(lang, 'tagline')}</p><div className="entry-aside">{lang === 'vi' ? 'Một con mèo trông có vẻ đã đọc luật. Không ai tin nó.' : 'One cat appears to have read the rules. Nobody believes it.'}</div></section>
    <section className="entry-form-panel" aria-label={t(lang, 'playNow')}>
      <label className="field"><span>{t(lang, 'nickname')}</span><input maxLength={24} value={name} onChange={event => setName(event.currentTarget.value)} placeholder={t(lang, 'nicknamePlaceholder')} autoComplete="nickname"/></label>
      
      <DeckPreview lang={lang}/>
      <div className="entry-actions"><button className="button button-primary button-large" type="button" disabled={!valid} onClick={() => void createRoom(name, { mode, resurrection })}>{t(lang, 'createRoom')} <span aria-hidden="true">↗</span></button>
      <div className="join-row"><label className="field"><span>{t(lang, 'roomCode')}</span><input value={code} onChange={event => setCode(event.currentTarget.value.toUpperCase())} maxLength={12} placeholder="ABCD12" autoCapitalize="characters"/></label><button className="button button-outline" type="button" disabled={!valid || code.trim().length !== 6} onClick={() => void joinRoom(name, code)}>{t(lang, 'joinRoom')}</button></div><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}><button className="text-button watch-link" type="button" disabled={!valid || code.trim().length !== 6} onClick={() => void joinRoom(name, code, true)}>{t(lang, 'watchRoom')}</button><button className="text-button" type="button" onClick={onOpenCodex} style={{ fontWeight: 800, color: 'var(--accent)' }}>{t(lang, 'previewCardsAction')}</button></div></div>
      <details className="create-options"><summary>{t(lang, 'settings')}</summary><div className="form-options"><label className="field"><span>{t(lang, 'mode')}</span><select value={mode} onChange={event => setMode(event.currentTarget.value as RoomMode)}><option value="BASE">{t(lang, 'mode.BASE')}</option><option value="EXTENDED">{t(lang, 'mode.EXTENDED')}</option></select></label><label className="toggle-row"><span>{t(lang, 'resurrection')} <small>{t(lang, 'resurrection.short')}</small></span><input type="checkbox" checked={resurrection} onChange={event => setResurrection(event.currentTarget.checked)}/></label></div></details>
    </section>
  </main>;
}

function Lobby({ lang, room, selfId, busy, ready, start, settings, leave, onOpenCodex }: {
  lang: Language; room: Room; selfId: string | undefined; busy: boolean;
  ready: (ready: boolean) => Promise<unknown>; start: () => Promise<unknown>;
  settings: (options: Room['options']) => Promise<unknown>; leave: () => Promise<unknown>; onOpenCodex: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const self = room.players.find(player => player.id === selfId);
  const host = room.hostId === selfId;
  const allReady = room.players.length >= 2 && room.players.every(player => player.ready && player.connected);
  const scaling = calculateDeckScaling(room.players.length, room.options.mode, room.options.resurrection);
  const invite = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(room.code)}`;
  async function copyInvite() {
    try { await navigator.clipboard.writeText(invite); setCopied(true); window.setTimeout(() => setCopied(false), 2500); }
    catch { setCopyError(true); }
  }
  return <main className="lobby-layout">
    <section className="lobby-main"><div className="page-heading"><span className="eyebrow">{t(lang, 'lobby')} / {room.code}</span><h1>{t(lang, 'waiting')}<span className="title-dot">.</span></h1><p>{t(lang, 'lobbyHint')}</p></div>
      <div className="room-ticket"><span>{t(lang, 'roomCode')}</span><strong>{room.code}</strong><button className="button button-outline" type="button" onClick={() => void copyInvite()}>{t(lang, copied ? 'copied' : 'copyLink')} ↗</button></div>
      {copyError && <p role="alert" className="inline-error">{t(lang, 'errorCopied')}</p>}
      <div className="player-list-header"><h2>{t(lang, 'seats')} <span>{room.players.length}/5</span></h2><span>{t(lang, 'invite')}</span></div>
      <ol className="player-list">{room.players.map((player, index) => <li key={player.id} data-player-id={player.id} className="player-list-row"><span className="seat-number">{String(index + 1).padStart(2, '0')}</span><span className="tiny-cat" aria-hidden="true">◡</span><strong>{player.name}{player.id === selfId ? <small> · {lang === 'vi' ? 'bạn' : 'you'}</small> : null}</strong>{player.id === room.hostId && <span className="host-label">{t(lang, 'host')}</span>}<span className={`ready-badge ${player.ready ? 'is-ready' : ''}`}>{t(lang, player.ready ? 'ready' : 'notReady')}</span>{!player.connected && <span className="offline-dot" title={t(lang, 'disconnected')}/>}</li>)}</ol>
      <div className="lobby-deck-scaling-box">
        <div className="deck-scaling-header">
          <div className="deck-scaling-title">
            <span>⚡</span>
            <span>{lang === 'vi' ? `Tự Cân Bằng Cọc Bài (${room.players.length} người)` : `Dynamic Deck Balancing (${room.players.length} players)`}</span>
          </div>
          <span className="deck-scaling-badge">{lang === 'vi' ? 'Tự co giãn' : 'Auto-scaled'}</span>
        </div>
        <div className="deck-scaling-grid">
          <div className="scaling-card">
            <span className="scaling-card-label">💣 {lang === 'vi' ? 'Mèo Nổ (Boom)' : 'Exploding'}</span>
            <div className="scaling-card-value">
              <span>{scaling.activeKittens}</span>
              <small>{room.players.length} - 1</small>
            </div>
            <span className="scaling-card-detail">{lang === 'vi' ? 'Đúng bằng số người - 1' : 'Exactly players - 1'}</span>
          </div>
          <div className="scaling-card">
            <span className="scaling-card-label">🛡️ {lang === 'vi' ? 'Cứu Nổ (Defuse)' : 'Defuses'}</span>
            <div className="scaling-card-value">
              <span>{scaling.totalDefusesInGame}</span>
              <small>{scaling.startingDefuses} + {scaling.extraDefusesInDeck}</small>
            </div>
            <span className="scaling-card-detail">{lang === 'vi' ? `${scaling.startingDefuses} phát tay + ${scaling.extraDefusesInDeck} cọc rút` : `${scaling.startingDefuses} dealt + ${scaling.extraDefusesInDeck} in deck`}</span>
          </div>
          <div className="scaling-card">
            <span className="scaling-card-label">🃏 {lang === 'vi' ? 'Tổng bộ bài' : 'Total Deck'}</span>
            <div className="scaling-card-value">
              <span>{scaling.totalDeckCards}</span>
              <small>{lang === 'vi' ? 'lá' : 'cards'}</small>
            </div>
            <span className="scaling-card-detail">{room.options.mode === 'BASE' ? (lang === 'vi' ? 'Bộ Gốc' : 'Base') : (lang === 'vi' ? 'Bộ Mở Rộng' : 'Extended')}{room.options.resurrection ? ' + Hồi Sinh' : ''}</span>
          </div>
        </div>
        <div className="deck-scaling-tip">
          {lang === 'vi'
            ? '💡 Số lượng Mèo Nổ và Cứu Nổ tự động mở rộng / thu hẹp theo số người chơi để ván đấu luôn cân bằng với đúng 1 người chiến thắng!'
            : '💡 Boom and Defuse card counts automatically expand or contract based on player count to ensure exactly one survivor wins!'}
        </div>
      </div>
      <div className="lobby-buttons">{self && <button className={`button ${self.ready ? 'button-outline' : 'button-primary'}`} type="button" disabled={busy} onClick={() => void ready(!self.ready)}>{t(lang, self.ready ? 'unready' : 'markReady')}</button>}{host && <button className="button button-dark" type="button" disabled={!allReady || busy} onClick={() => void start()}>{t(lang, 'start')} <span aria-hidden="true">→</span></button>}<button className="button button-outline" type="button" onClick={onOpenCodex}>{t(lang, 'cardCodex')} ✦</button></div>
      {!allReady && <p className="quiet-note">{t(lang, 'lobbyMinimum')}</p>}
    </section>
    <aside className="lobby-side"><div className="side-block"><span className="eyebrow">02 / {t(lang, 'settings')}</span><h2>{t(lang, 'rules')}</h2><label className="field"><span>{t(lang, 'mode')}</span><select value={room.options.mode} disabled={!host || busy} onChange={event => void settings({ ...room.options, mode: event.currentTarget.value as RoomMode })}><option value="BASE">{t(lang, 'mode.BASE')}</option><option value="EXTENDED">{t(lang, 'mode.EXTENDED')}</option></select></label><label className="toggle-row"><span>{t(lang, 'resurrection')} <small>{t(lang, 'resurrection.short')}</small></span><input type="checkbox" disabled={!host || busy} checked={room.options.resurrection} onChange={event => void settings({ ...room.options, resurrection: event.currentTarget.checked })}/></label><div className="lobby-rule-tags"><span>{t(lang, 'original')}</span>{room.options.mode === 'EXTENDED' && <span>{t(lang, 'house')}</span>}</div><button className="button button-outline" type="button" onClick={onOpenCodex} style={{ width: '100%', marginTop: '4px' }}>{t(lang, 'previewCardsAction')}</button></div><button className="text-button" type="button" onClick={() => void leave()}>{t(lang, 'leaveRoom')} ↗</button></aside>
  </main>;
}

function Results({ lang, snapshot, selfId, rematch, leave, busy }: { lang: Language; snapshot: ServerSnapshot; selfId?: string; rematch: () => Promise<unknown>; leave: () => Promise<unknown>; busy: boolean }) {
  const game = snapshot.game?.public;
  if (!game) return null;
  const winner = game.players.find(player => player.id === game.winnerId);
  const draws = snapshot.events.filter(event => event.gameId === game.gameId && event.key === 'card.drawn').length;
  const nopes = snapshot.events.filter(event => event.gameId === game.gameId && event.key === 'nope.played').length;
  return <main className="result-layout"><span className="eyebrow">{t(lang, 'results')}</span><div className="result-cat"><CardView card={{ instanceId: 'result', type: 'DEFUSE' }} lang={lang}/></div><h1>{t(lang, 'winner', { name: winner?.name ?? '—' })}</h1><p>{lang === 'vi' ? 'Mọi người khác đã có một ngày rất bình thường.' : 'Everyone else had a very normal day.'}</p><div className="result-stats"><div><strong>{draws}</strong><span>{lang === 'vi' ? 'lần rút đã ghi' : 'recorded draws'}</span></div><div><strong>{nopes}</strong><span>{lang === 'vi' ? 'lần KHÔNG' : 'NOPEs'}</span></div><div><strong>{game.players.length}</strong><span>{lang === 'vi' ? 'người dự ván' : 'at the table'}</span></div></div><div className="result-buttons">{snapshot.room.hostId === selfId && <button className="button button-primary" type="button" disabled={busy} onClick={() => void rematch()}>{t(lang, 'rematch')} ↗</button>}<button className="button button-outline" type="button" onClick={() => void leave()}>{t(lang, 'leaveRoom')}</button></div></main>;
}

export default function App() {
  const [lang, setLang] = usePreference<Language>('kittens.language', 'vi');
  const [initialLoading, setInitialLoading] = useState(true);
  const [startingMatch, setStartingMatch] = useState(false);
  const prevRoomStatus = useRef<string | undefined>(undefined);
  const [reduced, setReduced] = useState(() => localStorage.getItem('kittens.reducedMotion') === 'true' || window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [skip, setSkip] = useState(() => localStorage.getItem('kittens.skipAnimation') === 'true');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [codexOpen, setCodexOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const game = useGameConnection();
  const audio = useAudio(game.snapshot?.room.status === 'PLAYING' ? 'game' : 'lobby', game.liveEvents);
  const room = game.snapshot?.room ?? null;
  useEffect(() => { localStorage.setItem('kittens.reducedMotion', String(reduced)); }, [reduced]);
  useEffect(() => { localStorage.setItem('kittens.skipAnimation', String(skip)); }, [skip]);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  useEffect(() => {
    // Initial resource loading: preload images and audio buffers
    const catGif = new Image();
    catGif.src = import.meta.env.BASE_URL + 'cat-ok.gif';
    const timer = setTimeout(() => {
      setInitialLoading(false);
    }, 1100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (prevRoomStatus.current === 'LOBBY' && room?.status === 'PLAYING') {
      setStartingMatch(true);
      const timer = setTimeout(() => setStartingMatch(false), 1200);
      prevRoomStatus.current = room?.status;
      return () => clearTimeout(timer);
    }
    prevRoomStatus.current = room?.status;
  }, [room?.status]);

  useEffect(() => { const close = (event: KeyboardEvent) => { if (event.key === 'Escape') { setSettingsOpen(false); setRulesOpen(false); setCodexOpen(false); setTutorialOpen(false); } }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close); }, []);
  const error = game.error ? t(lang, `error.${game.error.code}`) === `error.${game.error.code}` ? t(lang, 'errorDefault') : t(lang, `error.${game.error.code}`) : '';
  return <div className={`app-shell ${reduced || skip ? 'motion-reduced' : ''}`}>
    <header className="topbar"><div className="brand-lockup"><img src={import.meta.env.BASE_URL+'cat-ok.gif'} alt="Logo" className="brand-icon brand-icon-gif" aria-hidden="true" /><span>{t(lang, 'brand')}</span></div><div className="topbar-actions"><button className="topbar-link tutorial-link" type="button" title={t(lang, 'tutorialVideo')} onClick={() => { setTutorialOpen(true); }}><span aria-hidden="true">▶</span> <span className="tutorial-link-label">{t(lang, 'tutorial')}</span></button><button className="topbar-link codex-link" type="button" onClick={() => { setCodexOpen(true); }} style={{ fontWeight: 800 }}>{t(lang, 'cardCodex')} ✦</button><span className={`connection-indicator ${game.connection}`} title={t(lang, game.connection === 'connected' ? 'connected' : game.connection === 'offline' ? 'offline' : 'connecting')}/><div className="language-switch" role="group" aria-label={t(lang, 'language')}><button type="button" className={lang === 'vi' ? 'active' : ''} aria-pressed={lang === 'vi'} onClick={() => { setLang('vi'); }}>VI</button><button type="button" className={lang === 'en' ? 'active' : ''} aria-pressed={lang === 'en'} onClick={() => { setLang('en'); }}>EN</button></div>{room && <button className="topbar-link rules-link" type="button" onClick={() => { setRulesOpen(true); }}>{t(lang, 'rules')}</button>}<button className="icon-button header-sound" type="button" onClick={() => { audio.toggleMute(); }} title={t(lang, audio.settings.mute ? 'unmute' : 'mute')} aria-label={t(lang, audio.settings.mute ? 'unmute' : 'mute')}>{audio.settings.mute ? '🔇' : '🔊'}</button><button className="icon-button header-settings" type="button" onClick={() => { setSettingsOpen(true); }} aria-label={t(lang, 'settings')}>☷</button></div></header>
    {game.connection === 'offline' && <div className="connection-banner" role="status">{t(lang, 'offline')}</div>}
    {error && <div className="error-toast" role="alert"><span>{error}</span><button type="button" onClick={game.dismissError} aria-label={t(lang, 'close')}>×</button></div>}
    {!room && <Entry lang={lang} connection={game.connection} busy={game.busy} createRoom={game.createRoom} joinRoom={game.joinRoom} onOpenCodex={() => setCodexOpen(true)}/>}
    {room && <div className="room-layout"><div className="room-main">
      <SocialToolbar key={room.code} players={room.players} selfId={game.session?.playerId} lang={lang} online={game.connection==='connected'} send={game.throwProp}/>
      {room.status==='DEALING'&&game.snapshot?.draft&&<DefuseDraft draft={game.snapshot.draft} lang={lang} selfId={game.session?.playerId} players={room.players} busy={game.busy} online={game.connection==='connected'} offset={game.clockOffsetMs} choose={game.chooseDefuse}/>}
      {room.status === 'LOBBY' && <Lobby lang={lang} room={room} selfId={game.session?.playerId} busy={game.busy} ready={game.ready} start={game.start} settings={game.settings} leave={game.leaveRoom} onOpenCodex={() => setCodexOpen(true)}/>}
      {room.status === 'PLAYING' && game.snapshot?.game && <Table lang={lang} room={room} game={game.snapshot.game} selfId={game.session?.playerId} liveEvents={game.liveEvents} busy={game.busy} online={game.connection === 'connected'} clockOffsetMs={game.clockOffsetMs} action={game.gameAction} reduced={reduced || skip}/>}
      {room.status === 'FINISHED' && game.snapshot && <Results lang={lang} snapshot={game.snapshot} selfId={game.session?.playerId} rematch={game.rematch} leave={game.leaveRoom} busy={game.busy}/>}
          {game.snapshot?.game&&<GameEffects events={game.liveEvents} gameId={game.snapshot.game.public.gameId} selfId={game.session?.playerId} lang={lang} players={game.snapshot.game.public.players} reduced={reduced||skip}/>}</div><RoomSidebar key={room.code} lang={lang} room={room} game={game.snapshot?.game?.public} selfId={game.session?.playerId} events={game.events} messages={game.snapshot?.chatMessages ?? game.events.filter(event => event.key === 'chat.message')} online={game.connection === 'connected'} busy={game.busy} send={game.chat}/></div>}
    {rulesOpen && <RulePanel lang={lang} room={room} onClose={() => setRulesOpen(false)}/>}
    {settingsOpen && <SettingsPanel lang={lang} settings={audio.settings} setSettings={audio.setSettings} enabled={audio.enabled} enable={audio.enable} reduced={reduced} setReduced={setReduced} skip={skip} setSkip={setSkip} onClose={() => setSettingsOpen(false)}/>}
    {codexOpen && <CardCodexModal lang={lang} onClose={() => { audio.stopSfx(); setCodexOpen(false); }} onPlaySfx={audio.playSfx} onStopSfx={audio.stopSfx}/>}
    {tutorialOpen && <TutorialModal lang={lang} onClose={() => setTutorialOpen(false)}/>}
    {initialLoading && <LobbyLoading lang={lang} context="initial" />}
    {startingMatch && <LobbyLoading lang={lang} context="start" />}
    {!initialLoading && !startingMatch && ((!room && (game.busy || game.connection === 'connecting')) || (room?.status === 'LOBBY' && (game.busy || game.connection === 'connecting'))) && <LobbyLoading lang={lang} context={game.connection === 'connecting' ? 'connecting' : !room ? 'create' : 'ready'}/>}
    {room&&<SocialEffects key={room.code} events={game.liveEvents} lang={lang} players={room.players} reduced={reduced||skip}/>}
    <InteractionFeedback sound={audio.playSfx} reduced={reduced||skip}/>
    {room && <footer className="app-footer"><span>{room.code}</span><span>{room.players.length} {lang === 'vi' ? 'người' : 'players'} · 💣 {Math.max(1, room.players.length - 1)} Boom · 🛡️ {room.players.length + (room.players.length >= 5 ? 1 : 2)} Defuse</span><span>{room.options.mode === 'BASE' ? '56' : '64'} {lang === 'vi' ? 'lá' : 'cards'}{room.options.resurrection ? ' + 2' : ''}</span><span>{game.events.some(event => event.key !== 'event.hidden') ? eventText(lang, game.events.filter(event => event.key !== 'event.hidden').at(-1)!, room.players) : t(lang, 'tagline')}</span></footer>}
  </div>;
}
