import { io } from 'socket.io-client';
import { randomUUID } from 'node:crypto';
import { writeFile, mkdir } from 'node:fs/promises';

const origin = process.env.SMOKE_SERVER_URL || 'https://beatsync-server.zney295.id.vn';
const socketPath = process.env.SMOKE_SOCKET_PATH || '/kittens/socket.io';
const viewerOrigin = process.env.SMOKE_VIEWER_ORIGIN || origin;
const transport=process.env.SMOKE_TRANSPORT || 'websocket';
if(!['websocket','polling'].includes(transport))throw new Error('Invalid smoke transport');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const clients = [];
const results = [];

async function waitFor(predicate, timeout = 10_000) {
  const until = Date.now() + timeout;
  while (!predicate()) {
    if (Date.now() > until) throw new Error('Snapshot deadline exceeded');
    await delay(25);
  }
}
async function request(client, event, payload = {}) {
  const ack = await new Promise((resolve, reject) => client.socket.timeout(10_000).emit(event, payload, (error, response) => error ? reject(error) : resolve(response)));
  if (!ack?.ok) throw new Error(`${event}: ${ack?.error?.code || 'missing ack'}`);
  return ack;
}
async function makeClient(index) {
  const client = { socket: io(origin, { path: socketPath, transports: [transport], extraHeaders: { Origin: viewerOrigin } }), snapshot: null, playerId: '' };
  clients.push(client);
  client.socket.on('room:snapshot', snapshot => { client.snapshot = snapshot; });
  await waitFor(() => client.socket.connected);
  if(client.socket.io.engine.transport.name!==transport)throw new Error('Unexpected transport');
  const opened = await request(client, 'session:open', { nickname: `Deploy Cat ${index + 1}` });
  client.playerId = opened.session.playerId;
  return client;
}
try {
  for (const count of [2, 3]) {
    const seats = [];
    for (let i = 0; i < count; i++) seats.push(await makeClient(i));
    const host = seats[0];
    const mode = count === 2 ? 'BASE' : 'EXTENDED';
    const created = await request(host, 'room:create', { options: { mode, resurrection: count === 3 } });
    for (const seat of seats.slice(1)) await request(seat, 'room:join', { roomCode: created.roomCode });
    for (const seat of seats) await request(seat, 'room:ready', { ready: true });
    const started = await request(host, 'room:start');
    await waitFor(() => seats.every(seat => seat.snapshot?.game?.public?.gameId === started.gameId));
    let actions = 0;
    while (host.snapshot.room.status === 'PLAYING' && actions < 200) {
      const game = host.snapshot.game.public;
      const actor = seats.find(seat => seat.playerId === game.currentPlayerId);
      const action = game.phase === 'TURN' ? { type: 'DRAW_CARD' }
        : game.phase === 'DEFUSE_INSERT' ? { type: 'DEFUSE_POSITION', index: 0 }
        : null;
      if (!action) throw new Error(`Unexpected draw-only phase ${game.phase}`);
      const ack = await request(actor, 'game:action', { gameId: game.gameId, turnId: game.turnId, actionId: randomUUID(), expectedRevision: game.revision, action });
      await waitFor(() => seats.every(seat => seat.snapshot.game.public.revision === ack.revision));
      const reference = JSON.stringify(host.snapshot.game.public);
      if (seats.some(seat => JSON.stringify(seat.snapshot.game.public) !== reference)) throw new Error('Public snapshots differ');
      actions++;
      await delay(250);
    }
    if (host.snapshot.room.status !== 'FINISHED') throw new Error('Game did not finish');
    const ended = host.snapshot.game.public;
    if (ended.players.filter(player => player.alive).length !== 1 || !ended.winnerId) throw new Error('Winner invariant failed');
    await request(host, 'room:rematch');
    await waitFor(() => seats.every(seat => seat.snapshot.room.status === 'LOBBY'));
    results.push({ players: count, mode, resurrection: count === 3, actions, gameId: started.gameId, winnerId: ended.winnerId, synchronized: true, rematch: true });
    for (const seat of seats) seat.socket.disconnect();
  }
  await mkdir('docs/qa', { recursive: true });
  await writeFile(`docs/qa/deployment-${transport}-smoke.json`, JSON.stringify({ recordedAt: new Date().toISOString(), origin, socketPath, viewerOrigin, transport, results }, null, 2));
  process.stdout.write(JSON.stringify({ origin, socketPath, transport, results }, null, 2) + '\n');
} finally {
  for (const client of clients) client.socket.disconnect();
}
