import type { Card, CardType, GameAction, GameEvent } from '@kittens/shared';
import { inspectPlay } from '@kittens/shared/play-policy';
import { makeDeck, randomIndex, secureRandom, shuffle } from './deck.js';
import { assertInvariants } from './snapshot.js';
import { GameError } from './types.js';
import type { CreateGameOptions, GameState, GameTransition, Pending, PlayerState, PlayIntent, RandomSource } from './types.js';

export const TURN_MS=30_000;
export const NOPE_MS=7_000;
export const CHOICE_MS=20_000;

function fail(code:string):never { throw new GameError(code); }
function person(state:GameState,id:string):PlayerState {
  const found=state.players.find(player=>player.id===id);
  if(!found) return fail('PLAYER_NOT_FOUND');
  return found;
}
function current(state:GameState,id:string):PlayerState {
  if(state.phase==='FINISHED') fail('GAME_FINISHED');
  if(state.currentPlayerId!==id) fail('NOT_YOUR_TURN');
  const player=person(state,id);
  if(!player.alive) fail('PLAYER_ELIMINATED');
  return player;
}
function target(state:GameState,actorId:string,targetId?:string,dead=false):PlayerState {
  if(!targetId) return fail('TARGET_REQUIRED');
  const player=person(state,targetId);
  if(player.id===actorId || player.alive===dead) fail('INVALID_TARGET');
  return player;
}
function emit(state:GameState,events:GameEvent[],key:string,params:GameEvent['params']={},visibility:GameEvent['visibility']='PUBLIC',playerId?:string) {
  const event:GameEvent={seq:++state.eventSeq,revision:state.revision,key,params,visibility,...(playerId?{playerId}:{})};
  state.log.push(event);
  if(state.log.length>300) state.log.shift();
  events.push(event);
}
function setPhase(state:GameState,phase:GameState['phase'],pending:Pending|null,deadlineAt:number|null) {
  state.phase=phase;state.pending=pending;state.deadlineAt=deadlineAt;
}
function finishIfWinner(state:GameState,events:GameEvent[]):boolean {
  const alive=state.players.filter(player=>player.alive);
  if(alive.length!==1) return false;
  state.winnerId=alive[0]!.id;
  state.currentPlayerId=null;
  state.turnsRemaining=0;
  setPhase(state,'FINISHED',null,null);
  emit(state,events,'game.won',{playerId:alive[0]!.id});
  return true;
}
function startBatDiscards(state:GameState,now:number,events:GameEvent[]) {
  const player=person(state,state.currentPlayerId!);
  const triggers=player.bats.filter(count=>count>0).length;
  player.bats=player.bats.map(count=>count-1).filter(count=>count>0);
  if(triggers>0 && player.hand.length>0){
    setPhase(state,'HIP_BAT_DISCARD',{kind:'HIP_BAT_DISCARD',targetPlayerId:player.id,remaining:triggers},now+CHOICE_MS);
    emit(state,events,'hipBat.discardRequired',{playerId:player.id,count:triggers});
  }else setPhase(state,'TURN',null,now+TURN_MS);
}
function beginTurn(state:GameState,now:number,events:GameEvent[]) {
  state.turnNumber++;
  state.turnId=`${state.gameId}:${state.turnNumber}`;
  emit(state,events,'turn.started',{playerId:state.currentPlayerId!,turnsRemaining:state.turnsRemaining});
  startBatDiscards(state,now,events);
}
function nextLiving(state:GameState):{player:PlayerState;circuit:number} {
  const from=state.players.findIndex(player=>player.id===state.currentPlayerId);
  if(from<0) return fail('INVALID_STATE');
  let circuit=state.circuit;
  for(let step=1;step<=state.players.length*3;step++){
    const index=(from+step)%state.players.length;
    if(index===0) circuit++;
    const candidate=state.players[index]!;
    if(candidate.alive && candidate.reviveAvailableCircuit<=circuit) return {player:candidate,circuit};
  }
  return fail('INVALID_STATE');
}
function advanceTurn(state:GameState,now:number,events:GameEvent[]) {
  if(finishIfWinner(state,events)) return;
  if(state.turnsRemaining>1){state.turnsRemaining--;beginTurn(state,now,events);return;}
  const next=nextLiving(state);
  state.currentPlayerId=next.player.id;
  state.circuit=next.circuit;
  state.turnsRemaining=1;
  state.attackDebtActive=false;
  beginTurn(state,now,events);
}
function attack(state:GameState,bonus:number,now:number,events:GameEvent[]) {
  const debt=(state.attackDebtActive?state.turnsRemaining:0)+2+bonus;
  const next=nextLiving(state);
  state.currentPlayerId=next.player.id;
  state.circuit=next.circuit;
  state.turnsRemaining=debt;
  state.attackDebtActive=true;
  emit(state,events,'attack.applied',{targetId:next.player.id,turns:debt});
  beginTurn(state,now,events);
}
function removeOwned(player:PlayerState,cardId:string):Card {
  const index=player.hand.findIndex(card=>card.instanceId===cardId);
  if(index<0) return fail('CARD_NOT_OWNED');
  return player.hand.splice(index,1)[0]!;
}
function invalidateFuture(state:GameState){
  for(const insight of Object.values(state.insights)) delete insight.futureCards;
}
function draw(state:GameState,now:number,rng:RandomSource,events:GameEvent[]) {
  const player=person(state,state.currentPlayerId!);
  if(state.drawPile.length===0) return fail('DRAW_PILE_EMPTY');
  const card=state.drawPile.shift()!;
  invalidateFuture(state);
  if(card.type!=='EXPLODING_KITTEN'){
    player.hand.push(card);
    emit(state,events,'card.drawn',{playerId:player.id});
    emit(state,events,'card.drawn.private',{cardType:card.type,instanceId:card.instanceId,artVariant:card.artVariant??0},'PRIVATE_PLAYER',player.id);
    advanceTurn(state,now,events);
    return;
  }
  emit(state,events,'card.exploded',{playerId:player.id,artVariant:card.artVariant??0});
  const defuse=player.hand.find(item=>item.type==='DEFUSE');
  if(defuse){
    removeOwned(player,defuse.instanceId);
    state.discardPile.push(defuse);
    setPhase(state,'DEFUSE_INSERT',{kind:'DEFUSE_INSERT',sourcePlayerId:player.id,kitten:card},now+CHOICE_MS);
    emit(state,events,'card.defused',{playerId:player.id,artVariant:defuse.artVariant??0});
    return;
  }
  player.alive=false;
  player.eliminatedKitten=card;
  player.bats=[];
  emit(state,events,'player.eliminated',{playerId:player.id});
  if(finishIfWinner(state,events)) return;
  // The eliminated player's remaining Attack debt expires with that player.
  state.turnsRemaining=1;
  state.attackDebtActive=false;
  const next=nextLiving(state);
  state.currentPlayerId=next.player.id;
  state.circuit=next.circuit;
  beginTurn(state,now,events);
}
function insertKitten(state:GameState,index:number,now:number,events:GameEvent[]) {
  if(state.pending?.kind!=='DEFUSE_INSERT') return fail('INVALID_PHASE');
  if(!Number.isInteger(index)||index<0||index>state.drawPile.length) return fail('INVALID_INSERT_POSITION');
  const actor=state.pending.sourcePlayerId;
  const kitten=state.pending.kitten;
  const zone=index===0?'TOP':index===state.drawPile.length?'BOTTOM':'MIDDLE_HIDDEN';
  state.drawPile.splice(index,0,kitten);
  invalidateFuture(state);
  emit(state,events,'defuse.inserted',{playerId:actor,zone});
  emit(state,events,'defuse.inserted.private',{index},'PRIVATE_PLAYER',actor);
  advanceTurn(state,now,events);
}
function primaryType(intent:PlayIntent):CardType {return intent.cards.find(card=>card.type!=='PLUS_PLUS')?.type ?? 'PLUS_PLUS';}
function makeIntent(state:GameState,actor:PlayerState,action:Extract<GameAction,{type:'PLAY_CARD'}>):PlayIntent {
  if(action.cardIds.length<1||action.cardIds.length>3) fail('INVALID_COMBO');
  if(action.cardIds.length!==new Set(action.cardIds).size) fail('DUPLICATE_CARD');
  const cards=action.cardIds.map(id=>actor.hand.find(card=>card.instanceId===id) ?? fail('CARD_NOT_OWNED'));
  const inspection=inspectPlay(cards);
  if(!inspection.valid) return fail(inspection.reason);
  const {kind,numericBonus}=inspection;
  if(inspection.target==='LIVING') target(state,actor.id,action.targetId);
  if(inspection.target==='ELIMINATED') target(state,actor.id,action.targetId,true);
  if(kind==='TRIPLE' && (!action.requestedType||action.requestedType==='EXPLODING_KITTEN')) fail('REQUESTED_TYPE_REQUIRED');
  return {kind,sourcePlayerId:actor.id,cards,targetId:action.targetId,requestedType:action.requestedType,numericBonus};
}
function eligibleDiscard(state:GameState,excluded:string[]=[]):Card[] {
  return state.discardPile.filter(card=>card.type!=='EXPLODING_KITTEN' && !excluded.includes(card.instanceId));
}
function takeDiscard(state:GameState,cardId:string,now:number,rng:RandomSource,events:GameEvent[]) {
  if(state.pending?.kind!=='ARCHAEOLOGY_CHOICE') return fail('INVALID_PHASE');
  const eligible=eligibleDiscard(state,state.pending.excludedCardIds);
  const card=eligible.find(item=>item.instanceId===cardId);
  if(!card) return fail('INVALID_DISCARD_CARD');
  const index=state.discardPile.findIndex(item=>item.instanceId===cardId);
  state.discardPile.splice(index,1);
  state.drawPile.splice(randomIndex(state.drawPile.length+1,rng),0,card);
  invalidateFuture(state);
  emit(state,events,'archaeology.returned',{cardType:card.type});
  setPhase(state,'TURN',null,now+TURN_MS);
}
function transfer(state:GameState,sourceId:string,targetId:string,card:Card,events:GameEvent[],key:string) {
  person(state,targetId).hand.push(card);
  emit(state,events,key,{sourceId,targetId,count:1});
  emit(state,events,'card.received',{cardType:card.type,instanceId:card.instanceId,artVariant:card.artVariant??0},'PRIVATE_PLAYER',targetId);
}
function resolveIntent(state:GameState,intent:PlayIntent,now:number,rng:RandomSource,events:GameEvent[]) {
  const actor=person(state,intent.sourcePlayerId);
  const type=primaryType(intent);
  if(intent.kind==='PAIR'||intent.kind==='TRIPLE'){
    const victim=person(state,intent.targetId!);
    let stolen:Card|undefined;
    if(victim.alive && victim.hand.length){
      if(intent.kind==='PAIR') stolen=victim.hand.splice(randomIndex(victim.hand.length,rng),1)[0];
      else {const index=victim.hand.findIndex(card=>card.type===intent.requestedType);if(index>=0) stolen=victim.hand.splice(index,1)[0];}
    }
    emit(state,events,intent.kind==='PAIR'?'combo.pair':'combo.triple',{playerId:actor.id,targetId:victim.id,...(intent.requestedType?{requestedType:intent.requestedType}:{}),success:!!stolen});
    if(stolen) transfer(state,victim.id,actor.id,stolen,events,'combo.stolen');
    setPhase(state,'TURN',null,now+TURN_MS);
    return;
  }
  switch(type){
    case 'SKIP': emit(state,events,'skip.applied',{playerId:actor.id});advanceTurn(state,now,events);return;
    case 'ATTACK': attack(state,intent.numericBonus,now,events);return;
    case 'FAVOR': {
      const victim=person(state,intent.targetId!);
      if(victim.hand.length===0){emit(state,events,'favor.empty',{targetId:victim.id});setPhase(state,'TURN',null,now+TURN_MS);return;}
      setPhase(state,'FAVOR_CHOICE',{kind:'FAVOR_CHOICE',sourcePlayerId:actor.id,targetPlayerId:victim.id},now+CHOICE_MS);
      emit(state,events,'favor.requested',{playerId:actor.id,targetId:victim.id});return;
    }
    case 'SHUFFLE':state.drawPile=shuffle(state.drawPile,rng);invalidateFuture(state);emit(state,events,'deck.shuffled',{playerId:actor.id});setPhase(state,'TURN',null,now+TURN_MS);return;
    case 'SEE_THE_FUTURE':state.insights[actor.id]={...state.insights[actor.id],futureCards:state.drawPile.slice(0,3+intent.numericBonus)};emit(state,events,'future.seen',{playerId:actor.id,count:Math.min(state.drawPile.length,3+intent.numericBonus)});setPhase(state,'TURN',null,now+TURN_MS);return;
    case 'AMATEUR_ARCHAEOLOGY':{
      const excluded=intent.cards.map(card=>card.instanceId);
      if(!eligibleDiscard(state,excluded).length){emit(state,events,'archaeology.empty',{});setPhase(state,'TURN',null,now+TURN_MS);return;}
      setPhase(state,'ARCHAEOLOGY_CHOICE',{kind:'ARCHAEOLOGY_CHOICE',sourcePlayerId:actor.id,excludedCardIds:excluded},now+CHOICE_MS);
      emit(state,events,'archaeology.choiceRequired',{playerId:actor.id});return;
    }
    case 'BATTLE_HAMSTER':{
      const victim=person(state,intent.targetId!);
      if(victim.hand.length<=1){emit(state,events,'hamster.empty',{targetId:victim.id});setPhase(state,'TURN',null,now+TURN_MS);return;}
      setPhase(state,'BATTLE_HAMSTER_DISCARD',{kind:'BATTLE_HAMSTER_DISCARD',sourcePlayerId:actor.id,targetPlayerId:victim.id},now+CHOICE_MS);
      emit(state,events,'hamster.discardRequired',{targetId:victim.id,count:victim.hand.length-1});return;
    }
    case 'CREEPY_PEEKY':{
      const victim=person(state,intent.targetId!);
      state.insights[actor.id]={...state.insights[actor.id],peekHand:{targetId:victim.id,cards:[...victim.hand]}};
      emit(state,events,'peek.used',{playerId:actor.id,targetId:victim.id});
      emit(state,events,'peek.private',{targetId:victim.id,count:victim.hand.length},'PRIVATE_PLAYER',actor.id);
      setPhase(state,'TURN',null,now+TURN_MS);return;
    }
    case 'HIP_BAT':{
      const victim=person(state,intent.targetId!);
      victim.bats.push(3+intent.numericBonus);
      emit(state,events,'hipBat.attached',{playerId:actor.id,targetId:victim.id,starts:3+intent.numericBonus});
      setPhase(state,'TURN',null,now+TURN_MS);return;
    }
    case 'HIP_CAT':{
      setPhase(state,'HIP_CAT_CHOICE',{kind:'HIP_CAT_CHOICE',sourcePlayerId:actor.id,targetPlayerId:intent.targetId!,choices:{}},now+CHOICE_MS);
      emit(state,events,'hipCat.choiceRequired',{playerId:actor.id,targetId:intent.targetId!});return;
    }
    case 'ROBIN_HOOD':{
      const living=state.players.filter(player=>player.alive);
      const pool=shuffle(living.flatMap(player=>player.hand),rng);
      for(const player of living) player.hand=[];
      const seatOrder=shuffle(living,rng);
      for(let i=0;i<pool.length;i++) seatOrder[i%seatOrder.length]!.hand.push(pool[i]!);
      emit(state,events,'robinHood.redealt',{playerId:actor.id,total:pool.length});
      setPhase(state,'TURN',null,now+TURN_MS);return;
    }
    case 'THE_TWINS':{
      for(const donor of state.players.filter(player=>player.alive&&player.id!==actor.id)){
        const countByType=new Map<CardType,number>();
        for(const card of donor.hand)countByType.set(card.type,(countByType.get(card.type)??0)+1);
        const allowance=new Map([...countByType].map(([cardType,count])=>[cardType,Math.floor(count/2)*2]));
        const transferCards:Card[]=[];
        donor.hand=donor.hand.filter(card=>{const count=allowance.get(card.type)??0;if(count<=0)return true;allowance.set(card.type,count-1);transferCards.push(card);return false;});
        actor.hand.push(...transferCards);
        emit(state,events,'twins.transferred',{sourceId:donor.id,targetId:actor.id,count:transferCards.length});
      }
      setPhase(state,'TURN',null,now+TURN_MS);return;
    }
    case 'RESURRECTION':{
      const revived=person(state,intent.targetId!);
      if(revived.alive||!revived.eliminatedKitten) return fail('INVALID_TARGET');
      const kitten=revived.eliminatedKitten;
      revived.eliminatedKitten=null;
      revived.alive=true;
      revived.reviveAvailableCircuit=state.circuit+1;
      state.drawPile.splice(randomIndex(state.drawPile.length+1,rng),0,kitten);
      invalidateFuture(state);
      emit(state,events,'player.resurrected',{playerId:revived.id,byPlayerId:actor.id});
      setPhase(state,'TURN',null,now+TURN_MS);return;
    }
    default: return fail('UNKNOWN_CARD_EFFECT');
  }
}
function resolveNope(state:GameState,now:number,rng:RandomSource,events:GameEvent[]) {
  if(state.pending?.kind!=='NOPE_WINDOW') return fail('INVALID_PHASE');
  const {intent,nopeCount}=state.pending;
  setPhase(state,'TURN',null,now+TURN_MS);
  if(nopeCount%2){emit(state,events,'action.cancelled',{playerId:intent.sourcePlayerId,cardType:primaryType(intent)});return;}
  resolveIntent(state,intent,now,rng,events);
}
function chooseCard(state:GameState,playerId:string,cardId:string,now:number,rng:RandomSource,events:GameEvent[]) {
  const pending=state.pending;
  if(!pending) return fail('INVALID_PHASE');
  if(pending.kind==='ARCHAEOLOGY_CHOICE'){
    if(pending.sourcePlayerId!==playerId) fail('NOT_YOUR_CHOICE');
    // A valid discard instance is used as the choice, not a hand card.
    takeDiscard(state,cardId,now,rng,events);
    return;
  }
  if(pending.kind==='FAVOR_CHOICE'){
    if(pending.targetPlayerId!==playerId) fail('NOT_YOUR_CHOICE');
    const card=removeOwned(person(state,playerId),cardId);
    transfer(state,playerId,pending.sourcePlayerId,card,events,'favor.given');
    setPhase(state,'TURN',null,now+TURN_MS);return;
  }
  if(pending.kind==='HIP_BAT_DISCARD'){
    if(pending.targetPlayerId!==playerId) fail('NOT_YOUR_CHOICE');
    const victim=person(state,playerId);
    const card=removeOwned(victim,cardId);
    state.discardPile.push(card);
    emit(state,events,'hipBat.discarded',{playerId,cardType:card.type});
    pending.remaining--;
    if(pending.remaining<=0||victim.hand.length===0) setPhase(state,'TURN',null,now+TURN_MS);
    else state.deadlineAt=now+CHOICE_MS;
    return;
  }
  if(pending.kind==='BATTLE_HAMSTER_DISCARD'){
    if(pending.targetPlayerId!==playerId) fail('NOT_YOUR_CHOICE');
    const victim=person(state,playerId);
    const card=removeOwned(victim,cardId);
    state.discardPile.push(card);
    emit(state,events,'hamster.discarded',{playerId,cardType:card.type});
    if(victim.hand.length<=1) setPhase(state,'TURN',null,now+TURN_MS);
    else state.deadlineAt=now+CHOICE_MS;
    return;
  }
  return fail('INVALID_PHASE');
}
function resolveHipCat(state:GameState,now:number,events:GameEvent[]) {
  if(state.pending?.kind!=='HIP_CAT_CHOICE') return fail('INVALID_PHASE');
  const pending=state.pending;
  const a=pending.choices[pending.sourcePlayerId]!;
  const b=pending.choices[pending.targetPlayerId]!;
  const beats:{[key:string]:string}={ROCK:'SCISSORS',PAPER:'ROCK',SCISSORS:'PAPER'};
  const winner=a===b?null:beats[a]===b?pending.sourcePlayerId:pending.targetPlayerId;
  emit(state,events,'hipCat.revealed',{playerId:pending.sourcePlayerId,targetId:pending.targetPlayerId,first:a,second:b,winnerId:winner});
  const take=(playerId:string,max:number)=>{
    for(let i=0;i<max;i++){
      const index=state.discardPile.findLastIndex(card=>card.type!=='EXPLODING_KITTEN'&&card.type!=='HIP_CAT');
      if(index<0)break;
      const card=state.discardPile.splice(index,1)[0]!;
      person(state,playerId).hand.push(card);
      emit(state,events,'hipCat.taken',{playerId,cardType:card.type});
    }
  };
  if(winner)take(winner,2);else {take(pending.sourcePlayerId,1);take(pending.targetPlayerId,1);}
  setPhase(state,'TURN',null,now+TURN_MS);
}

export function createGame(options:CreateGameOptions):GameState {
  const {gameId,players,mode='BASE',resurrection=false,now=Date.now(),rng=secureRandom}=options;
  if(players.length<2||players.length>5) return fail('PLAYER_COUNT_INVALID');
  if(new Set(players.map(player=>player.id)).size!==players.length) return fail('DUPLICATE_PLAYER');
  const all=makeDeck(mode,resurrection,players.length);
  const kittens=all.filter(card=>card.type==='EXPLODING_KITTEN');
  const defuses=all.filter(card=>card.type==='DEFUSE');
  const nonSpecial=shuffle(all.filter(card=>card.type!=='EXPLODING_KITTEN'&&card.type!=='DEFUSE'&&card.type!=='RESURRECTION'),rng);
  const choices=options.defuseChoices??{},requested=Object.values(choices);
  if(new Set(requested).size!==requested.length||Object.keys(choices).some(id=>!players.some(p=>p.id===id))||requested.some(id=>!defuses.some(c=>c.instanceId===id)))return fail('INVALID_DEFUSE_SELECTION');
  const selected=players.map(seed=>{const id=choices[seed.id];const index=id?defuses.findIndex(c=>c.instanceId===id):defuses.findIndex(c=>!requested.includes(c.instanceId));if(index<0)return fail('INVALID_DEFUSE_SELECTION');return defuses.splice(index,1)[0]!;});
  const statePlayers=players.map((seed,i)=>({id:seed.id,name:seed.name,hand:[selected[i]!,...nonSpecial.splice(0,7)],alive:true,eliminatedKitten:null,bats:[],reviveAvailableCircuit:0}));
  const extraDefuses=defuses.splice(0,Math.min(players.length>=5?1:2,defuses.length));
  const activeKittens=kittens.splice(0,players.length-1);
  const resurrectionCards=all.filter(card=>card.type==='RESURRECTION');
  const drawPile=shuffle([...nonSpecial,...extraDefuses,...activeKittens,...resurrectionCards],rng);
  const state:GameState={gameId,mode,resurrection,totalCards:all.length,revision:0,eventSeq:0,turnNumber:1,turnId:`${gameId}:1`,circuit:0,phase:'TURN',currentPlayerId:players[0]!.id,turnsRemaining:1,attackDebtActive:false,deadlineAt:now+TURN_MS,players:statePlayers,drawPile,discardPile:[],removed:[...defuses,...kittens],pending:null,winnerId:null,log:[],insights:{}};
  assertInvariants(state);
  return state;
}
export function applyAction(original:GameState,playerId:string,action:GameAction,now=Date.now(),rng:RandomSource=secureRandom):GameTransition {
  const state:GameState=structuredClone(original);
  const events:GameEvent[]=[];
  if(state.phase==='FINISHED') return fail('GAME_FINISHED');
  const actor=person(state,playerId);
  if(!actor.alive) return fail('PLAYER_ELIMINATED');
  state.revision++;
  switch(action.type){
    case 'DRAW_CARD':
      current(state,playerId);
      if(state.phase!=='TURN') fail('INVALID_PHASE');
      draw(state,now,rng,events);break;
    case 'PLAY_CARD':{
      current(state,playerId);
      if(state.phase!=='TURN') fail('INVALID_PHASE');
      const intent=makeIntent(state,actor,action);
      for(const card of intent.cards){removeOwned(actor,card.instanceId);state.discardPile.push(card);}
      setPhase(state,'NOPE_WINDOW',{kind:'NOPE_WINDOW',intent,nopeCount:0,passedPlayerIds:[]},now+NOPE_MS);
      emit(state,events,'card.played',{playerId,cardType:primaryType(intent),count:intent.cards.length});
      break;
    }
    case 'NOPE':{
      if(state.pending?.kind!=='NOPE_WINDOW') fail('INVALID_PHASE');
      const card=actor.hand.find(item=>item.instanceId===action.cardId);
      if(card?.type!=='NOPE') fail('CARD_NOT_OWNED');
      removeOwned(actor,action.cardId);
      state.discardPile.push(card);
      state.pending.nopeCount++;
      state.pending.passedPlayerIds=[];
      state.deadlineAt=now+NOPE_MS;
      emit(state,events,'nope.played',{playerId,count:state.pending.nopeCount});break;
    }
    case 'PASS_NOPE':{
      if(state.pending?.kind!=='NOPE_WINDOW') fail('INVALID_PHASE');
      if(state.pending.passedPlayerIds.includes(playerId)) fail('ALREADY_PASSED');
      state.pending.passedPlayerIds.push(playerId);
      emit(state,events,'nope.passed',{playerId});
      if(state.players.filter(player=>player.alive).every(player=>state.pending?.kind==='NOPE_WINDOW'&&state.pending.passedPlayerIds.includes(player.id))) resolveNope(state,now,rng,events);
      break;
    }
    case 'CHOOSE_CARD': chooseCard(state,playerId,action.cardId,now,rng,events);break;
    case 'DEFUSE_POSITION':
      if(state.pending?.kind!=='DEFUSE_INSERT'||state.pending.sourcePlayerId!==playerId) fail('NOT_YOUR_CHOICE');
      insertKitten(state,action.index,now,events);break;
    case 'HIP_CAT_CHOICE':{
      if(state.pending?.kind!=='HIP_CAT_CHOICE') fail('INVALID_PHASE');
      if(playerId!==state.pending.sourcePlayerId&&playerId!==state.pending.targetPlayerId) fail('NOT_YOUR_CHOICE');
      if(state.pending.choices[playerId]) fail('ALREADY_CHOSEN');
      state.pending.choices[playerId]=action.choice;
      emit(state,events,'hipCat.choiceSubmitted',{playerId});
      if(state.pending.choices[state.pending.sourcePlayerId]&&state.pending.choices[state.pending.targetPlayerId])resolveHipCat(state,now,events);
      break;
    }
    default: return fail('UNKNOWN_ACTION');
  }
  assertInvariants(state);
  return {state,events};
}
export function tick(original:GameState,now=Date.now(),rng:RandomSource=secureRandom):GameTransition|null {
  if(original.deadlineAt===null||now<original.deadlineAt||original.phase==='FINISHED')return null;
  let state:GameState=structuredClone(original);
  const events:GameEvent[]=[];
  state.revision++;
  const pending=state.pending;
  if(state.phase==='TURN')draw(state,now,rng,events);
  else if(pending?.kind==='NOPE_WINDOW')resolveNope(state,now,rng,events);
  else if(pending?.kind==='DEFUSE_INSERT')insertKitten(state,randomIndex(state.drawPile.length+1,rng),now,events);
  else if(pending?.kind==='FAVOR_CHOICE'){
    const victim=person(state,pending.targetPlayerId);
    if(victim.hand.length)chooseCard(state,victim.id,victim.hand[randomIndex(victim.hand.length,rng)]!.instanceId,now,rng,events);
    else setPhase(state,'TURN',null,now+TURN_MS);
  }else if(pending?.kind==='ARCHAEOLOGY_CHOICE'){
    const eligible=eligibleDiscard(state,pending.excludedCardIds);
    if(eligible.length)chooseCard(state,pending.sourcePlayerId,eligible[randomIndex(eligible.length,rng)]!.instanceId,now,rng,events);
    else setPhase(state,'TURN',null,now+TURN_MS);
  }else if(pending?.kind==='HIP_BAT_DISCARD'){
    const victim=person(state,pending.targetPlayerId);
    if(victim.hand.length)chooseCard(state,victim.id,victim.hand[randomIndex(victim.hand.length,rng)]!.instanceId,now,rng,events);
    else setPhase(state,'TURN',null,now+TURN_MS);
  }else if(pending?.kind==='BATTLE_HAMSTER_DISCARD'){
    const victim=person(state,pending.targetPlayerId);
    while(victim.hand.length>1){
      const cardId=victim.hand[randomIndex(victim.hand.length,rng)]!.instanceId;
      chooseCard(state,victim.id,cardId,now,rng,events);
    }
    if(state.phase==='BATTLE_HAMSTER_DISCARD')setPhase(state,'TURN',null,now+TURN_MS);
  }else if(pending?.kind==='HIP_CAT_CHOICE'){
    for(const id of [pending.sourcePlayerId,pending.targetPlayerId]) if(!pending.choices[id])pending.choices[id]=(['ROCK','PAPER','SCISSORS'] as const)[randomIndex(3,rng)]!;
    resolveHipCat(state,now,events);
  }else return null;
  emit(state,events,'timer.resolved',{phase:original.phase});
  assertInvariants(state);
  return {state,events};
}
