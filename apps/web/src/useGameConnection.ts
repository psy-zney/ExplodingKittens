import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { Ack, GameAction, GameEvent, RoomMode, ServerSnapshot, Session } from './types';
import { LiveEventStream } from './liveEvents';
import { newActionId } from './actionId';

const TOKEN_KEY = 'kittens.guestToken';
const NAME_KEY = 'kittens.nickname';
const ROOM_KEY = 'kittens.roomCode';
const ROLE_KEY = 'kittens.roomRole';
const SERVER_URL = import.meta.env.VITE_SERVER_URL || import.meta.env.VITE_GAME_SERVER_URL || (import.meta.env.DEV ? 'http://localhost:3001' : window.location.origin);

type AppError = { code: string; params?: Record<string, unknown> };
type Connection = 'connecting' | 'connected' | 'offline';
type Success<T> = { ok: true } & T;

function rememberRoom(code: string | null, watch = false) {
  if (code) { localStorage.setItem(ROOM_KEY, code); localStorage.setItem(ROLE_KEY, watch ? 'spectator' : 'player'); }
  else { localStorage.removeItem(ROOM_KEY); localStorage.removeItem(ROLE_KEY); }
  const url = new URL(window.location.href);
  if (code) url.searchParams.set('room', code);
  else url.searchParams.delete('room');
  window.history.replaceState({}, '', url);
}

function emitAck<T extends object>(socket: Socket, event: string, payload: object): Promise<Ack<T>> {
  return new Promise((resolve) => {
    socket.timeout(10000).emit(event, payload, (error: Error | null, response: Ack<T>) => {
      if (error || !response) resolve({ ok: false, error: { code: 'TIMEOUT' } });
      else resolve(response);
    });
  });
}

export function useGameConnection() {
  const socketRef = useRef<Socket | null>(null);
  const snapshotRef = useRef<ServerSnapshot | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const requestLock = useRef(false);
  const [clockOffsetMs, setClockOffsetMs] = useState(0);
  const [pingMs, setPingMs] = useState<number | null>(null);
  const [connection, setConnection] = useState<Connection>('connecting');
  const [session, setSession] = useState<Session | null>(null);
  const [snapshot, setSnapshot] = useState<ServerSnapshot | null>(null);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [latestEvent, setLatestEvent] = useState<GameEvent | null>(null);
  const [liveEvents, setLiveEvents] = useState<GameEvent[]>([]);
  const [error, setError] = useState<AppError | null>(null);
  const [busy, setBusy] = useState(false);

  const sync = useCallback(async () => {
    const socket = socketRef.current;
    if (socket?.connected) await emitAck(socket, 'room:sync', {});
  }, []);

  useEffect(() => {
    const socket = io(SERVER_URL, { path: import.meta.env.VITE_SOCKET_PATH || '/socket.io', autoConnect: true, reconnection: true, reconnectionDelayMax: 3000, transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    let disposed = false;
    let measuring = false;
    let clockMeasured = false;
    const stream = new LiveEventStream();
    const measurePing = async () => {
      if (disposed || !socket.connected || document.hidden || measuring) return;
      measuring = true;
      const start = performance.now();
      const sentAt = Date.now();
      try {
        const result = await emitAck<{ serverNow: number }>(socket, 'connection:ping', {});
        if (disposed || !socket.connected) return;
        const elapsed = performance.now() - start;
        setPingMs(result.ok ? Math.round(elapsed) : null);
        if (result.ok && typeof result.serverNow === 'number') { clockMeasured = true; setClockOffsetMs(result.serverNow - (sentAt + elapsed / 2)); }
      } finally { measuring = false; }
    };
    const pingTimer = window.setInterval(() => void measurePing(), 15000);

    socket.on('connect', async () => {
      stream.reset();
      setLiveEvents([]);
      setLatestEvent(null);
      setConnection('connecting');
      const storedToken = localStorage.getItem(TOKEN_KEY) ?? undefined;
      const nickname = localStorage.getItem(NAME_KEY) || 'Quiet Cat';
      let result = await emitAck<{ session: Session }>(socket, 'session:open', { token: storedToken, nickname });
      if (!result.ok && storedToken) result = await emitAck<{ session: Session }>(socket, 'session:open', { nickname });
      if (disposed) return;
      if (!result.ok) { setError(result.error); setConnection('offline'); return; }
      localStorage.setItem(TOKEN_KEY, result.session.token);
      localStorage.setItem(NAME_KEY, result.session.nickname);
      sessionRef.current = result.session;
      setSession(result.session);
      setConnection('connected');
      void measurePing();
      const invite = new URLSearchParams(window.location.search).get('room')?.trim().toUpperCase();
      const remembered = localStorage.getItem(ROOM_KEY)?.trim().toUpperCase();
      const code = remembered && (!invite || invite === remembered) ? remembered : null;
      if (code) {
        const watch = localStorage.getItem(ROLE_KEY) === 'spectator';
        const joined = await emitAck(socket, watch ? 'room:watch' : 'room:join', { roomCode: code });
        if (joined.ok) rememberRoom(code, watch);
        else if (!watch && invite && joined.error.code === 'ROOM_FULL') {
          const watched = await emitAck(socket, 'room:watch', { roomCode: code });
          if (watched.ok) rememberRoom(code, true);
          else setError(watched.error);
        } else setError(joined.error);
      }
    });
    socket.on('disconnect', () => { clockMeasured = false; setConnection('offline'); setPingMs(null); });
    socket.on('connect_error', () => { setConnection('offline'); setPingMs(null); });
    socket.on('room:snapshot', (next: ServerSnapshot) => {
      if (disposed) return;
      if (snapshotRef.current?.room.code !== next.room.code) {
        stream.reset();
        setLiveEvents([]);
        setLatestEvent(null);
      }
      stream.hydrate(Array.isArray(next.events) ? next.events : []);
      snapshotRef.current = next;
      if (!clockMeasured && typeof next.serverNow === 'number') setClockOffsetMs(next.serverNow - Date.now());
      setSnapshot(next);
      setEvents(Array.isArray(next.events) ? next.events : []);
      setError(null);
      window.dispatchEvent(new Event('kittens:state-synced'));
    });
    socket.on('room:event', (event: GameEvent) => {
      if (disposed || !event || typeof event.seq !== 'number') return;
      const accepted = stream.accept(event);
      if (accepted.gap) void emitAck(socket, 'room:sync', {});
      setEvents((previous) => {
        const last = previous.at(-1)?.seq ?? 0;
        if (event.seq <= last) return previous;
        return [...previous, event].slice(-100);
      });
      if (accepted.event && !document.hidden) {
        setLiveEvents(previous => [...previous, accepted.event!].slice(-100));
        setLatestEvent(accepted.event);
      }
    });
    const visibility = () => {
      setLiveEvents([]);
      setLatestEvent(null);
      if (!document.hidden && socket.connected) {
        void measurePing();
        if (!snapshotRef.current) { window.dispatchEvent(new Event('kittens:state-synced')); return; }
        stream.reset();
        void emitAck(socket, 'room:sync', {});
      }
    };
    document.addEventListener('visibilitychange', visibility);
    return () => { disposed = true; window.clearInterval(pingTimer); document.removeEventListener('visibilitychange', visibility); socket.disconnect(); socketRef.current = null; };
  }, []);

  const request = useCallback(async <T extends object>(event: string, payload: object): Promise<Success<T> | null> => {
    const socket = socketRef.current;
    if (!socket?.connected || !sessionRef.current) { setError({ code: 'CONNECTION' }); return null; }
    if (requestLock.current) return null;
    requestLock.current = true;
    setBusy(true);
    try {
      const result = await emitAck<T>(socket, event, payload);
      if (!result.ok) { setError(result.error); if (result.error.code.startsWith('STALE') || result.error.code === 'TIMEOUT') void sync(); return null; }
      setError(null);
      return result;
    } finally { requestLock.current = false; setBusy(false); }
  }, [sync]);

  const updateNickname = useCallback(async (nickname: string) => {
    const socket = socketRef.current;
    const trimmed = nickname.trim().slice(0, 24);
    if (!socket?.connected || !trimmed) return false;
    const response = await emitAck<{ session: Session }>(socket, 'session:open', { token: localStorage.getItem(TOKEN_KEY) ?? undefined, nickname: trimmed });
    if (!response.ok) { setError(response.error); return false; }
    localStorage.setItem(NAME_KEY, response.session.nickname);
    localStorage.setItem(TOKEN_KEY, response.session.token);
    sessionRef.current = response.session;
    setSession(response.session);
    return true;
  }, []);

  const createRoom = useCallback(async (nickname: string, options: { mode: RoomMode; resurrection: boolean }) => {
    if (!await updateNickname(nickname)) return false;
    const result = await request<{ roomCode: string }>('room:create', { options });
    if (result) rememberRoom(result.roomCode);
    return !!result;
  }, [request, updateNickname]);

  const joinRoom = useCallback(async (nickname: string, roomCode: string, watch = false) => {
    if (!await updateNickname(nickname)) return false;
    const code = roomCode.trim().toUpperCase();
    const result = await request('room:' + (watch ? 'watch' : 'join'), { roomCode: code });
    if (result) rememberRoom(code, watch);
    return !!result;
  }, [request, updateNickname]);

  const leaveRoom = useCallback(async () => {
    const result = await request('room:leave', {});
    if (result) { rememberRoom(null); snapshotRef.current = null; setSnapshot(null); setEvents([]); setLiveEvents([]); setLatestEvent(null); }
    return !!result;
  }, [request]);

  const gameAction = useCallback(async (action: GameAction) => {
    const game = snapshotRef.current?.game?.public;
    if (!game) { setError({ code: 'NO_GAME' }); return false; }
    const result = await request('game:action', {
      gameId: game.gameId,
      turnId: game.turnId,
      actionId: newActionId(),
      expectedRevision: game.revision,
      action
    });
    return !!result;
  }, [request]);

  return {
    connection, session, snapshot, events, liveEvents, latestEvent, error, busy, clockOffsetMs, pingMs,
    dismissError: () => setError(null), sync,
    createRoom, joinRoom, leaveRoom,
    ready: (ready: boolean) => request('room:ready', { ready }),
    start: () => request('room:start', {}),
    rematch: () => request('room:rematch', {}),
    settings: (options: { mode: RoomMode; resurrection: boolean }) => request('room:settings', { options }),
    chat: (text: string) => request('room:chat', { text: text.trim().slice(0, 240) }),
    gameAction,
    chooseDefuse:(gameId:string,cardId:string)=>request('room:choose-defuse',{gameId,cardId,actionId:newActionId()}),
    throwProp:async(targetId:string,prop:'EGG'|'BOMB'|'ROCK')=>{
      const socket=socketRef.current;
      if(!socket?.connected||!sessionRef.current)return {ok:false as const,error:{code:'CONNECTION'}};
      return emitAck<Record<string,unknown>>(socket,'room:throw',{targetId,prop,actionId:newActionId()});
    }
  };
}
