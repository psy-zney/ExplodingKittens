import { inspectPlay, isNumericCard } from '@kittens/shared/play-policy';
import type { Card, GameAction, PrivateGame, PublicGame } from './types';

export type ComposeMode = 'SINGLE' | 'PAIR' | 'TRIPLE' | 'PLUS_PLUS';
export type AutoMode = 'OFF' | 'DRAW' | 'BASIC';
// Direct hand selection: matching cards form pairs/triples; ++ joins numeric cards.
export function selectHandCard(previous: string[], card: Card, hand: Card[], mandatory = false): string[] {
  if (previous.includes(card.instanceId)) return previous.filter(id => id !== card.instanceId);
  if (mandatory) return [card.instanceId];
  const first = hand.find(item => item.instanceId === previous[0]);
  if (!first) return [card.instanceId];
  if (first.type === card.type && card.type !== 'EXPLODING_KITTEN') {
    return previous.length < 3 ? [...previous, card.instanceId] : previous;
  }
  if (previous.length === 1 && ((first.type === 'PLUS_PLUS' && isNumericCard(card.type)) || (card.type === 'PLUS_PLUS' && isNumericCard(first.type)))) return [...previous, card.instanceId];
  return [card.instanceId];
}
export function selectCard(previous: string[], card: Card, hand: Card[], mode: ComposeMode, mandatory = false): string[] {
  if (previous.includes(card.instanceId)) return previous.filter(id => id !== card.instanceId);
  if (mandatory || mode === 'SINGLE') return [card.instanceId];
  const first = hand.find(item => item.instanceId === previous[0]);
  const max = mode === 'TRIPLE' ? 3 : 2;
  const compatible = mode === 'PLUS_PLUS'
    ? first && ((first.type === 'PLUS_PLUS' && isNumericCard(card.type)) || (card.type === 'PLUS_PLUS' && isNumericCard(first.type)))
    : first?.type === card.type;
  return compatible ? previous.length < max ? [...previous, card.instanceId] : [...previous.slice(0, max - 1), card.instanceId] : [card.instanceId];
}

export function canSelect(card: Card, hand: Card[], mode: ComposeMode, game: PublicGame, selfId: string): boolean {
  if (mode === 'PLUS_PLUS') return (card.type === 'PLUS_PLUS' && hand.some(c => isNumericCard(c.type))) || (isNumericCard(card.type) && hand.some(c => c.type === 'PLUS_PLUS'));
  if (mode === 'PAIR' || mode === 'TRIPLE') return card.type !== 'EXPLODING_KITTEN' && hand.filter(c => c.type === card.type).length >= (mode === 'PAIR' ? 2 : 3);
  const shape = inspectPlay([card]);
  return shape.valid && (shape.target !== 'ELIMINATED' || game.players.some(p => !p.alive)) && (shape.target !== 'LIVING' || game.players.some(p => p.alive && p.id !== selfId));
}

export type Suggestion = { cardIds: string[]; mode: ComposeMode; reason: 'escape' | 'future' | 'pair' | 'draw' };
// Accepts only the requesting player's filtered snapshot. No draw order or
// opponent hands exist here. Advice is a simple policy, not an optimal bot.
export function suggestPlay(game: PublicGame, mine: PrivateGame, selfId: string): Suggestion {
  const hand = mine.hand;
  if (mine.privateData.futureCards?.[0]?.type === 'EXPLODING_KITTEN') {
    const escape = ['ATTACK', 'SKIP', 'SHUFFLE'].map(type => hand.find(c => c.type === type)).find(Boolean);
    if (escape) return { cardIds: [escape.instanceId], mode: 'SINGLE', reason: 'escape' };
  }
  if (!mine.privateData.futureCards?.length) {
    const future = hand.find(c => c.type === 'SEE_THE_FUTURE');
    if (future) return { cardIds: [future.instanceId], mode: 'SINGLE', reason: 'future' };
  }
  if (game.players.some(p => p.alive && p.id !== selfId && (p.handCount ?? 0) > 0)) {
    for (const card of hand.filter(c => c.type.startsWith('CAT_'))) {
      const pair = hand.filter(c => c.type === card.type).slice(0, 2);
      if (pair.length === 2) return { cardIds: pair.map(c => c.instanceId), mode: 'PAIR', reason: 'pair' };
    }
  }
  return { cardIds: [], mode: 'SINGLE', reason: 'draw' };
}

const expendable = (cards: Card[]) => [...cards].sort((a, b) => score(a) - score(b))[0];
const score = (card: Card) => card.type === 'DEFUSE' ? 100 : card.type === 'NOPE' ? 80 : card.type === 'RESURRECTION' ? 60 : card.type.startsWith('CAT_') ? 0 : 20;

export function planAutoAction(game: PublicGame, mine: PrivateGame | null, selfId: string | undefined, mode: AutoMode, seconds: number, playsThisTurn = 0): GameAction | null {
  if (mode === 'OFF' || !mine || !selfId || !game.players.some(p => p.id === selfId && p.alive) || seconds <= 0) return null;
  const pending = game.pending;
  if (game.phase === 'TURN' && game.currentPlayerId === selfId) {
    if (mode === 'DRAW') return seconds <= 5 ? { type: 'DRAW_CARD' } : null;
    const suggestion = suggestPlay(game, mine, selfId);
    if (suggestion.cardIds.length && playsThisTurn < 3) {
      const target = [...game.players].filter(p => p.alive && p.id !== selfId).sort((a, b) => (b.handCount ?? 0) - (a.handCount ?? 0))[0];
      return { type: 'PLAY_CARD', cardIds: suggestion.cardIds, ...(suggestion.mode === 'PAIR' && target ? { targetId: target.id } : {}) };
    }
    return { type: 'DRAW_CARD' };
  }
  if (mode !== 'BASIC') return null;
  if (game.phase === 'NOPE_WINDOW' && !pending?.passedPlayerIds?.includes(selfId)) return { type: 'PASS_NOPE' };
  if (['FAVOR_CHOICE', 'HIP_BAT_DISCARD', 'BATTLE_HAMSTER_DISCARD'].includes(game.phase) && pending?.targetPlayerId === selfId) {
    const card = expendable(mine.hand);
    return card ? { type: 'CHOOSE_CARD', cardId: card.instanceId } : null;
  }
  if (game.phase === 'DEFUSE_INSERT' && pending?.sourcePlayerId === selfId && mine.privateData.insertSlotCount) {
    return { type: 'DEFUSE_POSITION', index: mine.privateData.insertSlotCount - 1 };
  }
  if (game.phase === 'ARCHAEOLOGY_CHOICE' && pending?.sourcePlayerId === selfId) {
    const choices = mine.privateData.discardChoices ?? [];
    const card = choices.find(c => c.type === 'DEFUSE') ?? choices[0];
    return card ? { type: 'CHOOSE_CARD', cardId: card.instanceId } : null;
  }
  if (game.phase === 'HIP_CAT_CHOICE' && (pending?.sourcePlayerId === selfId || pending?.targetPlayerId === selfId) && !mine.privateData.hipCatChoice) return { type: 'HIP_CAT_CHOICE', choice: 'ROCK' };
  return null;
}

export function secondsRemaining(deadline: number | null | undefined, now: number, offset = 0): number {
  return deadline ? Math.max(0, Math.ceil((deadline - now - offset) / 1000)) : 0;
}
