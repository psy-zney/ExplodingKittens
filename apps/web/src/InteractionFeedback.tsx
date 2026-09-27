import { useEffect, useRef } from 'react';

export function InteractionFeedback({ sound, reduced }: { sound: (name: string) => void; reduced: boolean }) {
  const last = useRef(0);
  useEffect(() => {
    const animations = new Set<Animation>();
    const feedback = (event: Event) => {
      if (event instanceof KeyboardEvent && (event.repeat || !['Enter', ' '].includes(event.key))) return;
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>('button,select,input[type=checkbox],input[type=range]') : null;
      if (!target || target.matches(':disabled') || performance.now() - last.current < 55) return;
      last.current = performance.now();
      sound(target.classList.contains('playing-card') ? 'ui_select' : 'ui_click');
      if (!reduced && target.tagName === 'BUTTON') {
        const transform = getComputedStyle(target).transform;
        const base = transform === 'none' ? '' : transform;
        const animation = target.animate([{ transform: `${base} scale(1)` }, { transform: `${base} scale(.95)` }, { transform: `${base} scale(1)` }], { duration: 180, easing: 'ease-out' });
        animations.add(animation);
        animation.onfinish = () => animations.delete(animation);
      }
    };
    window.addEventListener('pointerdown', feedback);
    window.addEventListener('keydown', feedback);
    return () => { window.removeEventListener('pointerdown', feedback); window.removeEventListener('keydown', feedback); animations.forEach(animation => animation.cancel()); };
  }, [sound, reduced]);
  return null;
}
