import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspectPlay } from '@kittens/shared/play-policy';
import { selectCard, selectHandCard, canSelect, suggestPlay, planAutoAction, secondsRemaining } from '../src/playAssist.ts';
const card = (type, id = type) => ({ type, instanceId: id });
const hand = [card('DEFUSE'), card('NOPE'), card('CAT_TACO', 't1'), card('CAT_TACO', 't2'), card('CAT_TACO', 't3'), card('SKIP'), card('ATTACK'), card('PLUS_PLUS')];
const game = { gameId: 'g', turnId: 't', revision: 1, phase: 'TURN', currentPlayerId: 'a', players: [{id:'a',alive:true,handCount:8},{id:'b',alive:true,handCount:4}], pending: null };
const mine = { ...game, hand, privateData: {} };

test('direct hand selection infers pair/triple, deselects, replaces unrelated cards and supports ++', () => {
  let selected = selectHandCard([], hand[2], hand);
  selected = selectHandCard(selected, hand[3], hand);
  assert.equal(inspectPlay(hand.filter(c => selected.includes(c.instanceId))).kind, 'PAIR');
  selected = selectHandCard(selected, hand[4], hand);
  assert.equal(inspectPlay(hand.filter(c => selected.includes(c.instanceId))).kind, 'TRIPLE');
  selected = selectHandCard(selected, hand[3], hand);
  assert.deepEqual(selected, ['t1', 't3']);
  assert.deepEqual(selectHandCard(selected, hand[5], hand), ['SKIP']);
  assert.deepEqual(selectHandCard(['ATTACK'], hand[7], hand), ['ATTACK', 'PLUS_PLUS']);
  assert.deepEqual(selectHandCard(['PLUS_PLUS'], hand[6], hand), ['PLUS_PLUS', 'ATTACK']);
  assert.deepEqual(selectHandCard(['t1'], hand[3], hand, true), ['t2']);
});

test('shared shapes support all legal combos and reject duplicates, mismatches and protected singles', () => {
  assert.equal(inspectPlay([hand[2],hand[3]]).kind,'PAIR');
  assert.equal(inspectPlay([hand[2],hand[3],hand[4]]).kind,'TRIPLE');
  assert.equal(inspectPlay([hand[6],hand[7]]).numericBonus,1);
  for(const cards of [[], [hand[0]], [hand[1]], [hand[2]], [hand[7]], [hand[2],hand[6]], [hand[2],hand[2]], hand.slice(0,4)]) assert.equal(inspectPlay(cards).valid,false);
  assert.equal(inspectPlay([card('RESURRECTION')]).target,'ELIMINATED');
  assert.equal(inspectPlay([card('RESURRECTION','r1'),card('RESURRECTION','r2')]).target,'LIVING');
});
test('single selection replaces the old card; combo changes reset without submitting mismatched groups', () => {
  assert.deepEqual(selectCard(['SKIP'],hand[6],hand,'SINGLE'),['ATTACK']);
  assert.deepEqual(selectCard(['t1'],hand[3],hand,'PAIR'),['t1','t2']);
  assert.deepEqual(selectCard(['t1','t2'],hand[6],hand,'PAIR'),['ATTACK']);
  assert.deepEqual(selectCard(['t1','t2'],hand[4],hand,'PAIR'),['t1','t3']);
  assert.deepEqual(selectCard(['t1','t2'],hand[4],hand,'TRIPLE'),['t1','t2','t3']);
  assert.deepEqual(selectCard(['t1','t2'],hand[5],hand,'TRIPLE',true),['SKIP']);
  assert.deepEqual(selectCard(['ATTACK'],hand[7],hand,'PLUS_PLUS'),['ATTACK','PLUS_PLUS']);
  assert.equal(canSelect(hand[2],hand,'SINGLE',game,'a'),false);
  assert.equal(canSelect(hand[2],hand,'TRIPLE',game,'a'),true);
});
test('suggestions depend on private permitted knowledge and preserve defensive cards', () => {
  assert.equal(suggestPlay(game,mine,'a').reason,'pair');
  const known = {...mine,privateData:{futureCards:[card('EXPLODING_KITTEN')]}};
  assert.equal(suggestPlay(game,known,'a').reason,'escape');
  assert.equal(suggestPlay(game,{...mine,hand:[card('SEE_THE_FUTURE')],privateData:{}},'a').reason,'future');
  assert.equal(suggestPlay(game,{...mine,hand:hand.slice(0,2)},'a').reason,'draw');
});
test('autoplay is off by default, respects roles and handles every compulsory phase without secret data', () => {
  assert.equal(planAutoAction(game,mine,'a','OFF',20),null);
  assert.equal(planAutoAction(game,mine,'b','BASIC',20),null);
  assert.equal(planAutoAction(game,null,'a','BASIC',20),null);
  assert.equal(planAutoAction(game,mine,'a','BASIC',0),null);
  assert.equal(planAutoAction({...game,players:[{id:'a',alive:false}]},mine,'a','BASIC',20),null);
  assert.equal(planAutoAction(game,mine,'a','DRAW',6),null);
  assert.deepEqual(planAutoAction(game,mine,'a','DRAW',5),{type:'DRAW_CARD'});
  assert.deepEqual(planAutoAction(game,mine,'a','BASIC',20),{type:'PLAY_CARD',cardIds:['t1','t2'],targetId:'b'});
  assert.deepEqual(planAutoAction(game,mine,'a','BASIC',20,3),{type:'DRAW_CARD'});
  for(const phase of ['FAVOR_CHOICE','HIP_BAT_DISCARD','BATTLE_HAMSTER_DISCARD']) assert.equal(planAutoAction({...game,phase,pending:{targetPlayerId:'a'}},mine,'a','BASIC',20).cardId,'t1');
  assert.deepEqual(planAutoAction({...game,phase:'NOPE_WINDOW',pending:{passedPlayerIds:[]}},mine,'a','BASIC',6),{type:'PASS_NOPE'});
  assert.equal(planAutoAction({...game,phase:'NOPE_WINDOW',pending:{passedPlayerIds:['a']}},mine,'a','BASIC',6),null);
  assert.deepEqual(planAutoAction({...game,phase:'DEFUSE_INSERT',pending:{sourcePlayerId:'a'}},{...mine,privateData:{insertSlotCount:17}},'a','BASIC',20),{type:'DEFUSE_POSITION',index:16});
  assert.equal(planAutoAction({...game,phase:'ARCHAEOLOGY_CHOICE',pending:{sourcePlayerId:'a'}},{...mine,privateData:{discardChoices:[card('SKIP'),card('DEFUSE')]}},'a','BASIC',20).cardId,'DEFUSE');
  assert.equal(planAutoAction({...game,phase:'HIP_CAT_CHOICE',pending:{targetPlayerId:'a'}},mine,'a','BASIC',20).choice,'ROCK');
  assert.equal(planAutoAction({...game,phase:'HIP_CAT_CHOICE',pending:{targetPlayerId:'a'}},{...mine,privateData:{hipCatChoice:'PAPER'}},'a','BASIC',20),null);
});
test('countdown compensates server clock skew and clamps expired deadlines', () => {
  assert.equal(secondsRemaining(40000,10000,10000),20);
  assert.equal(secondsRemaining(40000,60000,-30000),10);
  assert.equal(secondsRemaining(40000,60000,0),0);
  assert.equal(secondsRemaining(null,10000,0),0);
});
