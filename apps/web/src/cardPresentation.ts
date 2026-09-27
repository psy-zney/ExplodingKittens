import type { ArtStyle, CardType } from './types';

// One illustrated deck for every viewer. Presentation never reads hidden state
// or a browser preference, so the codex, hand and discard use the same artwork.
export const CARD_ART_STYLES: Record<CardType, ArtStyle> = {
  EXPLODING_KITTEN: 'pen', DEFUSE: 'pen', ATTACK: 'stamp', FAVOR: 'geometry',
  NOPE: 'stamp', SHUFFLE: 'geometry', SKIP: 'pixel', SEE_THE_FUTURE: 'pen',
  CAT_TACO: 'stamp', CAT_BEARD: 'pen', CAT_RAINBOW: 'geometry',
  CAT_POTATO: 'pixel', CAT_CATERMELON: 'pen', AMATEUR_ARCHAEOLOGY: 'stamp',
  BATTLE_HAMSTER: 'pixel', CREEPY_PEEKY: 'pen', HIP_BAT: 'geometry',
  HIP_CAT: 'stamp', PLUS_PLUS: 'pixel', ROBIN_HOOD: 'pen',
  THE_TWINS: 'geometry', RESURRECTION: 'stamp',
};

export const DECK_PREVIEW_TYPES: CardType[] = ['DEFUSE', 'ATTACK', 'SKIP', 'SHUFFLE'];
