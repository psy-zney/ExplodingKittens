import { useEffect, useRef, useState } from 'react';
import { eventText } from './eventText';
import { t } from './i18n';
import { useModalFocus } from './useModalFocus';
import type { GameEvent, Language, PublicGame, Room } from './types';

type Props = {
  lang: Language; room: Room; selfId?: string; game?: PublicGame;
  events: GameEvent[]; messages: GameEvent[]; online: boolean; busy: boolean;
  send: (text: string) => Promise<unknown>;
};

function ChatIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 11.5a8 8 0 0 1-8 8H4l1.5-4A8 8 0 1 1 20 11.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><path d="M8 10h8M8 14h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>;
}

function RoomChat({ lang, room, selfId, messages, online, busy, send }: Omit<Props, 'game' | 'events'>) {
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width:850px)').matches);
  const [open, setOpen] = useState(() => !window.matchMedia('(max-width:850px)').matches);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const latestSeq = messages.at(-1)?.seq ?? 0;
  const [seenSeq, setSeenSeq] = useState(latestSeq);
  const listRef = useRef<HTMLOListElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sendingRef = useRef(false);
  const panelRef = useModalFocus(open && mobile);
  const unread = messages.filter(message => message.seq > seenSeq && message.params?.playerId !== selfId).length;
  const timeFormat = new Intl.DateTimeFormat(lang === 'vi' ? 'vi-VN' : 'en-GB', { hour: '2-digit', minute: '2-digit' });

  useEffect(() => {
    const query = window.matchMedia('(max-width:850px)');
    const change = () => setMobile(query.matches);
    query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    const read = () => {
      if (!open || !atBottom || document.hidden) return;
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
      setSeenSeq(latestSeq);
    };
    read();
    document.addEventListener('visibilitychange', read);
    return () => document.removeEventListener('visibilitychange', read);
  }, [latestSeq, open, atBottom]);

  function close() {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }
  async function submit() {
    const text = draft.trim();
    if (!text || !online || busy || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setFailed(false);
    try {
      const result = await send(text);
      if (result) { setDraft(current => current === draft ? '' : current); setAtBottom(true); }
      else setFailed(true);
    } catch { setFailed(true); }
    finally { sendingRef.current = false; setSending(false); }
  }

  return <div className={`room-chat ${open ? 'is-open' : ''}`}>
    <button ref={triggerRef} className="room-chat-trigger" type="button" aria-expanded={open} aria-controls="room-chat-panel" onClick={() => { setAtBottom(true); setOpen(true); }}>
      <ChatIcon/><span>{t(lang, 'chat')}</span>{unread > 0 && <span className="chat-unread" aria-label={t(lang, 'chatUnread', { count: unread })}>{unread > 99 ? '99+' : unread}</span>}
    </button>
    {open && mobile && <div className="room-chat-backdrop" onClick={close} aria-hidden="true"/>}
    <section ref={panelRef} id="room-chat-panel" className="room-chat-panel" hidden={!open} role={mobile ? 'dialog' : 'region'} aria-modal={mobile && open ? true : undefined} aria-labelledby="room-chat-title" onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); close(); } }}>
      <header className="room-chat-header"><div><h2 id="room-chat-title"><ChatIcon/>{t(lang, 'chat')}</h2><p><span className={`chat-online-dot ${online ? 'is-online' : ''}`} aria-hidden="true"/>{online ? t(lang, 'chatInRoom', { code: room.code }) : t(lang, 'chatOffline')}</p></div><button type="button" className="chat-close" onClick={close} aria-label={t(lang, 'chatMinimize')}>−</button></header>
      <ol ref={listRef} className="room-chat-messages" role="log" aria-label={t(lang, 'chatMessages')} aria-live="polite" aria-relevant="additions" onScroll={event => { const list = event.currentTarget; setAtBottom(list.scrollHeight - list.scrollTop - list.clientHeight < 40); }}>
        {!messages.length && <li className="chat-empty"><span aria-hidden="true">⌃ · ⌃</span><strong>{t(lang, 'chatEmpty')}</strong><p>{t(lang, 'chatEmptyHint')}</p></li>}
        {messages.map(message => {
          const params = message.params ?? {};
          const own = params.playerId === selfId;
          const name = String(params.playerName ?? room.players.find(player => player.id === params.playerId)?.name ?? '—');
          const sentAt = typeof params.sentAt === 'number' && Number.isFinite(params.sentAt) ? params.sentAt : null;
          return <li key={message.seq} className={`room-chat-message ${own ? 'is-own' : ''}`} data-message-seq={message.seq}><div className="chat-message-meta"><strong>{name}{own && <small> · {t(lang, 'chatYou')}</small>}</strong>{sentAt !== null && <time dateTime={new Date(sentAt).toISOString()}>{timeFormat.format(sentAt)}</time>}</div><p dir="auto">{String(params.text ?? '')}</p></li>;
        })}
      </ol>
      {!atBottom && unread > 0 && <button className="chat-new-messages" type="button" onClick={() => setAtBottom(true)}>{t(lang, 'chatUnread', { count: unread })} ↓</button>}
      <form className="room-chat-form" onSubmit={event => { event.preventDefault(); void submit(); }}>
        <label htmlFor="room-chat-input">{t(lang, 'chatWrite')}</label><textarea ref={inputRef} id="room-chat-input" rows={2} value={draft} maxLength={240} placeholder={t(lang, 'chatPlaceholder')} aria-describedby="room-chat-help" onChange={event => { setDraft(event.currentTarget.value); setFailed(false); }} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void submit(); } }}/>
        <div className="chat-compose-footer"><span id="room-chat-help">{mobile ? t(lang, 'chatLimit') : t(lang, 'chatKeyboard')} <small>{draft.length}/240</small></span><button type="submit" className="button button-dark" disabled={!draft.trim() || !online || busy || sending}>{t(lang, sending ? 'chatSending' : 'send')} <span aria-hidden="true">↗</span></button></div>
        {(!online || failed) && <p className="chat-feedback" role="status">{t(lang, !online ? 'chatOfflineDraft' : 'chatFailed')}</p>}
      </form>
    </section>
  </div>;
}

function GameHistory({ lang, room, game, events }: Pick<Props, 'lang' | 'room' | 'events'> & { game: PublicGame }) {
  const listRef = useRef<HTMLOListElement>(null);
  const following = useRef(true);
  const logs = (events.length ? events : game.log ?? []).filter(event => event.visibility !== 'SERVER_ONLY' && event.key !== 'event.hidden' && event.key !== 'chat.message').slice(-50);
  const latestSeq = logs.at(-1)?.seq;
  useEffect(() => { if (following.current && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, [latestSeq]);
  return <div className="history-panel"><details open className="history-details"><summary>{t(lang, 'eventLog')} <span>{logs.length}</span></summary><ol ref={listRef} aria-live="polite" aria-relevant="additions text" onScroll={event => { const list = event.currentTarget; following.current = list.scrollHeight - list.scrollTop - list.clientHeight < 40; }}>{logs.map(event => <li key={event.seq}><span className="log-tick">{String(event.seq).padStart(2, '0')}</span><span>{eventText(lang, event, [...game.players, ...room.players])}</span></li>)}</ol></details></div>;
}

export function RoomSidebar(props: Props) {
  return <aside className="room-sidebar" aria-label={t(props.lang, 'chatAndHistory')}><div className="room-sidebar-sticky"><RoomChat {...props}/>{props.game && <GameHistory lang={props.lang} room={props.room} game={props.game} events={props.events}/>}</div></aside>;
}
