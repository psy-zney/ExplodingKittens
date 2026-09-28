import { describe, expect, it } from 'vitest';
import { calculateDeckScaling, type Card, type CardType, type GameAction } from '@kittens/shared';
import { applyAction, assertInvariants, createGame, makeDeck, getPrivateSnapshot, getPublicSnapshot, getSpectatorSnapshot, tick, type GameState } from '../src/index.js';

const rng=()=>0.37;
const seeds=[{id:'a',name:'A'},{id:'b',name:'B'},{id:'c',name:'C'},{id:'d',name:'D'},{id:'e',name:'E'}];
const game=(count=3,mode:'BASE'|'EXTENDED'='BASE',resurrection=false)=>createGame({gameId:'g',players:seeds.slice(0,count),mode,resurrection,now:0,rng});
const act=(state:GameState,id:string,action:GameAction)=>applyAction(state,id,action,100,rng).state;
function pl(state:GameState,id:string){return state.players.find(p=>p.id===id)!;}
function removeToDiscard(state:GameState,id:string,cardId:string){
  const hand=pl(state,id).hand;
  state.discardPile.push(hand.splice(hand.findIndex(card=>card.instanceId===cardId),1)[0]!);
}
function extract(state:GameState,type:CardType):Card {
  const zones=[state.drawPile,...state.players.map(p=>p.hand),state.discardPile,state.removed];
  for(const zone of zones){const i=zone.findIndex(c=>c.type===type);if(i>=0)return zone.splice(i,1)[0]!;}
  throw new Error(`No ${type}`);
}
function give(state:GameState,id:string,type:CardType){
  const zones=[state.drawPile,...state.players.filter(p=>p.id!==id).map(p=>p.hand),state.discardPile,state.removed];
  for(const zone of zones){const i=zone.findIndex(c=>c.type===type);if(i>=0){const card=zone.splice(i,1)[0]!;pl(state,id).hand.push(card);return card;}}
  throw new Error(`No external ${type}`);
}
function top(state:GameState,type:CardType){const i=state.drawPile.findIndex(c=>c.type===type);if(i<0)throw new Error(`No deck ${type}`);state.drawPile.unshift(state.drawPile.splice(i,1)[0]!);}
function passAll(state:GameState){
  for(const p of state.players.filter(p=>p.alive)){
    if(state.phase!=='NOPE_WINDOW')break;
    state=act(state,p.id,{type:'PASS_NOPE'});
  }
  return state;
}
function play(state:GameState,id:string,types:CardType[],targetId?:string,requestedType?:CardType){
  const used=new Set<string>();
  const cards=types.map(type=>{
    const owned=pl(state,id).hand.find(card=>card.type===type&&!used.has(card.instanceId));
    const card=owned??give(state,id,type);
    used.add(card.instanceId);
    return card;
  });
  state=act(state,id,{type:'PLAY_CARD',cardIds:cards.map(c=>c.instanceId),targetId,requestedType});
  return passAll(state);
}

describe('base setup and core rules',()=>{
  it('waits for the longer deadlines and resets the timer at each response step',()=>{
    let state=game();
    expect(state.deadlineAt).toBe(45000);
    expect(tick(state,44999,rng)).toBeNull();
    const favor=give(state,'a','FAVOR');
    state=act(state,'a',{type:'PLAY_CARD',cardIds:[favor.instanceId],targetId:'b'});
    expect(state.deadlineAt).toBe(12100);
    expect(tick(state,12099,rng)).toBeNull();
    state=tick(state,12100,rng)!.state;
    expect(state.phase).toBe('FAVOR_CHOICE');
    expect(state.deadlineAt).toBe(42100);
    expect(tick(state,42099,rng)).toBeNull();
    state=tick(state,42100,rng)!.state;
    expect(state.phase).toBe('TURN');
    expect(state.deadlineAt).toBe(87100);
    assertInvariants(state);
  });
  it.each([2,3,4,5])('reports the actual active deck size for %i players in either mode', count => {
    for (const mode of ['BASE','EXTENDED'] as const) for (const resurrection of [false,true]) {
      const state = game(count,mode,resurrection);
      expect(calculateDeckScaling(count,mode,resurrection).totalDeckCards).toBe(state.totalCards-state.removed.length);
    }
  });
  it('gives every physical Defuse and Boom a stable distinct expression',()=>{
    for(const [type,count] of [['DEFUSE',6],['EXPLODING_KITTEN',4]] as const){
      const cards=makeDeck('BASE',false).filter(c=>c.type===type);
      expect(cards).toHaveLength(count);
      expect(new Set(cards.map(c=>c.artVariant)).size).toBe(count);
      expect(cards).toEqual(makeDeck('BASE',false).filter(c=>c.type===type));
    }
  });
  it.each([2,3,4,5])('deals the chosen physical rescue cats plus seven cards for %i players',count=>{
    const defuses=makeDeck('BASE',false).filter(c=>c.type==='DEFUSE').reverse();
    const choices=Object.fromEntries(seeds.slice(0,count).map((p,i)=>[p.id,defuses[i]!.instanceId]));
    const state=createGame({gameId:'draft',players:seeds.slice(0,count),now:5000,rng,defuseChoices:choices});
    state.players.forEach((p,i)=>{
      expect(p.hand).toHaveLength(8);
      expect(p.hand[0]).toEqual(defuses[i]);
      expect(p.hand.slice(1).every(c=>c.type!=='DEFUSE'&&c.type!=='EXPLODING_KITTEN')).toBe(true);
    });
    expect(state.deadlineAt).toBe(50000);
    assertInvariants(state);
  });
  it('rejects colliding, foreign or non-Defuse draft choices',()=>{
    const id=makeDeck('BASE',false).find(c=>c.type==='DEFUSE')!.instanceId;
    for(const choices of [{a:id,b:id},{outsider:id},{a:'card-1'}])expect(()=>createGame({gameId:'g',players:seeds.slice(0,2),defuseChoices:choices})).toThrow('INVALID_DEFUSE_SELECTION');
    const partial=createGame({gameId:'g',players:seeds.slice(0,3),defuseChoices:{b:id}});
    expect(pl(partial,'b').hand[0]!.instanceId).toBe(id);
    assertInvariants(partial);
  });
  it('rejects empty and four-card plays without changing the original state',()=>{
    const state=game();
    const before=structuredClone(state);
    for(const cardIds of [[],pl(state,'a').hand.slice(0,4).map(card=>card.instanceId)]) {
      expect(()=>act(state,'a',{type:'PLAY_CARD',cardIds})).toThrow('INVALID_COMBO');
      expect(state).toEqual(before);
    }
  });
  it.each([2,3,4,5])('deals 56 cards without duplicates for %i players',count=>{
    const state=game(count);
    expect(state.totalCards).toBe(56);
    expect(state.players.every(p=>p.hand.length===8&&p.hand.filter(c=>c.type==='DEFUSE').length===1)).toBe(true);
    expect(state.drawPile.filter(c=>c.type==='EXPLODING_KITTEN')).toHaveLength(count-1);
    expect(state.drawPile.filter(c=>c.type==='DEFUSE')).toHaveLength(Math.min(2,6-count));
    assertInvariants(state);
  });
  it('Attack carries only remaining turn debt and Skip consumes one',()=>{
    let state=play(game(),'a',['ATTACK']);
    expect(state.currentPlayerId).toBe('b');expect(state.turnsRemaining).toBe(2);
    state=play(state,'b',['SKIP']);
    expect(state.currentPlayerId).toBe('b');expect(state.turnsRemaining).toBe(1);
    state=play(state,'b',['ATTACK']);
    expect(state.currentPlayerId).toBe('c');expect(state.turnsRemaining).toBe(3);
    assertInvariants(state);
  });
  it('Nope chains toggle cancellation before the effect starts',()=>{
    let state=game();const skip=give(state,'a','SKIP');
    state=act(state,'a',{type:'PLAY_CARD',cardIds:[skip.instanceId]});
    const nope1=give(state,'b','NOPE');state=act(state,'b',{type:'NOPE',cardId:nope1.instanceId});
    state=passAll(state);expect(state.currentPlayerId).toBe('a');
    const skip2=give(state,'a','SKIP');state=act(state,'a',{type:'PLAY_CARD',cardIds:[skip2.instanceId]});
    const nope2=give(state,'b','NOPE');const nope3=give(state,'c','NOPE');
    state=act(state,'b',{type:'NOPE',cardId:nope2.instanceId});
    state=act(state,'c',{type:'NOPE',cardId:nope3.instanceId});
    state=passAll(state);expect(state.currentPlayerId).toBe('b');
    assertInvariants(state);
  });
  it('pair randomly steals and triple requests a card type',()=>{
    let state=game();
    const pair=['CAT_TACO','CAT_TACO'] as const;
    const ids=pair.map(t=>give(state,'a',t).instanceId);
    const before=pl(state,'b').hand.length;
    state=passAll(act(state,'a',{type:'PLAY_CARD',cardIds:ids,targetId:'b'}));
    expect(pl(state,'b').hand.length).toBe(before-1);
    const defuseBefore=pl(state,'b').hand.filter(c=>c.type==='DEFUSE').length;
    state=play(state,'a',['CAT_BEARD','CAT_BEARD','CAT_BEARD'],'b','DEFUSE');
    expect(pl(state,'b').hand.filter(c=>c.type==='DEFUSE').length).toBe(defuseBefore-1);
    assertInvariants(state);
  });
  it('See the Future is ordered and private; Shuffle is server-side',()=>{
    let state=game();const expected=state.drawPile.slice(0,3);
    state=play(state,'a',['SEE_THE_FUTURE']);
    expect(getPrivateSnapshot(state,'a').privateData.futureCards).toEqual(expected);
    expect(JSON.stringify(getPublicSnapshot(state))).not.toContain(expected[0]!.instanceId);
    state=play(state,'a',['SHUFFLE']);
    expect(getPrivateSnapshot(state,'a').privateData.futureCards).toBeUndefined();
    state=play(state,'a',['SEE_THE_FUTURE']);
    expect(getPrivateSnapshot(state,'a').privateData.futureCards).toBeDefined();
    state=act(state,'a',{type:'DRAW_CARD'});
    expect(getPrivateSnapshot(state,'a').privateData.futureCards).toBeUndefined();
    assertInvariants(state);
  });
  it('Favor is chosen by the target and timeout chooses by server RNG',()=>{
    let state=play(game(),'a',['FAVOR'],'b');
    expect(state.phase).toBe('FAVOR_CHOICE');
    const card=pl(state,'b').hand[0]!;
    state=act(state,'b',{type:'CHOOSE_CARD',cardId:card.instanceId});
    expect(pl(state,'a').hand.some(c=>c.instanceId===card.instanceId)).toBe(true);
    state=play(state,'a',['FAVOR'],'c');
    const result=tick(state,state.deadlineAt!,rng)!;
    expect(result.state.phase).toBe('TURN');assertInvariants(result.state);
  });
  it('Defuse accepts every slot; middle has an indistinguishable public payload and reconnect snapshot',()=>{
    let state=game();top(state,'EXPLODING_KITTEN');
    state=act(state,'a',{type:'DRAW_CARD'});
    expect(state.phase).toBe('DEFUSE_INSERT');
    const n=state.drawPile.length;
    expect(getPrivateSnapshot(state,'a').privateData.insertSlotCount).toBe(n+1);
    expect(getPrivateSnapshot(state,'b').privateData.insertSlotCount).toBeUndefined();
    expect(getSpectatorSnapshot(state).pending).toEqual({kind:'DEFUSE_INSERT',sourcePlayerId:'a'});
    const middle1=applyAction(state,'a',{type:'DEFUSE_POSITION',index:1},100,rng);
    const middle2=applyAction(state,'a',{type:'DEFUSE_POSITION',index:2},100,rng);
    const pub=(events:typeof middle1.events)=>events.filter(e=>e.visibility==='PUBLIC');
    expect(pub(middle1.events)).toEqual(pub(middle2.events));
    expect(getPublicSnapshot(middle1.state)).toEqual(getPublicSnapshot(middle2.state));
    expect(JSON.stringify(getSpectatorSnapshot(middle1.state))).not.toContain('defuse.inserted.private');
    expect(pub(middle1.events).find(e=>e.key==='defuse.inserted')?.params).toEqual({playerId:'a',zone:'MIDDLE_HIDDEN'});
    const topResult=applyAction(state,'a',{type:'DEFUSE_POSITION',index:0},100,rng);
    const bottomResult=applyAction(state,'a',{type:'DEFUSE_POSITION',index:n},100,rng);
    expect(pub(topResult.events).find(e=>e.key==='defuse.inserted')?.params.zone).toBe('TOP');
    expect(pub(bottomResult.events).find(e=>e.key==='defuse.inserted')?.params.zone).toBe('BOTTOM');
    for(const r of [middle1,middle2,topResult,bottomResult])assertInvariants(r.state);
    for(let index=0;index<=n;index++){
      const result=applyAction(state,'a',{type:'DEFUSE_POSITION',index},100,rng);
      expect(result.state.drawPile[index]?.type).toBe('EXPLODING_KITTEN');
      const expected=index===0?'TOP':index===n?'BOTTOM':'MIDDLE_HIDDEN';
      expect(pub(result.events).find(e=>e.key==='defuse.inserted')?.params.zone).toBe(expected);
      assertInvariants(result.state);
    }
    expect(()=>applyAction(state,'a',{type:'DEFUSE_POSITION',index:n+1},100,rng)).toThrow();
  });
  it('eliminated hand stays secret and final survivor wins',()=>{
    let state=game(2);
    const defuse=pl(state,'a').hand.find(c=>c.type==='DEFUSE')!;
    pl(state,'a').hand.splice(pl(state,'a').hand.indexOf(defuse),1);state.discardPile.push(defuse);
    top(state,'EXPLODING_KITTEN');state=act(state,'a',{type:'DRAW_CARD'});
    expect(state.phase).toBe('FINISHED');expect(state.winnerId).toBe('b');
    expect(pl(state,'a').hand.length).toBeGreaterThan(0);
    expect(getPublicSnapshot(state).players[0]!.handCount).toBe(0);
    expect(getPrivateSnapshot(state,'a').hand).toEqual([]);
    assertInvariants(state);
  });
  it.each([2,3,4,5])('can finish a real draw-only match with %i players',count=>{
    let state=game(count);
    let steps=0;
    while(state.phase!=='FINISHED'&&steps++<600){
      const next=tick(state,state.deadlineAt!,rng);
      expect(next).not.toBeNull();
      state=next!.state;
      assertInvariants(state);
    }
    expect(state.phase).toBe('FINISHED');
    expect(state.players.filter(p=>p.alive).map(p=>p.id)).toEqual([state.winnerId]);
  });
});

describe('application expansion and resurrection',()=>{
  it('Plus Plus Future views four ordered cards; Plus Plus Bat lasts four starts',()=>{
    let state=game(3,'EXTENDED');
    state=play(state,'a',['PLUS_PLUS','SEE_THE_FUTURE']);
    // Cards given by the fixture can move the deck. Check against its actual order.
    expect(getPrivateSnapshot(state,'a').privateData.futureCards).toEqual(state.drawPile.slice(0,4));
    expect(getPrivateSnapshot(state,'a').privateData.futureCards).toHaveLength(4);
    state=game(3,'EXTENDED');
    state=play(state,'a',['PLUS_PLUS','HIP_BAT'],'b');
    expect(pl(state,'b').bats).toEqual([4]);
    state=play(state,'a',['ATTACK']);
    for(let i=0;i<2;i++){
      expect(state.phase).toBe('HIP_BAT_DISCARD');
      state=tick(state,state.deadlineAt!,rng)!.state;
      expect(state.phase).toBe('TURN');
      state=play(state,'b',['SKIP']);
    }
    expect(pl(state,'b').bats).toEqual([2]);
    expect(state.currentPlayerId).toBe('c');
    assertInvariants(state);
  });

  it('Hip Cat timeout preserves a submitted secret and tie awards the sole discard to actor',()=>{
    let state=game(3,'EXTENDED');
    const discard=extract(state,'SKIP');
    state.discardPile.push(discard);
    state=play(state,'a',['HIP_CAT'],'b');
    const aBefore=pl(state,'a').hand.length;
    const bBefore=pl(state,'b').hand.length;
    state=act(state,'a',{type:'HIP_CAT_CHOICE',choice:'PAPER'});
    expect(getPrivateSnapshot(state,'a').privateData.hipCatChoice).toBe('PAPER');
    expect(getPrivateSnapshot(state,'b').privateData.hipCatChoice).toBeUndefined();
    expect(JSON.stringify(getSpectatorSnapshot(state))).not.toContain('PAPER');
    // rng .37 chooses PAPER for the missing target.
    state=tick(state,state.deadlineAt!,rng)!.state;
    expect(pl(state,'a').hand.length).toBe(aBefore+1);
    expect(pl(state,'b').hand.length).toBe(bBefore);
    expect(state.log.findLast(e=>e.key==='hipCat.revealed')?.params).toMatchObject({first:'PAPER',second:'PAPER',winnerId:null});
    assertInvariants(state);
  });

  it('Twins gives all four matching cards',()=>{
    let state=game(3,'EXTENDED');
    for(const player of state.players){const matching=player.hand.filter(card=>card.type==='CAT_POTATO');player.hand=player.hand.filter(card=>card.type!=='CAT_POTATO');state.drawPile.push(...matching);}
    for(let i=0;i<4;i++)give(state,'b','CAT_POTATO');
    state=play(state,'a',['THE_TWINS']);
    expect(pl(state,'b').hand.filter(card=>card.type==='CAT_POTATO')).toHaveLength(0);
    expect(pl(state,'a').hand.filter(card=>card.type==='CAT_POTATO')).toHaveLength(4);
    assertInvariants(state);
  });

  it('Nope cancels Resurrection and finished games reject it',()=>{
    let state=game(3,'BASE',true);
    const defuse=pl(state,'a').hand.find(card=>card.type==='DEFUSE')!;
    removeToDiscard(state,'a',defuse.instanceId);
    top(state,'EXPLODING_KITTEN');state=act(state,'a',{type:'DRAW_CARD'});
    const saved=pl(state,'a').hand.map(card=>card.instanceId);
    const resurrection=give(state,'b','RESURRECTION');
    state=act(state,'b',{type:'PLAY_CARD',cardIds:[resurrection.instanceId],targetId:'a'});
    const nope=give(state,'c','NOPE');
    state=act(state,'c',{type:'NOPE',cardId:nope.instanceId});
    state=passAll(state);
    expect(pl(state,'a').alive).toBe(false);
    expect(pl(state,'a').hand.map(card=>card.instanceId)).toEqual(saved);
    assertInvariants(state);
    state=game(2,'BASE',true);
    const defuse2=pl(state,'a').hand.find(card=>card.type==='DEFUSE')!;
    removeToDiscard(state,'a',defuse2.instanceId);
    top(state,'EXPLODING_KITTEN');state=act(state,'a',{type:'DRAW_CARD'});
    const card=give(state,'b','RESURRECTION');
    const finished=structuredClone(state);
    expect(()=>act(state,'b',{type:'PLAY_CARD',cardIds:[card.instanceId],targetId:'a'})).toThrow('GAME_FINISHED');
    expect(state).toEqual(finished);
  });
  it('80-card deck adds three of each extension with unique physical IDs',()=>{
    const deck=makeDeck('EXTENDED');
    const state=game(3,'EXTENDED');expect(state.totalCards).toBe(80);assertInvariants(state);
    for(const type of ['AMATEUR_ARCHAEOLOGY','BATTLE_HAMSTER','CREEPY_PEEKY','HIP_BAT','HIP_CAT','PLUS_PLUS','ROBIN_HOOD','THE_TWINS']) expect(deck.filter(card=>card.type===type)).toHaveLength(3);
    expect(new Set(deck.map(card=>card.instanceId)).size).toBe(80);
  });
  it('Amateur Archaeology chooses an eligible discard, reinserts privately',()=>{
    let state=play(game(3,'EXTENDED'),'a',['SEE_THE_FUTURE']);
    expect(getPrivateSnapshot(state,'a').privateData.futureCards).toBeDefined();
    const chosen=state.discardPile.find(c=>c.type==='SEE_THE_FUTURE')!;
    state=play(state,'a',['AMATEUR_ARCHAEOLOGY']);
    expect(state.phase).toBe('ARCHAEOLOGY_CHOICE');
    expect(getPrivateSnapshot(state,'a').privateData.discardChoices?.some(c=>c.instanceId===chosen.instanceId)).toBe(true);
    state=act(state,'a',{type:'CHOOSE_CARD',cardId:chosen.instanceId});
    expect(state.drawPile.some(c=>c.instanceId===chosen.instanceId)).toBe(true);assertInvariants(state);
    expect(getPrivateSnapshot(state,'a').privateData.futureCards).toBeUndefined();
  });
  it('Battle Hamster timeout clears a disconnected large hand in one tick',()=>{
    let state=play(game(3,'EXTENDED'),'a',['BATTLE_HAMSTER'],'b');
    expect(state.phase).toBe('BATTLE_HAMSTER_DISCARD');
    const victim=pl(state,'b');
    while(victim.hand.length<10){
      const index=state.drawPile.findIndex(card=>card.type!=='EXPLODING_KITTEN');
      victim.hand.push(state.drawPile.splice(index,1)[0]!);
    }
    const before=victim.hand.length;
    assertInvariants(state);
    const result=tick(state,state.deadlineAt!,rng)!;
    state=result.state;
    expect(result.events.filter(event=>event.key==='hamster.discarded')).toHaveLength(before-1);
    expect(state.phase).toBe('TURN');
    expect(pl(state,'b').hand).toHaveLength(1);assertInvariants(state);
  });
  it('Creepy Peeky reveals a target hand only to the actor',()=>{
    const state=play(game(3,'EXTENDED'),'a',['CREEPY_PEEKY'],'b');
    expect(getPrivateSnapshot(state,'a').privateData.peekHand?.cards).toEqual(pl(state,'b').hand);
    expect(getPrivateSnapshot(state,'c').privateData.peekHand).toBeUndefined();
    for(const card of pl(state,'b').hand) expect(JSON.stringify(getSpectatorSnapshot(state))).not.toContain(`"instanceId":"${card.instanceId}"`);
    assertInvariants(state);
  });
  it('Hip Bat demands a discard at each of three starts',()=>{
    let state=play(game(3,'EXTENDED'),'a',['HIP_BAT'],'b');
    expect(pl(state,'b').bats).toEqual([3]);
    state=play(state,'a',['ATTACK']);
    expect(state.phase).toBe('HIP_BAT_DISCARD');
    const discard=pl(state,'b').hand[0]!;
    state=act(state,'b',{type:'CHOOSE_CARD',cardId:discard.instanceId});
    expect(state.discardPile.some(c=>c.instanceId===discard.instanceId)).toBe(true);
    assertInvariants(state);
  });
  it('Hip Cat hides choices until both submit and takes latest discard cards',()=>{
    let state=play(game(3,'EXTENDED'),'a',['SEE_THE_FUTURE']);
    state=play(state,'a',['HIP_CAT'],'b');
    state=act(state,'a',{type:'HIP_CAT_CHOICE',choice:'ROCK'});
    expect(JSON.stringify(getPublicSnapshot(state))).not.toContain('ROCK');
    state=act(state,'b',{type:'HIP_CAT_CHOICE',choice:'SCISSORS'});
    expect(state.log.some(e=>e.key==='hipCat.revealed'&&e.params.winnerId==='a')).toBe(true);
    assertInvariants(state);
  });
  it('Plus Plus adds one to numeric Attack and rejects nonnumeric Skip',()=>{
    let state=game(3,'EXTENDED');const plus=give(state,'a','PLUS_PLUS');const skip=give(state,'a','SKIP');
    expect(()=>act(state,'a',{type:'PLAY_CARD',cardIds:[plus.instanceId,skip.instanceId]})).toThrow();
    const attack=give(state,'a','ATTACK');
    state=act(state,'a',{type:'PLAY_CARD',cardIds:[plus.instanceId,attack.instanceId]});
    state=passAll(state);expect(state.turnsRemaining).toBe(3);assertInvariants(state);
  });
  it('Robin Hood conserves all living hands and does not expose cards',()=>{
    let state=game(3,'EXTENDED');const card=give(state,'a','ROBIN_HOOD');
    const before=state.players.reduce((n,p)=>n+p.hand.length,0)-1;
    state=passAll(act(state,'a',{type:'PLAY_CARD',cardIds:[card.instanceId]}));
    expect(state.players.reduce((n,p)=>n+p.hand.length,0)).toBe(before);
    const sizes=state.players.map(p=>p.hand.length);expect(Math.max(...sizes)-Math.min(...sizes)).toBeLessThanOrEqual(1);
    assertInvariants(state);
  });
  it('The Twins takes full pairs, leaving one of a triple',()=>{
    let state=game(3,'EXTENDED');
    const existing=pl(state,'b').hand.filter(c=>c.type==='CAT_TACO');
    pl(state,'b').hand=pl(state,'b').hand.filter(c=>c.type!=='CAT_TACO');state.drawPile.push(...existing);
    for(let i=0;i<3;i++)give(state,'b','CAT_TACO');
    const actorBefore=pl(state,'a').hand.filter(c=>c.type==='CAT_TACO').length;
    state=play(state,'a',['THE_TWINS']);
    expect(pl(state,'b').hand.filter(c=>c.type==='CAT_TACO')).toHaveLength(1);
    expect(pl(state,'a').hand.filter(c=>c.type==='CAT_TACO')).toHaveLength(actorBefore+2);
    assertInvariants(state);
  });
  it('Resurrection returns the exact preserved hand and Kitten, with next-circuit entry',()=>{
    let state=game(3,'BASE',true);expect(state.totalCards).toBe(58);
    const defuse=pl(state,'a').hand.find(c=>c.type==='DEFUSE')!;
    pl(state,'a').hand.splice(pl(state,'a').hand.indexOf(defuse),1);state.discardPile.push(defuse);
    const saved=pl(state,'a').hand.map(c=>c.instanceId);
    top(state,'EXPLODING_KITTEN');state=act(state,'a',{type:'DRAW_CARD'});
    expect(state.currentPlayerId).toBe('b');expect(pl(state,'a').alive).toBe(false);
    state=play(state,'b',['SEE_THE_FUTURE']);
    expect(getPrivateSnapshot(state,'b').privateData.futureCards).toBeDefined();
    state=play(state,'b',['RESURRECTION'],'a');
    expect(pl(state,'a').alive).toBe(true);expect(pl(state,'a').hand.map(c=>c.instanceId)).toEqual(saved);
    expect(pl(state,'a').reviveAvailableCircuit).toBe(state.circuit+1);
    expect(getPrivateSnapshot(state,'b').privateData.futureCards).toBeUndefined();
    assertInvariants(state);
  });
});
