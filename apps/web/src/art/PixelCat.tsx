import type { CardType } from '../types';
import { CardScene } from './CardScene';
import { CatActor } from './CatActor';

export default function PixelCat({ type, variant=0 }: { type: CardType; variant?:number }) {
  return <CardScene type={type} style="pixel" cat={<CatActor type={type} style="pixel" variant={variant}/>}/>;
}
