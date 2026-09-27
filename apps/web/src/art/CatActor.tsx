import type { ArtStyle, CardType } from '../types';

// Original characters: the pose and expression respond to the card's story.
export function CatActor({ type, style }: { type: CardType; style: ArtStyle }) {
  const running = ['ATTACK', 'SKIP', 'ROBIN_HOOD'].includes(type);
  const floating = ['CAT_RAINBOW', 'RESURRECTION', 'HIP_BAT'].includes(type);
  const startled = type === 'EXPLODING_KITTEN' || type === 'CREEPY_PEEKY';
  const stern = type === 'ATTACK' || type === 'NOPE' || type === 'BATTLE_HAMSTER';
  const sleepy = type === 'DEFUSE' || type === 'CAT_POTATO';
  const fur = 'var(--fur, #fff0d2)';
  const dark = 'var(--scene-ink, #482b28)';
  const pink = '#e99784';
  if (style === 'pixel') {
    return <g className="scene-character pixel-character" transform={running ? 'rotate(-12 58 92)' : undefined}>
      <path d="M28 29V13h16v8h8v8h24v-8h8V13h16v16h8v40h-8v16H84v8H44v-8H28V69h-8V29Z" fill={fur}/>
      <path d="M36 87h52v32H76v16h16v12H68v-20H56v20H28v-12h16v-16h-8Z" fill="var(--fur-shadow,#efb374)"/>
      <path d={running ? 'M34 96H18v-8H8m78 15h20v-16h10M34 137H17m58-11h19v9' : 'M32 96H16v16h12m62-15h18v-8h10v16h-10M48 96v16h28V96'} fill="none"/>
      <path d="M33 26v13h11V26m43 0v13h11V26" stroke={pink} strokeWidth="6"/>
      <path d="M39 49h10v10H39Zm40 0h10v10H79Z" fill={dark} stroke="none"/>
      <path d="M58 66h12v6H58Z" fill={pink} stroke="none"/><path d={stern ? 'M51 45h-16m44 0h16M53 79h22' : 'M54 78v5h20v-5'} stroke={dark}/>
      <path d="M30 66H12m90 0h18M44 119h36"/><path d="M47 88h10v8H47Zm16 7h10v8H63Z" fill="var(--scene-pop,#db6744)" stroke="none"/>
    </g>;
  }
  if (style === 'geometry') {
    return <g className="scene-character geometry-character" transform={floating ? 'rotate(8 62 84)' : undefined}>
      <path d="M29 141 62 79l33 62H75l-13-17-13 17Z" fill="var(--fur-shadow,#e9a663)"/>
      <path d="m25 44 2-29 27 23m27 0 26-23-1 31" fill={fur}/>
      <ellipse cx="66" cy="58" rx="40" ry="33" fill={fur}/>
      <path d="m31 23 6 16 12-2m51-14-6 16-11-2" fill={pink} stroke="none"/>
      <path d="M26 96 49 112l13-10m25-9-9 19-14-10M93 116q29 12 25-12" fill="none"/>
      <circle cx="50" cy="54" r={startled ? 7 : 4} fill={startled ? '#fff9e9' : dark}/><circle cx="82" cy="54" r={startled ? 7 : 4} fill={startled ? '#fff9e9' : dark}/>
      {startled && <><circle cx="50" cy="54" r="2" fill={dark}/><circle cx="82" cy="54" r="2" fill={dark}/></>}
      <path d="m61 64 5 5 5-5Z" fill={pink}/><path d={stern ? 'm46 44 10 5m20 0 10-5M57 76h18' : 'm57 75 9 6 9-6'}/>
      <path d="M31 66 15 61m17 13-16 2m86-10 16-5m-17 13 17 2"/><path d="m55 95 11-10 11 10-11 10Z" fill="var(--scene-pop,#d96843)" stroke="none"/>
    </g>;
  }
  return <g className={`scene-character ${style}-character`} transform={running ? 'rotate(-10 63 90)' : floating ? 'rotate(9 63 90)' : undefined}>
    <path d={running ? 'M42 80Q26 103 44 117l-19 15 10 14 28-25 18 24 19-9-23-24q13-17 3-33Z' : 'M40 79q-18 26-6 50l-10 16h29l10-14 10 14h28l-10-17q9-29-10-48Z'} fill="var(--fur-shadow,#f2be87)"/>
    <path d="m25 43-3-28 27 15q14-6 28 0l27-15-3 29q16 28-8 40-35 16-63-3-18-11-5-38Z" fill={fur}/>
    <path d="m29 25 3 15 12-5m52-10-3 15-12-5" fill={pink} stroke="none"/>
    <path d={running ? 'M37 93 20 87 9 100m72-8 18-14 12 3M90 125q26 5 19-15' : type === 'NOPE' ? 'M41 96 33 106m47-10 21-22 8 5-7 28M91 126q27 3 21-16' : 'M39 93q9 18 21 16m22-15q-7 17-21 15M89 124q28 7 23-15'} fill="none"/>
    {startled ? <><ellipse cx="45" cy="53" rx="9" ry="12" fill="#fff8e9"/><ellipse cx="81" cy="53" rx="9" ry="12" fill="#fff8e9"/><circle cx="45" cy="54" r="2" fill={dark}/><circle cx="81" cy="54" r="2" fill={dark}/></> : sleepy ? <path d="M36 54h16m20 0h17M37 50l13 1m24-1 13 1"/> : <><ellipse cx="45" cy="54" rx="4" ry="6" fill={dark} stroke="none"/><ellipse cx="81" cy="54" rx="4" ry="6" fill={dark} stroke="none"/></>}
    {stern && <path d="m34 42 17 6m23 0 17-6" strokeWidth="4"/>}
    <path d="m58 64 5 5 5-5Z" fill={pink} stroke="none"/>
    <path d={startled ? 'M59 75q4-6 8 0v7h-8Z' : stern ? 'M52 75h23l-5 11H57Z' : 'M51 73q6 11 12 1 7 10 13-1'} fill={stern ? pink : 'none'}/>
    <path d="m28 60-17-6m17 16-18 4m90-14 16-6m-17 16 17 4M36 132l12 1m32-1h12"/>
    <path d="m55 89 8 6 8-6M42 104l-4 11m47-8 5 9" stroke="var(--scene-pop,#da734c)" strokeWidth="5"/>
    {style === 'pen' && <path d="m31 43-1 9m9 30 9 3m-9 29-2 7m35-1 8 1m4-86-3 7" strokeWidth="1" opacity=".6"/>}
    {style === 'stamp' && <path d="M26 45v16m70 15-9 7m-47 51 7-1" stroke="#fff3dc" strokeWidth="2"/>}
    {type === 'CAT_BEARD' && <path d="M36 70q13-9 27 2 13-11 27-2l-9 22-8-6-10 16-11-16-8 6Z" fill="#835444"/>}
    {type === 'SEE_THE_FUTURE' && <path d="M20 40q9-32 44-33 33 1 43 34L80 29 63 34 45 28Z" fill="var(--scene-pop,#f6c566)"/>}
    {type === 'ROBIN_HOOD' && <><path d="m22 33 21-22 25 7 35 18Z" fill="#5b8a68"/><path d="m73 25 9-22 9 4-14 21Z" fill="#d76f51"/></>}
    {type === 'HIP_CAT' && <path d="M24 34q12-23 37-20 29 0 34 24H61l-9 6H25Z" fill="var(--scene-pop,#e4a158)"/>}
  </g>;
}
