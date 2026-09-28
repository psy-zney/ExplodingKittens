const palettes = [
  ['#dfad73', '#483c60'], ['#f4c1a0', '#34576a'],
  ['#e4c98b', '#456555'], ['#bec7dd', '#75474d'],
  ['#e6b0a7', '#485a80'], ['#c4d5b4', '#625242'],
];

export function PlayerPortrait({ id, alive }: { id: string; alive: boolean }) {
  const seed = [...id].reduce((value, character) => value + character.charCodeAt(0), 0);
  const [fur, background] = palettes[seed % palettes.length]!;
  return <svg className="player-portrait" viewBox="0 0 64 64" aria-hidden="true">
    <circle cx="32" cy="32" r="32" fill={background}/>
    <path d="M14 30 12 11 27 21Q32 19 37 21L52 11 50 32Q54 51 32 54 11 52 14 30Z" fill={fur} stroke="#27252e" strokeWidth="2" strokeLinejoin="round"/>
    <path d="m16 17 8 6-8 5m32-11-8 6 8 5" fill="#ca857f"/>
    <path d="M24 44Q32 36 40 44L43 49Q32 56 21 49Z" fill="#fff2dc"/>
    {alive ? <><ellipse cx="24" cy="34" rx="2.2" ry="3.1" fill="#292733"/><ellipse cx="40" cy="34" rx="2.2" ry="3.1" fill="#292733"/></> : <path d="m21 31 6 6m0-6-6 6m16-6 6 6m0-6-6 6" stroke="#292733" strokeWidth="2"/>}
    <path d="m29 41 3 3 3-3Z" fill="#885054"/>
    <path d="M32 44v3m-5 0q2 3 5 0 3 3 5 0M11 39l9 2m-9 4 9-1m24-3 9-2m-9 5 9 1" fill="none" stroke="#44333b" strokeWidth="1.5" strokeLinecap="round"/>
    {seed % 2 === 0 && <path d="m30 21 2 7 2-7m-14 5 4 2m20-2-4 2" fill="none" stroke="#966744" strokeWidth="2" strokeLinecap="round"/>}
  </svg>;
}
