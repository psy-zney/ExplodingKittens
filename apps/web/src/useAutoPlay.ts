import { useEffect, useRef, useState } from 'react';
import { planAutoAction, type AutoMode } from './playAssist';
import type { GameAction, PrivateGame, PublicGame } from './types';

export function useAutoPlay(game: PublicGame, mine: PrivateGame | null, selfId: string | undefined, seconds: number, online: boolean, busy: boolean, action: (action: GameAction) => Promise<boolean>) {
  const [setting, setSetting] = useState<{ gameId: string; mode: AutoMode }>(() => {
    try { return JSON.parse(sessionStorage.getItem('kittens.autoplay') ?? '{}'); } catch { return { gameId: '', mode: 'OFF' }; }
  });
  const mode = setting.gameId === game.gameId && ['OFF', 'DRAW', 'BASIC'].includes(setting.mode) ? setting.mode : 'OFF';
  const setMode = (next: AutoMode) => { const value = { gameId: game.gameId, mode: next }; setSetting(value); sessionStorage.setItem('kittens.autoplay', JSON.stringify(value)); };
  const [visible, setVisible] = useState(!document.hidden);
  const turnPlays = useRef({ id: '', count: 0 });
  const attempted = useRef('');
  const [queued, setQueued] = useState(false);
  const latest = useRef({ game, mine, selfId, seconds, online, busy, mode, action });
  latest.current = { game, mine, selfId, seconds, online, busy, mode, action };
  if (turnPlays.current.id !== game.turnId) turnPlays.current = { id: game.turnId, count: 0 };
  const plan = planAutoAction(game, mine, selfId, mode, seconds, turnPlays.current.count);
  const planKey = plan ? JSON.stringify(plan) : '';
  useEffect(() => { const onVisibility = () => setVisible(!document.hidden); document.addEventListener('visibilitychange', onVisibility); return () => document.removeEventListener('visibilitychange', onVisibility); }, []);
  useEffect(() => {
    const key = `${game.gameId}:${game.turnId}:${game.revision}:${mode}`;
    if (!planKey || !online || busy || !visible || attempted.current === key) { setQueued(false); return; }
    setQueued(true);
    const timer = window.setTimeout(async () => {
      const state = latest.current;
      if (document.hidden || !state.online || state.busy || state.mode !== mode || state.game.gameId !== game.gameId || state.game.turnId !== game.turnId || state.game.revision !== game.revision || state.seconds <= 0) return;
      const fresh = planAutoAction(state.game, state.mine, state.selfId, mode, state.seconds, turnPlays.current.count);
      if (!fresh || JSON.stringify(fresh) !== planKey) return;
      attempted.current = key;
      setQueued(false);
      if (await state.action(fresh)) { if (fresh.type === 'PLAY_CARD') turnPlays.current.count += 1; }
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [game.gameId, game.turnId, game.revision, mode, planKey, online, busy, visible]);
  return { mode, setMode, queued };
}
