import { useEffect, useState } from 'react';
import type { Language } from './types';
import './lobbyLoading.css';

interface LobbyLoadingProps {
  lang: Language;
  message?: string;
  context?: 'create' | 'join' | 'start' | 'ready' | 'settings' | 'connecting' | 'default';
}

const QUOTES: Record<Language, string[]> = {
  vi: [
    'Đang giấu tia laser vào tay áo…',
    'Mèo đang kiểm tra kíp nổ bom…',
    'Đảm bảo không ai giấu lá Defuse dưới đệm…',
    'Đang huấn luyện Hamster Chiến đấu…',
    'Mèo đang rình bạn rút bài…',
    'Đang xáo cọc bài và chia bài… đừng chớp mắt!',
    'Đang xới lại mộ bài tìm lá cũ…',
    'Một con mèo vừa nhìn bạn với ánh mắt khả nghi…'
  ],
  en: [
    'Concealing laser pointers up sleeves…',
    'The kitten is inspecting explosive fuses…',
    'Verifying no Defuse cards are under the cushion…',
    'Training Battle Hamsters in the backyard…',
    'A cat is quietly watching your draw…',
    'Shuffling deck and dealing cards… don’t blink!',
    'Digging through the discard pile for relics…',
    'A cat just gave you a very suspicious look…'
  ]
};

const TITLES: Record<Language, Record<string, string>> = {
  vi: {
    create: 'Đang tạo phòng chơi mới…',
    join: 'Đang vào bàn bài…',
    start: 'Đang bắt đầu ván đấu…',
    ready: 'Đang đồng bộ trạng thái sẵn sàng…',
    settings: 'Đang lưu cài đặt phòng…',
    connecting: 'Đang kết nối tới máy chủ…',
    default: 'Mèo đang xử lý…'
  },
  en: {
    create: 'Creating your table…',
    join: 'Joining the table…',
    start: 'Starting the match…',
    ready: 'Updating ready status…',
    settings: 'Updating room settings…',
    connecting: 'Connecting to server…',
    default: 'Kitten is busy…'
  }
};

export function LobbyLoading({ lang, message, context = 'default' }: LobbyLoadingProps) {
  const [quoteIndex, setQuoteIndex] = useState(0);

  useEffect(() => {
    const quotes = QUOTES[lang];
    const timer = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % quotes.length);
    }, 2400);
    return () => clearInterval(timer);
  }, [lang]);

  const title = message || TITLES[lang][context] || TITLES[lang].default;
  const quote = QUOTES[lang][quoteIndex];

  return (
    <div className="lobby-loading-overlay" role="alert" aria-busy="true" aria-live="polite">
      <div className="lobby-loading-card">
        <div className="lobby-cat-avatar" aria-hidden="true">
          <div className="lobby-cat-ears">
            <span>⌃</span>
            <span>⌃</span>
          </div>
          <div className="lobby-cat-face">◡</div>
          <div className="lobby-cat-paws">
            <span>🐾</span>
            <span>🐾</span>
          </div>
        </div>

        <div className="lobby-loading-pill">
          <span className="loading-pulse-dot" />
          <span>{lang === 'vi' ? 'ĐANG TẢI DỮ LIỆU' : 'LOADING TABLE'}</span>
        </div>

        <h3 className="loading-title">{title}</h3>

        <div className="loading-bar-wrap" aria-hidden="true">
          <div className="loading-bar-shimmer" />
        </div>

        <p className="loading-quote">“{quote}”</p>
      </div>
    </div>
  );
}
