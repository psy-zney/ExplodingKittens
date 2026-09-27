import type { CardType } from '../types';
import { CardScene } from './CardScene';
import { CatActor } from './CatActor';

export default function StampCat({ type, variant=0 }: { type: CardType; variant?:number }) {
  return <CardScene type={type} style="stamp" cat={<CatActor type={type} style="stamp" variant={variant}/>}/>;
}
