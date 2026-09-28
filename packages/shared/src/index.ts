import { z } from 'zod';

export const cardTypes = [
  'EXPLODING_KITTEN', 'DEFUSE', 'ATTACK', 'FAVOR', 'NOPE', 'SHUFFLE', 'SKIP',
  'SEE_THE_FUTURE', 'CAT_TACO', 'CAT_BEARD', 'CAT_RAINBOW', 'CAT_POTATO',
  'CAT_CATERMELON', 'AMATEUR_ARCHAEOLOGY', 'BATTLE_HAMSTER', 'CREEPY_PEEKY',
  'HIP_BAT', 'HIP_CAT', 'PLUS_PLUS', 'ROBIN_HOOD', 'THE_TWINS', 'RESURRECTION'
] as const;
export const cardTypeSchema = z.enum(cardTypes);
export type CardType = z.infer<typeof cardTypeSchema>;
export type Card = { instanceId: string; type: CardType; artVariant?: number };
export const cardSchema = z.object({ instanceId: z.string().min(1), type: cardTypeSchema, artVariant: z.number().int().min(0).max(31).optional() });

export const gameModes = ['BASE', 'EXTENDED'] as const;
export type GameMode = typeof gameModes[number];
export const gameModeSchema = z.enum(gameModes);
export const phases = [
  'TURN', 'NOPE_WINDOW', 'FAVOR_CHOICE', 'DEFUSE_INSERT', 'HIP_CAT_CHOICE',
  'HIP_BAT_DISCARD', 'BATTLE_HAMSTER_DISCARD', 'ARCHAEOLOGY_CHOICE', 'FINISHED'
] as const;
export type GamePhase = typeof phases[number];
export const phaseSchema = z.enum(phases);

export const GAME_TIMING = { turnMs: 45_000, nopeMs: 12_000, choiceMs: 30_000 } as const;
export function phaseDurationMs(phase: GamePhase): number {
  return phase === 'FINISHED' ? 0 : phase === 'TURN' ? GAME_TIMING.turnMs : phase === 'NOPE_WINDOW' ? GAME_TIMING.nopeMs : GAME_TIMING.choiceMs;
}

const playCardActionSchema = z.object({
  type: z.literal('PLAY_CARD'),
  cardIds: z.array(z.string().min(1)).min(1).max(3),
  targetId: z.string().min(1).optional(),
  requestedType: cardTypeSchema.optional()
}).strict();
export const gameActionSchema = z.discriminatedUnion('type', [
  z.object({type:z.literal('DRAW_CARD')}).strict(),
  playCardActionSchema,
  z.object({type:z.literal('NOPE'),cardId:z.string().min(1)}).strict(),
  z.object({type:z.literal('PASS_NOPE')}).strict(),
  z.object({type:z.literal('CHOOSE_CARD'),cardId:z.string().min(1)}).strict(),
  z.object({type:z.literal('DEFUSE_POSITION'),index:z.number().int().nonnegative()}).strict(),
  z.object({type:z.literal('HIP_CAT_CHOICE'),choice:z.enum(['ROCK','PAPER','SCISSORS'])}).strict()
]);
export type GameAction = z.infer<typeof gameActionSchema>;
export const actionEnvelopeSchema = z.object({
  gameId: z.string().min(1).max(100),
  turnId: z.string().min(1).max(100),
  actionId: z.string().uuid(),
  expectedRevision: z.number().int().nonnegative(),
  action: gameActionSchema
}).strict();
export type ActionEnvelope = z.infer<typeof actionEnvelopeSchema>;

export const createRoomSchema = z.object({
  nickname: z.string().trim().min(1).max(24),
  mode: gameModeSchema.default('BASE'),
  resurrection: z.boolean().default(false),
  language: z.enum(['vi','en']).optional(),
  style: z.enum(['pen','stamp','pixel','geometry']).optional()
}).strict();
export const joinRoomSchema = z.object({
  code: z.string().trim().min(4).max(12),
  nickname: z.string().trim().min(1).max(24),
  language: z.enum(['vi','en']).optional(),
  style: z.enum(['pen','stamp','pixel','geometry']).optional()
}).strict();
export const chatSchema = z.object({text:z.string().trim().min(1).max(300)}).strict();

export type Visibility = 'PUBLIC' | 'PRIVATE_PLAYER' | 'SERVER_ONLY';
export type GameEvent = {
  seq: number;
  revision: number;
  key: string;
  params: Record<string, string | number | boolean | null>;
  visibility: Visibility;
  playerId?: string;
};
export type PublicPlayer = {
  id: string;
  name: string;
  alive: boolean;
  handCount: number;
  hipBatRemaining: number;
  eliminatedKittenCount: number;
};
export type PublicPending = {
  kind: Exclude<GamePhase, 'TURN' | 'FINISHED'>;
  sourcePlayerId?: string;
  targetPlayerId?: string;
  cardType?: CardType;
  nopeCount?: number;
  passedPlayerIds?: string[];
  playKind?: 'SINGLE' | 'PAIR' | 'TRIPLE' | 'PLUS_PLUS';
  requestedType?: CardType;
};
export type PublicSnapshot = {
  gameId: string;
  revision: number;
  eventSeq: number;
  turnId: string;
  phase: GamePhase;
  currentPlayerId: string | null;
  turnsRemaining: number;
  deadlineAt: number | null;
  players: PublicPlayer[];
  drawCount: number;
  discardPile: Card[];
  pending: PublicPending | null;
  winnerId: string | null;
  log: GameEvent[];
};
export type PrivateSnapshot = PublicSnapshot & {
  isSpectator: false;
  hand: Card[];
  privateData: {
    futureCards?: Card[];
    peekHand?: {targetId:string;cards:Card[]};
    insertSlotCount?: number;
    discardChoices?: Card[];
    hipCatChoice?: 'ROCK'|'PAPER'|'SCISSORS';
  };
};
export type SpectatorSnapshot = PublicSnapshot & {isSpectator:true};

export type DeckScalingInfo = {
  playerCount: number;
  activeKittens: number;
  startingDefuses: number;
  extraDefusesInDeck: number;
  totalDefusesInGame: number;
  totalDeckCards: number;
};

export function calculateDeckScaling(playerCount: number, mode: GameMode = 'BASE', resurrection = false): DeckScalingInfo {
  const count = Math.max(2, playerCount);
  const activeKittens = Math.max(1, count - 1);
  const startingDefuses = count;
  const extraDefusesInDeck = count >= 5 ? 1 : 2;
  const totalDefusesInGame = startingDefuses + extraDefusesInDeck;
  const baseOtherCards = 46;
  const expansionCards = mode === 'EXTENDED' ? 24 : 0;
  const resurrectionCards = resurrection ? 2 : 0;
  const otherCards = baseOtherCards + expansionCards + resurrectionCards;
  const totalDeckCards = otherCards + totalDefusesInGame + activeKittens;
  return {
    playerCount: count,
    activeKittens,
    startingDefuses,
    extraDefusesInDeck,
    totalDefusesInGame,
    totalDeckCards
  };
}
