import type { CardType } from '../types';
import { CardScene } from './CardScene';
import { CatActor } from './CatActor';

export default function PenCat({ type, variant=0 }: { type: CardType; variant?:number }) {
  return <CardScene type={type} style="pen" cat={<CatActor type={type} style="pen" variant={variant}/>}/>;
}
