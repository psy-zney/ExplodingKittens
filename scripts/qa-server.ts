// Local test runner only. This file is never imported by the production app
// or copied into the runtime image. Fixture control binds to loopback.
import { createServer } from 'node:http';
import { createGameServer } from '../apps/server/src/server.ts';
import { assertInvariants } from '@kittens/engine';
import type { CardType } from '@kittens/shared';

const gameServer = createGameServer({ corsOrigins: ['http://localhost:5182', 'http://127.0.0.1:5182'] });
const controls = createServer(async (request, response) => {
  if (request.method !== 'POST') { response.writeHead(405).end(); return; }
  let body = '';
  for await (const chunk of request) body += chunk;
  try {
    const { roomCode, fixture } = JSON.parse(body);
    const room = gameServer.rooms.get(roomCode);
    if (!room?.game || room.game.phase !== 'TURN') throw new Error('Fixture requires an idle turn');
    const state = room.game;
    const actor = state.players[0]!;
    const types: CardType[] = fixture === 'hamster' ? ['DEFUSE', 'BATTLE_HAMSTER', 'SKIP', 'NOPE'] : ['DEFUSE', 'CAT_TACO', 'CAT_TACO', 'CAT_TACO', 'FAVOR', 'SEE_THE_FUTURE', 'SKIP', 'ATTACK', 'NOPE'];
    state.drawPile.push(...actor.hand.splice(0));
    for (const type of types) {
      const zones = [state.drawPile, ...state.players.slice(1).map(p => p.hand), state.discardPile, state.removed];
      const zone = zones.find(cards => cards.some(c => c.type === type));
      if (!zone) throw new Error(`Missing fixture card ${type}`);
      const index = zone.findIndex(c => c.type === type);
      actor.hand.push(zone.splice(index, 1)[0]!);
    }
    state.currentPlayerId = actor.id;
    state.deadlineAt = Date.now() + (fixture === 'timer' ? 4500 : 30000);
    state.revision += 1;
    assertInvariants(state);
    response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ revision: state.revision }));
  } catch { response.writeHead(400).end('Fixture rejected'); }
});
controls.listen(3013, '127.0.0.1');
void gameServer.listen(3012).then(() => process.stdout.write('Local QA game:3012, loopback fixture control:3013\n'));
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => { controls.close(); void gameServer.close().then(() => process.exit(0)); });
