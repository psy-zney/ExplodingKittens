import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { createServer as createHttpServer, type Server as HttpServer } from 'node:http';
import express from 'express';
import { Server, type Socket } from 'socket.io';
import { z } from 'zod';
import type { ActionEnvelope, Card } from '@kittens/shared';
import {
  makeDeck, shuffle, secureRandom,
  applyAction,
  createGame,
  getPrivateSnapshot,
  getPublicSnapshot,
  getSpectatorSnapshot,
  tick,
} from '@kittens/engine';
import { inboundSchemas, type EventName, type RoomOptions } from './schemas.js';

type GameState = ReturnType<typeof createGame>;
type GameEvent = ReturnType<typeof applyAction>['events'][number];
type AckSuccess = { ok: true; [key: string]: unknown };
type AckFailure = { ok: false; error: { code: string; params?: Record<string, unknown> } };
type Ack = AckSuccess | AckFailure;

interface Session {
  token: string;
  playerId: string;
  nickname: string;
  roomCode?: string;
  lastSeenAt: number;
  lastThrowAt?: number;
}

interface Seat {
  id: string;
  name: string;
  ready: boolean;
  connected: boolean;
  disconnectedAt?: number;
}

interface VisibleEvent {
  seq: number;
  revision: number;
  gameId?: string;
  key: string;
  params: Record<string, unknown>;
  visibility: 'PUBLIC' | 'PRIVATE_PLAYER';
  playerId?: string;
}

interface Room {
  code: string;
  hostId: string;
  status: 'LOBBY' | 'DEALING' | 'PLAYING' | 'FINISHED';
  draft: null | {gameId:string;deadlineAt:number;cards:Card[];choices:Record<string,string>};
  socialProcessed:Map<string,Record<string,unknown>>;
  options: RoomOptions;
  players: Map<string, Seat>;
  game: GameState | null;
  events: VisibleEvent[];
  chatMessages: VisibleEvent[];
  sequence: number;
  processed: Map<string, AckSuccess>;
  queue: Promise<unknown>;
  emptySince?: number;
}

export interface GameServerOptions {
  corsOrigins?: string[];
  socketPath?: string;
  tickIntervalMs?: number;
  now?: () => number;
}

const MAX_PLAYERS = 5;
const MIN_PLAYERS = 2;
const RECONNECT_HOLD_MS = 120_000;
const EMPTY_ROOM_TTL_MS = 60 * 60_000;
const MAX_EVENT_HISTORY = 200;
const MAX_CHAT_HISTORY = 100;

class ServerFault extends Error {
  constructor(public readonly code: string, public readonly params?: Record<string, unknown>) {
    super(code);
  }
}

function fail(code: string, params?: Record<string, unknown>): never {
  throw new ServerFault(code, params);
}

function ackFailure(error: unknown): AckFailure {
  // Engine errors have a stable `code`. Never echo exception messages or
  // invalid payloads: they can contain private cards or insertion positions.
  const maybe = error as { code?: unknown; params?: unknown };
  if (maybe && typeof maybe.code === 'string' && /^[A-Z][A-Z0-9_]*$/.test(maybe.code)) {
    return {
      ok: false,
      error: {
        code: maybe.code,
        ...(maybe.params && typeof maybe.params === 'object'
          ? { params: maybe.params as Record<string, unknown> }
          : {}),
      },
    };
  }
  return { ok: false, error: { code: 'INTERNAL_ERROR' } };
}

function randomCode(rooms: Map<string, Room>): string {
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    if (!rooms.has(code)) return code;
  }
  return fail('INTERNAL_ERROR');
}

function safePublicParams(key: string, params: Record<string, unknown>): Record<string, unknown> {
  const unsafeKey = /^(index|slot|slotIndex|position|drawPile|drawOrder|hand|cards|cardIds|insertSlotCount|pointerX|pointerY|dragProgress|duration)$/i;
  const clean: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(params)) {
    if (!unsafeKey.test(name)) clean[name] = value;
  }
  // A middle insertion is deliberately indistinguishable across all middle
  // slots. Animation clients receive only this zone, never drag coordinates.
  if (key.includes('insert') && clean.zone === 'MIDDLE_HIDDEN') {
    return Object.fromEntries(Object.entries(clean).filter(([name]) =>
      name === 'zone' || name === 'playerId' || name === 'playerName',
    ));
  }
  return clean;
}

class TokenBucket {
  private remaining = 45;
  private updatedAt: number | null = null;

  take(cost: number, now: number): boolean {
    if (this.updatedAt !== null) {
      this.remaining = Math.min(45, this.remaining + Math.max(0, now - this.updatedAt) * (45 / 10_000));
    }
    this.updatedAt = now;
    if (this.remaining < cost) return false;
    this.remaining -= cost;
    return true;
  }
}

export function createGameServer(options: GameServerOptions = {}) {
  const now = options.now ?? Date.now;
  const app = express();
  app.disable('x-powered-by');
  app.get('/health', (_request, response) => response.json({ ok: true }));
  const httpServer: HttpServer = createHttpServer(app);
  const allowedOrigins = options.corsOrigins ?? ['http://localhost:5173'];
  const io = new Server(httpServer, {
    cors: { origin: allowedOrigins, methods: ['GET', 'POST'] },
    // Browser WebSocket upgrades bypass CORS. Apply the same exact allowlist
    // to the Engine.IO handshake; native clients may omit Origin.
    allowRequest: (request, callback) => callback(null,
      !request.headers.origin || allowedOrigins.includes(request.headers.origin)),
    path: options.socketPath ?? '/socket.io',
    maxHttpBufferSize: 32 * 1024,
    serveClient: false,
  });
  const rooms = new Map<string, Room>();
  const sessions = new Map<string, Session>();

  function sessionFor(socket: Socket): Session {
    const session = socket.data.session as Session | undefined;
    if (!session) return fail('UNAUTHORIZED');
    session.lastSeenAt = now();
    return session;
  }

  function roomFor(socket: Socket): Room {
    const code = socket.data.roomCode as string | undefined;
    const room = code ? rooms.get(code) : undefined;
    if (!room) return fail('ROOM_NOT_JOINED');
    return room;
  }

  function seatFor(socket: Socket, room: Room): Seat {
    const session = sessionFor(socket);
    if (socket.data.role !== 'player') return fail('NOT_PLAYER');
    const seat = room.players.get(session.playerId);
    if (!seat) return fail('NOT_PLAYER');
    return seat;
  }

  function hostFor(socket: Socket, room: Room): Seat {
    const seat = seatFor(socket, room);
    if (seat.id !== room.hostId) return fail('NOT_HOST');
    return seat;
  }

  function roomRevision(room: Room): number {
    return room.game?.revision ?? 0;
  }

  function addEvent(room: Room, key: string, params: Record<string, unknown>, visibility: VisibleEvent['visibility'] = 'PUBLIC', playerId?: string): VisibleEvent {
    const event: VisibleEvent = {
      seq: ++room.sequence,
      revision: roomRevision(room),
      ...(room.game ? { gameId: room.game.gameId } : {}),
      key,
      params: visibility === 'PUBLIC' ? safePublicParams(key, params) : params,
      visibility,
      ...(playerId ? { playerId } : {}),
    };
    room.events.push(event);
    if (room.events.length > MAX_EVENT_HISTORY) room.events.shift();
    return event;
  }

  function addEngineEvents(room: Room, engineEvents: GameEvent[]): VisibleEvent[] {
    const recorded: VisibleEvent[] = [];
    for (const engineEvent of engineEvents) {
      if (engineEvent.visibility === 'SERVER_ONLY') continue;
      if (engineEvent.visibility !== 'PUBLIC' && engineEvent.visibility !== 'PRIVATE_PLAYER') continue;
      const params = (engineEvent.params ?? {}) as Record<string, unknown>;
      recorded.push(addEvent(room, engineEvent.key, params, engineEvent.visibility, engineEvent.playerId));
    }
    return recorded;
  }

  function wireEventFor(event: VisibleEvent, playerId: string | null) {
    if (event.visibility === 'PRIVATE_PLAYER' && playerId !== event.playerId) {
      // Keep the room sequence contiguous without sending the secret event.
      // Private events in this engine accompany a public action, so the
      // placeholder reveals neither a card nor a previously hidden action.
      return {
        seq: event.seq,
        revision: event.revision,
        ...(event.gameId ? { gameId: event.gameId } : {}),
        key: 'event.hidden',
        params: {},
        visibility: 'PUBLIC' as const,
      };
    }
    const { playerId: _recipient, ...wireEvent } = event;
    return wireEvent;
  }

  function publicRoom(room: Room) {
    const gamePublic = room.game ? getPublicSnapshot(room.game) : null;
    const aliveById = new Map<string, boolean>();
    if (gamePublic) {
      for (const player of gamePublic.players) aliveById.set(player.id, player.alive);
    }
    return {
      code: room.code,
      hostId: room.hostId,
      status: room.status,
      options: room.options,
      players: [...room.players.values()].map((seat) => ({
        id: seat.id,
        name: seat.name,
        ready: seat.ready,
        connected: seat.connected,
        eliminated: aliveById.has(seat.id) ? !aliveById.get(seat.id) : false,
      })),
    };
  }

  function snapshotFor(room: Room, socket: Socket) {
    const session = socket.data.session as Session | undefined;
    const playerId = socket.data.role === 'player' && session && room.players.has(session.playerId)
      ? session.playerId
      : null;
    let game = null;
    if (room.game) {
      const publicSnapshot = playerId
        ? getPublicSnapshot(room.game)
        : getSpectatorSnapshot(room.game);
      game = {
        public: publicSnapshot,
        private: playerId ? getPrivateSnapshot(room.game, playerId) : null,
      };
    }
    return {
      serverNow: now(),
      draft: room.draft ? structuredClone(room.draft) : null,
      room: publicRoom(room),
      game,
      events: room.events.map((event) => wireEventFor(event, playerId)),
      chatMessages: room.chatMessages.map((event) => wireEventFor(event, playerId)),
    };
  }

  function socketsIn(room: Room): Socket[] {
    return [...io.sockets.sockets.values()].filter((socket) => socket.data.roomCode === room.code);
  }

  function publish(room: Room, newEvents: VisibleEvent[] = []) {
    for (const socket of socketsIn(room)) {
      const session = socket.data.session as Session | undefined;
      const playerId = socket.data.role === 'player' && session ? session.playerId : null;
      for (const event of newEvents) {
        socket.emit('room:event', wireEventFor(event, playerId));
      }
      socket.emit('room:snapshot', snapshotFor(room, socket));
    }
  }

  function refreshPresence(room: Room) {
    const sockets = socketsIn(room);
    let changed = false;
    for (const seat of room.players.values()) {
      const connected = sockets.some((socket) =>
        socket.data.role === 'player' && (socket.data.session as Session | undefined)?.playerId === seat.id,
      );
      if (seat.connected !== connected) {
        seat.connected = connected;
        seat.disconnectedAt = connected ? undefined : now();
        changed = true;
      }
    }
    room.emptySince = sockets.length ? undefined : (room.emptySince ?? now());
    if (changed) publish(room);
  }

  async function queued<T>(room: Room, work: () => T | Promise<T>): Promise<T> {
    const result = room.queue.then(work, work);
    room.queue = result.then(() => undefined, () => undefined);
    return result;
  }

  function attach(socket: Socket, room: Room, role: 'player' | 'spectator') {
    const oldCode = socket.data.roomCode as string | undefined;
    if (oldCode && oldCode !== room.code) {
      socket.leave(oldCode);
      const oldRoom = rooms.get(oldCode);
      socket.data.roomCode = undefined;
      if (oldRoom) refreshPresence(oldRoom);
    }
    socket.data.roomCode = room.code;
    socket.data.role = role;
    socket.join(room.code);
    refreshPresence(room);
    socket.emit('room:snapshot', snapshotFor(room, socket));
  }

  function assertLobby(room: Room) {
    if (room.status !== 'LOBBY') fail('GAME_STARTED');
  }

  function onEvent<K extends EventName>(
    socket: Socket,
    name: K,
    handler: (payload: z.infer<(typeof inboundSchemas)[K]>) => Promise<Record<string, unknown> | void> | Record<string, unknown> | void,
  ) {
    const bucket = (socket.data.bucket ??= new TokenBucket()) as TokenBucket;
    socket.on(name as string, async (...args: unknown[]) => {
      const raw = args[0];
      const reply = args[1];
      const ack = typeof reply === 'function' ? reply as (ack: Ack) => void : () => undefined;
      if (!bucket.take(name === 'room:throw' ? 8 : name === 'room:chat' ? 5 : 1, now())) {
        ack({ ok: false, error: { code: 'RATE_LIMITED' } });
        return;
      }
      const parsed = inboundSchemas[name].safeParse(raw ?? {});
      if (!parsed.success) {
        ack({ ok: false, error: { code: 'BAD_REQUEST' } });
        return;
      }
      try {
        const result = await handler(parsed.data as z.infer<(typeof inboundSchemas)[K]>);
        ack({ ok: true, ...(result ?? {}) });
      } catch (error) {
        ack(ackFailure(error));
      }
    });
  }

  io.on('connection', (socket) => {
    onEvent(socket, 'session:open', async ({ token, nickname }) => {
      const attachedSession = socket.data.session as Session | undefined;
      if (attachedSession) {
        if (token && token !== attachedSession.token) fail('ALREADY_AUTHENTICATED');
        if (nickname && !attachedSession.roomCode) attachedSession.nickname = nickname;
        attachedSession.lastSeenAt = now();
        return {
          session: {
            token: attachedSession.token,
            playerId: attachedSession.playerId,
            nickname: attachedSession.nickname,
            ...(attachedSession.roomCode ? { roomCode: attachedSession.roomCode } : {}),
          },
        };
      }
      let session = token ? sessions.get(token) : undefined;
      if (!session) {
        session = {
          token: randomBytes(32).toString('hex'),
          playerId: randomUUID(),
          nickname: nickname ?? 'Guest',
          lastSeenAt: now(),
        };
        sessions.set(session.token, session);
      } else if (nickname && !session.roomCode) {
        session.nickname = nickname;
      }
      session.lastSeenAt = now();
      socket.data.session = session;
      return {
        session: {
          token: session.token,
          playerId: session.playerId,
          nickname: session.nickname,
          ...(session.roomCode ? { roomCode: session.roomCode } : {}),
        },
      };
    });

    onEvent(socket, 'room:create', async ({ options: requestedOptions }) => {
      const session = sessionFor(socket);
      if (session.roomCode && rooms.get(session.roomCode)?.players.has(session.playerId)) fail('ALREADY_IN_ROOM');
      const code = randomCode(rooms);
      const room: Room = {
        code,
        hostId: session.playerId,
        status: 'LOBBY',
        draft:null, socialProcessed:new Map(),
        options: requestedOptions ?? { mode: 'EXTENDED', resurrection: false },
        players: new Map([[session.playerId, {
          id: session.playerId,
          name: session.nickname,
          ready: false,
          connected: true,
        }]]),
        game: null,
        events: [],
        chatMessages: [],
        sequence: 0,
        processed: new Map(),
        queue: Promise.resolve(),
      };
      rooms.set(code, room);
      session.roomCode = code;
      const event = addEvent(room, 'room.created', { playerId: session.playerId, playerName: session.nickname });
      attach(socket, room, 'player');
      publish(room, [event]);
      return { roomCode: code };
    });

    onEvent(socket, 'room:join', async ({ roomCode }) => {
      const session = sessionFor(socket);
      const room = rooms.get(roomCode);
      if (!room) fail('ROOM_NOT_FOUND');
      if (session.roomCode && session.roomCode !== roomCode && rooms.get(session.roomCode)?.players.has(session.playerId)) fail('ALREADY_IN_ROOM');
      return queued(room, () => {
        if (session.roomCode && session.roomCode !== roomCode && rooms.get(session.roomCode)?.players.has(session.playerId)) fail('ALREADY_IN_ROOM');
        let seat = room.players.get(session.playerId);
        let event: VisibleEvent | undefined;
        if (!seat) {
          assertLobby(room);
          if (room.players.size >= MAX_PLAYERS) fail('ROOM_FULL');
          seat = { id: session.playerId, name: session.nickname, ready: false, connected: true };
          room.players.set(session.playerId, seat);
          if (!room.players.has(room.hostId)) room.hostId = room.players.keys().next().value ?? seat.id;
          event = addEvent(room, 'room.joined', { playerId: seat.id, playerName: seat.name });
        }
        session.roomCode = roomCode;
        attach(socket, room, 'player');
        publish(room, event ? [event] : []);
        return { roomCode };
      });
    });

    onEvent(socket, 'room:watch', async ({ roomCode }) => {
      const session = sessionFor(socket);
      const room = rooms.get(roomCode);
      if (!room) fail('ROOM_NOT_FOUND');
      const role = room.players.has(session.playerId) ? 'player' : 'spectator';
      attach(socket, room, role);
      return { roomCode };
    });

    onEvent(socket, 'room:leave', async () => {
      const room = roomFor(socket);
      const session = sessionFor(socket);
      return queued(room, () => {
        const wasPlayer = socket.data.role === 'player';
        socket.leave(room.code);
        socket.data.roomCode = undefined;
        socket.data.role = undefined;
        let event: VisibleEvent | undefined;
        if (wasPlayer && room.status !== 'PLAYING' && room.status !== 'DEALING') {
          const seat = room.players.get(session.playerId);
          if (seat) {
            room.players.delete(seat.id);
            session.roomCode = undefined;
            event = addEvent(room, 'room.left', { playerId: seat.id, playerName: seat.name });
            if (room.hostId === seat.id) room.hostId = room.players.keys().next().value ?? '';
          }
        }
        refreshPresence(room);
        publish(room, event ? [event] : []);
        return {};
      });
    });

    onEvent(socket, 'room:ready', async ({ ready }) => {
      const room = roomFor(socket);
      return queued(room, () => {
        assertLobby(room);
        const seat = seatFor(socket, room);
        if (seat.ready === ready) return {};
        seat.ready = ready;
        const event = addEvent(room, 'room.ready', { playerId: seat.id, playerName: seat.name, ready });
        publish(room, [event]);
        return {};
      });
    });

    onEvent(socket, 'room:settings', async ({ options: newOptions }) => {
      const room = roomFor(socket);
      return queued(room, () => {
        assertLobby(room);
        hostFor(socket, room);
        if (room.options.mode === newOptions.mode && room.options.resurrection === newOptions.resurrection) return {};
        room.options = newOptions;
        for (const seat of room.players.values()) seat.ready = false;
        const event = addEvent(room, 'room.settings', { mode: newOptions.mode, resurrection: newOptions.resurrection });
        publish(room, [event]);
        return {};
      });
    });

    onEvent(socket, 'room:start', async () => {
      const room = roomFor(socket);
      return queued(room, () => {
        assertLobby(room);
        hostFor(socket, room);
        if (room.players.size < MIN_PLAYERS || room.players.size > MAX_PLAYERS || [...room.players.values()].some((seat) => !seat.ready || !seat.connected)) {
          fail('NOT_READY');
        }
        room.draft = {
          gameId: randomUUID(), deadlineAt: now() + 5000,
          cards: makeDeck(room.options.mode, room.options.resurrection).filter(card => card.type === 'DEFUSE'),
          choices: {},
        };
        room.status = 'DEALING';
        room.processed.clear();
        publish(room, [addEvent(room, 'draft.started', {})]);
        return { gameId: room.draft.gameId };
      });
    });

    onEvent(socket, 'room:rematch', async () => {
      const room = roomFor(socket);
      return queued(room, () => {
        hostFor(socket, room);
        if (room.status !== 'FINISHED') fail('GAME_NOT_FINISHED');
        room.status = 'LOBBY';
        room.game = null;
        room.draft = null;
        room.processed.clear();
        for (const seat of room.players.values()) seat.ready = false;
        const event = addEvent(room, 'room.rematch', {});
        publish(room, [event]);
        return {};
      });
    });

    onEvent(socket, 'room:chat', async ({ text }) => {
      const room = roomFor(socket);
      const session = sessionFor(socket);
      return queued(room, () => {
        const event = addEvent(room, 'chat.message', { playerId: session.playerId, playerName: session.nickname, text, sentAt: now() });
        room.chatMessages.push(event);
        if (room.chatMessages.length > MAX_CHAT_HISTORY) room.chatMessages.shift();
        publish(room, [event]);
        return {};
      });
    });

    onEvent(socket, 'room:choose-defuse', async ({ gameId, cardId }) => {
      const room = roomFor(socket);
      return queued(room, () => {
        const seat = seatFor(socket, room);
        if (!room.draft || room.status !== 'DEALING' || room.draft.gameId !== gameId) fail('DRAFT_FINISHED');
        if (now() >= room.draft.deadlineAt) { finishDraft(room); fail('DRAFT_FINISHED'); }
        if (room.draft.choices[seat.id] === cardId) return {};
        if (room.draft.choices[seat.id]) fail('DEFUSE_ALREADY_CHOSEN');
        if (!room.draft.cards.some(card => card.instanceId === cardId)) fail('INVALID_DEFUSE_SELECTION');
        if (Object.values(room.draft.choices).includes(cardId)) fail('DEFUSE_TAKEN');
        room.draft.choices[seat.id] = cardId;
        publish(room, [addEvent(room, 'draft.chosen', { playerId: seat.id, cardId })]);
        return {};
      });
    });

    onEvent(socket, 'room:throw', async ({ targetId, prop, actionId }) => {
      const room = roomFor(socket), session = sessionFor(socket);
      return queued(room, () => {
        const key = session.playerId + ':' + actionId, prior = room.socialProcessed.get(key);
        if (prior) return prior;
        const target = room.players.get(targetId);
        if (!target) fail('INVALID_TARGET');
        if (session.lastThrowAt !== undefined && now() - session.lastThrowAt < 1500) fail('REACTION_COOLDOWN');
        session.lastThrowAt = now();
        const event = addEvent(room, 'social.thrown', {
          sourceId: session.playerId, sourceName: session.nickname,
          targetId, targetName: target.name, prop,
        });
        for (const viewer of socketsIn(room)) viewer.emit('room:event', wireEventFor(event, null));
        const result = { eventSeq: event.seq };
        room.socialProcessed.set(key, result);
        if (room.socialProcessed.size > 256) room.socialProcessed.delete(room.socialProcessed.keys().next().value!);
        return result;
      });
    });

    onEvent(socket, 'connection:ping', () => ({ serverNow: now() }));

    onEvent(socket, 'room:sync', async () => {
      const room = roomFor(socket);
      socket.emit('room:snapshot', snapshotFor(room, socket));
      return {};
    });

    onEvent(socket, 'game:action', async (rawEnvelope) => {
      const envelope = rawEnvelope as ActionEnvelope;
      const room = roomFor(socket);
      return queued(room, () => {
        const seat = seatFor(socket, room);
        if (!room.game) fail('NO_GAME');
        const actionKey = `${room.game.gameId}:${seat.id}:${envelope.actionId}`;
        const prior = room.processed.get(actionKey);
        if (prior) return prior;
        // A packet reaching the room queue after the deadline cannot beat the
        // next timer interval. Resolve the expired obligation first.
        resolveExpired(room);
        if (room.status !== 'PLAYING') fail('GAME_FINISHED');
        if (envelope.gameId !== room.game.gameId) fail('STALE_GAME');
        if (envelope.turnId !== room.game.turnId) fail('STALE_TURN');
        if (envelope.expectedRevision !== room.game.revision) fail('STALE_REVISION', { revision: room.game.revision });
        const transition = applyAction(room.game, seat.id, envelope.action, now());
        room.game = transition.state;
        if (room.game.winnerId || room.game.phase === 'FINISHED') room.status = 'FINISHED';
        const events = addEngineEvents(room, transition.events);
        const result: AckSuccess = { ok: true, revision: room.game.revision, eventSeq: room.sequence };
        room.processed.set(actionKey, result);
        if (room.processed.size > 5_000) {
          const oldest = room.processed.keys().next().value;
          if (oldest) room.processed.delete(oldest);
        }
        publish(room, events);
        return result;
      });
    });

    socket.on('disconnect', () => {
      const code = socket.data.roomCode as string | undefined;
      const room = code ? rooms.get(code) : undefined;
      if (room) refreshPresence(room);
    });
  });

  function finishDraft(room: Room) {
    if (!room.draft || room.status !== 'DEALING' || now() < room.draft.deadlineAt) return;
    const draft = room.draft;
    const claimed = new Set(Object.values(draft.choices));
    const remaining = shuffle(draft.cards.filter(card => !claimed.has(card.instanceId)), secureRandom);
    for (const seat of room.players.values()) if (!draft.choices[seat.id]) draft.choices[seat.id] = remaining.shift()!.instanceId;
    room.game = createGame({
      gameId: draft.gameId, players: [...room.players.values()].map(seat => ({ id: seat.id, name: seat.name })),
      mode: room.options.mode, resurrection: room.options.resurrection, now: now(), defuseChoices: draft.choices,
    });
    room.draft = null;
    room.status = 'PLAYING';
    publish(room, [addEvent(room, 'room.started', { gameId: room.game.gameId })]);
  }

  function resolveExpired(room: Room) {
    if (!room.game || room.status !== 'PLAYING') return;
    const transition = tick(room.game, now());
    if (!transition) return;
    room.game = transition.state;
    if (room.game.winnerId || room.game.phase === 'FINISHED') room.status = 'FINISHED';
    publish(room, addEngineEvents(room, transition.events));
  }

  const timer = setInterval(() => {
    const currentTime = now();
    for (const room of rooms.values()) {
      if (room.status === 'DEALING' && room.draft && room.draft.deadlineAt <= currentTime) void queued(room, () => finishDraft(room));
      if (room.status === 'PLAYING' && room.game && (room.game.deadlineAt ?? Infinity) <= currentTime) {
        void queued(room, () => {
          resolveExpired(room);
        });
      }
      const host = room.players.get(room.hostId);
      if (host && !host.connected && host.disconnectedAt !== undefined && currentTime - host.disconnectedAt >= RECONNECT_HOLD_MS) {
        const replacement = [...room.players.values()].find(seat => seat.connected);
        if (replacement) {
          room.hostId = replacement.id;
          publish(room, [addEvent(room, 'room.hostChanged', { playerId: replacement.id, playerName: replacement.name })]);
        }
      }
      if (room.status === 'LOBBY') {
        let removed = false;
        for (const seat of room.players.values()) {
          if (!seat.connected && seat.disconnectedAt && currentTime - seat.disconnectedAt > RECONNECT_HOLD_MS) {
            room.players.delete(seat.id);
            const session = [...sessions.values()].find((entry) => entry.playerId === seat.id);
            if (session?.roomCode === room.code) session.roomCode = undefined;
            if (room.hostId === seat.id) room.hostId = room.players.keys().next().value ?? '';
            removed = true;
          }
        }
        if (removed) publish(room);
      }
      if (room.emptySince && currentTime - room.emptySince > EMPTY_ROOM_TTL_MS) {
        rooms.delete(room.code);
        for (const session of sessions.values()) {
          if (session.roomCode === room.code) session.roomCode = undefined;
        }
      }
    }
    for (const [token, session] of sessions) {
      if (!session.roomCode && currentTime - session.lastSeenAt > EMPTY_ROOM_TTL_MS) sessions.delete(token);
    }
  }, options.tickIntervalMs ?? 250);
  timer.unref();

  return {
    app,
    io,
    httpServer,
    rooms,
    async listen(port = 3001): Promise<number> {
      await new Promise<void>((resolve, reject) => {
        httpServer.once('error', reject);
        httpServer.listen(port, '0.0.0.0', () => {
          httpServer.off('error', reject);
          resolve();
        });
      });
      const address = httpServer.address();
      if (!address || typeof address === 'string') return fail('INTERNAL_ERROR');
      return address.port;
    },
    async close(): Promise<void> {
      clearInterval(timer);
      await new Promise<void>((resolve) => io.close(() => resolve()));
    },
  };
}
