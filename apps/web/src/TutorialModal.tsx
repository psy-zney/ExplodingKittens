import type { Language } from './types';
import { t } from './i18n';
import { useModalFocus } from './useModalFocus';
import './tutorialModal.css';

type TutorialModalProps = {
  lang: Language;
  onClose: () => void;
};

export function TutorialModal({ lang, onClose }: TutorialModalProps) {
  const modalRef = useModalFocus();
  const base = import.meta.env.BASE_URL;
  const videoUrl = `${base}tutorial/huong-dan-choi-meo-no.mp4`;
  const posterUrl = `${base}tutorial/huong-dan-choi-meo-no-poster.png`;

  return (
    <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={modalRef} className="modal tutorial-modal" role="dialog" aria-modal="true" aria-labelledby="tutorial-title">
        <header className="modal-header tutorial-header">
          <div>
            <span className="eyebrow">▶ 46 GIÂY · {t(lang, 'tutorialLanguage')}</span>
            <h2 id="tutorial-title">{t(lang, 'tutorialVideo')}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label={t(lang, 'close')}>×</button>
        </header>
        <div className="tutorial-body">
          <video className="tutorial-player" controls playsInline preload="metadata" poster={posterUrl}>
            <source src={videoUrl} type="video/mp4" />
            {lang === 'vi' ? 'Trình duyệt của bạn không phát được video này.' : 'Your browser cannot play this video.'}
          </video>
          <div className="tutorial-copy">
            <p>{t(lang, 'tutorialIntro')}</p>
            <div className="tutorial-chapters" aria-label={lang === 'vi' ? 'Nội dung video' : 'Video chapters'}>
              <span>01 · {lang === 'vi' ? 'Mục tiêu' : 'Goal'}</span>
              <span>02 · {lang === 'vi' ? 'Một lượt chơi' : 'One turn'}</span>
              <span>03 · Combo & Nope</span>
              <span>04 · {lang === 'vi' ? 'Mèo Nổ' : 'Exploding Kitten'}</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
