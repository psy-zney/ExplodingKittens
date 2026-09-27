import { useState } from 'react';
import type { CardType, Language } from './types';
import { CardView, CARD_VISUALS } from './CardView';
import { cardDescription, cardName, EXPANSION_TYPES, t } from './i18n';
import { useModalFocus } from './useModalFocus';
import './cardCodex.css';

interface CardCodexModalProps {
  lang: Language;
  onClose: () => void;
  onPlaySfx?: (name: string) => void;
}

type FilterTab = 'ALL' | 'BASE' | 'EXTENDED' | 'RESURRECTION' | 'DANGER' | 'ACTION' | 'MATCH';

const BASE_CARD_TYPES: CardType[] = [
  'EXPLODING_KITTEN',
  'DEFUSE',
  'ATTACK',
  'FAVOR',
  'NOPE',
  'SHUFFLE',
  'SKIP',
  'SEE_THE_FUTURE',
  'CAT_TACO',
  'CAT_BEARD',
  'CAT_RAINBOW',
  'CAT_POTATO',
  'CAT_CATERMELON'
];

const ALL_TYPES: CardType[] = [
  ...BASE_CARD_TYPES,
  ...EXPANSION_TYPES,
  'RESURRECTION'
];

const CARD_COUNTS: Record<CardType, { count: string; noteVi: string; noteEn: string }> = {
  EXPLODING_KITTEN: { count: 'N - 1', noteVi: 'Bằng số người chơi trừ 1 (3 lá trong bàn 4 người)', noteEn: 'Players minus 1 (3 cards for 4 players)' },
  DEFUSE: { count: '6 lá', noteVi: 'Mỗi người nhận 1 lá lúc đầu; đưa tối đa 2 lá dư vào bộ rút', noteEn: '1 dealt to each player; up to 2 spares enter the draw pile' },
  ATTACK: { count: '4 lá', noteVi: 'Có trong bộ gốc 56 lá', noteEn: 'Included in base 56-card deck' },
  FAVOR: { count: '4 lá', noteVi: 'Có trong bộ gốc 56 lá', noteEn: 'Included in base 56-card deck' },
  NOPE: { count: '5 lá', noteVi: 'Lá phản đòn quan trọng nhất', noteEn: 'Crucial interrupt card' },
  SHUFFLE: { count: '4 lá', noteVi: 'Có trong bộ gốc 56 lá', noteEn: 'Included in base 56-card deck' },
  SKIP: { count: '4 lá', noteVi: 'Có trong bộ gốc 56 lá', noteEn: 'Included in base 56-card deck' },
  SEE_THE_FUTURE: { count: '5 lá', noteVi: 'Có trong bộ gốc 56 lá', noteEn: 'Included in base 56-card deck' },
  CAT_TACO: { count: '4 lá', noteVi: 'Mèo thường, dùng để ghép combo 2/3 lá', noteEn: 'Standard cat, used for 2/3 card combos' },
  CAT_BEARD: { count: '4 lá', noteVi: 'Mèo thường, dùng để ghép combo 2/3 lá', noteEn: 'Standard cat, used for 2/3 card combos' },
  CAT_RAINBOW: { count: '4 lá', noteVi: 'Mèo thường, dùng để ghép combo 2/3 lá', noteEn: 'Standard cat, used for 2/3 card combos' },
  CAT_POTATO: { count: '4 lá', noteVi: 'Mèo thường, dùng để ghép combo 2/3 lá', noteEn: 'Standard cat, used for 2/3 card combos' },
  CAT_CATERMELON: { count: '4 lá', noteVi: 'Mèo thường, dùng để ghép combo 2/3 lá', noteEn: 'Standard cat, used for 2/3 card combos' },
  AMATEUR_ARCHAEOLOGY: { count: '1 lá', noteVi: 'Bộ mở rộng (Chế độ Mở Rộng 64 lá)', noteEn: 'Expansion card (64-card Extended mode)' },
  BATTLE_HAMSTER: { count: '1 lá', noteVi: 'Bộ mở rộng (Chế độ Mở Rộng 64 lá)', noteEn: 'Expansion card (64-card Extended mode)' },
  CREEPY_PEEKY: { count: '1 lá', noteVi: 'Bộ mở rộng (Chế độ Mở Rộng 64 lá)', noteEn: 'Expansion card (64-card Extended mode)' },
  HIP_BAT: { count: '1 lá', noteVi: 'Bộ mở rộng (Chế độ Mở Rộng 64 lá)', noteEn: 'Expansion card (64-card Extended mode)' },
  HIP_CAT: { count: '1 lá', noteVi: 'Bộ mở rộng (Chế độ Mở Rộng 64 lá)', noteEn: 'Expansion card (64-card Extended mode)' },
  PLUS_PLUS: { count: '1 lá', noteVi: 'Bộ mở rộng (Chế độ Mở Rộng 64 lá)', noteEn: 'Expansion card (64-card Extended mode)' },
  ROBIN_HOOD: { count: '1 lá', noteVi: 'Bộ mở rộng (Chế độ Mở Rộng 64 lá)', noteEn: 'Expansion card (64-card Extended mode)' },
  THE_TWINS: { count: '1 lá', noteVi: 'Bộ mở rộng (Chế độ Mở Rộng 64 lá)', noteEn: 'Expansion card (64-card Extended mode)' },
  RESURRECTION: { count: '2 lá', noteVi: 'Lá bài tùy chọn khi bật chế độ Hồi Sinh', noteEn: 'Optional card added when Resurrection is enabled' }
};

const CARD_SFX: Partial<Record<CardType, string>> = {
  EXPLODING_KITTEN: 'explosion',
  DEFUSE: 'defuse',
  ATTACK: 'attack',
  NOPE: 'nope',
  SEE_THE_FUTURE: 'peek',
  SKIP: 'draw',
  SHUFFLE: 'shuffle',
  FAVOR: 'steal',
  CAT_TACO: 'steal',
  CAT_BEARD: 'steal',
  CAT_RAINBOW: 'steal',
  CAT_POTATO: 'steal',
  CAT_CATERMELON: 'steal',
  AMATEUR_ARCHAEOLOGY: 'shuffle',
  BATTLE_HAMSTER: 'attack',
  CREEPY_PEEKY: 'peek',
  HIP_BAT: 'steal',
  HIP_CAT: 'play',
  PLUS_PLUS: 'attack',
  ROBIN_HOOD: 'shuffle',
  THE_TWINS: 'steal',
  RESURRECTION: 'revive'
};

export function CardCodexModal({ lang, onClose, onPlaySfx }: CardCodexModalProps) {
  const modalRef = useModalFocus();
  const [selectedType, setSelectedType] = useState<CardType>('EXPLODING_KITTEN');
  const [tab, setTab] = useState<FilterTab>('ALL');
  const [animKey, setAnimKey] = useState(0);

  const filterCards = (item: CardType): boolean => {
    if (tab === 'ALL') return true;
    if (tab === 'BASE') return BASE_CARD_TYPES.includes(item);
    if (tab === 'EXTENDED') return EXPANSION_TYPES.includes(item);
    if (tab === 'RESURRECTION') return item === 'RESURRECTION';
    const visual = CARD_VISUALS[item];
    if (tab === 'DANGER') return visual.category === 'danger' || visual.category === 'safe';
    if (tab === 'ACTION') return visual.category === 'action' || visual.category === 'block';
    if (tab === 'MATCH') return visual.category === 'match';
    return true;
  };

  const filteredList = ALL_TYPES.filter(filterCards);
  const visual = CARD_VISUALS[selectedType];
  const countInfo = CARD_COUNTS[selectedType];

  const handleSelectCard = (type: CardType) => {
    setSelectedType(type);
    setAnimKey(prev => prev + 1);
    if (onPlaySfx) {
      const sfx = CARD_SFX[type] || 'ui_click';
      onPlaySfx(sfx);
    }
  };

  const replayAnimation = () => {
    setAnimKey(prev => prev + 1);
    if (onPlaySfx) {
      const sfx = CARD_SFX[selectedType] || 'ui_click';
      onPlaySfx(sfx);
    }
  };

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={modalRef}
        className="modal codex-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="codex-title"
      >
        {/* Header */}
        <header className="codex-header">
          <div className="codex-title-wrap">
            <span className="eyebrow">{lang === 'vi' ? 'BỘ BÀI MINH HỌA' : 'ILLUSTRATED DECK'} · {ALL_TYPES.length}</span>
            <h2 id="codex-title">
              <span>{lang === 'vi' ? 'Kho Thẻ Bài Mèo Nổ' : 'Exploding Kittens Card Codex'}</span>
              <span className="codex-badge-count">{filteredList.length}</span>
            </h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label={t(lang, 'close')}>
            ×
          </button>
        </header>

        {/* Filter Tabs */}
        <div className="codex-tabs" role="group" aria-label={t(lang, 'cardFilter')}>
          <button
            type="button"
            className={`codex-tab ${tab === 'ALL' ? 'active' : ''}`}
            onClick={() => setTab('ALL')}
          >
            {lang === 'vi' ? `Tất cả (${ALL_TYPES.length})` : `All Cards (${ALL_TYPES.length})`}
          </button>
          <button
            type="button"
            className={`codex-tab ${tab === 'BASE' ? 'active' : ''}`}
            onClick={() => setTab('BASE')}
          >
            {lang === 'vi' ? `Bản gốc (${BASE_CARD_TYPES.length})` : `Original (${BASE_CARD_TYPES.length})`}
          </button>
          <button
            type="button"
            className={`codex-tab ${tab === 'EXTENDED' ? 'active' : ''}`}
            onClick={() => setTab('EXTENDED')}
          >
            {lang === 'vi' ? 'Mở rộng (8)' : 'Expansion (8)'}
          </button>
          <button
            type="button"
            className={`codex-tab ${tab === 'RESURRECTION' ? 'active' : ''}`}
            onClick={() => setTab('RESURRECTION')}
          >
            {lang === 'vi' ? 'Hồi sinh (1)' : 'Resurrection (1)'}
          </button>
          <button
            type="button"
            className={`codex-tab ${tab === 'DANGER' ? 'active' : ''}`}
            onClick={() => setTab('DANGER')}
          >
            {lang === 'vi' ? 'Nổ & Cứu' : 'Danger & Safe'}
          </button>
          <button
            type="button"
            className={`codex-tab ${tab === 'ACTION' ? 'active' : ''}`}
            onClick={() => setTab('ACTION')}
          >
            {lang === 'vi' ? 'Tác động & Chặn' : 'Action & Block'}
          </button>
          <button
            type="button"
            className={`codex-tab ${tab === 'MATCH' ? 'active' : ''}`}
            onClick={() => setTab('MATCH')}
          >
            {lang === 'vi' ? '5 Họ Mèo Combo' : 'Cat Combos'}
          </button>
        </div>

        {/* Modal Body */}
        <div className="codex-body">
          {/* Canonical illustration shared by every viewer. */}
          <aside className="codex-showcase">
            <div className="showcase-card-holder">
              <CardView
                card={{ instanceId: 'showcase-preview', type: selectedType }}
                lang={lang}
              />
            </div>

            <p className="showcase-deck-note">{t(lang, 'mixedDeckNote')}</p>

            <div className="showcase-stats">
              <div className="stat-box">
                <span>{lang === 'vi' ? 'Số lượng' : 'Deck Count'}</span>
                <strong>{countInfo.count.replace('lá', lang === 'vi' ? 'lá' : 'cards')}</strong>
              </div>
              <div className="stat-box">
                <span>{lang === 'vi' ? 'Nhóm bài' : 'Category'}</span>
                <strong>{t(lang, `cardCategory.${visual.category}`)}</strong>
              </div>
            </div>
          </aside>

          {/* Right Column: Grid Selector, Rules, & Animation Arena */}
          <main className="codex-content">
            {/* Mini Grid */}
            <div className="codex-grid-wrap">
              <div className="codex-section-label">
                <span>{lang === 'vi' ? 'Chọn lá bài để xem' : 'Select a card to inspect'}</span>
                <span>{filteredList.length} {lang === 'vi' ? 'loại' : 'types'}</span>
              </div>
              <div className="codex-mini-grid" role="group" aria-label={t(lang, 'cardGallery')}>
                {filteredList.map((type) => {
                  const itemVisual = CARD_VISUALS[type];
                  const isSelected = type === selectedType;
                  return (
                    <button
                      key={type}
                      type="button"
                      aria-pressed={isSelected}
                      aria-label={cardName(lang, type)}
                      className={`codex-mini-card tone-${itemVisual.tone} ${isSelected ? 'active' : ''}`}
                      onClick={() => handleSelectCard(type)}
                    >
                      <CardView card={{ instanceId: `codex-${type}`, type }} lang={lang} compact/>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Detailed Description */}
            <div className="card-detail-card">
              {EXPANSION_TYPES.includes(selectedType) && <p className="card-detail-desc">{t(lang, 'rule.extro')}</p>}
              <div className="card-detail-header">
                <div>
                  <span className="eyebrow">{selectedType}</span>
                  <h3>{cardName(lang, selectedType)}</h3>
                </div>
                <span className={`card-detail-type-pill tone-${visual.tone}`}>
                  {t(lang, `cardCategory.${visual.category}`)}
                </span>
              </div>

              <p className="card-detail-desc">{cardDescription(lang, selectedType)}</p>

              {/* Detailed Rules Contract */}
              <div className="card-detail-rules">
                <strong>{lang === 'vi' ? 'Luật thi đấu & Cơ chế hoạt động' : 'Rule Contract & Behavior'}</strong>
                <p>
                  {t(lang, `rule.${selectedType}`) !== `rule.${selectedType}`
                    ? t(lang, `rule.${selectedType}`)
                    : countInfo[lang === 'vi' ? 'noteVi' : 'noteEn']}
                </p>
                {t(lang, `rule.detail.${selectedType}`) !== `rule.detail.${selectedType}` && (
                  <p style={{ marginTop: 4, fontStyle: 'italic', opacity: 0.9 }}>
                    {t(lang, `rule.detail.${selectedType}`)}
                  </p>
                )}
                {visual.category === 'match' && (
                  <p style={{ marginTop: 4, fontSize: '0.78rem' }}>
                    {lang === 'vi'
                      ? 'Hai lá cùng tên: cướp ngẫu nhiên một lá. Ba lá cùng tên: gọi tên loại bài; chỉ lấy được nếu mục tiêu có. Chọn đối thủ rồi xác nhận đánh. Game này hỗ trợ combo 2 và 3 lá.'
                      : 'Two matching cards: steal one random card. Three matching cards: name a type; take it only if the target has it. Choose an opponent, then confirm. This game supports two- and three-card combos.'}
                  </p>
                )}
              </div>
            </div>

            {/* Animation Arena */}
            <section className="animation-arena" aria-label={lang === 'vi' ? 'Hoạt ảnh minh họa' : 'Illustration animation'}>
              <div className="arena-header">
                <span className="arena-tag">
                  <span>▶</span>
                  <span>{lang === 'vi' ? 'HOẠT ẢNH MINH HỌA' : 'INTERACTIVE SIMULATION'}</span>
                </span>
                <button
                  type="button"
                  className="arena-replay-btn"
                  onClick={replayAnimation}
                  title={lang === 'vi' ? 'Chạy lại hoạt ảnh' : 'Replay animation'}
                >
                  <span>↻</span>
                  <span>{lang === 'vi' ? 'Xem lại' : 'Replay'}</span>
                </button>
              </div>

              <div className="arena-stage" key={animKey}>
                <CardSimulationScene type={selectedType} lang={lang} />
              </div>
            </section>
          </main>
        </div>
      </section>
    </div>
  );
}

function CardSimulationScene({ type, lang }: { type: CardType; lang: Language }) {
  switch (type) {
    case 'EXPLODING_KITTEN':
      return (
        <div className="anim-bomb-wrap">
          <div className="anim-bomb-timer">3</div>
          <div className="anim-bomb-cat">💣🐱</div>
          <div className="anim-explosion">
            <div className="anim-blast-ring" />
            <div className="anim-kaboom-text">💥 KABOOM!!</div>
          </div>
        </div>
      );

    case 'DEFUSE':
      return (
        <div className="anim-defuse-wrap">
          <div className="anim-laser-pointer">🔦</div>
          <div className="anim-laser-beam" />
          <div className="anim-laser-cat">😼🐾</div>
          <div className="anim-defused-badge">
            {lang === 'vi' ? '✓ ĐÃ GỠ BOM THÀNH CÔNG!' : '✓ DEFUSED SAFELY!'}
          </div>
        </div>
      );

    case 'ATTACK':
      return (
        <div className="anim-attack-wrap">
          <div className="anim-claw-mark" />
          <div className="anim-claw-mark" />
          <div className="anim-claw-mark" />
          <div className="anim-attack-badge">
            ⚡ +2 {lang === 'vi' ? 'LƯỢT ĐÒI NỢ' : 'TURNS FORCED'} ⚡
          </div>
        </div>
      );

    case 'NOPE':
      return (
        <div className="anim-nope-wrap">
          <div className="anim-nope-cross">✕</div>
          <div className="anim-nope-shield">
            <span className="anim-nope-text">NOPE!</span>
          </div>
        </div>
      );

    case 'SEE_THE_FUTURE':
      return (
        <div className="anim-future-wrap">
          <div className="anim-crystal-ball">🔮</div>
          <div className="anim-future-cards">
            <div className="anim-mini-future-card">#1</div>
            <div className="anim-mini-future-card">#2</div>
            <div className="anim-mini-future-card">#3</div>
          </div>
        </div>
      );

    case 'SKIP':
      return (
        <div className="anim-skip-wrap">
          <div className="anim-skip-wind" />
          <div className="anim-skip-wind" />
          <div className="anim-skip-wind" />
          <div className="anim-skip-cat">🕶️💨</div>
        </div>
      );

    case 'SHUFFLE':
      return (
        <div className="anim-shuffle-wrap">
          <div className="anim-shuffle-deck">🂠</div>
          <div className="anim-shuffle-deck">🂡</div>
          <div className="anim-shuffle-deck">🂢</div>
        </div>
      );

    case 'FAVOR':
      return (
        <div className="anim-favor-wrap">
          <div className="anim-beg-cat">🥺🤲</div>
          <div className="anim-favor-gift">🂠✨</div>
        </div>
      );

    case 'CAT_TACO':
    case 'CAT_BEARD':
    case 'CAT_RAINBOW':
    case 'CAT_POTATO':
    case 'CAT_CATERMELON': {
      const emojiMap: Record<string, string> = {
        CAT_TACO: '🌮',
        CAT_BEARD: '🧔',
        CAT_RAINBOW: '🌈',
        CAT_POTATO: '🥔',
        CAT_CATERMELON: '🍉'
      };
      const catIcon = emojiMap[type] || '🐱';
      return (
        <div className="anim-cat-combo-wrap">
          <div className="anim-combo-cat-1">{catIcon}🐱</div>
          <div className="anim-combo-spark">✨💥✨</div>
          <div className="anim-combo-cat-2">🐱{catIcon}</div>
        </div>
      );
    }

    case 'AMATEUR_ARCHAEOLOGY':
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div className="anim-shovel">⛏️</div>
          <div className="anim-relic-card">📜✨</div>
        </div>
      );

    case 'BATTLE_HAMSTER':
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
          <div className="anim-hamster">🐹</div>
          <div className="anim-boxing-glove">🥊💥</div>
        </div>
      );

    case 'CREEPY_PEEKY':
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div className="anim-magnifier">🔍</div>
          <div className="anim-secret-eye">👁️🂠</div>
        </div>
      );

    case 'HIP_BAT':
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div className="anim-bat">🦇🎧</div>
          <div className="anim-bat-steal">🂠⚡</div>
        </div>
      );

    case 'HIP_CAT':
      return (
        <div className="anim-rps-box">
          <div className="anim-rps-hand1">✊</div>
          <div className="anim-rps-vs">VS</div>
          <div className="anim-rps-hand2">✌️</div>
        </div>
      );

    case 'PLUS_PLUS':
      return (
        <div style={{ textAlign: 'center' }}>
          <div className="anim-plus-symbol">[ ++ ]</div>
          <div style={{ color: '#aaffcc', fontSize: '0.8rem', fontWeight: 800, marginTop: 4 }}>
            ⚡ +1 BOOST EFFECT ⚡
          </div>
        </div>
      );

    case 'ROBIN_HOOD':
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div className="anim-bow-arrow">🏹💨</div>
          <div className="anim-target">🎯🂠</div>
        </div>
      );

    case 'THE_TWINS':
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 25 }}>
          <div className="anim-twin1">🐱👯</div>
          <div className="anim-twin2">👯🐱</div>
        </div>
      );

    case 'RESURRECTION':
      return (
        <div className="anim-angel-wrap">
          <div className="anim-halo" />
          <div className="anim-wings">🪽</div>
          <div className="anim-angel-cat">😇🐱</div>
        </div>
      );

    default:
      return <div style={{ fontSize: '3rem' }}>✨</div>;
  }
}
