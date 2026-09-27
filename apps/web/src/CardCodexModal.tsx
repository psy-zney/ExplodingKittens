import { useState } from 'react';
import { calculateDeckScaling } from '@kittens/shared';
import type { CardType, Language } from './types';
import { CardView, CARD_VISUALS } from './CardView';
import { cardDescription, cardName, EXPANSION_TYPES, t } from './i18n';
import { useModalFocus } from './useModalFocus';
import './cardCodex.css';

interface CardCodexModalProps {
  lang: Language;
  onClose: () => void;
  onPlaySfx?: (name: string) => void;
  onStopSfx?: () => void;
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
  EXPLODING_KITTEN: {
    count: 'N - 1 lá (Tự co giãn)',
    noteVi: 'Tự động mở rộng & thu hẹp theo số người chơi (Số Boom = Số người - 1). Ví dụ: 2 người = 1 Boom, 3 người = 2 Boom, 4 người = 3 Boom, 5 người = 4 Boom.',
    noteEn: 'Dynamically scales with player count (Booms = Players - 1). E.g. 2 players = 1 Boom, 3 players = 2 Booms, 4 players = 3 Booms, 5 players = 4 Booms.'
  },
  DEFUSE: {
    count: 'N + 1~2 lá (Tự co giãn)',
    noteVi: 'Tự động cấp 1 lá trên tay cho mỗi người chơi (N lá). Cọc rút giữ thêm 1-2 lá phòng ngừa (N < 5: thêm 2 lá; N ≥ 5: thêm 1 lá).',
    noteEn: 'Dynamically scales: each player starts with 1 Defuse (N cards). The draw pile holds 1-2 extra (N < 5: 2 extra; N ≥ 5: 1 extra).'
  },
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

export function CardCodexModal({ lang, onClose, onPlaySfx, onStopSfx }: CardCodexModalProps) {
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

  const handleClose = () => {
    onStopSfx?.();
    onClose();
  };

  const handleSelectCard = (type: CardType) => {
    onStopSfx?.();
    setSelectedType(type);
    setAnimKey(prev => prev + 1);
    if (onPlaySfx) {
      const sfx = CARD_SFX[type] || 'ui_click';
      onPlaySfx(sfx);
    }
  };

  const replayAnimation = () => {
    onStopSfx?.();
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
        if (e.target === e.currentTarget) handleClose();
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
          <button className="icon-button" type="button" onClick={handleClose} aria-label={t(lang, 'close')}>
            ×
          </button>
        </header>

        {/* Filter Tabs */}
        <div className="codex-tabs" role="group" aria-label={t(lang, 'cardFilter')}>
          <button
            type="button"
            className={`codex-tab ${tab === 'ALL' ? 'active' : ''}`}
            onClick={() => { onStopSfx?.(); setTab('ALL'); }}
          >
            {lang === 'vi' ? `Tất cả (${ALL_TYPES.length})` : `All Cards (${ALL_TYPES.length})`}
          </button>
          <button
            type="button"
            className={`codex-tab ${tab === 'BASE' ? 'active' : ''}`}
            onClick={() => { onStopSfx?.(); setTab('BASE'); }}
          >
            {lang === 'vi' ? `Bản gốc (${BASE_CARD_TYPES.length})` : `Original (${BASE_CARD_TYPES.length})`}
          </button>
          <button
            type="button"
            className={`codex-tab ${tab === 'EXTENDED' ? 'active' : ''}`}
            onClick={() => { onStopSfx?.(); setTab('EXTENDED'); }}
          >
            {lang === 'vi' ? 'Mở rộng (8)' : 'Expansion (8)'}
          </button>
          <button
            type="button"
            className={`codex-tab ${tab === 'RESURRECTION' ? 'active' : ''}`}
            onClick={() => { onStopSfx?.(); setTab('RESURRECTION'); }}
          >
            {lang === 'vi' ? 'Hồi sinh (1)' : 'Resurrection (1)'}
          </button>
          <button
            type="button"
            className={`codex-tab ${tab === 'DANGER' ? 'active' : ''}`}
            onClick={() => { onStopSfx?.(); setTab('DANGER'); }}
          >
            {lang === 'vi' ? 'Nổ & Cứu' : 'Danger & Safe'}
          </button>
          <button
            type="button"
            className={`codex-tab ${tab === 'ACTION' ? 'active' : ''}`}
            onClick={() => { onStopSfx?.(); setTab('ACTION'); }}
          >
            {lang === 'vi' ? 'Tác động & Chặn' : 'Action & Block'}
          </button>
          <button
            type="button"
            className={`codex-tab ${tab === 'MATCH' ? 'active' : ''}`}
            onClick={() => { onStopSfx?.(); setTab('MATCH'); }}
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

              {(selectedType === 'EXPLODING_KITTEN' || selectedType === 'DEFUSE') && (
                <DeckScalingSimulator lang={lang} />
              )}
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


function DeckScalingSimulator({ lang }: { lang: Language }) {
  const [simPlayers, setSimPlayers] = useState<number>(4);
  const scaling = calculateDeckScaling(simPlayers, 'BASE', false);

  return (
    <div className="codex-scaling-simulator">
      <div className="simulator-header">
        <h4>
          <span>⚙️</span>
          <span>{lang === 'vi' ? 'Mô Phỏng Co Giãn Theo Số Người' : 'Dynamic Deck Scaling Simulator'}</span>
        </h4>
        <div className="simulator-player-selector">
          <span>{lang === 'vi' ? 'Số người:' : 'Players:'}</span>
          {[2, 3, 4, 5].map((count) => (
            <button
              key={count}
              type="button"
              className={`simulator-p-btn ${simPlayers === count ? 'active' : ''}`}
              onClick={() => setSimPlayers(count)}
            >
              {count} {lang === 'vi' ? 'người' : 'P'}
            </button>
          ))}
        </div>
      </div>

      <div className="simulator-grid">
        <div className="simulator-stat">
          <span>{lang === 'vi' ? 'Mèo Nổ (Boom)' : 'Exploding'}</span>
          <strong>{scaling.activeKittens} {lang === 'vi' ? 'lá' : 'cards'}</strong>
          <small>{simPlayers} - 1</small>
        </div>
        <div className="simulator-stat">
          <span>{lang === 'vi' ? 'Cứu Nổ (Defuse)' : 'Defuses'}</span>
          <strong>{scaling.totalDefusesInGame} {lang === 'vi' ? 'lá' : 'cards'}</strong>
          <small>{scaling.startingDefuses} tay + {scaling.extraDefusesInDeck} cọc</small>
        </div>
        <div className="simulator-stat">
          <span>{lang === 'vi' ? 'Tổng bộ bài' : 'Deck Size'}</span>
          <strong>{scaling.totalDeckCards} {lang === 'vi' ? 'lá' : 'cards'}</strong>
          <small>{lang === 'vi' ? 'Bộ gốc 56' : 'Base 56'}</small>
        </div>
      </div>

      <div className="simulator-formula-box">
        {lang === 'vi'
          ? `💡 Với ${simPlayers} người chơi: Cọc rút luôn giữ chính xác ${scaling.activeKittens} Mèo Nổ. Khi ${scaling.activeKittens} người bị nổ tung, đúng 1 người sống sót duy nhất sẽ chiến thắng!`
          : `💡 For ${simPlayers} players: The draw pile holds exactly ${scaling.activeKittens} Exploding Kittens. Once ${scaling.activeKittens} players explode, exactly 1 survivor wins!`}
      </div>
    </div>
  );
}
