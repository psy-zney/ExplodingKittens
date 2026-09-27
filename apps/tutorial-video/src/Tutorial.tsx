import type { ComponentType, CSSProperties, ReactNode } from 'react';
import {
  AbsoluteFill,
  Easing,
  interpolate,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

const COLORS = {
  paper: '#f4f1e9',
  card: '#fffefa',
  ink: '#232320',
  muted: '#77756f',
  line: '#d7d3c9',
  accent: '#c84836',
  accentDark: '#942f24',
  green: '#4b7e48',
  yellow: '#f3b347',
  blue: '#4d779d',
};

const fontFamily = 'Arial, "Segoe UI", sans-serif';

function enter(frame: number, fps: number, delay = 0) {
  return spring({ frame: frame - delay, fps, config: { damping: 18, stiffness: 170 } });
}

function sceneOpacity(frame: number, duration: number) {
  return interpolate(frame, [0, 12, duration - 12, duration], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.quad),
  });
}

function CatFace({ size = 170, mood = '•ᴗ•' }: { size?: number; mood?: string }) {
  const ear = size * 0.37;
  return (
    <div style={{ position: 'relative', width: size, height: size * 0.86 }}>
      <div style={{ position: 'absolute', left: 4, top: 0, width: ear, height: ear, background: COLORS.yellow, clipPath: 'polygon(0 0, 100% 88%, 10% 100%)', transform: 'rotate(-5deg)' }} />
      <div style={{ position: 'absolute', right: 4, top: 0, width: ear, height: ear, background: COLORS.yellow, clipPath: 'polygon(100% 0, 90% 100%, 0 88%)', transform: 'rotate(5deg)' }} />
      <div style={{ position: 'absolute', inset: `${size * 0.16}px 0 0`, border: `5px solid ${COLORS.ink}`, borderRadius: '48% 48% 43% 43%', background: '#ffe3a3', display: 'grid', placeItems: 'center', fontSize: size * 0.2, fontWeight: 900, letterSpacing: 5 }}>
        {mood}
      </div>
    </div>
  );
}

function MiniCard({ title, subtitle, color = COLORS.card, rotate = 0, icon = '🐾', style }: { title: string; subtitle: string; color?: string; rotate?: number; icon?: string; style?: CSSProperties }) {
  return (
    <div style={{ width: 184, height: 248, border: `4px solid ${COLORS.ink}`, borderRadius: 18, background: color, padding: 16, boxShadow: '8px 9px 0 rgba(35,35,32,.18)', display: 'flex', flexDirection: 'column', transform: `rotate(${rotate}deg)`, ...style }}>
      <strong style={{ fontSize: 22, lineHeight: 1.02, textTransform: 'uppercase' }}>{title}</strong>
      <div style={{ flex: 1, display: 'grid', placeItems: 'center', fontSize: 62 }}>{icon}</div>
      <span style={{ fontSize: 15, lineHeight: 1.25, fontWeight: 750 }}>{subtitle}</span>
    </div>
  );
}

function SceneShell({ frame, duration, chapter, progress, children }: { frame: number; duration: number; chapter: string; progress: number; children: ReactNode }) {
  return (
    <AbsoluteFill style={{ opacity: sceneOpacity(frame, duration), backgroundColor: COLORS.paper, color: COLORS.ink, fontFamily, overflow: 'hidden' }}>
      <AbsoluteFill style={{ backgroundImage: `radial-gradient(${COLORS.line} 1.5px, transparent 1.5px)`, backgroundSize: '28px 28px', opacity: 0.34 }} />
      <div style={{ position: 'absolute', top: 34, left: 54, right: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 42, height: 42, border: `3px solid ${COLORS.ink}`, borderRadius: '50%', display: 'grid', placeItems: 'center', background: COLORS.yellow, fontWeight: 950 }}>M</div>
          <strong style={{ fontSize: 18, letterSpacing: 3 }}>MÈO NỔ</strong>
        </div>
        <span style={{ color: COLORS.muted, fontSize: 15, fontWeight: 800, letterSpacing: 1.2 }}>{chapter}</span>
      </div>
      <div style={{ position: 'absolute', left: 54, right: 54, bottom: 30, height: 5, background: COLORS.line }}>
        <div style={{ width: `${progress * 100}%`, height: '100%', background: COLORS.accent }} />
      </div>
      {children}
    </AbsoluteFill>
  );
}

function Title({ frame, duration }: { frame: number; duration: number }) {
  const { fps } = useVideoConfig();
  const title = enter(frame, fps, 4);
  const cat = enter(frame, fps, 14);
  return (
    <SceneShell frame={frame} duration={duration} chapter="HƯỚNG DẪN NHANH" progress={0.03}>
      <div style={{ position: 'absolute', inset: '125px 90px 75px', display: 'grid', gridTemplateColumns: '1.25fr .75fr', alignItems: 'center', gap: 60 }}>
        <div style={{ transform: `translateY(${(1 - title) * 40}px)`, opacity: title }}>
          <span style={{ display: 'inline-block', background: COLORS.accent, color: '#fff', padding: '8px 13px', fontSize: 17, fontWeight: 900, letterSpacing: 1.5 }}>46 GIÂY · DỄ NHỚ</span>
          <h1 style={{ fontSize: 86, lineHeight: 0.94, letterSpacing: -5, margin: '25px 0 20px', maxWidth: 720 }}>Chơi Mèo Nổ<br />như thế nào?</h1>
          <p style={{ fontSize: 27, color: COLORS.muted, margin: 0 }}>Sống sót. Chơi bài. Và đừng rút nhầm mèo.</p>
        </div>
        <div style={{ transform: `translateX(${(1 - cat) * 70}px) rotate(${(1 - cat) * 8}deg)`, opacity: cat, display: 'grid', placeItems: 'center' }}>
          <div style={{ width: 285, height: 285, borderRadius: '50%', background: '#ffd785', display: 'grid', placeItems: 'center', border: `4px solid ${COLORS.ink}`, boxShadow: '14px 16px 0 rgba(35,35,32,.18)' }}>
            <CatFace size={210} />
          </div>
        </div>
      </div>
    </SceneShell>
  );
}

function Goal({ frame, duration }: { frame: number; duration: number }) {
  const { fps } = useVideoConfig();
  const cards = [
    { title: 'Bạn', mood: '•ᴗ•', color: '#ffe3a3' },
    { title: 'Bạn bè', mood: '•̀ᴗ•́', color: '#c7dca8' },
    { title: 'Nguy hiểm', mood: '×﹏×', color: '#efb2a9' },
  ];
  return (
    <SceneShell frame={frame} duration={duration} chapter="01 · MỤC TIÊU" progress={0.18}>
      <div style={{ position: 'absolute', inset: '120px 70px 75px' }}>
        <h2 style={{ fontSize: 57, letterSpacing: -2.5, margin: 0 }}>Người sống cuối cùng thắng.</h2>
        <p style={{ fontSize: 24, color: COLORS.muted, margin: '12px 0 38px' }}>Mỗi người bắt đầu với 8 lá, trong đó có 1 lá Cứu Nổ.</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 55 }}>
          {cards.map((item, index) => {
            const pop = enter(frame, fps, 20 + index * 11);
            return (
              <div key={item.title} style={{ transform: `translateY(${(1 - pop) * 55}px) scale(${0.85 + pop * 0.15})`, opacity: pop, textAlign: 'center' }}>
                <div style={{ background: item.color, border: `3px solid ${COLORS.ink}`, borderRadius: 25, padding: '18px 35px 10px', boxShadow: '8px 9px 0 rgba(35,35,32,.15)' }}><CatFace size={150} mood={item.mood} /></div>
                <strong style={{ display: 'block', marginTop: 15, fontSize: 21 }}>{item.title}</strong>
              </div>
            );
          })}
        </div>
      </div>
    </SceneShell>
  );
}

function Turn({ frame, duration }: { frame: number; duration: number }) {
  const { fps } = useVideoConfig();
  const steps = [
    { number: '1', title: 'Đánh bài', note: 'Tùy chọn · có thể đánh nhiều lá', color: '#fff2c9', icon: '🂠' },
    { number: '2', title: 'Rút 1 lá', note: 'Bắt buộc nếu chưa kết thúc lượt', color: '#dbe7f2', icon: '↓' },
    { number: '3', title: 'Qua lượt', note: 'Người kế tiếp bắt đầu', color: '#dce8cc', icon: '→' },
  ];
  return (
    <SceneShell frame={frame} duration={duration} chapter="02 · MỘT LƯỢT CHƠI" progress={0.36}>
      <div style={{ position: 'absolute', inset: '125px 65px 80px' }}>
        <h2 style={{ fontSize: 55, letterSpacing: -2.4, margin: 0 }}>Nhớ đúng một nhịp: <span style={{ color: COLORS.accent }}>đánh rồi rút.</span></h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 55px 1fr 55px 1fr', alignItems: 'center', gap: 14, marginTop: 62 }}>
          {steps.map((step, index) => {
            const pop = enter(frame, fps, 18 + index * 18);
            return (
              <div key={step.number} style={{ display: 'contents' }}>
                <div style={{ height: 285, background: step.color, border: `3px solid ${COLORS.ink}`, borderRadius: 20, padding: 25, boxShadow: '9px 10px 0 rgba(35,35,32,.15)', transform: `translateY(${(1 - pop) * 45}px)`, opacity: pop }}>
                  <span style={{ display: 'grid', placeItems: 'center', width: 43, height: 43, background: COLORS.ink, color: '#fff', borderRadius: '50%', fontSize: 22, fontWeight: 900 }}>{step.number}</span>
                  <div style={{ fontSize: 69, margin: '20px 0 10px' }}>{step.icon}</div>
                  <strong style={{ fontSize: 31 }}>{step.title}</strong>
                  <p style={{ color: COLORS.muted, fontSize: 17, lineHeight: 1.35, margin: '9px 0 0' }}>{step.note}</p>
                </div>
                {index < steps.length - 1 && <div style={{ fontSize: 45, fontWeight: 900, color: COLORS.accent, opacity: pop }}>→</div>}
              </div>
            );
          })}
        </div>
      </div>
    </SceneShell>
  );
}

function Actions({ frame, duration }: { frame: number; duration: number }) {
  const { fps } = useVideoConfig();
  const cards = [
    { title: 'Tấn Công', subtitle: 'Người sau chơi 2 lượt', icon: '⚡', color: '#efb2a9' },
    { title: 'Bỏ Lượt', subtitle: 'Không rút trong 1 lượt nợ', icon: '↷', color: '#d9e9f3' },
    { title: 'Xem Trước', subtitle: 'Xem riêng 3 lá đầu', icon: '◉', color: '#dfd1ef' },
    { title: 'Xáo Bài', subtitle: 'Đổi thứ tự bộ rút', icon: '⤨', color: '#dce8cc' },
    { title: 'Xin Một Lá', subtitle: 'Đối thủ chọn lá đưa bạn', icon: '↝', color: '#ffe2b7' },
  ];
  return (
    <SceneShell frame={frame} duration={duration} chapter="03 · NHỮNG LÁ QUAN TRỌNG" progress={0.54}>
      <div style={{ position: 'absolute', inset: '115px 55px 75px' }}>
        <h2 style={{ fontSize: 51, letterSpacing: -2.2, margin: 0 }}>Đánh lá hành động trước khi rút.</h2>
        <p style={{ fontSize: 21, color: COLORS.muted, margin: '8px 0 35px' }}>Sau khi lá được đánh, mọi người có 7 giây để dùng Nope.</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 28 }}>
          {cards.map((card, index) => {
            const pop = enter(frame, fps, 15 + index * 9);
            return <MiniCard key={card.title} {...card} rotate={(index - 2) * 1.7} style={{ transform: `translateY(${(1 - pop) * 55}px) rotate(${(index - 2) * 1.7}deg)`, opacity: pop }} />;
          })}
        </div>
      </div>
    </SceneShell>
  );
}

function Combos({ frame, duration }: { frame: number; duration: number }) {
  const { fps } = useVideoConfig();
  const left = enter(frame, fps, 12);
  const right = enter(frame, fps, 28);
  const nope = enter(frame, fps, 48);
  return (
    <SceneShell frame={frame} duration={duration} chapter="04 · COMBO & NOPE" progress={0.70}>
      <div style={{ position: 'absolute', inset: '115px 65px 75px' }}>
        <h2 style={{ fontSize: 52, letterSpacing: -2.3, margin: 0 }}>Mèo thường mạnh khi đi cùng nhau.</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28, marginTop: 35 }}>
          <div style={{ background: COLORS.card, border: `3px solid ${COLORS.ink}`, borderRadius: 20, padding: 28, boxShadow: '8px 9px 0 rgba(35,35,32,.14)', transform: `translateX(${(1 - left) * -60}px)`, opacity: left }}>
            <span style={{ color: COLORS.accent, fontWeight: 950, fontSize: 18 }}>CẶP · 2 LÁ CÙNG TÊN</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 13, margin: '22px 0 18px' }}>
              <MiniCard title="Mèo Taco" subtitle="" icon="🌮" color="#ffe2b7" style={{ width: 115, height: 155, padding: 10, boxShadow: '4px 5px 0 #d8d1c6' }} />
              <span style={{ fontSize: 31, fontWeight: 900 }}>+</span>
              <MiniCard title="Mèo Taco" subtitle="" icon="🌮" color="#ffe2b7" style={{ width: 115, height: 155, padding: 10, boxShadow: '4px 5px 0 #d8d1c6' }} />
              <span style={{ fontSize: 31, color: COLORS.accent, fontWeight: 900 }}>→</span>
              <strong style={{ fontSize: 22, lineHeight: 1.2 }}>Cướp ngẫu nhiên<br />1 lá</strong>
            </div>
          </div>
          <div style={{ background: COLORS.card, border: `3px solid ${COLORS.ink}`, borderRadius: 20, padding: 28, boxShadow: '8px 9px 0 rgba(35,35,32,.14)', transform: `translateX(${(1 - right) * 60}px)`, opacity: right }}>
            <span style={{ color: COLORS.blue, fontWeight: 950, fontSize: 18 }}>BỘ BA · 3 LÁ CÙNG TÊN</span>
            <p style={{ fontSize: 25, lineHeight: 1.25, margin: '25px 0 12px', fontWeight: 850 }}>Gọi tên một lá bạn muốn lấy.</p>
            <p style={{ fontSize: 19, color: COLORS.muted, lineHeight: 1.4, margin: 0 }}>Nếu đối thủ có lá đó, họ phải đưa cho bạn.</p>
          </div>
        </div>
        <div style={{ marginTop: 28, background: COLORS.ink, color: '#fff', padding: '18px 24px', borderRadius: 14, display: 'flex', alignItems: 'center', gap: 22, transform: `translateY(${(1 - nope) * 35}px)`, opacity: nope }}>
          <strong style={{ fontSize: 28, color: '#ffcf61' }}>NOPE!</strong>
          <span style={{ fontSize: 20 }}>Hủy hành động vừa đánh. Nope thứ hai sẽ hủy Nope thứ nhất.</span>
        </div>
      </div>
    </SceneShell>
  );
}

function Explosion({ frame, duration }: { frame: number; duration: number }) {
  const { fps } = useVideoConfig();
  const boom = enter(frame, fps, 10);
  const defuse = enter(frame, fps, 45);
  const insert = enter(frame, fps, 77);
  return (
    <SceneShell frame={frame} duration={duration} chapter="05 · MÈO NỔ" progress={0.88}>
      <div style={{ position: 'absolute', inset: '112px 70px 75px' }}>
        <h2 style={{ fontSize: 52, letterSpacing: -2.2, margin: 0 }}>Rút trúng Mèo Nổ thì sao?</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 1fr 90px 1fr', alignItems: 'center', gap: 12, marginTop: 47 }}>
          <div style={{ display: 'grid', placeItems: 'center', transform: `scale(${0.78 + boom * 0.22})`, opacity: boom }}>
            <MiniCard title="Mèo Nổ" subtitle="Nguy hiểm!" icon="💥" color="#efb2a9" rotate={-3} />
            <strong style={{ fontSize: 21, marginTop: 17 }}>1 · Rút trúng</strong>
          </div>
          <div style={{ fontSize: 52, fontWeight: 900, color: COLORS.accent, opacity: defuse }}>→</div>
          <div style={{ display: 'grid', placeItems: 'center', transform: `scale(${0.78 + defuse * 0.22})`, opacity: defuse }}>
            <MiniCard title="Cứu Nổ" subtitle="Tự động sử dụng" icon="🛡" color="#dce8cc" rotate={2} />
            <strong style={{ fontSize: 21, marginTop: 17 }}>2 · Được cứu</strong>
          </div>
          <div style={{ fontSize: 52, fontWeight: 900, color: COLORS.accent, opacity: insert }}>→</div>
          <div style={{ transform: `translateX(${(1 - insert) * 40}px)`, opacity: insert }}>
            <div style={{ height: 250, border: `4px solid ${COLORS.ink}`, background: COLORS.card, borderRadius: 18, padding: 20, boxShadow: '8px 9px 0 rgba(35,35,32,.15)' }}>
              <strong style={{ fontSize: 24 }}>Nhét mèo lại</strong>
              <div style={{ margin: '23px auto 18px', width: 130, height: 126, position: 'relative' }}>
                {[0, 1, 2, 3, 4].map(index => <div key={index} style={{ position: 'absolute', left: index * 6, top: index * 12, width: 100, height: 60, background: index === 2 ? '#efb2a9' : '#ddd7ca', border: `2px solid ${COLORS.ink}`, borderRadius: 5 }} />)}
              </div>
              <span style={{ fontSize: 17, color: COLORS.muted, fontWeight: 750 }}>Chọn vị trí bí mật</span>
            </div>
            <strong style={{ display: 'block', textAlign: 'center', fontSize: 21, marginTop: 17 }}>3 · Kết thúc lượt</strong>
          </div>
        </div>
        <p style={{ textAlign: 'center', margin: '24px 0 0', fontSize: 20, color: COLORS.accentDark, fontWeight: 850, opacity: defuse }}>Không có Cứu Nổ? Bạn bị loại khỏi ván.</p>
      </div>
    </SceneShell>
  );
}

function Outro({ frame, duration }: { frame: number; duration: number }) {
  const { fps } = useVideoConfig();
  const pop = enter(frame, fps, 5);
  return (
    <SceneShell frame={frame} duration={duration} chapter="SẴN SÀNG CHƠI" progress={1}>
      <div style={{ position: 'absolute', inset: '125px 80px 75px', display: 'grid', gridTemplateColumns: '.7fr 1.3fr', alignItems: 'center', gap: 60 }}>
        <div style={{ transform: `scale(${0.82 + pop * 0.18}) rotate(${(1 - pop) * -8}deg)`, opacity: pop }}>
          <div style={{ width: 320, height: 320, display: 'grid', placeItems: 'center', borderRadius: '50%', background: COLORS.yellow, border: `4px solid ${COLORS.ink}`, boxShadow: '13px 15px 0 rgba(35,35,32,.16)' }}><CatFace size={230} mood="•̀ᴗ•́" /></div>
        </div>
        <div style={{ transform: `translateY(${(1 - pop) * 40}px)`, opacity: pop }}>
          <span style={{ color: COLORS.green, fontSize: 19, fontWeight: 950, letterSpacing: 1.6 }}>BẠN ĐÃ BIẾT ĐỦ ĐỂ BẮT ĐẦU</span>
          <h2 style={{ fontSize: 67, lineHeight: 1, letterSpacing: -3.5, margin: '18px 0 22px' }}>Đánh bài.<br />Rút bài.<br /><span style={{ color: COLORS.accent }}>Sống sót.</span></h2>
          <p style={{ fontSize: 23, color: COLORS.muted, lineHeight: 1.4, margin: 0 }}>Mở <strong style={{ color: COLORS.ink }}>Kho thẻ bài</strong> để xem cách dùng đủ 22 loại lá.</p>
        </div>
      </div>
    </SceneShell>
  );
}

const scenes = [
  { from: 0, duration: 120, component: Title },
  { from: 120, duration: 180, component: Goal },
  { from: 300, duration: 240, component: Turn },
  { from: 540, duration: 240, component: Actions },
  { from: 780, duration: 210, component: Combos },
  { from: 990, duration: 240, component: Explosion },
  { from: 1230, duration: 150, component: Outro },
] as const;

function SceneRenderer({ component: Component, duration }: { component: ComponentType<{ frame: number; duration: number }>; duration: number }) {
  const frame = useCurrentFrame();
  return <Component frame={frame} duration={duration} />;
}

export function Tutorial() {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      {scenes.map(scene => {
        const Component = scene.component;
        return (
          <Sequence key={scene.from} from={scene.from} durationInFrames={scene.duration} premountFor={fps}>
            <SceneRenderer component={Component} duration={scene.duration} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}

export function TutorialPoster() {
  return (
    <AbsoluteFill style={{ background: COLORS.paper, color: COLORS.ink, fontFamily, overflow: 'hidden' }}>
      <AbsoluteFill style={{ backgroundImage: `radial-gradient(${COLORS.line} 1.5px, transparent 1.5px)`, backgroundSize: '28px 28px', opacity: 0.34 }} />
      <div style={{ position: 'absolute', inset: '78px 90px', display: 'grid', gridTemplateColumns: '1.2fr .8fr', alignItems: 'center', gap: 60 }}>
        <div>
          <span style={{ display: 'inline-block', background: COLORS.accent, color: '#fff', padding: '9px 14px', fontSize: 18, fontWeight: 900, letterSpacing: 1.5 }}>▶ VIDEO HƯỚNG DẪN · 46 GIÂY</span>
          <h1 style={{ fontSize: 88, lineHeight: .94, letterSpacing: -5, margin: '28px 0 22px' }}>Chơi Mèo Nổ<br />như thế nào?</h1>
          <p style={{ fontSize: 27, color: COLORS.muted, margin: 0 }}>Đánh bài · Rút bài · Sống sót</p>
        </div>
        <div style={{ width: 330, height: 330, borderRadius: '50%', background: COLORS.yellow, display: 'grid', placeItems: 'center', border: `4px solid ${COLORS.ink}`, boxShadow: '14px 16px 0 rgba(35,35,32,.18)' }}>
          <CatFace size={235} />
        </div>
      </div>
    </AbsoluteFill>
  );
}
