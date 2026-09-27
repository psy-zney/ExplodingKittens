export type Language = 'vi' | 'en';
export type ArtStyle = 'pen' | 'stamp' | 'pixel' | 'geometry';
export type RoomMode = 'BASE' | 'EXTENDED';
export type CardType =
  | 'EXPLODING_KITTEN' | 'DEFUSE' | 'ATTACK' | 'FAVOR' | 'NOPE'
  | 'SHUFFLE' | 'SKIP' | 'SEE_THE_FUTURE'
  | 'CAT_TACO' | 'CAT_BEARD' | 'CAT_RAINBOW' | 'CAT_POTATO' | 'CAT_CATERMELON'
  | 'AMATEUR_ARCHAEOLOGY' | 'BATTLE_HAMSTER' | 'CREEPY_PEEKY'
  | 'HIP_BAT' | 'HIP_CAT' | 'PLUS_PLUS' | 'ROBIN_HOOD' | 'THE_TWINS'
  | 'RESURRECTION';
export type Card = { instanceId: string; type: CardType };
export type GamePhase = 'TURN' | 'NOPE_WINDOW' | 'FAVOR_CHOICE' | 'DEFUSE_INSERT' | 'HIP_CAT_CHOICE' | 'HIP_BAT_DISCARD' | 'BATTLE_HAMSTER_DISCARD' | 'ARCHAEOLOGY_CHOICE' | 'FINISHED';
export type Player = { id: string; name: string; ready?: boolean; connected?: boolean; eliminated?: boolean; alive?: boolean; handCount?: number; hipBatRemaining?: number; eliminatedKittenCount?: number };
export type Room = {
  code: string;
  hostId: string;
  status: 'LOBBY' | 'PLAYING' | 'FINISHED';
  options: { mode: RoomMode; resurrection: boolean };
  players: Player[];
};
export type Pending = { kind: Exclude<GamePhase, 'TURN' | 'FINISHED'>; sourcePlayerId?: string; targetPlayerId?: string; cardType?: CardType; nopeCount?: number; passedPlayerIds?: string[]; playKind?: 'SINGLE' | 'PAIR' | 'TRIPLE' | 'PLUS_PLUS'; requestedType?: CardType };
export type PublicGame = {
  gameId: string;
  revision: number;
  eventSeq: number;
  turnId: string;
  phase: GamePhase;
  currentPlayerId: string | null;
  turnsRemaining: number;
  deadlineAt?: number | null;
  players: Player[];
  drawCount: number;
  discardPile: Card[];
  pending?: Pending | null;
  winnerId?: string | null;
  log?: GameEvent[];
};
export type PrivateGame = PublicGame & {
  isSpectator: false;
  hand: Card[];
  privateData: {
    futureCards?: Card[];
    peekHand?: { targetId: string; cards: Card[] };
    insertSlotCount?: number;
    discardChoices?: Card[];
    hipCatChoice?: 'ROCK' | 'PAPER' | 'SCISSORS';
  };
};
export type GameEvent = {
  seq: number;
  revision: number;
  gameId?: string;
  key: string;
  params?: Record<string, unknown>;
  visibility?: string;
};
export type ServerSnapshot = {
  serverNow?: number;
  room: Room;
  game: null | { public: PublicGame; private: PrivateGame | null };
  events: GameEvent[];
  chatMessages?: GameEvent[];
};
export type Session = { token: string; playerId: string; nickname: string };
export type GameAction =
  | { type: 'DRAW_CARD' }
  | { type: 'PLAY_CARD'; cardIds: string[]; targetId?: string; requestedType?: CardType; plusPlusId?: string; discardCardId?: string }
  | { type: 'NOPE'; cardId: string }
  | { type: 'PASS_NOPE' }
  | { type: 'CHOOSE_CARD'; cardId: string }
  | { type: 'DEFUSE_POSITION'; index: number }
  | { type: 'HIP_CAT_CHOICE'; choice: 'ROCK' | 'PAPER' | 'SCISSORS' };
export type Ack<T = Record<string, never>> = ({ ok: true } & T) | { ok: false; error: { code: string; params?: Record<string, unknown> } };
