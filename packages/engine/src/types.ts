import type { Card, CardType, GameAction, GameEvent, GameMode, GamePhase } from '@kittens/shared';
export type { Card, CardType, GameAction, GameEvent, GameMode, GamePhase } from '@kittens/shared';

export type RandomSource = () => number;
export type PlayerSeed = { id: string; name: string };
export type PlayerState = PlayerSeed & {
  hand: Card[];
  alive: boolean;
  eliminatedKitten: Card | null;
  bats: number[];
  reviveAvailableCircuit: number;
};
export type PlayIntent = {
  kind: 'SINGLE' | 'PAIR' | 'TRIPLE' | 'PLUS_PLUS';
  sourcePlayerId: string;
  cards: Card[];
  targetId?: string;
  requestedType?: CardType;
  numericBonus: number;
};
export type Pending =
  | {kind:'NOPE_WINDOW'; intent:PlayIntent; nopeCount:number; passedPlayerIds:string[]}
  | {kind:'FAVOR_CHOICE'; sourcePlayerId:string; targetPlayerId:string}
  | {kind:'DEFUSE_INSERT'; sourcePlayerId:string; kitten:Card}
  | {kind:'HIP_CAT_CHOICE'; sourcePlayerId:string; targetPlayerId:string; choices:Record<string,'ROCK'|'PAPER'|'SCISSORS'>}
  | {kind:'HIP_BAT_DISCARD'; targetPlayerId:string; remaining:number}
  | {kind:'BATTLE_HAMSTER_DISCARD'; sourcePlayerId:string; targetPlayerId:string}
  | {kind:'ARCHAEOLOGY_CHOICE'; sourcePlayerId:string; excludedCardIds:string[]};
export type PrivateInsight = {futureCards?:Card[]; peekHand?:{targetId:string;cards:Card[]}};
export type GameState = {
  gameId: string;
  mode: GameMode;
  resurrection: boolean;
  totalCards: number;
  revision: number;
  eventSeq: number;
  turnNumber: number;
  turnId: string;
  circuit: number;
  phase: GamePhase;
  currentPlayerId: string | null;
  turnsRemaining: number;
  attackDebtActive: boolean;
  deadlineAt: number | null;
  players: PlayerState[];
  drawPile: Card[];
  discardPile: Card[];
  removed: Card[];
  pending: Pending | null;
  winnerId: string | null;
  log: GameEvent[];
  insights: Record<string,PrivateInsight>;
};
export type GameTransition = {state:GameState;events:GameEvent[]};
export type CreateGameOptions = {
  gameId:string;
  players:PlayerSeed[];
  mode?:GameMode;
  resurrection?:boolean;
  now?:number;
  rng?:RandomSource;
};
export class GameError extends Error {
  constructor(public readonly code:string) { super(code); this.name='GameError'; }
}
