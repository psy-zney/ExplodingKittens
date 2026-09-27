import type { Card, CardType, GameEvent } from './types';

export type EffectKind = 'draw' | 'play' | 'attack' | 'nope' | 'shuffle' | 'explosion' | 'defuse' | 'steal' | 'peek' | 'revive' | 'win' | 'eliminate' | 'start' | 'toss';
export type GameEffect = {
  id: string;
  kind: EffectKind;
  event: GameEvent;
  duration: number;
  playerId?: string;
  sourceId?: string;
  targetId?: string;
  card?: Card;
};

export const PUBLIC_INSERT_MS = 500;
export function effectSound(effect: GameEffect): string {
  if(effect.kind==='toss')return `throw_${String(effect.event.params?.prop).toLowerCase()}`;
  if(effect.kind!=='play')return effect.kind;
  const sounds: Partial<Record<CardType,string>>={ATTACK:'attack',FAVOR:'favor',NOPE:'nope',SHUFFLE:'shuffle',SKIP:'skip',SEE_THE_FUTURE:'peek',AMATEUR_ARCHAEOLOGY:'dig',BATTLE_HAMSTER:'hamster',CREEPY_PEEKY:'peek',HIP_BAT:'bat',HIP_CAT:'duel',PLUS_PLUS:'plus',ROBIN_HOOD:'redeal',THE_TWINS:'twins',RESURRECTION:'revive'};
  return effect.card?sounds[effect.card.type]??'play':'play';
}
export type PublicInsertion = { seq: number; zone: 'TOP' | 'BOTTOM' | 'MIDDLE_HIDDEN'; playerId: string };
export function publicInsertionOf(event: GameEvent): PublicInsertion | null {
  if (event.key !== 'defuse.inserted' || event.visibility === 'PRIVATE_PLAYER' || event.visibility === 'SERVER_ONLY') return null;
  const zone = event.params?.zone;
  if (zone !== 'TOP' && zone !== 'BOTTOM' && zone !== 'MIDDLE_HIDDEN') return null;
  return { seq: event.seq, zone, playerId: String(event.params?.playerId ?? '') };
}

const kinds: Record<string, EffectKind> = {
  'card.drawn': 'draw', 'card.played': 'play', 'attack.applied': 'attack',
  'nope.played': 'nope', 'deck.shuffled': 'shuffle', 'card.exploded': 'explosion',
  'card.defused': 'defuse', 'combo.stolen': 'steal', 'favor.given': 'steal',
  'twins.transferred': 'steal', 'future.seen': 'peek', 'peek.used': 'peek',
  'player.resurrected': 'revive', 'game.won': 'win',
  'player.eliminated':'eliminate','room.started':'start','social.thrown':'toss',
};
const durations: Record<EffectKind, number> = {
  draw: 380, play: 360, attack: 360, nope: 300, shuffle: 480, explosion: 520,
  defuse: 480, steal: 420, peek: 300, revive: 420, win: 480,
  eliminate:550,start:550,toss:650,
};

/** Deliberately whitelist presentation inputs. Never use a private insert index. */
export function describeEffects(events: readonly GameEvent[], selfId?: string): GameEffect[] {
  return events.flatMap(event => {
    const kind = kinds[event.key];
    if (!kind || event.visibility === 'PRIVATE_PLAYER' || event.visibility === 'SERVER_ONLY') return [];
    const p = event.params ?? {};
    const playerId = typeof p.playerId === 'string' ? p.playerId : undefined;
    const sourceId = typeof p.sourceId === 'string' ? p.sourceId : undefined;
    const targetId = typeof p.targetId === 'string' ? p.targetId : undefined;
    let card: Card | undefined;
    if (kind === 'play' && typeof p.cardType === 'string') card = { instanceId: `effect:${event.seq}`, type: p.cardType as CardType };
    if (kind === 'explosion' || kind === 'defuse') card = { instanceId: `effect:${event.seq}`, type: kind==='defuse'?'DEFUSE':'EXPLODING_KITTEN',artVariant:typeof p.artVariant==='number'?p.artVariant:0 };
    if ((kind === 'draw' && playerId === selfId) || (kind === 'steal' && targetId === selfId)) {
      const privateKey = kind === 'draw' ? 'card.drawn.private' : 'card.received';
      const nextPublic = events.find(candidate => candidate.seq > event.seq && candidate.visibility !== 'PRIVATE_PLAYER' && candidate.key !== 'event.hidden');
      const detail = events.find(candidate => candidate.seq > event.seq && (!nextPublic || candidate.seq < nextPublic.seq)
        && candidate.key === privateKey && candidate.gameId === event.gameId && candidate.revision === event.revision && candidate.visibility === 'PRIVATE_PLAYER');
      if (typeof detail?.params?.cardType === 'string') card = {
        instanceId: String(detail.params.instanceId ?? `effect:${event.seq}`), type: detail.params.cardType as CardType, artVariant: typeof detail.params.artVariant === 'number' ? detail.params.artVariant : 0,
      };
    }
    return [{ id: `${event.gameId ?? 'room'}:${event.seq}`, kind, event, duration: durations[kind], playerId, sourceId, targetId, card }];
  });
}
