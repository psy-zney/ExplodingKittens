import type { ReactNode } from 'react';
import type { ArtStyle, CardType } from '../types';

// Original comic stage sets. All four drawing treatments belong to one deck.
export function CardScene({ type, style, cat }: { type: CardType; style: ArtStyle; cat: ReactNode }) {
  const ink = 'var(--scene-ink,#482b28)';
  const card = (x: number, y: number, angle = 0) => <g transform={`translate(${x} ${y}) rotate(${angle} 9 13)`}><rect width="18" height="26" rx={style === 'pixel' ? 0 : 2} fill="var(--card-tint, #fff)"/><path d="m4 7 3-2 2 2 2-2 3 2v8H4Z"/><path d="M5 21h8"/></g>;
  let props: ReactNode;
  switch (type) {
    case 'EXPLODING_KITTEN': props = <><circle cx="117" cy="83" r="25" fill="var(--scene-pop,#f3ba5c)"/><path d="M111 58v-7h12v7m-7-8q-12-20 5-24"/><path d="m122 26 8-8m-8 8 10 1m-10-1-2-11"/><path d="m103 75 7 7m0-7-7 7m17-7 7 7m0-7-7 7M110 97h13"/><path d="M21 15 15 6m55 8 7-9m-32 8-2-10"/></>; break;
    case 'DEFUSE': props = <><circle cx="115" cy="88" r="22" fill="var(--scene-pop,#f3ba5c)"/><path d="M111 67v-8h9v8m-4-8q-9-16 4-24"/><path d="m99 44 27 26m-28 0 27-26"/><circle cx="96" cy="40" r="5"/><circle cx="96" cy="73" r="5"/><path d="m109 89 5 5 9-13M48 89l25 5 23-13"/></>; break;
    case 'ATTACK': props = <><path d="m81 56 17 13m-17 0 17 12M109 54q22-7 28 10v20q-17 13-28-4Z" fill="var(--scene-pop,#f3ba5c)"/><path d="m99 39 4-10m33 20 10-4m-7 38 11 3M33 102l-15 12m47-10 7 12"/></>; break;
    case 'FAVOR': props = <><path d="M78 89h15l10-7q5-2 7 2l-4 5h22q7 0 3 5l-18 14H91"/>{card(100, 50, 8)}<path d="M92 33q0-12 11-12 14 1 11 12-2 4-11 8v5m0 7v1"/></>; break;
    case 'NOPE': props = <><path d="M80 48h68v43H80Z" fill="var(--scene-pop,#f3ba5c)"/><path d="m103 58 22 22m0-22-22 22M114 92v26M83 117h61"/><path d="M45 89 77 74"/></>; break;
    case 'SHUFFLE': props = <>{card(87, 58, -22)}{card(109, 51, 9)}{card(125, 66, 24)}<path d="M90 35q35-13 52 12m-1-12 3 13-14-2M145 102q-32 16-54-2m2 13-4-14 15 2"/></>; break;
    case 'SKIP': props = <><path d="M100 28h37v83h-37Zm2 2 22 8v64l-22 7M116 70h1"/><path d="M75 80h30m-9-8 10 8-10 8M30 106l-8 12m40-11-10 13"/><path d="M82 118h63"/></>; break;
    case 'SEE_THE_FUTURE': props = <><circle cx="114" cy="65" r="25" fill="var(--scene-pop,#f3ba5c)"/><path d="m109 53 5-3 5 3m-13 11h16m-18 8q10 8 20 0M93 94h43l5 12H88Z"/>{card(91, 111, -12)}{card(112, 107)}{card(132, 111, 12)}<path d="m88 31 4-7m49 7 5-7"/></>; break;
    case 'CAT_TACO': props = <><path d="M80 76q30-37 61 0l-6 28H86Z" fill="var(--scene-pop,#f3ba5c)"/><path d="M80 76q30 26 61 0M86 73l7-8 8 5 8-9 9 9 9-4 9 8M95 88v1m16 4v1m15-7v1"/><path d="M27 28q19-13 39 0"/></>; break;
    case 'CAT_BEARD': props = <><path d="m33 71 8 26 6-8 6 9 12-29" fill="var(--fur-shadow,#ad7155)"/><path d="M92 74q-8 0-7-9 5 6 13-2 8-8 16 1 8-9 16-1 8 8 13 2 1 9-7 9-12 5-22-5-10 10-22 5Z" fill="var(--scene-pop,#f3ba5c)"/><path d="M100 102h28m-32 6h36"/></>; break;
    case 'CAT_RAINBOW': props = <><path d="M85 89v-9a29 29 0 0 1 58 0v9M94 89v-9a20 20 0 0 1 40 0v9M104 89v-9a10 10 0 0 1 20 0v9"/><path d="M82 89q-14-10-19 2-15-1-11 10h35m40-12q14-10 19 2 15-1 11 10h-31M37 83l11 13 11-13"/></>; break;
    case 'CAT_POTATO': props = <><path d="M106 45q-27 1-26 40-1 33 29 28 31 4 33-27 2-29-19-33-4-9-17-8Z" fill="var(--fur-shadow,#ad7155)"/><path d="m97 65 3 2m20-3 3 2m-24 33 3 2m24-9 3 2M107 81v3m13-3v3m-12 12h10"/><path d="M39 34h21l-3-9H42Z"/></>; break;
    case 'CAT_CATERMELON': props = <><path d="M80 69h66q-4 49-33 49T80 69Z" fill="var(--scene-pop,#f3ba5c)"/><path d="M89 75q5 31 24 35 19-4 24-35m-34 2 2 5m10 6v5m10-16-2 5M37 33l9-7 11 7"/></>; break;
    case 'AMATEUR_ARCHAEOLOGY': props = <><path d="M98 28h27v11H98Zm14 11v51l-12 1v18q14 17 26 0V90h-14M78 117h67"/><path d="m81 114 6-16 11 7-2 9m28 3 3-14 9 5 2 9M33 33h30l-6-13H39Z"/><circle cx="91" cy="105" r="3"/></>; break;
    case 'BATTLE_HAMSTER': props = <><circle cx="97" cy="55" r="9"/><circle cx="131" cy="55" r="9"/><ellipse cx="114" cy="82" rx="29" ry="28" fill="var(--scene-pop,#f3ba5c)"/><path d="m99 70 7 5m17 0 7-5M110 89h8v7h-8Zm-14 12-6 13m39-13 5 13M108 61l6-8 6 8"/></>; break;
    case 'CREEPY_PEEKY': props = <><circle cx="111" cy="70" r="21"/><circle cx="111" cy="70" r="16" fill="#fff0ce"/><path d="m126 86 20 22M94 70q17-15 34 0-17 15-34 0Z"/><circle cx="111" cy="70" r="4"/>{card(85, 109, -12)}{card(110, 109, 12)}</>; break;
    case 'HIP_BAT': props = <><path d="m78 66 20 4 9-14 9 14 27-6-9 21-12-3-10 13-10-13-10 3Z" fill="var(--fur-shadow,#ad7155)"/><path d="m105 72 3 4m8-4-3 4M88 112v9m21-9v9m21-9v9"/><path d="M38 28 46 17l9 12"/></>; break;
    case 'HIP_CAT': props = <><circle cx="92" cy="57" r="11"/><path d="M110 82h23v25h-23Zm4 0V69m7 13V65m7 17V70M87 113l16 16m0-16-16 16"/><path d="m85 22 16 8m24 0 16-8"/></>; break;
    case 'PLUS_PLUS': props = <><path d="M91 51h42v41H91Z" fill="var(--scene-pop,#f3ba5c)"/><path d="M94 71h13m-6-7v14m17-7h13m-6-7v14M85 111h54m-12-8 12 8-12 8M37 90l8-7 10 7"/></>; break;
    case 'ROBIN_HOOD': props = <><path d="M104 28q40 41 0 82M104 28v82M82 69h62m-12-8 12 8-12 8M33 30l12-19 25 19Z" fill="var(--scene-pop,#f3ba5c)"/><path d="M48 19 56 6m0 0 11 3-9 9"/>{card(81, 116, -18)}{card(112, 114, 18)}</>; break;
    case 'THE_TWINS': props = <><path d="m92 57-2-17 13 9 14-9-1 17q10 25-12 29-25-2-12-29Zm28 31-2-17 13 9 14-9-1 17q10 25-12 29-25-2-12-29Z" fill="var(--scene-pop,#f3ba5c)"/><path d="M98 63v3m13-3v3m13 28v3m13-3v3M91 111h16m-16 6h16"/></>; break;
    case 'RESURRECTION': props = <><ellipse cx="48" cy="13" rx="23" ry="6"/><path d="M104 103V45m-14 11 14-11 14 11M24 82Q0 53 9 47q17-5 22 27m32 7q25-30 20-35-17-4-25 29M85 115h40m-36 6h32"/><path d="m132 28 3-7 3 7 7 3-7 3-3 7-3-7-7-3Z" fill="var(--scene-pop,#f3ba5c)"/></>; break;
  }
  return <svg viewBox="0 0 200 168" className={`cat-art-svg scene-art scene-${style}`} aria-hidden="true" role="presentation" shapeRendering={style === 'pixel' ? 'crispEdges' : undefined}>
    <path d={style === 'pixel' ? 'M4 18h12V9h168v9h12v135h-12v8H16v-8H4Z' : style === 'geometry' ? 'M5 26 23 6l167 10 5 128-18 18L6 150Z' : 'M5 23Q34 9 71 12L189 8l5 34-3 112-25 7-154-5L5 121Z'} fill="var(--scene-bg,#d77158)"/>
    <path d={style === 'pixel' ? 'M12 118h176v24H12Z' : 'M7 125q50-16 93 2 51-23 89-9l1 29-21 6-155-4Z'} fill="var(--scene-ground,#b86247)" opacity=".42"/>
    <g fill="#fff0ce" opacity=".4"><circle cx="25" cy="31" r="2"/><circle cx="178" cy="35" r="3"/><circle cx="102" cy="132" r="2"/><path d="m109 18 3-4 5 3-3 4Z"/><path d="m16 91 5-2 2 5-5 2Z"/></g>
    <g fill="none" stroke={ink} strokeWidth={style === 'stamp' ? 3.5 : style === 'pixel' ? 3 : 2.2} strokeLinecap={style === 'pixel' ? 'square' : 'round'} strokeLinejoin={style === 'pixel' ? 'miter' : 'round'}>
      <ellipse cx="59" cy="151" rx="43" ry="5" fill={ink} stroke="none" opacity=".16"/>
      <g transform={style === 'stamp' ? 'translate(-8 5) rotate(-3 64 85)' : 'translate(-8 5)'}>{cat}</g>
      <g transform="translate(16 9) scale(1.15)">{props}</g>
      {style === 'pen' && <path d="m12 154 12-3m5 4 11-3m114 5 13-3m5 2 11-4" strokeWidth="1" opacity=".55"/>}
      {style === 'stamp' && <path d="M9 18v14m180 105v13M14 158h24" stroke="#fff0ce" opacity=".65"/>}
    </g>
  </svg>;
}
