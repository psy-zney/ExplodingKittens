import { expect, it } from 'vitest';
import { applyAction, assertInvariants, createGame, GameError, tick } from '../src/index.js';
import type { GameAction } from '@kittens/shared';

it.each([1,2,3,4,5,6])('seed %i: 16 full games preserve cards across both decks and resurrection',seed=>{
  for(const count of [2,3,4,5])for(const mode of ['BASE','EXTENDED'] as const)for(const resurrection of [false,true]){
    let randomState=seed*1000+count;
    const rng=()=>{randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;return randomState/2**32;};
    let now=0;
    let state=createGame({gameId:`sim-${seed}-${count}-${mode}-${resurrection}`,players:Array.from({length:count},(_,i)=>({id:`p${i}`,name:`Cat${i}`})),mode,resurrection,now,rng});
    let playsInTurn=0;
    let lastTurn=state.turnId;
    let steps=0;
    while(state.phase!=='FINISHED'&&steps++<1000){
      now+=10;
      if(state.turnId!==lastTurn){lastTurn=state.turnId;playsInTurn=0;}
      if(state.phase!=='TURN'){
        // This exercises every mandatory choice fallback and pre-effect window.
        now=state.deadlineAt!;
        state=tick(state,now,rng)!.state;
      }else{
        const actor=state.players.find(player=>player.id===state.currentPlayerId)!;
        const opponents=state.players.filter(player=>player.alive&&player.id!==actor.id);
        let applied=false;
        if(playsInTurn<2&&rng()<0.65){
          for(const card of actor.hand){
            const dead=state.players.find(player=>!player.alive);
            const target=card.type==='RESURRECTION'?dead:opponents[Math.floor(rng()*opponents.length)];
            const action:GameAction={type:'PLAY_CARD',cardIds:[card.instanceId],targetId:target?.id};
            try{
              state=applyAction(state,actor.id,action,now,rng).state;
              applied=true;playsInTurn++;break;
            }catch(error){
              // Expected invalid single cards/targets must not mask invariant failures.
              expect(error).toBeInstanceOf(GameError);
              expect((error as GameError).code).toMatch(/^(CARD_NOT_PLAYABLE_ALONE|TARGET_REQUIRED|INVALID_TARGET)$/);
            }
          }
        }
        if(!applied)state=applyAction(state,actor.id,{type:'DRAW_CARD'},now,rng).state;
      }
      assertInvariants(state);
    }
    expect(state.phase,`seed=${seed}, players=${count}, mode=${mode}, resurrection=${resurrection}`).toBe('FINISHED');
    expect(state.players.filter(player=>player.alive).map(player=>player.id)).toEqual([state.winnerId]);
  }
});
