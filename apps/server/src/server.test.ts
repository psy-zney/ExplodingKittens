import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { io as connectClient, type Socket as ClientSocket } from 'socket.io-client';
import { createGameServer } from './server.js';

type Ack = { ok: boolean; error?: { code: string }; [key: string]: unknown };
type Snapshot = {
  serverNow: number;
  room: { code: string; status: string; players: Array<{ id: string; connected: boolean }> };
  game: null | {
    public: { gameId: string; turnId: string; revision: number; currentPlayerId: string; players: Array<{ id: string }> };
    private: null | { hand: Array<{ instanceId: string; type: string }> };
  };
  events: Array<{ seq: number; key: string; params: Record<string, unknown> }>;
  chatMessages: Array<{ seq: number; key: string; params: Record<string, unknown>; visibility: string }>;
};

async function withAck(socket: ClientSocket, event: string, payload: unknown = {}): Promise<Ack> {
  return await new Promise<Ack>((resolve, reject) => {
    socket.timeout(2_000).emit(event, payload, (error: Error | null, result: Ack) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
}

async function nextSnapshot(socket: ClientSocket): Promise<Snapshot> {
  return await new Promise<Snapshot>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('snapshot timeout')), 2_000);
    socket.once('room:snapshot', (snapshot: Snapshot) => {
      clearTimeout(timeout);
      resolve(snapshot);
    });
  });
}

describe('Socket.IO room server', () => {
  let server: ReturnType<typeof createGameServer>;
  let baseUrl: string;
  let clients: ClientSocket[];
  let logicalNow: number;

  beforeEach(async () => {
    logicalNow = Date.now();
    server = createGameServer({ corsOrigins: ['http://localhost:5173'], now: () => logicalNow, tickIntervalMs: 5 });
    baseUrl = `http://127.0.0.1:${await server.listen(0)}`;
    clients = [];
  });

  afterEach(async () => {
    for (const client of clients) client.disconnect();
    await server.close();
  });

  async function guest(nickname: string, token?: string): Promise<{ socket: ClientSocket; token: string; playerId: string }> {
    const socket = connectClient(baseUrl, { transports: ['websocket'], reconnection: false, autoConnect: false });
    clients.push(socket);
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('connect_error', reject);
      socket.connect();
    });
    const result = await withAck(socket, 'session:open', { nickname, ...(token ? { token } : {}) });
    expect(result.ok).toBe(true);
    const session = result.session as { token: string; playerId: string };
    return { socket, token: session.token, playerId: session.playerId };
  }

  async function startRoom(count: number) {
    const players = await Promise.all(Array.from({ length: count }, (_, i) => guest(`Cat ${i + 1}`)));
    const creator = players[0]!;
    const create = await withAck(creator.socket, 'room:create', { options: { mode: 'BASE', resurrection: false } });
    expect(create.ok).toBe(true);
    const roomCode = create.roomCode as string;
    for (const player of players.slice(1)) {
      expect((await withAck(player.socket, 'room:join', { roomCode })).ok).toBe(true);
    }
    for (const player of players) expect((await withAck(player.socket, 'room:ready', { ready: true })).ok).toBe(true);
    expect((await withAck(creator.socket, 'room:start')).ok).toBe(true);
    return { players, roomCode };
  }

  it('rejects unlisted browser origins for WebSocket and polling handshakes', async () => {
    for (const transport of ['websocket', 'polling']) {
      const socket = connectClient(baseUrl, { transports: [transport], reconnection: false, autoConnect: false, extraHeaders: { Origin: 'https://unlisted.example' } });
      clients.push(socket);
      await new Promise<void>((resolve, reject) => {
        socket.once('connect', () => reject(new Error('Unlisted origin connected')));
        socket.once('connect_error', () => resolve());
        socket.connect();
      });
    }
    const socket = connectClient(baseUrl, { transports: ['websocket'], reconnection: false, autoConnect: false, extraHeaders: { Origin: 'http://localhost:5173' } });
    clients.push(socket);
    await new Promise<void>((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); socket.connect(); });
    expect((await withAck(socket, 'session:open', { nickname: 'Allowed' })).ok).toBe(true);
  });

  it('changing rules resets readiness and disconnected seats cannot start', async () => {
    const host = await guest('Host');
    const other = await guest('Other');
    const created = await withAck(host.socket, 'room:create');
    const roomCode = created.roomCode as string;
    await withAck(other.socket, 'room:join', { roomCode });
    for (const player of [host, other]) await withAck(player.socket, 'room:ready', { ready: true });
    await withAck(host.socket, 'room:settings', { options: { mode: 'EXTENDED', resurrection: true } });
    const room = server.rooms.get(roomCode)!;
    expect([...room.players.values()].every(player => !player.ready)).toBe(true);
    expect((await withAck(host.socket, 'room:start')).error?.code).toBe('NOT_READY');
    for (const player of [host, other]) await withAck(player.socket, 'room:ready', { ready: true });
    const notice = nextSnapshot(host.socket);
    other.socket.disconnect();
    await notice;
    expect((await withAck(host.socket, 'room:start')).error?.code).toBe('NOT_READY');
  });

  it('a late action resolves the expired server deadline before validating revision', async () => {
    // Disable periodic ticks to prove the packet path enforces the deadline.
    for (const client of clients) client.disconnect();
    await server.close();
    server = createGameServer({ now: () => logicalNow, tickIntervalMs: 60_000 });
    baseUrl = `http://127.0.0.1:${await server.listen(0)}`;
    const { players, roomCode } = await startRoom(2);
    const before = server.rooms.get(roomCode)!.game!;
    logicalNow = before.deadlineAt! + 1;
    const actor = players.find(player => player.playerId === before.currentPlayerId)!;
    const result = await withAck(actor.socket, 'game:action', { gameId: before.gameId, turnId: before.turnId, expectedRevision: before.revision, actionId: randomUUID(), action: { type: 'DRAW_CARD' } });
    expect(result.ok).toBe(false);
    expect(result.error?.code).toMatch(/STALE_(TURN|REVISION)/);
    expect(server.rooms.get(roomCode)!.game!.revision).toBe(before.revision + 1);
    expect(server.rooms.get(roomCode)!.events.some(event => event.key === 'timer.resolved')).toBe(true);
  });

  it('hands host control to a connected player after 120s without losing the game seat', async () => {
    const { players, roomCode } = await startRoom(2);
    const room = server.rooms.get(roomCode)!;
    const oldHost = players[0]!;
    const notice = nextSnapshot(players[1]!.socket);
    oldHost.socket.disconnect();
    await notice;
    await expect.poll(() => room.players.get(oldHost.playerId)?.connected).toBe(false);
    logicalNow += 120_001;
    await expect.poll(() => room.hostId).toBe(players[1]!.playerId);
    expect(room.players.has(oldHost.playerId)).toBe(true);
    const returned = await guest('ignored', oldHost.token);
    await withAck(returned.socket, 'room:join', { roomCode });
    expect(room.hostId).toBe(players[1]!.playerId);
    expect(room.players.size).toBe(2);
  });

  for (const count of [2, 3, 4, 5]) {
    it(`starts a real ${count}-player game with private hands`, async () => {
      const { players, roomCode } = await startRoom(count);
      const spectator = await guest('Watcher');
      const waiting = nextSnapshot(spectator.socket);
      expect((await withAck(spectator.socket, 'room:watch', { roomCode })).ok).toBe(true);
      const spectatorView = await waiting;
      expect(spectatorView.room.players).toHaveLength(count);
      expect(spectatorView.game?.private).toBeNull();
      expect(JSON.stringify(spectatorView.game?.public)).not.toContain('"hand":');
      for (const player of players) {
        const viewPromise = nextSnapshot(player.socket);
        expect((await withAck(player.socket, 'room:sync')).ok).toBe(true);
        const view = await viewPromise;
        expect(view.serverNow).toBe(logicalNow);
        expect(view.game?.private?.hand).toHaveLength(8);
        const firstId = view.game?.private?.hand[0]?.instanceId;
        expect(firstId).toBeTruthy();
        expect(JSON.stringify(spectatorView)).not.toContain(firstId);
      }
      const game = spectatorView.game!.public;
      const rejected = await withAck(spectator.socket, 'game:action', {
        gameId: game.gameId,
        turnId: game.turnId,
        actionId: randomUUID(),
        expectedRevision: game.revision,
        action: { type: 'DRAW_CARD' },
      });
      expect(rejected).toMatchObject({ ok: false, error: { code: 'NOT_PLAYER' } });
    });
  }

  it('restores a guest seat and the same private hand after reconnect', async () => {
    const { players, roomCode } = await startRoom(2);
    const player = players[1]!;
    const beforePromise = nextSnapshot(player.socket);
    await withAck(player.socket, 'room:sync');
    const before = await beforePromise;
    const beforeIds = before.game!.private!.hand.map((card) => card.instanceId);
    const hostNotice = nextSnapshot(players[0]!.socket);
    player.socket.disconnect();
    const disconnectedView = await hostNotice;
    expect(disconnectedView.room.players.find((seat) => seat.id === player.playerId)?.connected).toBe(false);
    const returning = await guest('ignored', player.token);
    expect(returning.playerId).toBe(player.playerId);
    const restoredPromise = nextSnapshot(returning.socket);
    expect((await withAck(returning.socket, 'room:join', { roomCode })).ok).toBe(true);
    const restored = await restoredPromise;
    expect(restored.game!.private!.hand.map((card) => card.instanceId)).toEqual(beforeIds);
    expect(restored.room.players.find((seat) => seat.id === player.playerId)?.connected).toBe(true);
  });

  it('serializes concurrent actions, returns cached ack for retries, and rejects an old turn', async () => {
    const { players } = await startRoom(2);
    const read = nextSnapshot(players[0]!.socket);
    await withAck(players[0]!.socket, 'room:sync');
    const snapshot = await read;
    const game = snapshot.game!.public;
    const current = players.find((player) => player.playerId === game.currentPlayerId)!;
    const base = { gameId: game.gameId, turnId: game.turnId, expectedRevision: game.revision, action: { type: 'DRAW_CARD' } };
    const actionA = randomUUID();
    const actionB = randomUUID();
    const [a, b] = await Promise.all([
      withAck(current.socket, 'game:action', { ...base, actionId: actionA }),
      withAck(current.socket, 'game:action', { ...base, actionId: actionB }),
    ]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    expect([a, b].find((result) => !result.ok)?.error?.code).toMatch(/STALE_(REVISION|TURN)/);
    const successfulId = a.ok ? actionA : actionB;
    const successful = a.ok ? a : b;
    expect(await withAck(current.socket, 'game:action', { ...base, actionId: successfulId })).toEqual(successful);
    const late = await withAck(current.socket, 'game:action', { ...base, actionId: randomUUID() });
    expect(late.ok).toBe(false);
    expect(late.error?.code).toMatch(/STALE_(REVISION|TURN)/);
  });

  it('validates messages, chat length, and forbids changing a room for another player', async () => {
    const host = await guest('Host');
    const created = await withAck(host.socket, 'room:create');
    expect(created.ok).toBe(true);
    const other = await guest('Other');
    expect(await withAck(other.socket, 'room:settings', { options: { mode: 'EXTENDED', resurrection: true } }))
      .toMatchObject({ ok: false, error: { code: 'ROOM_NOT_JOINED' } });
    expect((await withAck(other.socket, 'room:join', { roomCode: created.roomCode })).ok).toBe(true);
    expect(await withAck(other.socket, 'room:settings', { options: { mode: 'EXTENDED', resurrection: true } }))
      .toMatchObject({ ok: false, error: { code: 'NOT_HOST' } });
    expect(await withAck(host.socket, 'room:chat', { text: 'x'.repeat(241) }))
      .toMatchObject({ ok: false, error: { code: 'BAD_REQUEST' } });
    expect(await withAck(host.socket, 'room:join', { roomCode: 'bad' }))
      .toMatchObject({ ok: false, error: { code: 'BAD_REQUEST' } });
  });

  it('keeps chat scoped to its room, authenticates the sender and restores it for players and spectators', async () => {
    const host = await guest('Mèo Việt');
    const peer = await guest('English Cat');
    const watcher = await guest('Watcher');
    const outsider = await guest('Other Room');
    const created = await withAck(host.socket, 'room:create');
    expect((await withAck(peer.socket, 'room:join', { roomCode: created.roomCode })).ok).toBe(true);
    expect((await withAck(watcher.socket, 'room:watch', { roomCode: created.roomCode })).ok).toBe(true);
    expect((await withAck(outsider.socket, 'room:create')).ok).toBe(true);
    const peerView = nextSnapshot(peer.socket);
    const spectatorView = nextSnapshot(watcher.socket);
    expect((await withAck(host.socket, 'room:chat', { text: '  Chào mèo 👋 <script>alert(1)</script>  ' })).ok).toBe(true);
    const received = (await peerView).chatMessages;
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ key: 'chat.message', visibility: 'PUBLIC', params: {
      playerId: host.playerId, playerName: 'Mèo Việt', text: 'Chào mèo 👋 <script>alert(1)</script>', sentAt: logicalNow,
    } });
    expect((await spectatorView).chatMessages).toEqual(received);
    expect(await withAck(peer.socket, 'room:chat', { text: 'fake', playerId: host.playerId }))
      .toMatchObject({ ok: false, error: { code: 'BAD_REQUEST' } });
    const outsiderView = nextSnapshot(outsider.socket);
    await withAck(outsider.socket, 'room:sync');
    expect((await outsiderView).chatMessages).toEqual([]);
    peer.socket.disconnect();
    const rejoined = await guest('English Cat', peer.token);
    expect(rejoined.playerId).toBe(peer.playerId);
    const restored = nextSnapshot(rejoined.socket);
    expect((await withAck(rejoined.socket, 'room:join', { roomCode: created.roomCode })).ok).toBe(true);
    expect((await restored).chatMessages).toEqual(received);
    expect((await withAck(host.socket, 'room:ready', { ready: true })).ok).toBe(true);
    expect((await withAck(rejoined.socket, 'room:ready', { ready: true })).ok).toBe(true);
    const started = nextSnapshot(host.socket);
    expect((await withAck(host.socket, 'room:start')).ok).toBe(true);
    const before = await started;
    expect(before.chatMessages).toEqual(received);
    const playingChat = nextSnapshot(host.socket);
    expect((await withAck(watcher.socket, 'room:chat', { text: 'Good luck!' })).ok).toBe(true);
    const after = await playingChat;
    expect(after.game).toEqual(before.game);
    expect(after.chatMessages.at(-1)?.params).toMatchObject({ playerId: watcher.playerId, playerName: 'Watcher', text: 'Good luck!' });
  });

  it('bounds chat history separately from action logs and keeps it after the event ring rolls over', async () => {
    const host = await guest('Chat Host');
    await withAck(host.socket, 'room:create');
    for (let index = 0; index < 105; index++) {
      logicalNow += 2_000;
      expect((await withAck(host.socket, 'room:chat', { text: `message ${index}` })).ok).toBe(true);
    }
    for (let index = 0; index < 205; index++) {
      logicalNow += 1_000;
      expect((await withAck(host.socket, 'room:ready', { ready: index % 2 === 0 })).ok).toBe(true);
    }
    const snapshot = nextSnapshot(host.socket);
    await withAck(host.socket, 'room:sync');
    const restored = await snapshot;
    expect(restored.events).toHaveLength(200);
    expect(restored.events.some(event => event.key === 'chat.message')).toBe(false);
    expect(restored.chatMessages).toHaveLength(100);
    expect(restored.chatMessages[0]?.params.text).toBe('message 5');
    expect(restored.chatMessages.at(-1)?.params.text).toBe('message 104');
    expect(restored.chatMessages.every(event => event.visibility === 'PUBLIC' && event.key === 'chat.message')).toBe(true);
  });

  it('updates the nickname in an open guest session before creating a room', async () => {
    const player = await guest('Guest');
    const renamed = await withAck(player.socket, 'session:open', { token: player.token, nickname: 'Tired Cat' });
    expect(renamed.ok).toBe(true);
    expect((renamed.session as { nickname: string }).nickname).toBe('Tired Cat');
    const created = await withAck(player.socket, 'room:create');
    expect(created.ok).toBe(true);
    const snapshotPromise = nextSnapshot(player.socket);
    await withAck(player.socket, 'room:sync');
    const view = await snapshotPromise;
    expect(view.room.players[0]).toMatchObject({ id: player.playerId });
    expect((view.room.players[0] as { name?: string }).name).toBe('Tired Cat');
  });

  it('makes the first joiner host when an empty lobby is reused', async () => {
    const originalHost = await guest('Original');
    const create = await withAck(originalHost.socket, 'room:create');
    const roomCode = create.roomCode as string;
    expect((await withAck(originalHost.socket, 'room:leave')).ok).toBe(true);
    const replacement = await guest('Replacement');
    const viewPromise = nextSnapshot(replacement.socket);
    expect((await withAck(replacement.socket, 'room:join', { roomCode })).ok).toBe(true);
    const view = await viewPromise;
    expect(view.room.players).toHaveLength(1);
    expect((view.room as { hostId?: string }).hostId).toBe(replacement.playerId);
    expect((await withAck(replacement.socket, 'room:settings', {
      options: { mode: 'EXTENDED', resurrection: false },
    })).ok).toBe(true);
  });

  it('hands the host role to a remaining lobby player and keeps it when the former host rejoins', async () => {
    const originalHost = await guest('Original');
    const create = await withAck(originalHost.socket, 'room:create');
    const roomCode = create.roomCode as string;
    const successor = await guest('Successor');
    expect((await withAck(successor.socket, 'room:join', { roomCode })).ok).toBe(true);
    expect((await withAck(originalHost.socket, 'room:leave')).ok).toBe(true);
    const successorViewPromise = nextSnapshot(successor.socket);
    await withAck(successor.socket, 'room:sync');
    const successorView = await successorViewPromise;
    expect((successorView.room as { hostId?: string }).hostId).toBe(successor.playerId);
    expect((await withAck(originalHost.socket, 'room:join', { roomCode })).ok).toBe(true);
    const oldHostRequest = await withAck(originalHost.socket, 'room:settings', {
      options: { mode: 'EXTENDED', resurrection: true },
    });
    expect(oldHostRequest).toMatchObject({ ok: false, error: { code: 'NOT_HOST' } });
    expect((await withAck(successor.socket, 'room:settings', {
      options: { mode: 'EXTENDED', resurrection: true },
    })).ok).toBe(true);
  });

  for (const position of ['TOP', 'MIDDLE_HIDDEN', 'BOTTOM'] as const) {
    it(`exposes only the ${position} placement zone to spectators and opponents`, async () => {
      const { players, roomCode } = await startRoom(2);
      const watcher = await guest('Watcher');
      expect((await withAck(watcher.socket, 'room:watch', { roomCode })).ok).toBe(true);
      const state = server.rooms.get(roomCode)!.game!;
      const kittenIndex = state.drawPile.findIndex((card) => card.type === 'EXPLODING_KITTEN');
      expect(kittenIndex).toBeGreaterThanOrEqual(0);
      const [kitten] = state.drawPile.splice(kittenIndex, 1);
      state.drawPile.unshift(kitten!);
      const actor = players.find((player) => player.playerId === state.currentPlayerId)!;
      const drawAck = await withAck(actor.socket, 'game:action', {
        gameId: state.gameId,
        turnId: state.turnId,
        actionId: randomUUID(),
        expectedRevision: state.revision,
        action: { type: 'DRAW_CARD' },
      });
      expect(drawAck.ok).toBe(true);
      const insertionState = server.rooms.get(roomCode)!.game!;
      expect(insertionState.phase).toBe('DEFUSE_INSERT');
      const slotCount = insertionState.drawPile.length + 1;
      const index = position === 'TOP' ? 0 : position === 'BOTTOM' ? slotCount - 1 : 1;
      expect(index).toBeGreaterThanOrEqual(0);
      if (position === 'MIDDLE_HIDDEN') expect(index).toBeLessThan(slotCount - 1);
      const publicEvents: unknown[] = [];
      watcher.socket.on('room:event', (event) => publicEvents.push(event));
      const insertionEventPromise = new Promise<{ key: string; params: Record<string, unknown> }>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('insertion event timeout')), 2_000);
        watcher.socket.on('room:event', (event: { key?: string; params: Record<string, unknown> }) => {
          if (event.key === 'defuse.inserted') {
            clearTimeout(timeout);
            resolve(event as { key: string; params: Record<string, unknown> });
          }
        });
      });
      const insertAck = await withAck(actor.socket, 'game:action', {
        gameId: insertionState.gameId,
        turnId: insertionState.turnId,
        actionId: randomUUID(),
        expectedRevision: insertionState.revision,
        action: { type: 'DEFUSE_POSITION', index },
      });
      expect(insertAck.ok).toBe(true);
      const insertionEvent = await insertionEventPromise;
      expect(insertionEvent.params).toEqual({ playerId: actor.playerId, zone: position });
      const spectatorSnapshotPromise = nextSnapshot(watcher.socket);
      await withAck(watcher.socket, 'room:sync');
      const spectatorSnapshot = await spectatorSnapshotPromise;
      const sequences = spectatorSnapshot.events.map((event) => event.seq);
      expect(sequences.every((seq, offset) => offset === 0 || seq === sequences[offset - 1]! + 1)).toBe(true);
      expect(spectatorSnapshot.events.filter((event) => event.key === 'event.hidden')
        .every((event) => Object.keys(event.params).length === 0)).toBe(true);
      expect(JSON.stringify(spectatorSnapshot)).not.toContain('"index"');
      expect(JSON.stringify(publicEvents)).not.toContain('"index"');
      expect(JSON.stringify(spectatorSnapshot)).not.toContain('"insertSlotCount"');
      const opponent = players.find((player) => player.playerId !== actor.playerId)!;
      const opponentSnapshotPromise = nextSnapshot(opponent.socket);
      await withAck(opponent.socket, 'room:sync');
      const opponentSnapshot = await opponentSnapshotPromise;
      expect(JSON.stringify(opponentSnapshot)).not.toContain('"index"');
      watcher.socket.disconnect();
      const rejoinedWatcher = await guest('Watcher', watcher.token);
      const reconnectSnapshotPromise = nextSnapshot(rejoinedWatcher.socket);
      await withAck(rejoinedWatcher.socket, 'room:watch', { roomCode });
      const reconnectSnapshot = await reconnectSnapshotPromise;
      expect(JSON.stringify(reconnectSnapshot)).not.toContain('"index"');
      expect(reconnectSnapshot.events.find((event) => event.key === 'defuse.inserted')?.params)
        .toEqual({ playerId: actor.playerId, zone: position });
    });
  }

  it('a passed Nope response survives reconnect without revealing cards', async () => {
    const { players, roomCode } = await startRoom(2);
    const state = server.rooms.get(roomCode)!.game!;
    const actorState = state.players.find(player => player.id === state.currentPlayerId)!;
    let card = actorState.hand.find(c => c.type === 'SHUFFLE');
    if (!card) {
      const zones = [state.drawPile, ...state.players.filter(p => p !== actorState).map(p => p.hand)];
      const zone = zones.find(cards => cards.some(c => c.type === 'SHUFFLE'))!;
      card = zone.splice(zone.findIndex(c => c.type === 'SHUFFLE'), 1, actorState.hand[0]!)[0]!;
      actorState.hand[0] = card;
    }
    const actor = players.find(p => p.playerId === actorState.id)!;
    expect((await withAck(actor.socket, 'game:action', { gameId: state.gameId, turnId: state.turnId, actionId: randomUUID(), expectedRevision: state.revision, action: {type:'PLAY_CARD',cardIds:[card.instanceId]} })).ok).toBe(true);
    const pending = server.rooms.get(roomCode)!.game!;
    expect((await withAck(actor.socket, 'game:action', { gameId: pending.gameId, turnId: pending.turnId, actionId: randomUUID(), expectedRevision: pending.revision, action: {type:'PASS_NOPE'} })).ok).toBe(true);
    actor.socket.disconnect();
    const returned = await guest('Returned', actor.token);
    const promise = nextSnapshot(returned.socket);
    await withAck(returned.socket, 'room:join', {roomCode});
    const view = await promise;
    expect((view.game!.public as any).pending.passedPlayerIds).toEqual([actor.playerId]);
    expect(view.serverNow).toBe(logicalNow);
    expect(JSON.stringify(view.game!.public)).not.toContain('"hand":');
  });

  it('resolves a Nope window after a player disconnects and rejects stale actions on reconnect', async () => {
    const { players, roomCode } = await startRoom(2);
    const state = server.rooms.get(roomCode)!.game!;
    const actorState = state.players.find((player) => player.id === state.currentPlayerId)!;
    let playable = actorState.hand.find((card) => ['SKIP', 'SHUFFLE', 'SEE_THE_FUTURE', 'ATTACK'].includes(card.type));
    if (!playable) {
      const deckIndex = state.drawPile.findIndex((card) => ['SKIP', 'SHUFFLE', 'SEE_THE_FUTURE', 'ATTACK'].includes(card.type));
      expect(deckIndex).toBeGreaterThanOrEqual(0);
      const [fromDeck] = state.drawPile.splice(deckIndex, 1, actorState.hand[0]!);
      actorState.hand[0] = fromDeck!;
      playable = fromDeck;
    }
    const actor = players.find((player) => player.playerId === actorState.id)!;
    const other = players.find((player) => player.playerId !== actorState.id)!;
    const play = await withAck(actor.socket, 'game:action', {
      gameId: state.gameId, turnId: state.turnId, actionId: randomUUID(), expectedRevision: state.revision,
      action: { type: 'PLAY_CARD', cardIds: [playable!.instanceId] },
    });
    expect(play.ok).toBe(true);
    expect(server.rooms.get(roomCode)!.game!.phase).toBe('NOPE_WINDOW');
    other.socket.disconnect();
    logicalNow += 8_000;
    await new Promise((resolve) => setTimeout(resolve, 20));
    const after = server.rooms.get(roomCode)!.game!;
    expect(after.phase).not.toBe('NOPE_WINDOW');
    const returned = await guest('Other', other.token);
    const reconnectSnapshotPromise = nextSnapshot(returned.socket);
    expect((await withAck(returned.socket, 'room:join', { roomCode })).ok).toBe(true);
    const view = await reconnectSnapshotPromise;
    expect(view.game?.public.revision).toBe(after.revision);
    const stale = await withAck(actor.socket, 'game:action', {
      gameId: state.gameId, turnId: state.turnId, actionId: randomUUID(), expectedRevision: state.revision,
      action: { type: 'DRAW_CARD' },
    });
    expect(stale.ok).toBe(false);
    expect(stale.error?.code).toMatch(/STALE_(TURN|REVISION)/);
  });

  it('times out a disconnected Defuse player without exposing the chosen slot', async () => {
    const { players, roomCode } = await startRoom(2);
    const watcher = await guest('Watcher');
    await withAck(watcher.socket, 'room:watch', { roomCode });
    const state = server.rooms.get(roomCode)!.game!;
    const kittenIndex = state.drawPile.findIndex((card) => card.type === 'EXPLODING_KITTEN');
    const [kitten] = state.drawPile.splice(kittenIndex, 1);
    state.drawPile.unshift(kitten!);
    const actor = players.find((player) => player.playerId === state.currentPlayerId)!;
    expect((await withAck(actor.socket, 'game:action', {
      gameId: state.gameId, turnId: state.turnId, actionId: randomUUID(), expectedRevision: state.revision,
      action: { type: 'DRAW_CARD' },
    })).ok).toBe(true);
    expect(server.rooms.get(roomCode)!.game!.phase).toBe('DEFUSE_INSERT');
    actor.socket.disconnect();
    logicalNow += 21_000;
    await new Promise((resolve) => setTimeout(resolve, 20));
    const resolved = server.rooms.get(roomCode)!.game!;
    expect(resolved.phase).not.toBe('DEFUSE_INSERT');
    const snapshotPromise = nextSnapshot(watcher.socket);
    await withAck(watcher.socket, 'room:sync');
    const snapshot = await snapshotPromise;
    const publicInsert = snapshot.events.find((event) => event.key === 'defuse.inserted');
    expect(publicInsert?.params.zone).toMatch(/^(TOP|BOTTOM|MIDDLE_HIDDEN)$/);
    expect(Object.keys(publicInsert!.params).sort()).toEqual(['playerId', 'zone']);
    expect(JSON.stringify(snapshot)).not.toContain('"index"');
    const returning = await guest('Cat', actor.token);
    const restoredPromise = nextSnapshot(returning.socket);
    await withAck(returning.socket, 'room:join', { roomCode });
    const restored = await restoredPromise;
    expect(restored.game?.public.revision).toBe(resolved.revision);
  });

  for (const count of [2, 3, 4, 5]) {
  it(`finishes a ${count}-player game using server timers and can rematch`, async () => {
    const { players, roomCode } = await startRoom(count);
    let room = server.rooms.get(roomCode)!;
    for (let attempt = 0; attempt < 220 && room.status !== 'FINISHED'; attempt++) {
      logicalNow += 31_000;
      await new Promise((resolve) => setTimeout(resolve, 8));
      room = server.rooms.get(roomCode)!;
    }
    expect(room.status).toBe('FINISHED');
    expect(room.game?.winnerId).toBeTruthy();
    const winner = room.game!.players.filter((player) => player.alive);
    expect(winner).toHaveLength(1);
    expect(winner[0]?.id).toBe(room.game!.winnerId);
    const oldGameId = room.game!.gameId;
    expect((await withAck(players[0]!.socket, 'room:rematch')).ok).toBe(true);
    expect(room.status).toBe('LOBBY');
    for (const player of players) expect((await withAck(player.socket, 'room:ready', { ready: true })).ok).toBe(true);
    const restart = await withAck(players[0]!.socket, 'room:start');
    expect(restart.ok).toBe(true);
    expect(restart.gameId).not.toBe(oldGameId);
  });
  }
});
