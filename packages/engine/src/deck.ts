import type { Card, CardType } from '@kittens/shared';
import type { GameMode, RandomSource } from './types.js';

export const BASE_COUNTS: Readonly<Partial<Record<CardType,number>>> = {
  EXPLODING_KITTEN:4, DEFUSE:6, ATTACK:4, FAVOR:4, NOPE:5, SHUFFLE:4,
  SKIP:4, SEE_THE_FUTURE:5, CAT_TACO:4, CAT_BEARD:4, CAT_RAINBOW:4,
  CAT_POTATO:4, CAT_CATERMELON:4
};
export const EXTENSION_TYPES: readonly CardType[] = [
  'AMATEUR_ARCHAEOLOGY','BATTLE_HAMSTER','CREEPY_PEEKY','HIP_BAT',
  'HIP_CAT','PLUS_PLUS','ROBIN_HOOD','THE_TWINS'
];
export function makeDeck(mode:GameMode='BASE', resurrection=false, playerCount=5):Card[] {
  const counts:Partial<Record<CardType,number>>={...BASE_COUNTS};
  if (playerCount > 5) {
    counts.EXPLODING_KITTEN = playerCount - 1;
    counts.DEFUSE = playerCount + 1;
  }
  if (mode==='EXTENDED') for (const type of EXTENSION_TYPES) counts[type]=1;
  if (resurrection) counts.RESURRECTION=2;
  let n=0;
  return Object.entries(counts).flatMap(([type,count])=>Array.from({length:count ?? 0},(_,artVariant)=>({instanceId:`card-${++n}`,type:type as CardType,artVariant})));
}
export function secureRandom():number {
  const bytes=new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return bytes[0]! / 4294967296;
}
export function randomIndex(length:number,rng:RandomSource):number {
  if (length<=0) throw new Error('Empty random range');
  const value=rng();
  if (!Number.isFinite(value) || value<0 || value>=1) throw new Error('RNG must return [0,1)');
  return Math.floor(value*length);
}
export function shuffle<T>(items:readonly T[],rng:RandomSource):T[] {
  const output=[...items];
  for(let i=output.length-1;i>0;i--){const j=randomIndex(i+1,rng);[output[i],output[j]]=[output[j]!,output[i]!];}
  return output;
}
