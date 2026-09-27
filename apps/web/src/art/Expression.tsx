export function Expression({boom,variant}:{boom:boolean;variant:number}) {
 const mood=variant%(boom?4:6),ink='var(--scene-ink,#482b28)';
 const wide=<><ellipse cx="45" cy="53" rx="8" ry="11" fill="#fff9e8"/><ellipse cx="81" cy="53" rx="8" ry="11" fill="#fff9e8"/><circle cx={mood===2?48:44} cy="55" r="3" fill={ink}/><circle cx={mood===2?78:82} cy="51" r="3" fill={ink}/></>;
 return <g className="cat-expression" data-mood={`${boom?'boom':'defuse'}-${mood}`}>
 {boom?<>
 {mood===0&&<>{wide}<ellipse cx="63" cy="77" rx="7" ry="9" fill="#ad4854"/><path d="m32 36 17-3m28 0 15 3"/><path d="m110 43 4 10q0 9-7 7-6-2-2-8Z" fill="#71b8cb" stroke="none"/></>}
 {mood===1&&<><path d="m35 47 8 10 9-10m22 0 8 10 9-10"/><path d="M43 73q20 26 40 0Z" fill="#ad4854"/><path d="M50 75h27v7H50Z" fill="#fff7dd"/><path d="m11 33-5-9m102 1 7-9"/></>}
 {mood===2&&<>{wide}<path d="M51 76h24"/><path d="M63 77v9q8 6 10-3v-6" fill="#ed8498"/><path d="m31 34 9 4m42-4 11-3"/></>}
 {mood===3&&<><path d="m34 43 19 9m20 0 20-9" strokeWidth="4"/><circle cx="45" cy="56" r="4" fill={ink}/><circle cx="81" cy="56" r="4" fill={ink}/><path d="M47 80q15-18 32 0"/><path d="m106 27 8-6m-7 11 9 4m-14-14 2-9" stroke="#ba483c"/></>}
 </>:<>
 {mood===0&&<><path d="m35 55 9-5 9 5"/><ellipse cx="81" cy="54" rx="4" ry="6" fill={ink}/><path d="M51 73q12 18 24-1"/><path d="m105 40 5-6 5 6-5 6Z" fill="#e99b4f" stroke="none"/></>}
 {mood===1&&<><path d="M29 45h29v17H32Zm39 0h29l-3 17H68ZM58 49h10" fill={ink}/><path d="m34 48 13 11m27-11 13 11" stroke="#f9dc91" strokeWidth="2"/><path d="m53 76 10 5 12-7"/></>}
 {mood===2&&<><path d="M45 61 34 49q-3-12 10-5 14-8 13 5Zm36 0L70 49q-3-12 10-5 14-8 13 5Z" fill="#d86c79" stroke="none"/><path d="M51 73q12 17 24 0"/><path d="M33 68h8m45 0h8" stroke="#e5a17f" strokeWidth="4"/></>}
 {mood===3&&<><path d="m33 56 12-8 10 8m16 0 10-8 12 8"/><path d="M45 71q18 27 36 0Z" fill="#98545e"/><path d="M49 73h28v7H49Z" fill="#fff7dd"/></>}
 {mood===4&&<><path d="M34 52h22m14 0h23M36 56h17m21 0h16"/><path d="m53 77 10-2 10 2"/><path d="m105 44 4 8q0 8-6 5-4-3 2-13Z" fill="#75b7cc" stroke="none"/></>}
 {mood===5&&<><circle cx="45" cy="54" r="4" fill={ink}/><path d="m71 52 11 6 10-6"/><path d="M51 74h25M62 75v10q8 7 11-3v-7" fill="#e98e9e"/></>}
 </>}
 <path d="m58 64 5 5 5-5Z" fill="#e99784" stroke="none"/>
 </g>;
}
