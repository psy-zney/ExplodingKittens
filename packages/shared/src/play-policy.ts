import type { Card, CardType } from './index.js';

export type PlayKind = 'SINGLE' | 'PAIR' | 'TRIPLE' | 'PLUS_PLUS';
export type PlayInspection = { valid: true; kind: PlayKind; type: CardType; numericBonus: number; target: 'NONE' | 'LIVING' | 'ELIMINATED' } | { valid: false; reason: string };
export const isNumericCard = (type: CardType) => ['ATTACK', 'SEE_THE_FUTURE', 'HIP_BAT'].includes(type);

// The server and the hand composer use the same shape contract. Ownership,
// phase, targets and revisions are still checked by the authoritative engine.
export function inspectPlay(cards: readonly Card[]): PlayInspection {
  if (cards.length < 1 || cards.length > 3) return { valid: false, reason: 'INVALID_COMBO' };
  if (new Set(cards.map(card => card.instanceId)).size !== cards.length) return { valid: false, reason: 'DUPLICATE_CARD' };
  const type = cards.find(card => card.type !== 'PLUS_PLUS')?.type ?? cards[0]!.type;
  let kind: PlayKind = 'SINGLE';
  if (cards.length > 1) {
    if (cards.every(card => card.type === cards[0]!.type) && type !== 'EXPLODING_KITTEN') kind = cards.length === 2 ? 'PAIR' : 'TRIPLE';
    else if (cards.length === 2 && cards.some(card => card.type === 'PLUS_PLUS') && isNumericCard(type)) kind = 'PLUS_PLUS';
    else return { valid: false, reason: 'INVALID_COMBO' };
  } else if (type.startsWith('CAT_') || ['DEFUSE', 'NOPE', 'EXPLODING_KITTEN', 'PLUS_PLUS'].includes(type)) {
    return { valid: false, reason: 'CARD_NOT_PLAYABLE_ALONE' };
  }
  const target = kind === 'PAIR' || kind === 'TRIPLE' || ['FAVOR', 'BATTLE_HAMSTER', 'CREEPY_PEEKY', 'HIP_BAT', 'HIP_CAT'].includes(type)
    ? 'LIVING' : type === 'RESURRECTION' ? 'ELIMINATED' : 'NONE';
  return { valid: true, kind, type, numericBonus: kind === 'PLUS_PLUS' ? 1 : 0, target };
}
