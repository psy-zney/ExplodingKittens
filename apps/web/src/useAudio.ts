import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameEvent } from './types';
import { describeEffects } from './effectDescriptors';

export type AudioSettings = { master: number; music: number; sfx: number; mute: boolean };
const STORAGE_KEY = 'kittens.audio';
const DEFAULT: AudioSettings = { master: 0.7, music: 0.45, sfx: 0.75, mute: false };

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
};

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
function cue(state: SoundState, name: string, now: number) {
  const { context, sfxGain, duckGain, noiseBuffer } = state;

  // Giảm nhẹ tiếng nhạc nền khi có SFX nổi bật (Audio Ducking)
  duckGain.gain.cancelScheduledValues(now);
  duckGain.gain.setTargetAtTime(0.35, now, 0.02);
  duckGain.gain.setTargetAtTime(1, now + 0.35, 0.25);

  switch (name) {
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

    // Route: music -> duckGain -> masterGain -> destination
    musicGain.connect(duckGain).connect(masterGain);
    // Route: sfx -> masterGain -> destination
    sfxGain.connect(masterGain);
    masterGain.connect(context.destination);

    const initialMaster = settings.mute ? 0 : settings.master;
    masterGain.gain.setValueAtTime(initialMaster, context.currentTime);
    musicGain.gain.setValueAtTime(settings.music, context.currentTime);
    sfxGain.gain.setValueAtTime(settings.sfx, context.currentTime);
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
      mode
    };

    state.interval = window.setInterval(() => {
      if (document.hidden) return;
      while (state.nextBeat < context.currentTime + 0.25) {
        scheduleBeat(state);
      }
    }, 60);

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
    state.sfxGain.gain.setTargetAtTime(settings.sfx, now, 0.03);
  }, [settings]);

  /** Chuyển đổi chế độ nhạc BGM giữa Sảnh (lobby) và Bàn chơi (game) */
  useEffect(() => {
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
      if (!state || !enabled || document.hidden || settings.mute) continue;
      const at = Math.max(state.context.currentTime + 0.01, state.nextCue);
      cue(state, effect.kind, at);
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
  const playSfx = useCallback((name: string) => {
    const state = stateRef.current;
    if (state && enabled && !settings.mute && !document.hidden) {
      cue(state, name, state.context.currentTime);
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

  return { settings, enabled, enable, setSettings, playSfx, toggleMute };
}
