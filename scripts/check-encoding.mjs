import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
const decoder=new TextDecoder('utf-8',{fatal:true});
const skipped=new Set(['node_modules','dist','.git','.vercel','playwright-report','test-results']);
let checked=0;
async function walk(dir){
  for(const entry of await readdir(dir,{withFileTypes:true})){
    const file=path.join(dir,entry.name);
    if(entry.isDirectory()){if(!skipped.has(entry.name))await walk(file);continue;}
    if(!/\.(?:ts|tsx|js|mjs|json|md|css|html|yaml|yml|sh|py)$/.test(file)||file.endsWith('package-lock.json'))continue;
    const value=decoder.decode(await readFile(file));
    if(value.includes('\uFFFD')||/[ÃÂ][\u0080-\u00BF]|á[»º]/u.test(value))throw new Error(`Invalid or mojibake text: ${file}`);
    checked++;
  }
}
await walk('apps');await walk('packages');await walk('deploy');await walk('docs');
for(const file of ['README.md','AGY_HANDOFF.md'])decoder.decode(await readFile(file));
console.log(`UTF-8 checked: ${checked+2} source/document files; no replacement characters or mojibake.`);
