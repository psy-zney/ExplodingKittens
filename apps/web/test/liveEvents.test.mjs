import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LiveEventStream } from '../src/liveEvents.ts';
import { describeEffects, effectSound, publicInsertionOf, PUBLIC_INSERT_MS } from '../src/effectDescriptors.ts';
import { newActionId } from '../src/actionId.ts';

test('HTTP gateway actions have unique UUIDs without secure-context randomUUID',()=>{
  const source={getRandomValues:array=>crypto.getRandomValues(array)};
  const ids=Array.from({length:100},()=>newActionId(source));
  assert.equal(new Set(ids).size,100);
  for(const id of ids)assert.match(id,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

const event = (seq, key, params = {}, visibility = 'PUBLIC') => ({ seq, revision: 4, gameId: 'one', key, params, visibility });

test('physical expressions survive private draw and public boom/defuse without exposing another hand',()=>{
  const events=[event(1,'card.drawn',{playerId:'a'}),event(2,'card.drawn.private',{cardType:'DEFUSE',instanceId:'physical',artVariant:5},'PRIVATE_PLAYER'),event(3,'card.exploded',{playerId:'a',artVariant:3}),event(4,'card.defused',{playerId:'a',artVariant:5}),event(5,'player.eliminated',{playerId:'b'}),event(6,'game.won',{playerId:'a'})];
  assert.equal(describeEffects(events,'a')[0].card.artVariant,5);
  assert.equal(describeEffects(events,'b')[0].card,undefined);
  assert.deepEqual(describeEffects(events).map(e=>e.kind),['draw','explosion','defuse','eliminate','win']);
  assert.equal(describeEffects(events)[1].card.artVariant,3);
});

test('functional and social effects have distinct sound cues, and reconnect does not replay throws',()=>{
  for(const [type,sound] of [['ATTACK','attack'],['FAVOR','favor'],['SKIP','skip'],['SHUFFLE','shuffle'],['SEE_THE_FUTURE','peek'],['AMATEUR_ARCHAEOLOGY','dig'],['BATTLE_HAMSTER','hamster'],['HIP_BAT','bat'],['HIP_CAT','duel'],['PLUS_PLUS','plus'],['ROBIN_HOOD','redeal'],['THE_TWINS','twins'],['RESURRECTION','revive']])assert.equal(effectSound(describeEffects([event(1,'card.played',{cardType:type})])[0]),sound);
  for(const prop of ['EGG','BOMB','ROCK'])assert.equal(effectSound(describeEffects([event(1,'social.thrown',{prop})])[0]),`throw_${prop.toLowerCase()}`);
  assert.equal(describeEffects([event(1,'room.started')])[0].kind,'start');
  const stream=new LiveEventStream(),thrown=event(9,'social.thrown',{prop:'EGG'});
  stream.hydrate([thrown]);assert.equal(stream.accept(thrown).event,undefined);
});

test('rapid packet burst preserves every effect; snapshots and retry packets never replay', () => {
  const stream = new LiveEventStream();
  stream.hydrate([event(5, 'card.played', { cardType: 'SKIP' })]);
  const packets = [event(6, 'card.drawn', { playerId: 'a' }), event(7, 'card.drawn.private', { cardType: 'NOPE', instanceId: 'secret' }, 'PRIVATE_PLAYER'), event(8, 'turn.started', { playerId: 'b' })];
  const live = packets.flatMap(packet => { const accepted = stream.accept(packet); assert.equal(accepted.gap, false); return accepted.event ? [accepted.event] : []; });
  assert.equal(live.length, 3);
  assert.deepEqual(describeEffects(live, 'a').map(effect => effect.kind), ['draw']);
  assert.equal(describeEffects(live, 'a')[0].card.type, 'NOPE');
  assert.equal(describeEffects(live, 'b')[0].card, undefined);
  stream.hydrate(packets);
  for (const packet of packets) assert.equal(stream.accept(packet).event, undefined);
  stream.reset();
  stream.hydrate(packets);
  assert.equal(stream.accept(packets[0]).event, undefined);
});

test('private placeholder advances seq; gap suppresses effects until snapshot recovery', () => {
  const stream = new LiveEventStream();
  stream.hydrate([event(3, 'turn.started')]);
  assert.equal(stream.accept(event(4, 'event.hidden')).event, undefined);
  assert.equal(stream.accept(event(5, 'nope.played')).event.key, 'nope.played');
  assert.equal(stream.accept(event(7, 'card.defused')).gap, true);
  assert.equal(stream.accept(event(8, 'turn.started')).event, undefined);
  stream.hydrate([event(8, 'turn.started')]);
  assert.equal(stream.accept(event(9, 'deck.shuffled')).event.key, 'deck.shuffled');
});

test('explosion, defuse, insertion and next turn burst cannot overwrite each other', () => {
  const burst = [event(1, 'card.exploded', { playerId: 'a' }), event(2, 'card.defused', { playerId: 'a' }), event(3, 'defuse.inserted', { playerId: 'a', zone: 'MIDDLE_HIDDEN' }), event(4, 'defuse.inserted.private', { index: 10 }, 'PRIVATE_PLAYER'), event(5, 'turn.started', { playerId: 'b' })];
  assert.deepEqual(describeEffects(burst).map(effect => effect.kind), ['explosion', 'defuse']);
  assert.deepEqual(publicInsertionOf(burst[2]), { seq: 3, zone: 'MIDDLE_HIDDEN', playerId: 'a' });
  assert.equal(publicInsertionOf(burst[3]), null);
});

test('every middle slot yields exactly the same public presentation and fixed duration', () => {
  const expected = publicInsertionOf(event(12, 'defuse.inserted', { playerId: 'a', zone: 'MIDDLE_HIDDEN' }));
  for (const index of [1, 2, 8, 39]) {
    const descriptor = publicInsertionOf(event(12, 'defuse.inserted', { playerId: 'a', zone: 'MIDDLE_HIDDEN', index, pointerY: index * 17, duration: index * 99 }));
    assert.deepEqual(descriptor, expected);
    assert.deepEqual(Object.keys(descriptor).sort(), ['playerId', 'seq', 'zone']);
  }
  assert.equal(PUBLIC_INSERT_MS, 500);
  assert.equal(publicInsertionOf(event(12, 'defuse.inserted', { playerId: 'a', zone: 'TOP' })).zone, 'TOP');
  assert.equal(publicInsertionOf(event(12, 'defuse.inserted', { playerId: 'a', zone: 'BOTTOM' })).zone, 'BOTTOM');
});
