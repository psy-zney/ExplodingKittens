import { lazy, Suspense } from 'react';
import type { Card, CardType, Language } from './types';
import { cardDescription, cardName, t } from './i18n';
import { CARD_ART_STYLES } from './cardPresentation';

type CardVisual = { tone: string; symbol: string; category: string };

// Presentation only: stable card types still determine every game effect.
export const CARD_VISUALS: Record<CardType, CardVisual> = {
  EXPLODING_KITTEN: { tone: 'red', symbol: '!', category: 'danger' },
  DEFUSE: { tone: 'green', symbol: '+', category: 'safe' },
  ATTACK: { tone: 'red', symbol: '↗', category: 'action' },
  FAVOR: { tone: 'amber', symbol: '?', category: 'action' },
  NOPE: { tone: 'red', symbol: '×', category: 'block' },
  SHUFFLE: { tone: 'green', symbol: '↻', category: 'utility' },
  SKIP: { tone: 'green', symbol: '→', category: 'utility' },
  SEE_THE_FUTURE: { tone: 'amber', symbol: '◎', category: 'peek' },
  CAT_TACO: { tone: 'taco', symbol: '①', category: 'match' },
  CAT_BEARD: { tone: 'beard', symbol: '②', category: 'match' },
  CAT_RAINBOW: { tone: 'rainbow', symbol: '③', category: 'match' },
  CAT_POTATO: { tone: 'potato', symbol: '④', category: 'match' },
  CAT_CATERMELON: { tone: 'melon', symbol: '⑤', category: 'match' },
  AMATEUR_ARCHAEOLOGY: { tone: 'green', symbol: '↶', category: 'utility' },
  BATTLE_HAMSTER: { tone: 'red', symbol: '!', category: 'action' },
  CREEPY_PEEKY: { tone: 'amber', symbol: '◎', category: 'peek' },
  HIP_BAT: { tone: 'red', symbol: '↗', category: 'action' },
  HIP_CAT: { tone: 'amber', symbol: '◇', category: 'action' },
  PLUS_PLUS: { tone: 'green', symbol: '++', category: 'utility' },
  ROBIN_HOOD: { tone: 'green', symbol: '↔', category: 'utility' },
  THE_TWINS: { tone: 'amber', symbol: 'Ⅱ', category: 'action' },
  RESURRECTION: { tone: 'green', symbol: '↑', category: 'safe' },
};

const art = {
  pen: lazy(() => import('./art/PenCat')),
  stamp: lazy(() => import('./art/StampCat')),
  pixel: lazy(() => import('./art/PixelCat')),
  geometry: lazy(() => import('./art/GeometryCat')),
};

export function CardView({ card, lang, selected, onClick, disabled, compact = false, className = '', hint, selectable }: {
  card: Card;
  lang: Language;
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  compact?: boolean;
  className?: string;
  hint?: string;
  selectable?: boolean;
}) {
  const style = CARD_ART_STYLES[card.type];
  const Art = art[style];
  const title = cardName(lang, card.type);
  const visual = CARD_VISUALS[card.type];
  const category = t(lang, `cardCategory.${visual.category}`);
  const content = <>
    <span className="card-header"><span className="card-corner" aria-hidden="true">{visual.symbol}</span><span className="card-category">{category}</span></span>
    <span className="card-title">{title}</span>
    <span className="card-art"><Suspense fallback={<span aria-hidden="true">◡</span>}><Art type={card.type} variant={card.artVariant??0}/></Suspense></span>
    {!compact && <span className="card-description">{cardDescription(lang, card.type)}</span>}
    {hint && <span className="card-hint">{hint}</span>}
  </>;
  const classes = `playing-card style-${style} tone-${visual.tone} ${card.type === 'EXPLODING_KITTEN' ? 'is-danger' : ''} ${selected ? 'is-selected' : ''} ${compact ? 'is-compact' : ''} ${selectable ? 'is-playable' : ''} ${hint ? 'is-suggested' : ''} ${className}`;
  const accessibleLabel = `${title}. ${category}. ${cardDescription(lang, card.type)}${hint ? `. ${hint}` : ''}${selectable ? lang === 'vi' ? '. Có thể chọn.' : '. Selectable.' : ''}`;
  return onClick ? <button type="button" className={classes} data-art-style={style} data-card-type={card.type} data-art-variant={card.artVariant??0} onClick={onClick} disabled={disabled} aria-pressed={!!selected} aria-label={accessibleLabel}>{content}</button>
    : <div className={classes} data-art-style={style} data-card-type={card.type} data-art-variant={card.artVariant??0} role="img" aria-label={accessibleLabel}>{content}</div>;
}

export function CardBack({ count, label, className = '' }: { count?: number; label?: string; className?: string }) {
  return <div className={`playing-card card-back ${className}`} aria-label={label} role="img">
    <svg className="back-cats" viewBox="0 0 120 130" aria-hidden="true"><g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m21 37-3-20 19 12q16-6 32 0l19-12-3 20q16 41-31 45-47-4-33-45Z" fill="currentColor" fillOpacity=".12"/><path d="M37 48v7m33-7v7m-23 9 7 4 7-4M22 59l-13-4m77 4 13-4M34 83l-7 23h22l5-10 7 10h22l-8-23m8 16q19 2 20-16"/><path d="m42 14 2-7m15 7 2-8m-47 107h77"/><circle cx="96" cy="44" r="11" fill="currentColor" fillOpacity=".12"/><path d="M95 32q-8-14 4-17"/></g></svg>
    <span className="back-word">MÈO NỔ</span>
    {typeof count === 'number' && <span className="back-count">{count}</span>}
  </div>;
}

export function cardTypeOf(value: unknown): CardType | null {
  return typeof value === 'object' && value !== null && 'type' in value && typeof value.type === 'string'
    ? value.type as CardType : null;
}
