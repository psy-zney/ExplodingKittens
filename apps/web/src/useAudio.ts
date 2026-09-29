import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameEvent } from './types';
import { describeEffects, effectSound } from './effectDescriptors';

export type AudioSettings = { master: number; music: number; sfx: number; mute: boolean };

export const MEME_AUDIO_MAP: Record<string, string> = {
  win: '/audio/win_borat.mp3',
  explosion: '/audio/boom_vine.mp3',
  defuse_1: '/audio/defuse_ocean.mp3',
  defuse_2: '/audio/defuse_tada.mp3',
  draw: '/audio/draw_buy.mp3',
  nope: '/audio/nope_tf2.mp3',
  attack: '/audio/attack_nani.mp3',
  skip: '/audio/skip_bye.mp3',
  peek: '/audio/peek_mystic.mp3',
  favor: '/audio/favor_yoink.mp3',
  shuffle: '/audio/shuffle_spin.mp3'
};

/** Giới hạn thời lượng hoạt động tối đa cho mỗi hiệu ứng âm thanh (tránh phát lê thê, chen lấn) */
export const MEME_DURATION_CAP: Record<string, number> = {
  win: 3.5,
  explosion: 1.8,
  defuse_1: 2.6,
  defuse_2: 2.2,
  draw: 0.8,
  nope: 1.1,
  attack: 2.2,
  skip: 1.8,
  peek: 2.2,
  favor: 1.2,
  shuffle: 1.5
};

const audioBufferCache: Record<string, AudioBuffer> = {};

async function loadMemeAudio(context: AudioContext, url: string): Promise<AudioBuffer | null> {
  if (audioBufferCache[url]) return audioBufferCache[url];
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}${url.replace(/^\//, '')}`);
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    const buffer = await context.decodeAudioData(arrayBuffer);
    audioBufferCache[url] = buffer;
    return buffer;
  } catch {
    return null;
  }
}

export function preloadAllMemeAudios(context: AudioContext) {
  for (const url of Object.values(MEME_AUDIO_MAP)) {
    void loadMemeAudio(context, url);
  }
}
const STORAGE_KEY = 'kittens.audio';
const DEFAULT: AudioSettings = { master: 0.55, music: 0.3, sfx: 0.45, mute: false };

function readSettings(): AudioSettings {
  try {
    return { ...DEFAULT, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
  } catch {
    return DEFAULT;
  }
}

type SoundState = {
  context: AudioContext;
  masterGain: GainNode;
  musicGain: GainNode;
  duckGain: GainNode;
  sfxGain: GainNode;
  noiseBuffer: AudioBuffer;
  nextBeat: number;
  nextCue: number;
  beat: number;
  interval: number;
  mode: 'lobby' | 'game';
  activeSfxSource: AudioBufferSourceNode | null;
  activeSfxGain: GainNode | null;
};

/** Dừng ngay lập tức âm thanh SFX cũ đang phát để không bị chen lấn, chồng chéo */
function stopCurrentSfx(state: SoundState) {
  if (state.activeSfxSource && state.activeSfxGain) {
    try {
      const now = state.context.currentTime;
      state.activeSfxGain.gain.cancelScheduledValues(now);
      state.activeSfxGain.gain.setValueAtTime(state.activeSfxGain.gain.value, now);
      state.activeSfxGain.gain.linearRampToValueAtTime(0.0001, now + 0.015);
      state.activeSfxSource.stop(now + 0.02);
    } catch {
      // Ignored if already ended
    }
  }
  state.activeSfxSource = null;
  state.activeSfxGain = null;
  // Phục hồi âm lượng nhạc nền
  try {
    state.duckGain.gain.cancelScheduledValues(state.context.currentTime);
    state.duckGain.gain.setTargetAtTime(1, state.context.currentTime, 0.08);
  } catch {
    // Ignored
  }
}

/** Tạo Noise Buffer dùng chung để tạo tiếng nổ, tiếng xáo bài, tiếng rút bài, tiếng móng cào, trống */
function createNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const bufferSize = ctx.sampleRate * 2; // 2 giây white noise
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

/** Phát âm thanh một nốt nhạc cơ bản có phong bao (envelope) */
function tone(
  ctx: AudioContext,
  output: AudioNode,
  at: number,
  hz: number,
  length: number,
  volume: number,
  kind: OscillatorType = 'sine',
  rampDownHz?: number
) {
  if (volume <= 0.0001) return;
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = kind;
  osc.frequency.setValueAtTime(hz, at);
  if (rampDownHz) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, rampDownHz), at + length);
  }
  env.gain.setValueAtTime(0.0001, at);
  env.gain.linearRampToValueAtTime(Math.max(0.0001, volume), at + 0.006);
  env.gain.exponentialRampToValueAtTime(0.0001, at + length);
  osc.connect(env).connect(output);
  osc.start(at);
  osc.stop(at + length + 0.02);
}

/** Phát âm thanh White Noise đã qua lọc tần số (dùng cho tiếng bài, bom, gió, cào) */
function noiseBurst(
  ctx: AudioContext,
  noiseBuffer: AudioBuffer,
  output: AudioNode,
  at: number,
  length: number,
  volume: number,
  filterType: BiquadFilterType = 'lowpass',
  filterHz = 800,
  filterRampHz?: number
) {
  if (volume <= 0.0001) return;
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer;
  source.loop = true;

  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.setValueAtTime(filterHz, at);
  if (filterRampHz) {
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, filterRampHz), at + length);
  }

  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, at);
  env.gain.linearRampToValueAtTime(Math.max(0.0001, volume), at + 0.008);
  env.gain.exponentialRampToValueAtTime(0.0001, at + length);

  source.connect(filter).connect(env).connect(output);
  source.start(at);
  source.stop(at + length + 0.02);
}

/** Phát tiếng mèo kêu "Meooww" tổng hợp bằng FM synthesis */
function catMeow(ctx: AudioContext, output: AudioNode, at: number, mood: 'happy' | 'scared' | 'beg' = 'happy') {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = 'sawtooth';

  // Lọc định hình thanh quản mèo (Formant filter)
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 4.0;

  if (mood === 'scared') {
    // Mèo la thất thanh khi nổ
    osc.frequency.setValueAtTime(800, at);
    osc.frequency.linearRampToValueAtTime(1400, at + 0.08);
    osc.frequency.exponentialRampToValueAtTime(450, at + 0.35);
    filter.frequency.setValueAtTime(1200, at);
    filter.frequency.linearRampToValueAtTime(2200, at + 0.08);
    filter.frequency.exponentialRampToValueAtTime(600, at + 0.35);
    env.gain.setValueAtTime(0.0001, at);
    env.gain.linearRampToValueAtTime(0.18, at + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, at + 0.35);
    osc.connect(filter).connect(env).connect(output);
    osc.start(at);
    osc.stop(at + 0.38);
  } else if (mood === 'beg') {
    // Mèo làm nũng xin bài
    osc.frequency.setValueAtTime(550, at);
    osc.frequency.linearRampToValueAtTime(850, at + 0.15);
    osc.frequency.exponentialRampToValueAtTime(520, at + 0.32);
    filter.frequency.setValueAtTime(900, at);
    filter.frequency.linearRampToValueAtTime(1400, at + 0.15);
    filter.frequency.exponentialRampToValueAtTime(800, at + 0.32);
    env.gain.setValueAtTime(0.0001, at);
    env.gain.linearRampToValueAtTime(0.12, at + 0.03);
    env.gain.exponentialRampToValueAtTime(0.0001, at + 0.32);
    osc.connect(filter).connect(env).connect(output);
    osc.start(at);
    osc.stop(at + 0.35);
  } else {
    // Mèo vui vẻ khi cứu nổ thành công
    osc.frequency.setValueAtTime(620, at);
    osc.frequency.linearRampToValueAtTime(920, at + 0.1);
    osc.frequency.exponentialRampToValueAtTime(600, at + 0.28);
    filter.frequency.setValueAtTime(950, at);
    filter.frequency.linearRampToValueAtTime(1600, at + 0.1);
    filter.frequency.exponentialRampToValueAtTime(900, at + 0.28);
    env.gain.setValueAtTime(0.0001, at);
    env.gain.linearRampToValueAtTime(0.14, at + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, at + 0.28);
    osc.connect(filter).connect(env).connect(output);
    osc.start(at);
    osc.stop(at + 0.3);
  }
}

/** Nhạc nền sống động: Lo-Fi Chiptune Mèo Nổ với Bassline, Melody & Trống điện tử */
function scheduleBeat(state: SoundState) {
  const { context, musicGain, noiseBuffer, mode } = state;
  const at = state.nextBeat;
  const beat = state.beat % 32; // Vòng lặp 32 nhịp (8 ô nhịp 4/4)

  if (mode === 'lobby') {
    // LOBBY BGM (Nhịp Lo-fi thư thái, ấm áp, hóm hỉnh): 105 BPM -> 0.285s/beat
    // Kick drum nhẹ ở nhịp 0, 8, 16, 24
    if (beat % 8 === 0) {
      tone(context, musicGain, at, 110, 0.14, 0.08, 'sine', 38);
    }
    // Snare brush ở nhịp 4, 12, 20, 28
    if (beat % 8 === 4) {
      noiseBurst(context, noiseBuffer, musicGain, at, 0.08, 0.035, 'bandpass', 1800);
    }
    // Hi-hat nhấp nhô
    if (beat % 2 === 0) {
      noiseBurst(context, noiseBuffer, musicGain, at, 0.03, 0.018, 'highpass', 5500);
    }

    // Walking Bassline mèo dạo chơi (gam Đô trưởng / Fa trưởng nhẹ nhàng)
    const lobbyBass = [130, 146, 164, 174, 196, 174, 164, 146];
    const bassNote = lobbyBass[Math.floor(beat / 4) % lobbyBass.length] ?? 130;
    if (beat % 4 === 0 || beat % 4 === 2) {
      tone(context, musicGain, at, bassNote, 0.22, 0.045, 'triangle');
    }

    // Giai điệu Chiptune mèo con ngẫu hứng
    const lobbyMelody: Record<number, number> = {
      2: 523, 5: 587, 8: 659, 11: 784, 14: 659,
      18: 587, 21: 523, 24: 440, 27: 392, 30: 523
    };
    if (lobbyMelody[beat]) {
      tone(context, musicGain, at, lobbyMelody[beat], 0.16, 0.022, 'sine');
    }
    state.nextBeat += 0.285;
  } else {
    // GAME BGM (Hồi hộp, kịch tính, nhịp nhanh 128 BPM -> 0.234s/beat)
    // Electro Kick đập dồn dập
    if (beat % 4 === 0) {
      tone(context, musicGain, at, 130, 0.16, 0.12, 'sine', 35);
    }
    // Snare đanh thép
    if (beat % 8 === 4) {
      noiseBurst(context, noiseBuffer, musicGain, at, 0.12, 0.07, 'bandpass', 2400);
      tone(context, musicGain, at, 220, 0.08, 0.05, 'triangle', 90);
    }
    // Hi-hat chạy liên tục
    noiseBurst(context, noiseBuffer, musicGain, at, 0.025, beat % 2 === 0 ? 0.025 : 0.015, 'highpass', 6500);

    // Bassline căng thẳng, dồn dập theo phong cách funk synth
    const gameBass = [82, 82, 98, 82, 110, 82, 123, 110];
    const gBass = gameBass[Math.floor(beat / 4) % gameBass.length] ?? 82;
    if (beat % 2 === 0) {
      tone(context, musicGain, at, gBass, 0.12, 0.065, 'sawtooth', gBass * 0.9);
    }

    // Arpeggio điện tử cảnh báo bom mèo
    const arpNotes = [440, 523, 659, 784, 880, 784, 659, 523];
    const arpNote = arpNotes[beat % arpNotes.length] ?? 440;
    tone(context, musicGain, at, arpNote, 0.06, 0.018, 'square');

    state.nextBeat += 0.234;
  }
  state.beat += 1;
}

/** Phát hiệu ứng âm thanh (Sound Effects - SFX) sắc nét, chân thực */
function cue(state: SoundState, name: string, now: number, meta?: { defuseCount?: number }) {
  const { context, sfxGain, duckGain, noiseBuffer } = state;

  // Luôn ngắt âm thanh SFX cũ đang phát trước khi phát âm thanh mới ("ko chen")
  stopCurrentSfx(state);

  // Determine meme audio key
  let memeKey = name;
  if (name === 'defuse') {
    memeKey = (meta?.defuseCount && meta.defuseCount >= 2) ? 'defuse_2' : 'defuse_1';
  }

  const memeUrl = MEME_AUDIO_MAP[memeKey];
  if (memeUrl) {
    const cached = audioBufferCache[memeUrl];
    if (cached) {
      const maxCap = MEME_DURATION_CAP[memeKey] ?? 2.5;
      const playDuration = Math.min(cached.duration, maxCap);

      const source = context.createBufferSource();
      source.buffer = cached;

      const individualGain = context.createGain();
      individualGain.gain.setValueAtTime(1, now);
      // Fade out nhẹ nhàng ở 30ms cuối để không bị nổ âm
      individualGain.gain.setValueAtTime(1, now + playDuration - 0.03);
      individualGain.gain.linearRampToValueAtTime(0.0001, now + playDuration);

      source.connect(individualGain).connect(sfxGain);
      source.start(now, 0, playDuration);

      state.activeSfxSource = source;
      state.activeSfxGain = individualGain;

      source.onended = () => {
        if (state.activeSfxSource === source) {
          state.activeSfxSource = null;
          state.activeSfxGain = null;
        }
      };

      // Duck music for the duration of the meme sound
      duckGain.gain.cancelScheduledValues(now);
      duckGain.gain.setTargetAtTime(0.18, now, 0.02);
      duckGain.gain.setTargetAtTime(1, now + playDuration * 0.85, 0.25);
      return;
    } else {
      void loadMemeAudio(context, memeUrl);
    }
  }

  // Giảm nhẹ tiếng nhạc nền khi có SFX nổi bật (Audio Ducking fallback)
  duckGain.gain.cancelScheduledValues(now);
  duckGain.gain.setTargetAtTime(0.35, now, 0.02);
  duckGain.gain.setTargetAtTime(1, now + 0.35, 0.25);

  switch (name) {
    case 'throw_egg':
    case 'throw_bomb':
    case 'throw_rock':
      noiseBurst(context,noiseBuffer,sfxGain,now,.12,.12,'bandpass',2100,800);
      if(name==='throw_egg'){noiseBurst(context,noiseBuffer,sfxGain,now+.37,.13,.18,'lowpass',1400);tone(context,sfxGain,now+.4,450,.08,.1,'sine',180);}
      if(name==='throw_bomb'){tone(context,sfxGain,now+.36,130,.2,.22,'sine',38);noiseBurst(context,noiseBuffer,sfxGain,now+.37,.18,.15,'lowpass',900,180);}
      if(name==='throw_rock'){tone(context,sfxGain,now+.37,380,.08,.17,'triangle',110);tone(context,sfxGain,now+.42,700,.07,.08,'sine');}
      break;
    case 'start':
      [330,440,550].forEach((hz,i)=>tone(context,sfxGain,now+i*.09,hz,.12,.12,'triangle'));
      break;
    case 'eliminate':
      [440,330,220].forEach((hz,i)=>tone(context,sfxGain,now+i*.1,hz,.14,.12,'triangle',hz*.8));
      break;
    case 'skip':
      tone(context,sfxGain,now,420,.16,.14,'sine',1100);
      noiseBurst(context,noiseBuffer,sfxGain,now,.12,.08,'bandpass',1800,3500);break;
    case 'favor':catMeow(context,sfxGain,now,'beg');break;
    case 'dig':
      [0,.08,.16].forEach((delay,i)=>noiseBurst(context,noiseBuffer,sfxGain,now+delay,.06,.12,'bandpass',600+i*230));break;
    case 'hamster':
      tone(context,sfxGain,now,260,.12,.13,'triangle',80);tone(context,sfxGain,now+.09,740,.12,.11,'sine',380);break;
    case 'bat':
      [0,.07,.14].forEach(delay=>noiseBurst(context,noiseBuffer,sfxGain,now+delay,.045,.1,'highpass',3000));break;
    case 'duel':
      [220,330,660].forEach((hz,i)=>tone(context,sfxGain,now+i*.1,hz,.1,.1,'triangle'));break;
    case 'plus':
      [660,880].forEach((hz,i)=>tone(context,sfxGain,now+i*.08,hz,.12,.13,'sine'));break;
    case 'redeal':
    case 'twins':
      [0,.08,.16,.24].forEach((delay,i)=>{noiseBurst(context,noiseBuffer,sfxGain,now+delay,.045,.07,'bandpass',1800);tone(context,sfxGain,now+delay,name==='twins'?600+i*90:400+i*100,.055,.08,'sine');});break;
    case 'ui_select':
      tone(context,sfxGain,now,780*(.96+Math.random()*.08),.05,.1,'sine',420);break;
    case 'explosion':
      // 💥 Vụ nổ bom dữ dội: Tiếng nổ Sub-Bass + White noise vỡ tan + Tiếng mèo kêu giật mình
      noiseBurst(context, noiseBuffer, sfxGain, now, 0.85, 0.42, 'lowpass', 600, 40);
      tone(context, sfxGain, now, 150, 0.55, 0.45, 'triangle', 25);
      catMeow(context, sfxGain, now + 0.08, 'scared');
      break;

    case 'defuse':
      // 🌿 Gỡ bom thành công: Tia laser "pew", tiếng kìm cắt dây "click", tiếng mèo kêu mừng rỡ
      tone(context, sfxGain, now, 1400, 0.12, 0.22, 'sine', 320);
      tone(context, sfxGain, now + 0.09, 2400, 0.05, 0.18, 'square');
      catMeow(context, sfxGain, now + 0.14, 'happy');
      break;

    case 'nope':
      // 🚫 Khiên Nope dập tắt hành động: Tiếng còi buzzer kép phản đối + tiếng đập kim loại
      tone(context, sfxGain, now, 185, 0.24, 0.35, 'square');
      tone(context, sfxGain, now, 246, 0.24, 0.32, 'sawtooth');
      noiseBurst(context, noiseBuffer, sfxGain, now, 0.14, 0.25, 'bandpass', 1200);
      break;

    case 'attack':
      // ⚡ Móng vuốt cào xé gió + tiếng sét nẹt điện
      noiseBurst(context, noiseBuffer, sfxGain, now, 0.22, 0.32, 'bandpass', 2200, 400);
      tone(context, sfxGain, now + 0.04, 380, 0.18, 0.28, 'sawtooth', 75);
      break;

    case 'shuffle':
      // 🌀 Xáo bài: Chuỗi tiếng giấy quẹt giòn tan (Riffle shuffle)
      for (let i = 0; i < 6; i++) {
        noiseBurst(context, noiseBuffer, sfxGain, now + i * 0.045, 0.05, 0.15, 'bandpass', 1500 + i * 200);
      }
      break;

    case 'draw':
      // 🂠 Rút bài: Tiếng lướt giấy giòn tan "Fwip!"
      noiseBurst(context, noiseBuffer, sfxGain, now, 0.11, 0.22, 'bandpass', 2400, 900);
      tone(context, sfxGain, now + 0.02, 380, 0.08, 0.16, 'sine', 650);
      break;

    case 'play':
      // 🂡 Đánh bài: Tiếng đập bài xuống mặt bàn nỉ "Thwack!"
      tone(context, sfxGain, now, 260, 0.12, 0.25, 'triangle', 70);
      noiseBurst(context, noiseBuffer, sfxGain, now, 0.07, 0.16, 'lowpass', 1100);
      break;

    case 'steal':
      // ✨ Cướp bài / Mèo combo: Tiếng leng keng hai nốt cao vút + mèo xin xỏ
      tone(context, sfxGain, now, 988, 0.15, 0.18, 'sine');
      tone(context, sfxGain, now + 0.08, 1318, 0.22, 0.2, 'sine');
      catMeow(context, sfxGain, now + 0.12, 'beg');
      break;

    case 'peek':
      // 🔮 Quả cầu tiên tri / Nhìn trước: Tiếng chuông pha lê thần bí
      tone(context, sfxGain, now, 880, 0.18, 0.15, 'sine');
      tone(context, sfxGain, now + 0.08, 1175, 0.2, 0.14, 'sine');
      tone(context, sfxGain, now + 0.16, 1568, 0.28, 0.16, 'sine');
      break;

    case 'revive':
      // 😇 Hồi sinh: Hợp âm thiên đường bay bổng
      tone(context, sfxGain, now, 440, 0.22, 0.16, 'sine');
      tone(context, sfxGain, now + 0.08, 554, 0.24, 0.16, 'sine');
      tone(context, sfxGain, now + 0.16, 659, 0.28, 0.18, 'sine');
      tone(context, sfxGain, now + 0.24, 880, 0.38, 0.22, 'sine');
      break;

    case 'win':
      // 🏆 Chiến thắng: Fanfare khải hoàn rực rỡ
      tone(context, sfxGain, now, 523, 0.15, 0.22, 'triangle');
      tone(context, sfxGain, now + 0.12, 659, 0.15, 0.24, 'triangle');
      tone(context, sfxGain, now + 0.24, 784, 0.2, 0.26, 'triangle');
      tone(context, sfxGain, now + 0.38, 1046, 0.45, 0.32, 'triangle');
      break;

    case 'ui_click':
      // 🔘 Tiếng pop nhẹ khi click nút / chọn lá bài
      tone(context, sfxGain, now, 650, 0.035, 0.12, 'sine', 350);
      break;
  }
}

export function useAudio(mode: 'lobby' | 'game', liveEvents: GameEvent[]) {
  const [settings, setSettings] = useState<AudioSettings>(readSettings);
  const [enabled, setEnabled] = useState(false);
  const stateRef = useRef<SoundState | null>(null);
  const seenRef = useRef(new Set<string>());
  const defuseCountRef = useRef<number>(0);
  const previewDefuseToggle = useRef<boolean>(false);

  const enable = useCallback(async () => {
    if (stateRef.current) {
      if (stateRef.current.context.state === 'suspended') {
        await stateRef.current.context.resume();
      }
      setEnabled(true);
      return;
    }
    const context = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (context.state === 'suspended') {
      await context.resume();
    }
    const masterGain = context.createGain();
    const musicGain = context.createGain();
    const duckGain = context.createGain();
    const sfxGain = context.createGain();
    const noiseBuffer = createNoiseBuffer(context);
    preloadAllMemeAudios(context);

    // Route: music -> duckGain -> masterGain -> destination
    musicGain.connect(duckGain).connect(masterGain);
    // Route: sfx -> masterGain -> destination
    sfxGain.connect(masterGain);
    const limiter=context.createDynamicsCompressor();
    limiter.threshold.value=-10;limiter.knee.value=12;limiter.ratio.value=12;limiter.attack.value=.003;limiter.release.value=.18;
    masterGain.connect(limiter).connect(context.destination);

    const initialMaster = settings.mute ? 0 : settings.master;
    masterGain.gain.setValueAtTime(initialMaster, context.currentTime);
    musicGain.gain.setValueAtTime(settings.music, context.currentTime);
    sfxGain.gain.setValueAtTime(settings.sfx * 0.55, context.currentTime);
    duckGain.gain.setValueAtTime(1, context.currentTime);

    const state: SoundState = {
      context,
      masterGain,
      musicGain,
      duckGain,
      sfxGain,
      noiseBuffer,
      beat: 0,
      nextBeat: context.currentTime + 0.1,
      nextCue: context.currentTime,
      interval: 0,
      mode,
      activeSfxSource: null,
      activeSfxGain: null
    };

    fetch(import.meta.env.BASE_URL + 'audio/bgm.mp3').then(r => r.arrayBuffer()).then(b => context.decodeAudioData(b)).then(ab => {
      const src = context.createBufferSource();
      src.buffer = ab;
      src.loop = true;
      const bgmVolume = context.createGain();
      bgmVolume.gain.value = 0.25; // Reduce base volume
      src.connect(bgmVolume).connect(musicGain);
      src.start();
    }).catch(() => {});

    state.interval = window.setInterval(() => {
      // Background music is now playing via AudioBufferSourceNode
    }, 1000);

    stateRef.current = state;
    setEnabled(true);
  }, [mode, settings]);

  /** Tự động mở khóa Web Audio API khi người dùng tương tác lần đầu trên web */
  useEffect(() => {
    const handleFirstInteraction = () => {
      void enable();
      window.removeEventListener('pointerdown', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
    window.addEventListener('pointerdown', handleFirstInteraction, { once: true });
    window.addEventListener('keydown', handleFirstInteraction, { once: true });
    return () => {
      window.removeEventListener('pointerdown', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
  }, [enable]);

  /** Cập nhật âm lượng khi settings thay đổi */
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    const state = stateRef.current;
    if (!state) return;
    const now = state.context.currentTime;
    const master = settings.mute ? 0 : settings.master;
    state.masterGain.gain.setTargetAtTime(master, now, 0.03);
    state.musicGain.gain.setTargetAtTime(settings.music * (document.hidden ? 0 : 1), now, 0.05);
    state.sfxGain.gain.setTargetAtTime(settings.sfx * 0.55, now, 0.03);
  }, [settings]);

  /** Chuyển đổi chế độ nhạc BGM giữa Sảnh (lobby) và Bàn chơi (game) */
  useEffect(() => {
    if (mode === 'lobby') {
      defuseCountRef.current = 0;
    }
    if (stateRef.current) {
      stateRef.current.mode = mode;
      stateRef.current.nextBeat = Math.max(stateRef.current.nextBeat, stateRef.current.context.currentTime + 0.1);
    }
  }, [mode]);

  /** Phản hồi các sự kiện GameEvent trong ván đấu */
  useEffect(() => {
    if (!liveEvents.length) {
      seenRef.current.clear();
      return;
    }
    const effects = describeEffects(liveEvents);
    const state = stateRef.current;
    for (const effect of effects) {
      if (seenRef.current.has(effect.id)) continue;
      seenRef.current.add(effect.id);

      // Khi kết thúc lượt / đánh xong chuyển lượt -> tắt âm thanh kéo dài của lượt cũ
      const turnEndKeys = ['card.drawn', 'turn.started', 'turn.timeout', 'room.started'];
      if (turnEndKeys.includes(effect.event.key) && state) {
        stopCurrentSfx(state);
      }

      if (effect.kind === 'defuse') {
        defuseCountRef.current += 1;
      }
      if (effect.kind === 'start' || effect.kind === 'win') {
        defuseCountRef.current = 0;
      }
      if (!state || !enabled || document.hidden || settings.mute) continue;
      const at = Math.max(state.context.currentTime + 0.01, state.nextCue);
      const snd = effectSound(effect);
      cue(state, snd, at, { defuseCount: defuseCountRef.current });
      state.nextCue = at + Math.max(0.16, effect.duration / 1000);
    }
    if (seenRef.current.size > 200) {
      seenRef.current = new Set(effects.map((e) => e.id));
    }
  }, [liveEvents, enabled, settings.mute]);

  /** Tạm dừng khi tab ẩn và tiếp tục khi tab hiển thị */
  useEffect(() => {
    const visibility = () => {
      const state = stateRef.current;
      if (!state) return;
      if (document.hidden) {
        state.musicGain.gain.setTargetAtTime(0, state.context.currentTime, 0.05);
      } else {
        state.nextBeat = Math.max(state.nextBeat, state.context.currentTime + 0.1);
        state.musicGain.gain.setTargetAtTime(settings.music, state.context.currentTime, 0.08);
      }
    };
    document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility);
  }, [settings.music]);

  /** Phát âm thanh UI tiện ích (click, hover) */
  const stopSfx = useCallback(() => {
    const state = stateRef.current;
    if (state) {
      stopCurrentSfx(state);
    }
  }, []);

  const playSfx = useCallback((name: string) => {
    const state = stateRef.current;
    if (state && enabled && !settings.mute && !document.hidden) {
      // Dừng âm thanh cũ trước khi phát âm thanh mới
      stopCurrentSfx(state);
      if (name === 'defuse') {
        previewDefuseToggle.current = !previewDefuseToggle.current;
        cue(state, 'defuse', state.context.currentTime, { defuseCount: previewDefuseToggle.current ? 1 : 2 });
      } else {
        cue(state, name, state.context.currentTime);
      }
    }
  }, [enabled, settings.mute]);

  /** Bật / Tắt tiếng nhanh */
  const toggleMute = useCallback(() => {
    setSettings((prev) => ({ ...prev, mute: !prev.mute }));
    if (!enabled) void enable();
  }, [enabled, enable]);

  useEffect(() => () => {
    const state = stateRef.current;
    if (state) {
      window.clearInterval(state.interval);
      void state.context.close();
      stateRef.current = null;
    }
  }, []);

  return { settings, enabled, enable, setSettings, playSfx, stopSfx, toggleMute };
}
