import { cardName, t } from './i18n';
import type { GameEvent, Language, Player } from './types';

export function eventText(lang: Language, event: GameEvent, players: Player[]): string {
  const p = event.params ?? {};
  const name = (id: unknown) => players.find(player => player.id === id)?.name ?? String(id ?? '');
  const playerName = String(p.playerName ?? name(p.playerId));
  const targetName = name(p.targetId);
  const sourceName = name(p.sourceId);
  const cardType = typeof p.cardType === 'string' ? cardName(lang, p.cardType) : '';
  const args: Record<string, unknown> = { ...p, playerName, targetName, sourceName, cardType };
  const keys: Record<string, string> = {
    'room.created': 'event.joined', 'room.joined': 'event.joined', 'room.left': 'event.left',
    'room.ready': 'event.ready', 'room.started': 'event.started', 'room.rematch': 'event.rematch', 'room.settings': 'event.settings',
    'room.hostChanged': 'event.hostChanged',
    'chat.message': 'event.chat',
    'turn.started': 'playerTurn',
    'card.played': 'event.cardPlayed', 'card.drawn': 'event.cardDrawn',
    'card.exploded': 'event.exploded', 'card.defused': 'event.defused',
    'player.eliminated': 'event.eliminated', 'game.won': 'event.won',
    'nope.played': 'event.nope', 'skip.applied': 'event.skipped',
    'defuse.inserted': `event.inserted.${String(p.zone ?? 'MIDDLE_HIDDEN')}`,
    'combo.stolen': 'event.stole', 'future.seen': 'event.future',
    'deck.shuffled': 'event.shuffled', 'player.resurrected': 'event.resurrected',
  };
  if (event.key === 'turn.started') return t(lang, 'playerTurn', { name: playerName });
  if (event.key === 'event.hidden') return '';
  if (event.key === 'room.ready' && p.ready === false) return t(lang, 'event.unready', { playerName });
  if (event.key === 'player.resurrected') return t(lang, 'event.resurrected', { playerName: name(p.byPlayerId), targetName: playerName });
  if (event.key === 'combo.stolen') return t(lang, 'event.stole', { playerName: targetName, targetName: sourceName });
  if (event.key === 'card.drawn.private') return lang === 'vi' ? `Bạn rút ${cardType}.` : `You drew ${cardType}.`;
  if (event.key === 'card.received') return lang === 'vi' ? `Bạn nhận ${cardType}.` : `You received ${cardType}.`;
  if (event.key === 'defuse.inserted.private') return lang === 'vi' ? `Bạn đã chọn khe ${String(p.index ?? '')}.` : `You chose slot ${String(p.index ?? '')}.`;
  if (keys[event.key]) return t(lang, keys[event.key], args);
  const compact: Record<string, [string, string]> = {
    'attack.applied': ['{targetName} phải chơi {turns} lượt.', '{targetName} owes {turns} turns.'],
    'nope.passed': ['{playerName} bỏ qua Nope.', '{playerName} passed on Nope.'],
    'action.cancelled': ['Hành động bị chặn.', 'The action was blocked.'],
    'favor.requested': ['{targetName} đang chọn một lá để đưa.', '{targetName} is choosing a card to give.'],
    'favor.given': ['{sourceName} đã đưa một lá.', '{sourceName} gave a card.'],
    'favor.empty': ['{targetName} không có lá để đưa.', '{targetName} has no card to give.'],
    'combo.pair': ['{playerName} dùng một cặp.', '{playerName} played a pair.'],
    'combo.triple': ['{playerName} dùng một bộ ba.', '{playerName} played a triple.'],
    'archaeology.returned': ['{cardType} trở vào bộ rút.', '{cardType} returned to the draw pile.'],
    'archaeology.empty': ['Không có lá nào để đào lại.', 'Nothing to dig up.'],
    'archaeology.choiceRequired': ['{playerName} đang chọn lá từ bộ bỏ.', '{playerName} is choosing a discard.'],
    'hamster.discardRequired': ['{targetName} phải bỏ bài đến khi còn một lá.', '{targetName} must discard down to one card.'],
    'hamster.discarded': ['{playerName} đã bỏ {cardType}.', '{playerName} discarded {cardType}.'],
    'hamster.empty': ['{targetName} đã có tối đa một lá.', '{targetName} already has at most one card.'],
    'peek.used': ['{playerName} lén xem bài của {targetName}.', '{playerName} peeked at {targetName}’s hand.'],
    'peek.private': ['Bạn vừa xem riêng một tay bài.', 'You privately saw a hand.'],
    'hipBat.attached': ['Một con dơi bám theo {targetName}.', 'A bat attached to {targetName}.'],
    'hipBat.discardRequired': ['{playerName} phải bỏ bài vì dơi.', '{playerName} must discard for the bat.'],
    'hipBat.discarded': ['{playerName} bỏ {cardType}.', '{playerName} discarded {cardType}.'],
    'hipCat.choiceRequired': ['Hai người đang chọn kéo, búa, bao.', 'Two players are choosing rock, paper, scissors.'],
    'hipCat.choiceSubmitted': ['{playerName} đã chọn kín.', '{playerName} chose in secret.'],
    'hipCat.revealed': ['Kéo, búa, bao đã lật.', 'Rock, paper, scissors revealed.'],
    'hipCat.taken': ['{playerName} lấy {cardType}.', '{playerName} took {cardType}.'],
    'robinHood.redealt': ['Tay bài đã được chia lại.', 'Hands were redistributed.'],
    'twins.transferred': ['{sourceName} đưa {count} lá cho {targetName}.', '{sourceName} gave {count} cards to {targetName}.'],
    'timer.resolved': ['Hết giờ. Máy chủ đã xử lý.', 'Time ran out. The server resolved it.'],
  };
  const template = compact[event.key];
  if (!template) return t(lang, 'event.unknown');
  return template[lang === 'vi' ? 0 : 1].replace(/\{(\w+)\}/g, (_, key: string) => String(args[key] ?? ''));
}
