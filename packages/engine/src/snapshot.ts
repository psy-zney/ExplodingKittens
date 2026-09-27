import type { Card, GameEvent, PrivateSnapshot, PublicPending, PublicSnapshot, SpectatorSnapshot } from '@kittens/shared';
import type { GameState } from './types.js';
import { GameError } from './types.js';

function publicPending(state:GameState):PublicPending|null {
  const pending=state.pending;
  if(!pending)return null;
  switch(pending.kind){
    case 'NOPE_WINDOW':return {kind:pending.kind,sourcePlayerId:pending.intent.sourcePlayerId,targetPlayerId:pending.intent.targetId,cardType:pending.intent.cards.find(card=>card.type!=='PLUS_PLUS')?.type,nopeCount:pending.nopeCount,playKind:pending.intent.kind,requestedType:pending.intent.requestedType,passedPlayerIds:[...pending.passedPlayerIds]};
    case 'FAVOR_CHOICE':return {kind:pending.kind,sourcePlayerId:pending.sourcePlayerId,targetPlayerId:pending.targetPlayerId};
    case 'DEFUSE_INSERT':return {kind:pending.kind,sourcePlayerId:pending.sourcePlayerId};
    case 'HIP_CAT_CHOICE':return {kind:pending.kind,sourcePlayerId:pending.sourcePlayerId,targetPlayerId:pending.targetPlayerId};
    case 'HIP_BAT_DISCARD':return {kind:pending.kind,targetPlayerId:pending.targetPlayerId};
    case 'BATTLE_HAMSTER_DISCARD':return {kind:pending.kind,sourcePlayerId:pending.sourcePlayerId,targetPlayerId:pending.targetPlayerId};
    case 'ARCHAEOLOGY_CHOICE':return {kind:pending.kind,sourcePlayerId:pending.sourcePlayerId};
  }
}
function visibleLog(log:GameEvent[],playerId?:string):GameEvent[] {
  return log.filter(event=>event.visibility==='PUBLIC'||(event.visibility==='PRIVATE_PLAYER'&&event.playerId===playerId));
}
export function getPublicSnapshot(state:GameState):PublicSnapshot {
  return {
    gameId:state.gameId,revision:state.revision,eventSeq:state.eventSeq,
    turnId:state.turnId,phase:state.phase,currentPlayerId:state.currentPlayerId,
    turnsRemaining:state.turnsRemaining,deadlineAt:state.deadlineAt,
    players:state.players.map(player=>({id:player.id,name:player.name,alive:player.alive,handCount:player.alive?player.hand.length:0,hipBatRemaining:player.bats.reduce((sum,count)=>sum+count,0),eliminatedKittenCount:player.eliminatedKitten?1:0})),
    drawCount:state.drawPile.length,discardPile:state.discardPile.map(card=>({...card})),
    pending:publicPending(state),winnerId:state.winnerId,log:visibleLog(state.log)
  };
}
export function getPrivateSnapshot(state:GameState,playerId:string):PrivateSnapshot {
  const player=state.players.find(item=>item.id===playerId);
  if(!player)throw new GameError('PLAYER_NOT_FOUND');
  const insight=state.insights[playerId]??{};
  const privateData:PrivateSnapshot['privateData']={};
  if(insight.futureCards)privateData.futureCards=insight.futureCards.map(card=>({...card}));
  if(insight.peekHand)privateData.peekHand={targetId:insight.peekHand.targetId,cards:insight.peekHand.cards.map(card=>({...card}))};
  if(state.pending?.kind==='DEFUSE_INSERT'&&state.pending.sourcePlayerId===playerId)privateData.insertSlotCount=state.drawPile.length+1;
  const pending=state.pending;
  if(pending?.kind==='ARCHAEOLOGY_CHOICE'&&pending.sourcePlayerId===playerId)privateData.discardChoices=state.discardPile.filter(card=>card.type!=='EXPLODING_KITTEN'&&!pending.excludedCardIds.includes(card.instanceId));
  if(state.pending?.kind==='HIP_CAT_CHOICE')privateData.hipCatChoice=state.pending.choices[playerId];
  return {...getPublicSnapshot(state),isSpectator:false,hand:player.alive?player.hand.map(card=>({...card})):[],privateData,log:visibleLog(state.log,playerId)};
}
export function getSpectatorSnapshot(state:GameState):SpectatorSnapshot {
  return {...getPublicSnapshot(state),isSpectator:true};
}

export function assertInvariants(state:GameState):void {
  const zones:Card[]=[...state.drawPile,...state.discardPile,...state.removed];
  for(const player of state.players){
    zones.push(...player.hand);
    if(player.eliminatedKitten)zones.push(player.eliminatedKitten);
  }
  if(state.pending?.kind==='DEFUSE_INSERT')zones.push(state.pending.kitten);
  if(zones.length!==state.totalCards)throw new Error(`CARD_COUNT_MISMATCH expected ${state.totalCards}, got ${zones.length}`);
  const ids=new Set(zones.map(card=>card.instanceId));
  if(ids.size!==zones.length)throw new Error('DUPLICATE_CARD_INSTANCE');
  const living=state.players.filter(player=>player.alive).length;
  const activeKittens=state.drawPile.filter(card=>card.type==='EXPLODING_KITTEN').length+(state.pending?.kind==='DEFUSE_INSERT'?1:0);
  if(activeKittens!==living-1)throw new Error(`KITTEN_BALANCE expected ${living-1}, got ${activeKittens}`);
  if(state.phase==='FINISHED'&&(!state.winnerId||living!==1))throw new Error('INVALID_WINNER');
  if(state.phase!=='FINISHED'&&(!state.currentPlayerId||!state.players.some(player=>player.id===state.currentPlayerId&&player.alive)))throw new Error('INVALID_CURRENT_PLAYER');
  if(state.phase==='DEFUSE_INSERT'&&state.pending?.kind!=='DEFUSE_INSERT')throw new Error('INVALID_PENDING');
}
