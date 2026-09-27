import { t } from './i18n';
import type { CardType, Language } from './types';

export type ThrowProp = 'EGG' | 'BOMB' | 'ROCK';
export function PropIcon({ prop }: { prop: ThrowProp }) {
  return <svg className="prop-icon" viewBox="0 0 80 80" aria-hidden="true" fill="none" stroke="#684036" strokeWidth="3" strokeLinejoin="round">
    {prop === 'EGG' && <><path d="M40 8C24 8 14 38 15 53c2 26 48 26 50 0C66 38 56 8 40 8Z" fill="#fff2cb"/><path d="m20 40 12 6 9-10 12 7 10-4"/><circle cx="30" cy="53" r="2" fill="#684036"/><circle cx="50" cy="53" r="2" fill="#684036"/><path d="M34 62q6 6 12 0"/></>}
    {prop === 'BOMB' && <><path d="M42 22q-5-13 8-14l8 2m-1-7 5 4m2 4 7 2" stroke="#ba6242"/><path d="M31 20h20v12H31Z" fill="#ca91b4"/><circle cx="40" cy="50" r="26" fill="#9a759e"/><path d="m22 46 9-5m16 0 9 5M28 59q12 12 25-1"/><path d="m25 26 5 8" stroke="#ebc8da"/></>}
    {prop === 'ROCK' && <><path d="m18 23 28-7 23 24-7 28-37 4L10 48Z" fill="#a9bfd0"/><path d="m18 23 12 21-20 4m20-4 27 5 12-9M30 44l-5 28" stroke="#7d9caf"/><circle cx="37" cy="47" r="2" fill="#684036"/><circle cx="52" cy="47" r="2" fill="#684036"/><path d="m38 58 11-1"/></>}
  </svg>;
}
const symbols: Partial<Record<CardType, string>> = { ATTACK: '↯', FAVOR: '♡', NOPE: '×', SHUFFLE: '↝', SKIP: '»', SEE_THE_FUTURE: '⌕', AMATEUR_ARCHAEOLOGY: '↟', BATTLE_HAMSTER: '!', CREEPY_PEEKY: '◉', HIP_BAT: '⌃', HIP_CAT: '✂', PLUS_PLUS: '+1', ROBIN_HOOD: '⇄', THE_TWINS: '×2', RESURRECTION: '↑' };
export function ActionSticker({ type, lang }: { type: CardType; lang: Language }) {
  if (!symbols[type]) return null;
  return <div className={`action-sticker sticker-${type.toLowerCase()}`} data-action-sticker={type}><span className="sticker-symbol">{symbols[type]}</span><strong>{t(lang, `fx.${type}`)}</strong><svg viewBox="0 0 90 75" fill="#fff0c4" stroke="#6c3930" strokeWidth="3" aria-hidden="true"><path d="M14 62Q7 35 18 15l18 10h17L74 12q18 36 5 51Q44 82 14 62Z"/><path d="m26 41 7-4 7 4m13 0 7-4 7 4m-23 9 5 4 5-4m-16 10q13 8 26-2" fill="none"/></svg></div>;
}
